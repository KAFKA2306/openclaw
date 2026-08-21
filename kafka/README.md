# KAFKA OpenClaw layer

This directory is the operator-owned layer for the `KAFKA2306/openclaw` fork. The upstream core stays as close as possible to `openclaw/openclaw`; customization lives in a bundled plugin, versioned agent workspaces, configuration patches, automations, and optional Claw packages.

## What is implemented

- `extensions/kafka-operator`: typed GitHub reads/writes, owner allowlist, per-write approval, evidence revision, and optional low-cost task routing.
- `kafka/agents/*`: isolated workspace bootstrap for the five domain agents.
- `kafka/openclaw.patch.json5`: additive runtime configuration for the KAFKA operator plugin.
- `kafka/setup.ps1`: idempotent-ish Windows setup that materializes workspaces, creates missing agents, enables the plugin, validates config, and reconciles the five hourly automations.
- `.github/workflows/sync-upstream.yml`: scheduled/manual upstream synchronization through one canonical PR branch; no force push and no direct overwrite of `main`.
- `kafka/claws/*`: experimental portable agent packages. They are optional because `openclaw claws` is explicitly experimental upstream.

## Security model

GitHub writes fail closed unless the repository owner is listed in `plugins.entries.kafka-operator.config.github.allowedOwners`. The token is read from an environment variable (default `GITHUB_TOKEN`) and is never written into repository or OpenClaw configuration. Every plugin-authored GitHub write asks for a one-time approval. There is no persistent `allow-always` path in this plugin.

The evidence hook is deliberately narrower than a truth oracle: for material factual prose it checks for direct HTTPS evidence metadata and requests at most one revision when no URL is present. A URL does not prove a claim; the revision instruction tells the model to verify against primary sources and remove or qualify unsupported claims.

## Install on the Windows/Clawboard machine

From the repository root in PowerShell:

```powershell
$env:GITHUB_TOKEN = "<token available only in this process or your secret manager>"
./kafka/setup.ps1
```

The script copies the tracked workspace bootstrap files under `~/.openclaw/workspaces/`, creates missing OpenClaw agents with `openclaw agents add --non-interactive`, applies the additive config patch, enables `kafka-operator`, validates configuration, and creates any missing domain automations.

To enable local cheap-task routing after the bundled `llama-cpp` provider has a model you have actually verified on the machine:

```powershell
$env:KAFKA_LOCAL_PROVIDER = "llama-cpp"
$env:KAFKA_LOCAL_MODEL = "<exact model id from openclaw models list>"
./kafka/setup.ps1
```

If either variable is absent, routing remains disabled. This avoids committing a guessed local model id.

## Verification

Repository-level proof:

```bash
pnpm test extensions/kafka-operator/
pnpm check
```

Machine-level proof after setup:

```powershell
openclaw config validate
openclaw plugins inspect kafka-operator --runtime --json
openclaw agents list --json
openclaw automations list --json
openclaw models list
```

The local machine still owns credentials, provider login, Gateway process state, and the actual local GGUF/model installation. Those cannot be safely baked into Git.
