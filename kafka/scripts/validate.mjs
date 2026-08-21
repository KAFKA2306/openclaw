#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobs = JSON.parse(readFileSync(join(root, "kafka/automations/jobs.json"), "utf8"));
const expectedSchedule = new Map([
  ["finance", 0],
  ["vr-3d", 12],
  ["games", 24],
  ["research-data", 36],
  ["agent-web", 48],
]);
const names = new Set();
const minutes = new Set();

if (jobs.schemaVersion !== 1 || jobs.timezone !== "Asia/Tokyo") throw new Error("unsupported jobs manifest");
if (!Array.isArray(jobs.jobs) || jobs.jobs.length !== expectedSchedule.size) throw new Error("expected five jobs");

for (const job of jobs.jobs) {
  if (!expectedSchedule.has(job.agent)) throw new Error(`unexpected agent ${job.agent}`);
  if (names.has(job.name)) throw new Error(`duplicate job name ${job.name}`);
  names.add(job.name);
  const match = /^(\d{1,2}) \* \* \* \*$/.exec(job.cron);
  if (!match) throw new Error(`job ${job.name} must be an hourly cron with a fixed minute`);
  const minute = Number(match[1]);
  if (minute < 0 || minute > 59 || minutes.has(minute)) throw new Error(`invalid/duplicate minute ${minute}`);
  minutes.add(minute);
  const expectedMinute = expectedSchedule.get(job.agent);
  if (minute !== expectedMinute) throw new Error(`job ${job.name} must run at minute ${expectedMinute}, got ${minute}`);
  if (typeof job.message !== "string" || job.message.length < 80) throw new Error(`job ${job.name} has an underspecified prompt`);
  for (const file of ["AGENTS.md", "CLAUDE.md"]) {
    if (!existsSync(join(root, "kafka", "agents", job.agent, file))) throw new Error(`missing ${job.agent}/${file}`);
  }
}

for (const plugin of ["github-operations", "evidence-check"]) {
  const dir = join(root, "kafka", "plugins", plugin);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(join(dir, "openclaw.plugin.json"), "utf8"));
  if (pkg.type !== "module") throw new Error(`${plugin}: package must be ESM`);
  if (manifest.id !== `kafka-${plugin}`) throw new Error(`${plugin}: manifest id mismatch`);
  if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) throw new Error(`${plugin}: package must include dist`);
  if (!existsSync(join(dir, "index.ts")) || !existsSync(join(dir, "tsconfig.json"))) throw new Error(`${plugin}: source/config missing`);
  if (process.env.CI && !existsSync(join(dir, "dist", "index.js"))) throw new Error(`${plugin}: CI must build dist/index.js before validation`);
}

if (!existsSync(join(root, "kafka", "scripts", "build-plugins.mjs"))) throw new Error("missing plugin build script");

const bootstrap = readFileSync(join(root, "kafka/scripts/bootstrap.mjs"), "utf8");
const usesAutomationMutation = bootstrap.includes('"automations", "add"') || bootstrap.includes('"automations", "create"');
if (!usesAutomationMutation) throw new Error("bootstrap must use `openclaw automations add` or its supported `create` alias");
for (const required of ['"--session", "isolated"', '"--agent", job.agent', '"--exact"']) {
  if (!bootstrap.includes(required)) throw new Error(`bootstrap automation contract missing ${required}`);
}

const configExample = readFileSync(join(root, "kafka/config/openclaw.example.json5"), "utf8");
if (!configExample.includes("kafka-evidence-check") || !configExample.includes("allowConversationAccess: true")) {
  throw new Error("config example must explicitly grant conversation access to kafka-evidence-check");
}

const installer = readFileSync(join(root, "kafka/scripts/install-plugins.mjs"), "utf8");
if (!installer.includes("plugins.entries.kafka-evidence-check.hooks.allowConversationAccess")) {
  throw new Error("plugin installer must activate the non-bundled evidence hook conversation-access permission");
}

console.log(`KAFKA customization valid: ${jobs.jobs.length} agents/jobs, exact JST offsets, 2 plugins, runtime policy config present.`);
