# Codex and Claws

## Codex

The fork already contains OpenClaw's bundled Codex integration. This KAFKA layer does not patch Codex protocol/runtime behavior. Root repository policy requires direct inspection of a sibling `../codex` checkout before a Codex-specific verdict or behavior change, so customization stays on the supported upstream seam rather than adding an unverified fork patch.

## Claws

`openclaw claws` is experimental and packages one new agent's identity, workspace files, plugins/skills/MCP requirements, and cron jobs. Because its schema and lifecycle are explicitly unstable, it is not the canonical deployment format for this fork.

Canonical source of truth here is:

- `kafka/agents/*/AGENTS.md` for domain policy;
- `kafka/automations/jobs.json` for recurring jobs;
- `kafka/plugins/*` for fork-specific capabilities;
- `kafka/scripts/bootstrap.mjs` for idempotent realization.

When the Claw contract stabilizes, these inputs can be generated into one Claw per domain agent without changing the domain definitions themselves.
