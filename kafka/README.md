# KAFKA OpenClaw layer

This directory is the fork-specific layer for `KAFKA2306/openclaw`. Upstream OpenClaw remains the product core. The KAFKA layer is intentionally small: ChatGPT and GitHub remain the reasoning/control plane, while OpenClaw is a bounded local execution worker for state that cloud-side tooling cannot directly reach.

## Canonical operating model

```text
Human
  -> ChatGPT: research / reason / prioritize / choose next
  -> GitHub: Issue / PR / Actions / main / production evidence
  -> OpenClaw local-worker: execute / observe / retry / collect evidence
  -> local machine: workspace / Unity / Blender / GPU / data / media tools
  -> repository-owned verifier
  -> ChatGPT + human: completion / merge / release / publish decisions
```

OpenClaw is not the default place to discover work. It must not autonomously create new themes or sweep domains for the highest-value issue. Repository-only work should stay in ChatGPT/Codex/GitHub tooling when local state is unnecessary.

## What is implemented

- one `local-worker` workspace template for explicit bounded tasks;
- zero scheduled model-backed jobs by default;
- an opt-in migration that retires the five legacy hourly discovery jobs if they were previously bootstrapped;
- a typed GitHub operations plugin with owner allowlisting and approval-gated PR creation;
- an evidence-quality finalization plugin for the local worker;
- cross-platform bootstrap/build/install scripts;
- a read-only runtime-state exporter;
- a no-force upstream synchronization workflow that opens or reuses a disposable PR instead of pushing directly to `main`;
- fork-specific syntax, build, packaging, and manifest validation.

## Activate locally

From the repository root after installing normal OpenClaw checkout dependencies:

```bash
node kafka/scripts/validate.mjs
node kafka/scripts/install-plugins.mjs --apply
node kafka/scripts/bootstrap.mjs --apply
```

`bootstrap.mjs` is dry-run by default. Normal `--apply` creates the `local-worker` if missing and creates only jobs declared in the manifest; the canonical manifest declares no scheduled jobs.

If an earlier version of this fork already created the five generic hourly jobs, retire those exact legacy jobs explicitly:

```bash
node kafka/scripts/bootstrap.mjs --apply --retire-legacy-hourly
```

That migration removes only the known legacy automation names. It does not delete legacy agent workspaces, sessions, credentials, or bindings. Agent deletion is intentionally not automated because an agent workspace may contain operator-owned state.

## Worker boundary

The local worker is for tasks that need local state or long-running execution, for example Unity/Blender, GPU workloads, FFmpeg/COLMAP/3DGS, large local files, or private data pipelines.

Default policy:

- execute an explicitly selected task; do not select a new issue;
- keep edits inside the assigned workspace;
- use repository-owned tests/invariants as the verifier;
- collect logs/artifacts/hashes and report uncertainty;
- do not read credentials, use sudo, force-push, merge, release, publish, or perform irreversible deletion;
- do not weaken the verifier to obtain a green result.

## Security defaults

GitHub write tools require OpenClaw approval by default. Set `KAFKA_GITHUB_REQUIRE_APPROVAL=0` only on a trusted operator-owned installation where unattended PR creation is explicitly intended. The plugin does not expose issue creation, force-push, merge, repository deletion, secret mutation, or file-content mutation.

The runtime-state exporter prints to stdout unless `--out <path>` is supplied. Do not publish its output blindly; local agent/session state can be private.

The evidence plugin is an evidence-hygiene gate, not a truth oracle. A URL alone does not prove a claim; primary evidence still has to support the statement.

## Local model option

OpenClaw already ships its standard `llama-cpp` provider. This layer does not fork it. Configure local inference through upstream OpenClaw when needed, then select the resulting model through ordinary agent configuration.

## Experimental Claws and Codex

Claws remain experimental upstream and are not the canonical deployment format here. The bundled Codex integration is reused unchanged rather than patched in this fork. See `integrations/codex-and-claws.md`.
