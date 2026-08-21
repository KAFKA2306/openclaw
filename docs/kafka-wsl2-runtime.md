---
summary: "KAFKA2306 向け OpenClaw の WSL2 正準 runtime、権限境界、導入・検証手順"
title: "KAFKA2306 WSL2 canonical runtime"
---

# KAFKA2306 WSL2 canonical runtime

更新日: 2026-08-22

## 結論

KAFKA2306 環境では、OpenClaw の canonical Gateway / worker runtime を **既存 WSL2 Ubuntu** とする。

- Windows PowerShell 側に別 Gateway を並行導入しない。
- Windows Hub / Windows node は Unity、Blender GUI、screen/device 操作など Windows-native state が必要になったときだけ追加する。
- OpenClaw は control plane ではなく、ChatGPT / GitHub が明示した既存 task を実行して evidence を返す bounded worker とする。
- 初回導入では daemon、cron、autonomous discovery、agent spawning を有効化しない。
- merge / release / publish / destructive deletion は OpenClaw の完了条件に含めない。

## 役割分担

```text
Human
  ↓
ChatGPT
  ↓
GitHub: task / contract / verifier / evidence
  ↓
WSL2 OpenClaw: execute / observe / retry / collect evidence
  ↓
Local state: repo / GPU / FFmpeg / COLMAP / data
  ↓
Independent verifier
  ↓
ChatGPT + Human: completion / merge / release judgement
```

Windows-native state が必要な task だけ、既存 WSL2 Gateway へ Windows Hub / node を接続する。

## Phase 1: WSL2 only

### 1. Preflight

```bash
uname -a
cat /etc/os-release
command -v docker || true
docker info >/tmp/openclaw-docker-info.txt 2>&1 || true
```

### 2. Rootless install

system-wide Node や root 権限への依存を避け、OpenClaw と Node を原則 `~/.openclaw` 配下へ置く。

```bash
curl -fsSL --proto '=https' --tlsv1.2 \
  https://openclaw.ai/install-cli.sh | bash

export PATH="$HOME/.openclaw/bin:$PATH"
grep -qxF 'export PATH="$HOME/.openclaw/bin:$PATH"' ~/.bashrc \
  || echo 'export PATH="$HOME/.openclaw/bin:$PATH"' >> ~/.bashrc

openclaw --version
```

2026-08-22 の確認時点では npm `latest` は `2026.7.1-2`、beta は `2026.8.1-beta.2`。初回は stable channel を使用し、実行時に解決された actual version を evidence として記録する。

### 3. ChatGPT / Codex OAuth

別の OpenAI API key 課金を前提にせず、ChatGPT / Codex subscription OAuth を優先する。

```bash
openclaw models auth login --provider openai --device-code
openclaw config set agents.defaults.model.primary openai/gpt-5.6-sol
openclaw models list --provider openai
openclaw models status
```

アカウントが GPT-5.6 を公開していない場合だけ、明示的に `openai/gpt-5.5` へ切り替え、silent downgrade は行わない。

## Least-privilege baseline

導入した version の current schema を正とし、`openclaw config validate` で拒否される key を無理に適用しない。

最低限、次の effective state を満たす。

- Gateway bind: loopback only
- elevated host escape: disabled
- filesystem access: workspace only
- autonomous cron / discovery: disabled
- Windows node `system.run`: Phase 1 では利用しない
- credentials / SSH keys / arbitrary HOME: worker scope 外

代表的な設定:

```bash
openclaw config set gateway.bind loopback
openclaw config set tools.elevated.enabled false
openclaw config set tools.fs.workspaceOnly true
openclaw config validate
```

## Sandbox

`docker info` が成功する場合、tool execution を sandbox 側へ閉じる。

```bash
openclaw config set agents.defaults.sandbox.mode all
openclaw config set agents.defaults.sandbox.scope agent
openclaw config set agents.defaults.sandbox.workspaceAccess ro
openclaw config validate
```

原則:

- `workspaceAccess` は `ro` から開始する。不要なら `none`。
- Docker socket を bind しない。
- `~/.ssh`, `~/.aws`, `~/.config` など credential roots を bind しない。
- elevated escape を有効にしない。
- Docker が使えない場合、代わりに broad host exec を許可しない。

## First acceptance test

初回は persistent daemon を install せず、foreground/debug 起動で検証する。

```bash
openclaw config validate
openclaw doctor
openclaw security audit
openclaw security audit --deep
openclaw sandbox explain --json || true
```

完了判定には次を要求する。

1. actual `openclaw --version` を記録した。
2. Gateway が loopback のみで listen する。
3. OAuth-backed model request が成功する。
4. allowed workspace の read-only inspection が成功する。
5. workspace 外への filesystem access が拒否される。
6. elevated / host escape が利用できない。
7. cron / autonomous issue discovery が有効になっていない。
8. config validation、security audit、sandbox explanation、process log を evidence として残した。

`process exit 0`、`gateway started`、`artifact exists` だけでは completion としない。

## Phase 2: Windows Hub / node

次のいずれかが explicit task に必要になった場合だけ追加する。

- Unity Editor state
- Blender GUI state
- Windows-only application
- screen / device capability
- Windows host 上でしか成立しない command

追加時も canonical Gateway は WSL2 のままとし、Windows 側に第2 Gateway を作らない。

`system.run` は deny-by-default とし、explicit task に必要な command だけを allowlist する。Windows node の start / stop / restart が WSL2 Gateway 接続を壊さないことを実測してから常用する。

## Known WSL2 risks to verify

過去の upstream では WSL2 に関して以下の障害が報告されているため、導入時は実環境で再検証する。

- systemd user / D-Bus 周りの Gateway lifecycle failure
- update 後の Gateway auth token / service restart failure
- WSL2 Gateway と Windows node lifecycle の接続干渉
- WSL2 mirrored networking 周りの listener / forwarding 問題

過去 issue が closed であっても、current installed version と current Windows / WSL2 state で再現しないことを acceptance evidence にする。

## Source of truth

現在状態がこの文書と矛盾する場合は現在状態を優先し、この文書を更新する。

- OpenClaw installer: https://docs.openclaw.ai/install/installer
- Windows / WSL2: https://docs.openclaw.ai/platforms/windows
- OpenAI provider / Codex OAuth: https://docs.openclaw.ai/providers/openai
- Security: https://docs.openclaw.ai/gateway/security
- Sandboxing: https://docs.openclaw.ai/gateway/sandboxing
- Sandbox vs tool policy vs elevated: https://docs.openclaw.ai/gateway/sandbox-vs-tool-policy-vs-elevated
