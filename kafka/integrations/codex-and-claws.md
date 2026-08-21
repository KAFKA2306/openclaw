# Codex and Claws

## Codex

The fork already contains OpenClaw's bundled Codex integration. This KAFKA layer does not patch Codex protocol/runtime behavior. Root repository policy requires direct inspection of a sibling `../codex` checkout before a Codex-specific verdict or behavior change, so customization stays on the supported upstream seam rather than adding an unverified fork patch.

## Claws

`openclaw claws` is experimental and packages an agent's identity, workspace files, plugins/skills/MCP requirements, and cron jobs. Its schema and lifecycle are not the canonical deployment format for this fork.

Canonical source of truth here is:

- `kafka/agents/local-worker/AGENTS.md` for the bounded execution contract;
- `kafka/automations/jobs.json` for scheduled jobs, which are empty by default;
- `kafka/plugins/*` for fork-specific capabilities;
- `kafka/scripts/bootstrap.mjs` for idempotent realization and explicit legacy-hourly retirement.

If the Claw contract becomes stable enough to use here, generate a single bounded local-worker Claw from these inputs rather than reintroducing domain-discovery agents.
