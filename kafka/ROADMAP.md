# KAFKA customization state

This file records only fork-specific work that cannot be recovered directly from upstream OpenClaw or ordinary GitHub state.

| Workstream               | Current repository state                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Upstream synchronization | PR-based, no force-push; `automation/upstream-sync` is disposable.                          |
| Execution model          | One explicit-task `local-worker`; no domain-discovery agents are canonical.                 |
| Scheduled model work     | Zero jobs by default. Legacy five-domain hourly jobs have an explicit retirement migration. |
| GitHub operations        | Owner allowlist; repository read and approval-gated PR creation only.                       |
| Evidence hygiene         | One bounded finalization revision for source-less current/factual output.                   |
| Runtime observability    | Read-only local runtime-state exporter.                                                     |
| Local inference          | Reuse upstream model/provider configuration; do not fork a duplicate provider.              |
| Codex / Claws            | Reuse upstream Codex; Claws remain optional/experimental.                                   |

## Completion contract

Repository completion means the exact PR head passes the fork-specific validation and all applicable upstream required checks. Local activation is a separate deployment state and requires an operator-owned Gateway plus any credentials, model configuration, local applications, and data permissions actually needed by the selected task.

A successful worker run is not a product release authorization. Build, validation, release, and production/runtime verification remain separate states.
