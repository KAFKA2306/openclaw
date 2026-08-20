$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Deployment = $PSScriptRoot
$PolicyPath = (Resolve-Path (Join-Path $Deployment 'policy.jsonc')).Path

if (-not (Get-Command openclaw -ErrorAction SilentlyContinue)) {
    throw 'openclaw is not available on PATH.'
}
if (-not $env:GITHUB_PERSONAL_ACCESS_TOKEN) {
    throw 'Set GITHUB_PERSONAL_ACCESS_TOKEN before running setup.'
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is required by the configured GitHub MCP server.'
}

$env:OPENCLAW_EXPERIMENTAL_CLAWS = '1'

function Ensure-PluginLinked {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Path
    )
    & openclaw plugins inspect $Id --json *> $null
    if ($LASTEXITCODE -ne 0) {
        & openclaw plugins install --link --force $Path
        if ($LASTEXITCODE -ne 0) { throw "Failed to link plugin: $Path" }
    }
    & openclaw plugins enable $Id
    if ($LASTEXITCODE -ne 0) { throw "Failed to enable plugin: $Id" }
}

function Ensure-OfficialPlugin {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Spec
    )
    & openclaw plugins inspect $Id --json *> $null
    if ($LASTEXITCODE -ne 0) {
        & openclaw plugins install $Spec
        if ($LASTEXITCODE -ne 0) { throw "Failed to install plugin: $Spec" }
    }
    & openclaw plugins enable $Id
    if ($LASTEXITCODE -ne 0) { throw "Failed to enable plugin: $Id" }
}

& openclaw plugins enable policy
if ($LASTEXITCODE -ne 0) { throw 'Failed to enable the Policy plugin.' }

Ensure-PluginLinked -Id 'evidence-check' -Path (Join-Path $Deployment 'plugins/evidence-check')
Ensure-PluginLinked -Id 'github-write-policy' -Path (Join-Path $Deployment 'plugins/github-write-policy')

& openclaw config set plugins.entries.evidence-check.hooks.allowConversationAccess true
if ($LASTEXITCODE -ne 0) { throw 'Failed to grant evidence-check conversation hook access.' }

& openclaw config set plugins.entries.policy.config.path $PolicyPath
if ($LASTEXITCODE -ne 0) { throw 'Failed to configure the Policy plugin path.' }

Ensure-OfficialPlugin -Id 'codex' -Spec '@openclaw/codex'
Ensure-OfficialPlugin -Id 'llama-cpp' -Spec '@openclaw/llama-cpp-provider'

$ClawIds = @('finance', 'vr-3d', 'games', 'research-data', 'agent-web')
foreach ($ClawId in $ClawIds) {
    $ClawPath = Join-Path $Deployment "claws/$ClawId"
    & openclaw claws status $ClawId --json *> $null
    $Installed = ($LASTEXITCODE -eq 0)
    $Operation = if ($Installed) { 'update' } else { 'add' }

    if ($Installed) {
        $PlanText = (& openclaw claws update $ClawId --from $ClawPath --dry-run --json) -join "`n"
    } else {
        $PlanText = (& openclaw claws add $ClawPath --dry-run --json) -join "`n"
    }
    if ($LASTEXITCODE -ne 0) { throw "Claw $Operation dry-run failed for $ClawId." }

    $Plan = $PlanText | ConvertFrom-Json
    if (-not $Plan.planIntegrity) { throw "No planIntegrity returned for $ClawId." }

    if ($Installed) {
        & openclaw claws update $ClawId --from $ClawPath --yes --plan-integrity $Plan.planIntegrity
    } else {
        & openclaw claws add $ClawPath --yes --plan-integrity $Plan.planIntegrity
    }
    if ($LASTEXITCODE -ne 0) { throw "Claw $Operation failed for $ClawId." }
}

& openclaw config validate --json
if ($LASTEXITCODE -ne 0) { throw 'OpenClaw configuration validation failed.' }

foreach ($ClawId in $ClawIds) {
    & openclaw policy check --agent $ClawId --severity-min error --json
    if ($LASTEXITCODE -ne 0) { throw "Policy conformance failed for $ClawId." }
}

Write-Host 'OpenClaw domain-agent deployment applied and policy-checked.'
