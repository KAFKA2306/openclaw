#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(readFileSync(join(root, "kafka/automations/jobs.json"), "utf8"));

if (manifest.schemaVersion !== 2 || manifest.timezone !== "Asia/Tokyo") {
  throw new Error("unsupported KAFKA automation manifest");
}
if (!Array.isArray(manifest.agents) || manifest.agents.length !== 1) {
  throw new Error("expected exactly one canonical KAFKA agent");
}
if (manifest.agents[0] !== "local-worker") {
  throw new Error("canonical KAFKA agent must be local-worker");
}
if (!Array.isArray(manifest.jobs) || manifest.jobs.length !== 0) {
  throw new Error("canonical KAFKA manifest must schedule zero model-backed jobs by default");
}
if (!existsSync(join(root, "kafka", "agents", "local-worker", "AGENTS.md"))) {
  throw new Error("missing local-worker/AGENTS.md");
}

for (const plugin of ["github-operations", "evidence-check"]) {
  const dir = join(root, "kafka", "plugins", plugin);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const pluginManifest = JSON.parse(readFileSync(join(dir, "openclaw.plugin.json"), "utf8"));
  if (pkg.type !== "module") {
    throw new Error(`${plugin}: package must be ESM`);
  }
  if (pluginManifest.id !== `kafka-${plugin}`) {
    throw new Error(`${plugin}: manifest id mismatch`);
  }
  if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) {
    throw new Error(`${plugin}: package must include dist`);
  }
  if (!existsSync(join(dir, "index.ts")) || !existsSync(join(dir, "tsconfig.json"))) {
    throw new Error(`${plugin}: source/config missing`);
  }
  if (process.env.CI && !existsSync(join(dir, "dist", "index.js"))) {
    throw new Error(`${plugin}: CI must build dist/index.js before validation`);
  }
}

for (const script of [
  "bootstrap.mjs",
  "build-plugins.mjs",
  "export-runtime-state.mjs",
  "install-plugins.mjs",
]) {
  if (!existsSync(join(root, "kafka", "scripts", script))) {
    throw new Error(`missing ${script}`);
  }
}

const bootstrap = readFileSync(join(root, "kafka/scripts/bootstrap.mjs"), "utf8");
for (const required of [
  '"agents", "add"',
  '"automations", "remove"',
  "--retire-legacy-hourly",
  "multiple legacy automations",
]) {
  if (!bootstrap.includes(required)) {
    throw new Error(`bootstrap contract missing ${required}`);
  }
}

const githubOperations = readFileSync(
  join(root, "kafka/plugins/github-operations/index.ts"),
  "utf8",
);
if (githubOperations.includes("kafka_github_create_issue")) {
  throw new Error("local-worker GitHub plugin must not expose autonomous issue creation");
}
if (!githubOperations.includes("kafka_github_create_pull_request")) {
  throw new Error("local-worker GitHub plugin must retain approval-gated PR creation");
}

const evidenceCheck = readFileSync(join(root, "kafka/plugins/evidence-check/index.ts"), "utf8");
if (!evidenceCheck.includes('["local-worker"]')) {
  throw new Error("evidence-check must target local-worker by default");
}

const configExample = readFileSync(join(root, "kafka/config/openclaw.example.json5"), "utf8");
if (
  !configExample.includes('"local-worker"') ||
  !configExample.includes("kafka-evidence-check") ||
  !configExample.includes("allowConversationAccess: true")
) {
  throw new Error("config example must contain the canonical worker and evidence permission");
}

const installer = readFileSync(join(root, "kafka/scripts/install-plugins.mjs"), "utf8");
if (!installer.includes("plugins.entries.kafka-evidence-check.hooks.allowConversationAccess")) {
  throw new Error(
    "plugin installer must activate the evidence hook conversation-access permission",
  );
}

console.log(
  "KAFKA customization valid: 1 explicit local worker, 0 scheduled model jobs, 2 plugins, legacy-hourly retirement path present.",
);
