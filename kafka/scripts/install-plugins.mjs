#!/usr/bin/env node
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result;
}

if (apply) {
  exec(process.execPath, [join(root, "kafka", "scripts", "build-plugins.mjs")]);
} else {
  console.log("[dry-run] build kafka plugins with repository-pinned esbuild");
}

for (const plugin of plugins) {
  const dir = join(root, "kafka", "plugins", plugin);
  const entry = join(dir, "dist", "index.js");
  if (apply && !existsSync(entry)) throw new Error(`missing built plugin entry: ${entry}`);
  const out = mkdtempSync(join(tmpdir(), `openclaw-${plugin}-`));
  try {
    const packed = exec("npm", ["pack", "--pack-destination", out], dir);
    if (apply) {
      const tgz = packed.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
      if (!tgz) throw new Error(`npm pack did not return an archive for ${plugin}`);
      exec("openclaw", ["plugins", "install", `npm-pack:${join(out, basename(tgz))}`, "--force"]);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

// Non-bundled plugins that inspect natural conversation output must receive an
// explicit operator-owned permission. Keep activation granular so existing
// unrelated plugin entries are not replaced.
exec("openclaw", ["config", "set", "plugins.entries.kafka-github-operations.enabled", "true", "--strict-json"]);
exec("openclaw", ["config", "set", "plugins.entries.kafka-evidence-check.enabled", "true", "--strict-json"]);
exec("openclaw", ["config", "set", "plugins.entries.kafka-evidence-check.hooks.allowConversationAccess", "true", "--strict-json"]);
if (apply) exec("openclaw", ["config", "validate"]);

console.log(apply ? "KAFKA plugins installed and policy config validated. Restart the Gateway." : "Dry run complete. Re-run with --apply to build, install, and configure plugins.");
