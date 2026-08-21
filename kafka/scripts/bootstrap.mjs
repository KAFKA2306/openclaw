#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const apply = process.argv.includes("--apply");
const retireLegacyHourly = process.argv.includes("--retire-legacy-hourly");
const manifest = JSON.parse(readFileSync(join(root, "kafka/automations/jobs.json"), "utf8"));
const agents = manifest.agents ?? [];
const jobs = manifest.jobs ?? [];
const legacyHourlyNames = [
  "kafka-finance-hourly",
  "kafka-vr-3d-hourly",
  "kafka-games-hourly",
  "kafka-research-data-hourly",
  "kafka-agent-web-hourly",
];

function run(args, { allowFailure = false } = {}) {
  if (!apply) {
    console.log(`[dry-run] openclaw ${args.map((value) => JSON.stringify(value)).join(" ")}`);
    return { status: 0, stdout: "", stderr: "" };
  }
  const result = spawnSync("openclaw", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `openclaw ${args[0]} failed (${result.status}): ${result.stderr || result.stdout}`,
    );
  }
  return result;
}

function workspaceFor(agent) {
  return join(homedir(), ".openclaw", `workspace-${agent}`);
}

function extractNames(text) {
  try {
    const queue = [JSON.parse(text)];
    const names = new Set();
    while (queue.length > 0) {
      const value = queue.pop();
      if (Array.isArray(value)) {
        queue.push(...value);
      } else if (value && typeof value === "object") {
        for (const key of ["id", "name", "agentId"]) {
          if (typeof value[key] === "string") {
            names.add(value[key]);
          }
        }
        queue.push(...Object.values(value));
      }
    }
    return names;
  } catch {
    return new Set();
  }
}

function automationRecords(text) {
  const queue = [JSON.parse(text)];
  const records = [];
  while (queue.length > 0) {
    const value = queue.pop();
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    if (!value || typeof value !== "object") {
      continue;
    }
    if (
      typeof value.name === "string" &&
      (typeof value.id === "string" || typeof value.id === "number")
    ) {
      records.push({ id: String(value.id), name: value.name });
    }
    queue.push(...Object.values(value));
  }
  return records;
}

const agentList = run(["agents", "list", "--json"], { allowFailure: true });
const existingAgents = extractNames(agentList.stdout || "");

for (const agent of agents) {
  const workspace = workspaceFor(agent);
  if (!existingAgents.has(agent)) {
    run(["agents", "add", agent, "--workspace", workspace, "--non-interactive"]);
  } else {
    console.log(`[ok] agent exists: ${agent}`);
  }
  if (apply) {
    mkdirSync(workspace, { recursive: true });
    const template = join(root, "kafka", "agents", agent, "AGENTS.md");
    if (existsSync(template)) {
      copyFileSync(template, join(workspace, "AGENTS.md"));
      copyFileSync(template, join(workspace, "CLAUDE.md"));
    }
  }
}

const automationList = run(["automations", "list", "--all", "--json"], {
  allowFailure: true,
});
const fallbackList =
  automationList.status === 0
    ? automationList
    : run(["automations", "list", "--all"], { allowFailure: true });
const listed = `${fallbackList.stdout || ""}\n${fallbackList.stderr || ""}`;
const automationNames = extractNames(fallbackList.stdout || "");

for (const job of jobs) {
  if (automationNames.has(job.name) || listed.includes(job.name)) {
    console.log(`[ok] automation exists: ${job.name}`);
    continue;
  }
  run([
    "automations",
    "create",
    job.cron,
    job.message,
    "--name",
    job.name,
    "--tz",
    manifest.timezone,
    "--session",
    "isolated",
    "--agent",
    job.agent,
    "--no-deliver",
    "--exact",
  ]);
}

if (retireLegacyHourly) {
  if (!apply) {
    for (const name of legacyHourlyNames) {
      console.log(`[dry-run] retire legacy automation by exact name: ${name}`);
    }
  } else {
    if (automationList.status !== 0) {
      throw new Error(
        "--retire-legacy-hourly requires `openclaw automations list --all --json` to succeed",
      );
    }
    const records = automationRecords(automationList.stdout || "{}");
    for (const name of legacyHourlyNames) {
      const matches = records.filter((record) => record.name === name);
      if (matches.length > 1) {
        throw new Error(`multiple legacy automations named ${name}; refusing ambiguous deletion`);
      }
      if (matches.length === 0) {
        console.log(`[ok] legacy automation absent: ${name}`);
        continue;
      }
      run(["automations", "remove", matches[0].id]);
      console.log(`[retired] ${name}`);
    }
  }
}

console.log(
  apply
    ? "KAFKA OpenClaw bootstrap applied."
    : "Dry run complete. Re-run with --apply to mutate local OpenClaw state.",
);
