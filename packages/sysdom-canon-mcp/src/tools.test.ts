import { describe, expect, it, vi } from "vitest";
import { createGetSysdomDestinationsTool } from "./destinations.js";
import { DifyRetrievalError } from "./dify.js";
import type { CanonRetriever } from "./retriever.js";
import { createQuerySysdomCanonTool } from "./tools.js";

describe("query_sysdom_canon", () => {
  it("returns structured, cited retrieval results without an answer", async () => {
    const retriever: CanonRetriever = {
      query: vi.fn().mockResolvedValue({
        query: "What is SIM?",
        passages: [
          {
            title: "Systems Intelligence Architecture",
            url: "https://sysdom.ai/articles/systems-intelligence-architecture",
            content: "SIM is the method beneath the agentic venture builder.",
            score: 0.9,
            documentId: "doc-1",
            chunkId: "chunk-1",
          },
        ],
      }),
    };
    const tool = createQuerySysdomCanonTool(retriever, 5);

    const result = await tool.execute({ query: " What is SIM? " });

    expect(retriever.query).toHaveBeenCalledWith({
      query: "What is SIM?",
      topK: 5,
      scoreThreshold: null,
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      count: 1,
      retrievalOnly: true,
    });
    expect(result.content[0]?.text).toContain("chunk-1");
  });

  it("rejects invalid requests before retrieval", async () => {
    const retriever: CanonRetriever = { query: vi.fn() };
    const tool = createQuerySysdomCanonTool(retriever);

    const result = await tool.execute({ query: "x", topK: 100 });

    expect(retriever.query).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isError: true });
    expect(result.content[0]?.text).toContain("invalid_request");
  });

  it("does not expose upstream error details", async () => {
    const retriever: CanonRetriever = {
      query: vi.fn().mockRejectedValue(
        new DifyRetrievalError("upstream_error", "Bearer secret-token failed", 401),
      ),
    };
    const tool = createQuerySysdomCanonTool(retriever);

    const result = await tool.execute({ query: "What is SIM?" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("retrieval_unavailable");
    expect(result.content[0]?.text).not.toContain("secret-token");
    expect(result.content[0]?.text).not.toContain("401");
  });
});

describe("get_sysdom_destinations", () => {
  it("returns exact official book destinations without calling Dify", async () => {
    const result = await createGetSysdomDestinationsTool().execute({ category: "book" });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      category: "book",
      count: 3,
      staticRegistry: true,
    });
    expect(result.content[0]?.text).toContain("https://maven.com/hankay/o/a29142");
    expect(result.content[0]?.text).toContain("https://www.amazon.com/dp/B0H3WSLJDZ");
  });

  it("rejects unknown destination categories", async () => {
    const result = await createGetSysdomDestinationsTool().execute({ category: "social" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("invalid_request");
  });
});
