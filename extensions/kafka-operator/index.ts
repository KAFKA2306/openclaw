import { Type } from "typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

type KafkaOperatorConfig = {
  github?: {
    tokenEnv?: string;
    allowedOwners?: string[];
  };
  evidence?: {
    enabled?: boolean;
    agentIds?: string[];
    minChars?: number;
  };
  routing?: {
    enabled?: boolean;
    agentIds?: string[];
    provider?: string;
    model?: string;
  };
};

type GithubRequestOptions = {
  method?: string;
  body?: unknown;
  requireAuth?: boolean;
};

const WRITE_TOOL_NAMES = new Set([
  "kafka_github_issue_create",
  "kafka_github_branch_create",
  "kafka_github_pr_create",
]);

const CHEAP_TASK_RE =
  /(?:^|\b)(summari[sz]e|summary|classif(?:y|ication)|extract|normalize|format|translate|translation)(?:\b|$)|(?:要約|分類|抽出|整形|正規化|翻訳)/i;
const EXPENSIVE_OR_RISKY_RE =
  /(?:latest|current|research|verify|verification|source|citation|github|issue|pull request|\bpr\b|commit|merge|delete|security|vulnerab|financial|investment|trading|medical|legal|最新|現在|調査|検証|出典|一次情報|イシュー|コミット|マージ|削除|金融|投資|株|医療|法務)/i;
const MATERIAL_FACT_RE =
  /(?:https?:\/\/|\b20\d{2}\b|\b\d+(?:\.\d+)?%\b|\b(?:sha|commit|version|release|api|r²|usd)\b|最新|現在|公式|一次情報|実測|検証|によると|円|ドル)/i;
const URL_RE = /https:\/\/[^\s<>()\]["']+/g;

function readConfig(pluginConfig: unknown): KafkaOperatorConfig {
  return (pluginConfig ?? {}) as KafkaOperatorConfig;
}

function parseRepo(raw: string): { owner: string; repo: string } {
  const value = raw.trim();
  const match = value.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) {
    throw new Error("repo must be in owner/name form");
  }
  return { owner: match[1]!, repo: match[2]! };
}

export function isAllowedWriteOwner(owner: string, allowedOwners?: string[]): boolean {
  const allowed = (allowedOwners ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
  return allowed.length > 0 && allowed.includes(owner.trim().toLowerCase());
}

export function shouldRequireEvidenceRevision(text: string, minChars = 220): boolean {
  const trimmed = text.trim();
  if (trimmed.length < minChars || !MATERIAL_FACT_RE.test(trimmed)) {
    return false;
  }
  return (trimmed.match(URL_RE) ?? []).length === 0;
}

export function shouldRouteCheapTask(prompt: string): boolean {
  const trimmed = prompt.trim();
  return trimmed.length > 0 && CHEAP_TASK_RE.test(trimmed) && !EXPENSIVE_OR_RISKY_RE.test(trimmed);
}

function selectedAgent(agentId: string | undefined, configured?: string[]): boolean {
  const ids = (configured ?? []).map((value) => value.trim()).filter(Boolean);
  return ids.length === 0 || (agentId ? ids.includes(agentId) : false);
}

function tokenFor(config: KafkaOperatorConfig): string | undefined {
  const envName = config.github?.tokenEnv?.trim() || "GITHUB_TOKEN";
  const token = process.env[envName]?.trim();
  return token || undefined;
}

async function githubJson(
  path: string,
  config: KafkaOperatorConfig,
  options: GithubRequestOptions = {},
): Promise<{ status: number; body: any }> {
  const token = tokenFor(config);
  if (options.requireAuth && !token) {
    const envName = config.github?.tokenEnv?.trim() || "GITHUB_TOKEN";
    throw new Error(`GitHub write requires ${envName}`);
  }
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "openclaw-kafka-operator",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body: any = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text.slice(0, 500) };
    }
  }
  return { status: response.status, body };
}

function requireWriteRepo(rawRepo: string, config: KafkaOperatorConfig) {
  const parsed = parseRepo(rawRepo);
  if (!isAllowedWriteOwner(parsed.owner, config.github?.allowedOwners)) {
    throw new Error(
      `GitHub writes are denied for ${parsed.owner}; configure plugins.entries.kafka-operator.config.github.allowedOwners`,
    );
  }
  return parsed;
}

function assertGithubOk(result: { status: number; body: any }, operation: string) {
  if (result.status >= 200 && result.status < 300) {
    return;
  }
  const message =
    result.body && typeof result.body.message === "string" ? result.body.message : "unknown error";
  throw new Error(`${operation} failed (${result.status}): ${message}`);
}

function toolResult(details: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(details, null, 2) }],
    details,
  };
}

