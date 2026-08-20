import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const APPROVAL_TOOLS = new Set([
  "github__issue_write",
  "github__add_issue_comment",
  "github__create_pull_request",
]);
const EXPLICITLY_BLOCKED = new Set([
  "github__create_or_update_file",
  "github__delete_file",
  "github__push_files",
  "github__create_branch",
  "github__merge_pull_request",
  "github__update_pull_request",
  "github__pull_request_review_write",
  "github__sub_issue_write",
]);
const WRITE_NAME =
  /(?:^|__)(?:create|update|delete|push|merge|write|add_|remove_|cancel|rerun|assign|lock|unlock)/i;

function configuredAllowedOwners(pluginConfig) {
  const configured = Array.isArray(pluginConfig?.allowedOwners)
    ? pluginConfig.allowedOwners.filter((value) => typeof value === "string" && value.length > 0)
    : [];
  return new Set(configured.length ? configured : ["KAFKA2306"]);
}

export default definePluginEntry({
  id: "github-write-policy",
  name: "GitHub Write Policy",
  register(api) {
    const pluginConfig = api.pluginConfig ?? {};
    const allowedOwners = configuredAllowedOwners(pluginConfig);
    const approvalTimeoutMs = Number.isInteger(pluginConfig.approvalTimeoutMs)
      ? pluginConfig.approvalTimeoutMs
      : 120000;

    api.on(
      "before_tool_call",
      async (event) => {
        if (!event.toolName.startsWith("github__")) {
          return;
        }

        const owner = typeof event.params?.owner === "string" ? event.params.owner : undefined;
        const repo = typeof event.params?.repo === "string" ? event.params.repo : undefined;

        if (owner && !allowedOwners.has(owner)) {
          return {
            block: true,
            blockReason: `GitHub write outside the configured owner allowlist: ${owner}`,
          };
        }

        if (EXPLICITLY_BLOCKED.has(event.toolName)) {
          return {
            block: true,
            blockReason: `GitHub mutation tool is blocked by policy: ${event.toolName}`,
          };
        }

        if (APPROVAL_TOOLS.has(event.toolName)) {
          return {
            requireApproval: {
              title: "Approve GitHub write",
              description: `${event.toolName}${owner && repo ? ` on ${owner}/${repo}` : ""}`,
              severity: "warning",
              timeoutMs: approvalTimeoutMs,
              allowedDecisions: ["allow-once", "deny"],
            },
          };
        }

        if (WRITE_NAME.test(event.toolName)) {
          return {
            block: true,
            blockReason: `Unexpected GitHub mutation tool is not approved: ${event.toolName}`,
          };
        }
      },
      { priority: 100 },
    );
  },
});
