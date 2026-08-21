import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const defaultAgents = ["finance", "research-data", "vr-3d", "games", "agent-web"];

function targetAgents(): Set<string> {
  const raw = process.env.KAFKA_EVIDENCE_AGENTS;
  return new Set((raw ? raw.split(",") : defaultAgents).map((x) => x.trim()).filter(Boolean));
}

function shouldCheck(text: string): boolean {
  if (text.length < 280) return false;
  const currentClaim = /\b(latest|current|today|currently|version|release|commit|sha|price|rate|status)\b|最新|現在|本日|今日|価格|利率|バージョン|コミット/i;
  const quantified = /(?:^|\s)(?:\d{4}-\d{2}-\d{2}|\d+(?:\.\d+)?%?|[0-9a-f]{7,40})(?:\s|$|[.,;:!?])/im;
  return currentClaim.test(text) || quantified.test(text);
}

export default definePluginEntry({
  id: "kafka-evidence-check",
  name: "KAFKA Evidence Check",
  description: "Evidence hygiene gate for research-like final answers.",
  register(api) {
    api.on("before_agent_finalize", (event, ctx) => {
      const text = event.lastAssistantMessage?.trim() ?? "";
      if (!text || !shouldCheck(text)) return { action: "continue" };
      const targets = targetAgents();
      if (ctx.agentId && !targets.has("*") && !targets.has(ctx.agentId)) return { action: "continue" };
      if (/https?:\/\/\S+/i.test(text)) return { action: "continue" };
      if (/未確認|未検証|確認できない|unverified|not verified|could not verify/i.test(text)) return { action: "continue" };
      const key = event.runId || event.turnId || event.sessionId;
      return {
        action: "revise",
        reason: "Research-like factual/current output has no source URL.",
        retry: {
          instruction: "Revise the answer once. Verify current factual, numeric, date, version, commit, price, rate, or status claims against primary sources where available; include direct source URLs for the supporting evidence. If a claim cannot be verified, state that explicitly instead of inventing a source.",
          idempotencyKey: `kafka-evidence:${key}`,
          maxAttempts: 1,
        },
      };
    });
  },
});