export default definePluginEntry({
  id: "kafka-operator",
  name: "KAFKA Operator",
  description: "Typed GitHub operations, write approvals, evidence gating, and optional task routing.",
  register(api) {
    const config = readConfig(api.pluginConfig);

    api.registerTool({
      name: "kafka_github_repo_state",
      description:
        "Read authoritative GitHub repository metadata and the default branch head for one owner/name repository.",
      parameters: Type.Object({ repo: Type.String() }, { additionalProperties: false }),
      async execute(_id, params) {
        const parsed = parseRepo(params.repo);
        const repoResult = await githubJson(`/repos/${parsed.owner}/${parsed.repo}`, config);
        assertGithubOk(repoResult, "read repository");
        const defaultBranch = repoResult.body?.default_branch;
        let branch: unknown = undefined;
        if (typeof defaultBranch === "string" && defaultBranch) {
          const branchResult = await githubJson(
            `/repos/${parsed.owner}/${parsed.repo}/branches/${encodeURIComponent(defaultBranch)}`,
            config,
          );
          assertGithubOk(branchResult, "read default branch");
          branch = {
            name: defaultBranch,
            sha: branchResult.body?.commit?.sha,
            protected: branchResult.body?.protected,
          };
        }
        return toolResult({
          full_name: repoResult.body?.full_name,
          html_url: repoResult.body?.html_url,
          default_branch: defaultBranch,
          branch,
          has_issues: repoResult.body?.has_issues,
          open_issues_count: repoResult.body?.open_issues_count,
          pushed_at: repoResult.body?.pushed_at,
          archived: repoResult.body?.archived,
        });
      },
    });
    api.registerToolMetadata({
      toolName: "kafka_github_repo_state",
      displayName: "GitHub Repository State",
      description: "Read repository metadata and the current default-branch SHA.",
      risk: "low",
      tags: ["github", "read"],
    });

    api.registerTool({
      name: "kafka_github_issue_create",
      description:
        "Create one GitHub Issue in an explicitly allowed owner. Exact open-title duplicates are returned instead of recreated.",
      parameters: Type.Object(
        {
          repo: Type.String(),
          title: Type.String({ minLength: 1 }),
          body: Type.Optional(Type.String()),
          labels: Type.Optional(Type.Array(Type.String())),
        },
        { additionalProperties: false },
      ),
      async execute(_id, params) {
        const { owner, repo } = requireWriteRepo(params.repo, config);
        const q = encodeURIComponent(`repo:${owner}/${repo} is:issue is:open in:title ${params.title}`);
        const search = await githubJson(`/search/issues?q=${q}&per_page=20`, config);
        assertGithubOk(search, "search issue duplicates");
        const existing = Array.isArray(search.body?.items)
          ? search.body.items.find((item: any) => item?.title === params.title)
          : undefined;
        if (existing) {
          return toolResult({ deduped: true, number: existing.number, html_url: existing.html_url });
        }
        const created = await githubJson(`/repos/${owner}/${repo}/issues`, config, {
          method: "POST",
          requireAuth: true,
          body: {
            title: params.title,
            ...(params.body ? { body: params.body } : {}),
            ...(params.labels ? { labels: params.labels } : {}),
          },
        });
        assertGithubOk(created, "create issue");
        return toolResult({
          deduped: false,
          number: created.body?.number,
          html_url: created.body?.html_url,
          state: created.body?.state,
        });
      },
    });
    api.registerToolMetadata({
      toolName: "kafka_github_issue_create",
      displayName: "Create GitHub Issue",
      description: "Create an issue in an allowlisted GitHub owner.",
      risk: "high",
      tags: ["github", "write", "issue"],
    });

    api.registerTool({
      name: "kafka_github_branch_create",
      description:
        "Create a GitHub branch from a named base branch in an explicitly allowed owner; return the existing branch when already present.",
      parameters: Type.Object(
        {
          repo: Type.String(),
          branch: Type.String({ minLength: 1 }),
          base: Type.Optional(Type.String({ minLength: 1, default: "main" })),
        },
        { additionalProperties: false },
      ),
      async execute(_id, params) {
        const { owner, repo } = requireWriteRepo(params.repo, config);
        const branch = params.branch.trim();
        const base = params.base?.trim() || "main";
        const existing = await githubJson(
          `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
          config,
        );
        if (existing.status === 200) {
          return toolResult({
            deduped: true,
            branch,
            sha: existing.body?.object?.sha,
            html_url: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branch)}`,
          });
        }
        if (existing.status !== 404) {
          assertGithubOk(existing, "check branch");
        }
        const baseRef = await githubJson(
          `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(base)}`,
          config,
        );
        assertGithubOk(baseRef, "read base branch");
        const sha = baseRef.body?.object?.sha;
        if (typeof sha !== "string" || !sha) {
          throw new Error("base branch did not resolve to a commit SHA");
        }
        const created = await githubJson(`/repos/${owner}/${repo}/git/refs`, config, {
          method: "POST",
          requireAuth: true,
          body: { ref: `refs/heads/${branch}`, sha },
        });
        assertGithubOk(created, "create branch");
        return toolResult({
          deduped: false,
          branch,
          sha: created.body?.object?.sha,
          html_url: `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(branch)}`,
        });
      },
    });
    api.registerToolMetadata({
      toolName: "kafka_github_branch_create",
      displayName: "Create GitHub Branch",
      description: "Create an allowlisted GitHub branch without force-updating refs.",
      risk: "high",
      tags: ["github", "write", "branch"],
    });

    api.registerTool({
      name: "kafka_github_pr_create",
      description:
        "Create one GitHub pull request in an explicitly allowed owner; reuse an existing open PR for the same head/base pair.",
      parameters: Type.Object(
        {
          repo: Type.String(),
          title: Type.String({ minLength: 1 }),
          head: Type.String({ minLength: 1 }),
          base: Type.Optional(Type.String({ minLength: 1, default: "main" })),
          body: Type.Optional(Type.String()),
          draft: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
      async execute(_id, params) {
        const { owner, repo } = requireWriteRepo(params.repo, config);
        const base = params.base?.trim() || "main";
        const head = params.head.trim();
        const existing = await githubJson(
          `/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${head}`)}&base=${encodeURIComponent(base)}&per_page=10`,
          config,
        );
        assertGithubOk(existing, "search pull request duplicates");
        if (Array.isArray(existing.body) && existing.body.length > 0) {
          const pr = existing.body[0];
          return toolResult({ deduped: true, number: pr?.number, html_url: pr?.html_url });
        }
        const created = await githubJson(`/repos/${owner}/${repo}/pulls`, config, {
          method: "POST",
          requireAuth: true,
          body: {
            title: params.title,
            head,
            base,
            ...(params.body ? { body: params.body } : {}),
            draft: params.draft === true,
          },
        });
        assertGithubOk(created, "create pull request");
        return toolResult({
          deduped: false,
          number: created.body?.number,
          html_url: created.body?.html_url,
          state: created.body?.state,
          draft: created.body?.draft,
        });
      },
    });
    api.registerToolMetadata({
      toolName: "kafka_github_pr_create",
      displayName: "Create GitHub Pull Request",
      description: "Create an allowlisted GitHub pull request.",
      risk: "high",
      tags: ["github", "write", "pull-request"],
    });

    api.on("before_tool_call", async (event) => {
      if (!WRITE_TOOL_NAMES.has(event.toolName)) {
        return;
      }
      const target = typeof event.params.repo === "string" ? event.params.repo : "unknown repository";
      return {
        requireApproval: {
          title: "Approve GitHub write",
          description: `${event.toolName} will modify ${target}.`,
          severity: "warning",
          allowedDecisions: ["allow-once", "deny"],
          timeoutMs: 120_000,
        },
      };
    });

    api.on("before_agent_finalize", async (event, ctx) => {
      const evidence = config.evidence;
      if (evidence?.enabled === false || !selectedAgent(ctx.agentId, evidence?.agentIds)) {
        return;
      }
      const answer = event.lastAssistantMessage ?? "";
      const minChars =
        typeof evidence?.minChars === "number" && Number.isFinite(evidence.minChars)
          ? Math.max(1, Math.floor(evidence.minChars))
          : 220;
      if (!shouldRequireEvidenceRevision(answer, minChars)) {
        return;
      }
      return {
        action: "revise" as const,
        reason: "Material factual claims are present but no direct HTTPS source URL is included.",
        retry: {
          instruction:
            "Verify material factual claims against primary sources, include direct HTTPS URLs next to the supported claims, and remove or qualify claims that cannot be verified. A URL is evidence metadata, not proof by itself.",
          idempotencyKey: "kafka-operator:evidence-url-v1",
          maxAttempts: 1,
        },
      };
    });

    api.on("before_model_resolve", async (event, ctx) => {
      const routing = config.routing;
      if (
        routing?.enabled !== true ||
        !selectedAgent(ctx.agentId, routing.agentIds) ||
        (event.attachments?.length ?? 0) > 0 ||
        !shouldRouteCheapTask(event.prompt)
      ) {
        return;
      }
      const provider = routing.provider?.trim();
      const model = routing.model?.trim();
      if (!provider || !model) {
        return;
      }
      return { providerOverride: provider, modelOverride: model };
    });
  },
});
