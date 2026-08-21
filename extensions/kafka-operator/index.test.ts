import { describe, expect, it } from "vitest";
import {
  isAllowedWriteOwner,
  shouldRequireEvidenceRevision,
  shouldRouteCheapTask,
} from "./index.js";

describe("kafka-operator policy helpers", () => {
  it("fails closed when no GitHub owner allowlist is configured", () => {
    expect(isAllowedWriteOwner("KAFKA2306", undefined)).toBe(false);
    expect(isAllowedWriteOwner("KAFKA2306", [])).toBe(false);
  });

  it("matches allowed owners case-insensitively", () => {
    expect(isAllowedWriteOwner("KAFKA2306", ["kafka2306"])).toBe(true);
    expect(isAllowedWriteOwner("other", ["KAFKA2306"])).toBe(false);
  });

  it("requires one bounded evidence revision for material source-free prose", () => {
    const factual =
      "2026年現在のversionは更新され、APIの仕様にも変更があります。".repeat(12);
    expect(shouldRequireEvidenceRevision(factual, 100)).toBe(true);
    expect(
      shouldRequireEvidenceRevision(`${factual} https://docs.openclaw.ai/plugins/hooks`, 100),
    ).toBe(false);
  });

  it("does not force citations on short or non-factual prose", () => {
    expect(shouldRequireEvidenceRevision("短い返答です。", 100)).toBe(false);
    expect(shouldRequireEvidenceRevision("文章を自然な日本語に整えました。".repeat(20), 100)).toBe(
      false,
    );
  });

  it("routes only cheap deterministic tasks", () => {
    expect(shouldRouteCheapTask("次の文章を要約してください")).toBe(true);
    expect(shouldRouteCheapTask("Classify these rows into three categories")).toBe(true);
    expect(shouldRouteCheapTask("最新情報を調査して検証してください")).toBe(false);
    expect(shouldRouteCheapTask("Summarize the latest GitHub issues")).toBe(false);
  });
});
