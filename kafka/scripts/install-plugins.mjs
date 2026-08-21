#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const apply = process.argv.includes("--apply");
const plugins = ["github-operations", "evidence-check"];

function exec(command, args, cwd = root) {
  console.log(`${apply ? ">" : "[dry-run]"} ${command} ${args.join(" ")}`);
  if (!apply) return { stdout: "" };
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result;
}

for (const plugin of plugins) {
  const dir = join(root, "kafka", "plugins", plugin);
  const out = mkdtempSync(join(tmpdir(), `openclaw-${plugin}-`));
  try {
    exec("pnpm", ["exec", "tsc", "-p", join(dir, "tsconfig.json")]);
    const packed = exec("npm", ["pack", "--pack-destination", out], dir);
    if (apply) {
      const tgz = packed.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
      if (!tgz) throw new Error(`npm pack did not return an archive for ${plugin}`);
      exec("openclaw", ["plugins", "install", `npm-pack:${join(out, basename(tgz))}`, "--force"]);
    }
  } finally {
    if (apply) rmSync(out, { recursive: true, force: true });
  }
}

console.log(apply ? "KAFKA plugins installed. Restart the Gateway." : "Dry run complete. Re-run with --apply to build and install plugins.");
