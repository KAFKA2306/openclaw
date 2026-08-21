# agent-resources boundary

`KAFKA2306/agent-resources` treats public GitHub state as its public dashboard truth source and explicitly avoids mixing private repository/work-item data into that surface. OpenClaw runtime state can contain local agent IDs, sessions, delivery routes, model/auth metadata, and other operator-local information, so this fork does not push runtime snapshots into the public dashboard automatically.

Use `node kafka/scripts/export-runtime-state.mjs` for a read-only local snapshot. The exporter asks OpenClaw for agent, automation, and dashboard state and emits a normalized envelope. Use `--out <path>` only for an operator-controlled destination; the file is created with restrictive permissions where supported.

This preserves the boundary:

```text
public GitHub state -> agent-resources public dashboard
local OpenClaw runtime -> local runtime-state export -> operator/private tooling
```

If agent-resources later gains an authenticated private ingestion surface, connect that surface to this exporter rather than scraping Control UI HTML or publishing local state into the public snapshot.
