# OpenClaw deployment for domain agents

This directory keeps fork-specific deployment material outside OpenClaw core. The intent is to stay close to `openclaw/openclaw` while composing documented extension points: Claws, plugins, MCP, cron, policy, Codex, and llama.cpp.

## What is implemented

1. `.github/workflows/upstream-sync.yml` merges `openclaw/openclaw:main` into this fork every hour and also supports manual dispatch. Merge conflicts fail the workflow instead of forcing history.
2. `claws/` defines five isolated domain agents with separate identities, workspaces, memory, tool policy, GitHub MCP access, and hourly Asia/Tokyo schedules.
3. GitHub access uses GitHub's official `github/github-mcp-server` Docker image with an explicit tool allowlist. Direct file mutation, branch creation, PR merge, and other unlisted GitHub write tools are not exposed.
4. `plugins/github-write-policy` requires operator approval for the three intentionally exposed GitHub write tools and blocks unexpected GitHub mutation tools if configuration drifts.
5. `plugins/evidence-check` uses OpenClaw's `before_agent_finalize` hook to require source URLs for substantive factual domain-agent replies and requests one bounded revision when sources are absent.
6. `policy.jsonc` is a conformance baseline for the five agents: filesystem/shell mutation tools must stay denied, filesystem access must stay workspace-only, and elevated mode must stay disabled.
7. `setup.ps1` links the two local policy plugins, enables the bundled Policy plugin, installs the official Codex and llama.cpp plugins, and applies/updates the five Claws through the documented dry-run + `planIntegrity` flow.

## Prerequisites

- An OpenClaw installation compatible with the current fork.
- Docker available when the GitHub MCP server starts.
- `GITHUB_PERSONAL_ACCESS_TOKEN` set in the environment. Do not commit a token.
- For Codex supervision, a native Codex installation that the official OpenClaw Codex plugin can detect.
- llama.cpp model setup is intentionally not forced by this repository; the official provider performs its own consent-based setup and supports custom GGUF paths.

## Install / update

From the repository root in PowerShell:

```powershell
$env:GITHUB_PERSONAL_ACCESS_TOKEN = "<token>"
./deployment/setup.ps1
```

The script never stores the token in Git. Claw application is integrity-bound: it first runs a dry-run, reads `planIntegrity`, then applies exactly that reviewed plan.

## GitHub MCP tool surface

The Claws expose these current official GitHub MCP tools:

- read: `get_file_contents`, `get_commit`, `list_commits`, `search_code`, `search_repositories`, `issue_read`, `search_issues`, `pull_request_read`, `search_pull_requests`, `actions_get`
- write with OpenClaw approval: `issue_write`, `add_issue_comment`, `create_pull_request`

The server is configured with `GITHUB_TOOLS`, so tools such as `create_or_update_file`, `push_files`, `delete_file`, `create_branch`, and `merge_pull_request` are absent from the MCP surface. Repository code changes should therefore flow through a reviewed coding harness such as the official Codex integration rather than unrestricted GitHub file-write tools.

## Agent schedules

| Agent | Asia/Tokyo schedule |
| --- | --- |
| `finance` | hourly at `:00` |
| `vr-3d` | hourly at `:12` |
| `games` | hourly at `:24` |
| `research-data` | hourly at `:36` |
| `agent-web` | hourly at `:48` |

Each cron run uses an isolated session and instructs the agent to advance at most one evidence-backed workline.

## Security and evidence behavior

The OpenClaw profile for each Claw denies `exec`, `process`, `write`, `edit`, and `apply_patch`, restricts filesystem tools to the workspace, and enables cross-conversation memory. GitHub write operations are separately narrowed by the MCP server and guarded with `before_tool_call` approval requests.

The evidence hook is intentionally narrow. It does not pretend that the existence of a URL proves a claim. It rejects a substantive factual answer with no source URL and asks the model for one bounded revision that re-checks claims against current primary or official sources and deletes unsupported claims. Domain prompts independently require current primary evidence, exact GitHub state, and explicit verification status.

## Upstream references

- OpenClaw plugin hooks: https://docs.openclaw.ai/plugins/hooks
- OpenClaw plugin permission requests: https://docs.openclaw.ai/plugins/plugin-permission-requests
- OpenClaw Claws: https://docs.openclaw.ai/cli/claws
- OpenClaw cron: https://docs.openclaw.ai/cli/cron
- OpenClaw Policy plugin: https://docs.openclaw.ai/plugins/reference/policy
- OpenClaw Codex plugin: https://docs.openclaw.ai/plugins/codex-harness
- OpenClaw llama.cpp provider: https://docs.openclaw.ai/plugins/llama-cpp
- GitHub MCP Server: https://github.com/github/github-mcp-server

## Known repository setting blocker

GitHub Issues are currently disabled on `KAFKA2306/openclaw`. The GitHub API rejects issue creation with HTTP 410 until the repository's Issues feature is enabled. This does not block the implementation in this directory, but the planned work items cannot be represented as native Issues in this repository until that repository setting is changed.
