param(
  [string]$WorkspaceRoot = (Join-Path $HOME ".openclaw\workspaces")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PatchFile = Join-Path $PSScriptRoot "openclaw.patch.json5"
$AgentsSource = Join-Path $PSScriptRoot "agents"

function Invoke-OpenClaw {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & openclaw @Args
  if ($LASTEXITCODE -ne 0) {
    throw "openclaw $($Args -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Has-Agent {
  param([string]$AgentId, [string]$JsonText)
  return $JsonText -match ('"id"\s*:\s*"' + [regex]::Escape($AgentId) + '"')
}

function Has-Automation {
  param([string]$Name, [string]$JsonText)
  return $JsonText -match ('"name"\s*:\s*"' + [regex]::Escape($Name) + '"')
}

$agents = @(
  @{ Id = "finance"; Minute = 0; Name = "KAFKA Finance hourly"; Prompt = "Run the Finance domain cycle. Inspect current primary evidence and repository state, identify the highest-value finance issue, make safe bounded progress, and report URLs/SHAs for material claims and mutations." },
  @{ Id = "research-data"; Minute = 12; Name = "KAFKA Research Data hourly"; Prompt = "Run the Research Data domain cycle. Inspect current research/data repositories and primary evidence, identify one highest-value data-quality or analysis issue, make safe bounded progress, and report reproducible evidence." },
  @{ Id = "vr-3d"; Minute = 24; Name = "KAFKA VR 3D hourly"; Prompt = "Run the VR/3D domain cycle. Inspect current VR, Unity, Blender, photogrammetry, avatar, and related repository state, select the highest-value issue, make safe bounded progress, and report reproducible evidence." },
  @{ Id = "games"; Minute = 36; Name = "KAFKA Games hourly"; Prompt = "Run the Games domain cycle. Inspect current game and game-tool repositories, select the highest-value issue using current repository evidence, make safe bounded progress, and report reproducible evidence." },
  @{ Id = "agent-web"; Minute = 48; Name = "KAFKA Agent Web hourly"; Prompt = "Run the Agent/Web domain cycle. Use the central agent-resources view plus current repository evidence, identify the highest-value agent/web infrastructure issue, make safe bounded progress, and report URLs/SHAs for mutations." }
)

New-Item -ItemType Directory -Force -Path $WorkspaceRoot | Out-Null

# Validate the additive config before writing it.
Invoke-OpenClaw config patch --file $PatchFile --dry-run
Invoke-OpenClaw config patch --file $PatchFile
Invoke-OpenClaw plugins enable kafka-operator

$agentJson = (& openclaw agents list --json | Out-String)
if ($LASTEXITCODE -ne 0) { throw "openclaw agents list --json failed" }

foreach ($agent in $agents) {
  $workspace = Join-Path $WorkspaceRoot $agent.Id
  New-Item -ItemType Directory -Force -Path $workspace | Out-Null

  if (-not (Has-Agent -AgentId $agent.Id -JsonText $agentJson)) {
    Invoke-OpenClaw agents add $agent.Id --workspace $workspace --non-interactive
    $agentJson = (& openclaw agents list --json | Out-String)
    if ($LASTEXITCODE -ne 0) { throw "openclaw agents list --json failed after adding $($agent.Id)" }
  }

  $source = Join-Path $AgentsSource $agent.Id
  Copy-Item (Join-Path $source "AGENTS.md") (Join-Path $workspace "AGENTS.md") -Force
  Copy-Item (Join-Path $source "IDENTITY.md") (Join-Path $workspace "IDENTITY.md") -Force
}

# Local routing is activated only with an exact, operator-verified provider/model pair.
if ($env:KAFKA_LOCAL_PROVIDER -and $env:KAFKA_LOCAL_MODEL) {
  Invoke-OpenClaw config set plugins.entries.kafka-operator.config.routing.provider $env:KAFKA_LOCAL_PROVIDER
  Invoke-OpenClaw config set plugins.entries.kafka-operator.config.routing.model $env:KAFKA_LOCAL_MODEL
  Invoke-OpenClaw config set plugins.entries.kafka-operator.config.routing.enabled true --strict-json
} else {
  Invoke-OpenClaw config set plugins.entries.kafka-operator.config.routing.enabled false --strict-json
}

Invoke-OpenClaw config validate

$automationJson = (& openclaw automations list --json | Out-String)
if ($LASTEXITCODE -ne 0) { throw "openclaw automations list --json failed" }

foreach ($agent in $agents) {
  if (Has-Automation -Name $agent.Name -JsonText $automationJson) {
    continue
  }
  $cron = "$($agent.Minute) * * * *"
  Invoke-OpenClaw automations create $cron $agent.Prompt --name $agent.Name --agent $agent.Id --session isolated --tz Asia/Tokyo --no-deliver
  $automationJson = (& openclaw automations list --json | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "openclaw automations list --json failed after creating $($agent.Name)" }
}

Write-Host "KAFKA OpenClaw layer configured. Runtime verification follows."
Invoke-OpenClaw plugins inspect kafka-operator --runtime --json
Invoke-OpenClaw agents list --json
Invoke-OpenClaw automations list --json
