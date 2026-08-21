# KAFKA customization workstreams

GitHub Issues are disabled on this fork, so this file is the repository-local issue ledger until the repository setting is enabled.

| # | Workstream | Repository result |
|---|---|---|
| 1 | Upstream synchronization | Resolved: hourly merge workflow, never force-pushes. |
| 2 | Domain agents | Resolved: five isolated workspace templates and bootstrap creation. |
| 3 | Version-controlled agent configuration | Resolved: templates, JSON5 example, and declarative job manifest. |
| 4 | Typed GitHub operations | Resolved: `kafka-github-operations` plugin. |
| 5 | GitHub write policy | Resolved: owner allowlist plus approval-gated metadata writes; destructive tools are absent. |
| 6 | Evidence verification | Resolved: bounded pre-finalization revision gate for research-like factual/current output; source presence is not treated as proof by itself. |
| 7 | Hourly automation | Resolved: five exact JST cron jobs with isolated sessions. |
| 8 | agent-resources integration | Resolved at boundary: read-only runtime exporter; public dashboard remains public-GitHub truth only. |
| 9 | Model routing / local inference | Resolved by upstream reuse: standard per-agent/per-job model selection plus official `llama-cpp`; no duplicate provider fork. |
| 10 | Codex / Claw packaging | Resolved by upstream reuse and explicit stability boundary: bundled Codex stays unmodified; Claws remain optional/experimental rather than canonical. |

## Completion contract

The repository layer is complete only when the exact-head `KAFKA customization check` passes its Node syntax checks, plugin `esbuild` compilation, structural validation, and package dry-runs. Local activation still requires an operator-owned OpenClaw Gateway, model/provider credentials, GitHub token for write tools, and any explicit llama.cpp model-download consent. Those are deployment state, not repository source state.
