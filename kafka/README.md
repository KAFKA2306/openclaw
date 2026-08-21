# KAFKA OpenClaw layer

This directory is the fork-specific layer for `KAFKA2306/openclaw`. Upstream OpenClaw remains the product core; KAFKA-specific behavior is isolated here so upstream synchronization stays reviewable.

## What is implemented

- five isolated domain-agent workspace templates;
- declarative hourly automation jobs at distinct minute offsets;
- a typed GitHub operations plugin with owner allowlisting and approval-gated writes;
- an evidence-quality finalization plugin that can request one bounded revision when research-like factual/current answers lack source URLs;
- a cross-platform Node bootstrapper for agents and automations;
- build/package/install scripts for the two external-style local plugins;
- a read-only runtime-state exporter for local operations tooling;
- an hourly, non-force upstream synchronization workflow;
- fork-specific syntax, build, packaging, and manifest validation.

## Activate locally

From the repository root after installing the normal OpenClaw checkout dependencies:

```bash
node kafka/scripts/validate.mjs
node kafka/scripts/bootstrap.mjs
node kafka/scripts/install-plugins.mjs --apply
node kafka/scripts/bootstrap.mjs --apply
```

`bootstrap.mjs` is dry-run by default. `--apply` creates missing agents and missing automation jobs. It does not delete existing agents, jobs, sessions, credentials, or bindings.

`install-plugins.mjs --apply` compiles each plugin with the repository-pinned `esbuild`, packs it through npm's package path, installs the resulting tarball through OpenClaw's `npm-pack:` installer, and removes temporary package archives afterwards. The generated `dist/` directories stay ignored by Git.

## Security defaults

GitHub write tools require OpenClaw approval by default. Set `KAFKA_GITHUB_REQUIRE_APPROVAL=0` only on a trusted operator-owned installation where unattended metadata writes are explicitly intended. The plugin never exposes force-push, merge, repository deletion, secret mutation, or file-content mutation tools.

The runtime-state exporter prints to stdout unless `--out <path>` is supplied. Do not publish its output blindly; local agent/session state can be private.

The evidence plugin is an evidence-hygiene gate, not a truth oracle: it can require a source-bearing revision, but a URL alone does not prove a claim. Agents still have to verify the supporting primary evidence.

## Local model option

OpenClaw already ships the official `llama-cpp` provider. This layer does not fork that implementation. Install/configure it using upstream OpenClaw setup when local inference is wanted, then choose the resulting `llama-cpp/<model>` reference in ordinary agent or automation model configuration.

## Experimental Claws and Codex

Claws remain experimental upstream. They are not the canonical deployment format in this layer; the stable source of truth is the agent templates plus bootstrap/automation manifests. The bundled Codex integration is reused unchanged rather than patched in this fork. See `integrations/codex-and-claws.md`.
