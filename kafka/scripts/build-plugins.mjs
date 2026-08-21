#!/usr/bin/env node
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const plugins = ["github-operations", "evidence-check"];
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

for (const plugin of plugins) {
  const dir = join(root, "kafka", "plugins", plugin);
  const dist = join(dir, "dist");
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  const result = spawnSync(
    pnpm,
    [
      "exec",
      "esbuild",
      join(dir, "index.ts"),
      "--bundle",
      "--platform=node",
      "--format=esm",
      "--target=es2022",
      "--packages=external",
      `--outfile=${join(dist, "index.js")}`,
      "--sourcemap",
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`esbuild failed for ${plugin} (${result.status}): ${result.stderr || result.stdout}`);
  }
  console.log(`[built] ${plugin}`);
}
