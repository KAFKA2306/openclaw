# KAFKA OpenClaw implementation ledger

GitHub Issues are disabled on this fork, so this file is the durable issue ledger for the KAFKA customization. Each item has a repository-level completion condition; machine-only activation is called out separately rather than being reported as source-code completion.

| ID | Work item | Repository status | Completion evidence |
| --- | --- | --- | --- |
| KOC-01 | Keep the fork current with upstream | DONE | Fork fast-forwarded to upstream before this work; `.github/workflows/sync-upstream.yml` maintains one no-force sync branch/PR. |
| KOC-02 | Define isolated domain agents | DONE | `kafka/agents/{finance,research-data,vr-3d,games,agent-web}/AGENTS.md`; `setup.ps1` creates missing agents with dedicated workspaces. |
| KOC-03 | Version-control agent workspaces and runtime config | DONE | `kafka/agents/*`, `kafka/openclaw.patch.json5`, and `kafka/setup.ps1`. Credentials are excluded. |
| KOC-04 | Typed GitHub operations plugin | DONE | `extensions/kafka-operator/index.ts`: repository state, issue create, branch create, PR create; exact-title/head dedupe where applicable. |
| KOC-05 | Gate GitHub writes with policy/approval | DONE | Owner allowlist fails closed and `before_tool_call` requires `allow-once` or `deny` for every plugin write. |
| KOC-06 | Evidence check before finalization | DONE | `before_agent_finalize` requests one bounded revision for material factual prose lacking a direct HTTPS source. |
| KOC-07 | Hourly domain-agent automations | DONE | `setup.ps1` reconciles the five hourly schedules in Asia/Tokyo using isolated sessions and exact cron timing. |
| KOC-08 | Surface OpenClaw state in agent-resources | SPLIT | OpenClaw-side contract is documented here; the dashboard adapter is implemented and tested in `KAFKA2306/agent-resources` as a separate repository change. |
| KOC-09 | Route cheap inference to a local provider | DONE | `before_model_resolve` performs opt-in cheap-task routing only when an exact provider/model is configured; setup refuses to guess a local model id. |
| KOC-10 | Codex supervision and Claw packaging | DONE / activation-gated | Existing bundled Codex integration is reused rather than forked; five experimental Claw packages are tracked under `kafka/claws`. Codex/provider login remains machine-owned. |

## Acceptance invariants

1. Upstream core changes are avoided when Plugin SDK/config/automation seams are sufficient.
2. No GitHub token, model credential, provider credential, or chat credential is committed.
3. GitHub writes are both owner-allowlisted and one-time approved.
4. Branch creation never force-updates a ref.
5. Issue and PR creation are duplicate-aware.
6. Evidence revision is bounded (`maxAttempts: 1`) and is not represented as automatic truth verification.
7. Local model routing is opt-in and disabled unless an exact provider and exact model are supplied.
8. Domain automations use separate agent ids and isolated sessions.
9. Upstream sync operates through a PR and stops on merge conflicts.
10. Runtime activation is verified with `openclaw config validate`, plugin inspection, agent listing, automation listing, and model listing on the target machine.
