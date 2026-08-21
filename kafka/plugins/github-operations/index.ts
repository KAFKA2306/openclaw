import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "typebox";

const API = "https://api.github.com";
const writeTools = new Set(["kafka_github_create_pull_request"]);

function allowedOwners(): Set<string> {
  return new Set(
    (process.env.KAFKA_GITHUB_ALLOWED_OWNERS || "KAFKA2306")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function assertOwner(owner: string): void {
  if (!allowedOwners().has(owner)) {
    throw new Error(`GitHub owner is outside KAFKA_GITHUB_ALLOWED_OWNERS: ${owner}`);
  }
}

function headers(): Record<string, string> {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "KAFKA-OpenClaw-GitHub-Operations",
  };
  if (process.env.GITHUB_TOKEN) {
    result.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return result;
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...headers(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    // Keep the raw response text for error reporting.
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : text;
    throw new Error(`GitHub ${method} ${path} failed (${response.status}): ${message}`);
  }
  return payload;
}

function toolResult(details: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(details, null, 2) }],
    details,
  };
}

export default definePluginEntry({
  id: "kafka-github-operations",
  name: "KAFKA GitHub Operations",
  description: "Owner-scoped GitHub operations for an explicit local-worker task.",
  register(api) {
    api.registerTool({
      name: "kafka_github_get_repository",
      description: "Read current GitHub repository metadata for an allowed owner.",
      parameters: Type.Object({
        owner: Type.String({ minLength: 1 }),
        repo: Type.String({ minLength: 1 }),
      }),
      async execute(_id, params) {
        assertOwner(params.owner);
        return toolResult(
          await request(
            "GET",
            `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}`,
          ),
        );
      },
    });

    api.registerTool({
      name: "kafka_github_create_pull_request",
      description:
        "Create a reviewable GitHub pull request between existing refs for an explicit task. This tool does not create commits or merge the PR.",
      parameters: Type.Object({
        owner: Type.String({ minLength: 1 }),
        repo: Type.String({ minLength: 1 }),
        title: Type.String({ minLength: 1, maxLength: 256 }),
        head: Type.String({ minLength: 1 }),
        base: Type.String({ minLength: 1 }),
        body: Type.Optional(Type.String()),
        draft: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        assertOwner(params.owner);
        if (!process.env.GITHUB_TOKEN) {
          throw new Error("GITHUB_TOKEN is required for GitHub writes");
        }
        return toolResult(
          await request(
            "POST",
            `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/pulls`,
            {
              title: params.title,
              head: params.head,
              base: params.base,
              body: params.body ?? "",
              draft: params.draft ?? false,
            },
          ),
        );
      },
    });

    api.on("before_tool_call", (event) => {
      if (!writeTools.has(event.toolName) || process.env.KAFKA_GITHUB_REQUIRE_APPROVAL === "0") {
        return;
      }
      return {
        requireApproval: {
          title: "KAFKA GitHub write",
          description: `${event.toolName} will create GitHub metadata. Review owner/repository and payload before allowing it.`,
          severity: "warning",
          allowedDecisions: ["allow-once", "allow-always", "deny"],
          pluginId: "kafka-github-operations",
        },
      };
    });
  },
});
