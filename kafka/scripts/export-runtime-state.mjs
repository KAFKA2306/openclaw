#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function capture(args) {
  const result = spawnSync("openclaw", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function captureWithFallback(primary, fallback) {
  const first = capture(primary);
  return first.ok || !fallback ? first : capture(fallback);
}

function jsonOrRaw(result) {
  if (!result.ok) {
    return { ok: false, error: (result.stderr || result.stdout).trim() };
  }
  try {
    return { ok: true, data: JSON.parse(result.stdout) };
  } catch {
    return { ok: true, raw: result.stdout.trim() };
  }
}

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: "openclaw-local-runtime",
  agents: jsonOrRaw(
    captureWithFallback(["agents", "list", "--json"], ["agents", "list"]),
  ),
  automations: jsonOrRaw(
    captureWithFallback(
      ["automations", "list", "--all", "--json"],
      ["automations", "list", "--all"],
    ),
  ),
  dashboard: jsonOrRaw(capture(["dashboard", "--json"])),
};

const outIndex = process.argv.indexOf("--out");
const rendered = `${JSON.stringify(snapshot, null, 2)}\n`;
if (outIndex >= 0) {
  const out = process.argv[outIndex + 1];
  if (!out) {
    throw new Error("--out requires a path");
  }
  writeFileSync(out, rendered, { encoding: "utf8", mode: 0o600 });
  console.error(`Wrote ${out}`);
} else {
  process.stdout.write(rendered);
}
