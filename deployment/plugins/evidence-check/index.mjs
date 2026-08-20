import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const DEFAULT_AGENT_IDS = new Set(["finance", "vr-3d", "games", "research-data", "agent-web"]);
const SOURCE_URL = /https?:\/\/[^\s)>\]}]+/i;
const FACT_SIGNAL =
  /(?:\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?%?\b|\b[0-9a-f]{7,40}\b|latest|current|version|release|commit|issue|pull request|最新|現在|正式|仕様|バージョン|コミット|イシュー|プルリク)/i;

function configuredAgentIds(pluginConfig) {
  const values = Array.isArray(pluginConfig?.agentIds) ? pluginConfig.agentIds : undefined;
  return values?.length
    ? new Set(values.filter((value) => typeof value === "string"))
    : DEFAULT_AGENT_IDS;
}

export default definePluginEntry({
  id: "evidence-check",
  name: "Evidence Check",
  register(api) {
    const pluginConfig = api.pluginConfig ?? {};
    const targetAgents = configuredAgentIds(pluginConfig);
    const minimumLength = Number.isInteger(pluginConfig.minimumLength)
      ? pluginConfig.minimumLength
      : 120;

    api.on(
      "before_agent_finalize",
      async (event, ctx) => {
        if (!ctx.agentId || !targetAgents.has(ctx.agentId)) {
          return;
        }

        const text =
          typeof event.lastAssistantMessage === "string" ? event.lastAssistantMessage.trim() : "";
        if (text.length < minimumLength || !FACT_SIGNAL.test(text) || SOURCE_URL.test(text)) {
          return;
        }

        const retryKey = `evidence-check:${event.runId ?? event.turnId ?? event.sessionId}`;
        return {
          action: "revise",
          reason: "Substantive factual output has no source URL.",
          retry: {
            instruction:
              "Re-check every factual claim against current primary or official sources. Include direct source URLs beside supported claims. Delete claims, dates, numbers, versions, specifications, or repository state that cannot be verified. Do not substitute secondary sources when a current primary source is available.",
            idempotencyKey: retryKey,
            maxAttempts: 1,
          },
        };
      },
      { priority: 80 },
    );
  },
});
