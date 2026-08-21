#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const jobs = JSON.parse(readFileSync(join(root, "kafka/automations/jobs.json"), "utf8"));
const expectedAgents = ["finance", "research-data", "vr-3d", "games", "agent-web"];
const names = new Set();
const minutes = new Set();

if (jobs.schemaVersion !== 1 || jobs.timezone !== "Asia/Tokyo") throw new Error("unsupported jobs manifest");
if (!Array.isArray(jobs.jobs) || jobs.jobs.length !== expectedAgents.length) throw new Error("expected five jobs");

for (const job of jobs.jobs) {
  if (!expectedAgents.includes(job.agent)) throw new Error(`unexpected agent ${job.agent}`);
  if (names.has(job.name)) throw new Error(`duplicate job name ${job.name}`);
  names.add(job.name);
  const match = /^(\d{1,2}) \* \* \* \*$/.exec(job.cron);
  if (!match) throw new Error(`job ${job.name} must be an hourly cron with a fixed minute`);
  const minute = Number(match[1]);
  if (minute < 0 || minute > 59 || minutes.has(minute)) throw new Error(`invalid/duplicate minute ${minute}`);
  minutes.add(minute);
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
  if (!existsSync(join(dir, "index.ts")) || !existsSync(join(dir, "tsconfig.json"))) throw new Error(`${plugin}: source/config missing`);
}

console.log(`KAFKA customization valid: ${jobs.jobs.length} agents/jobs, ${minutes.size} unique hourly offsets, 2 plugins.`);
