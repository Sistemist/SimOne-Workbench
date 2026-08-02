import { describe, expect, it, vi } from "vitest";
import type { SysdomCanonConfig } from "./config.js";
import { DifyKnowledgeRetriever, DifyRetrievalError } from "./dify.js";

const config: SysdomCanonConfig = {
  apiUrl: "https://api.dify.test/v1",
  apiKey: "secret-token",
  datasetId: "11111111-1111-4111-8111-111111111111",
  timeoutMs: 1_000,
  defaultTopK: 5,
  searchMethod: "keyword_search",
  maxPassageChars: 30,
  maxTotalChars: 45,
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DifyKnowledgeRetriever", () => {
  it("sends a retrieval-only request and normalizes cited passages", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      records: [
        {
          segment: {
            id: "chunk-1",
            document_id: "document-1",
            content: "A verified Sysdom canon passage that is deliberately long.",
            document: {
              id: "document-1",
              name: "Systems Intelligence Architecture",
              doc_metadata: { canonical_url: "https://sysdom.ai/articles/systems-intelligence-architecture" },
            },
          },
          score: 0.91,
        },
      ],
    }));
    const retriever = new DifyKnowledgeRetriever(config, fetchFn);

    const result = await retriever.query({
      query: "What is Systems Intelligence?",
      topK: 3,
      scoreThreshold: 0.4,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.dify.test/v1/datasets/11111111-1111-4111-8111-111111111111/retrieve",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    expect(JSON.parse(String(init.body))).toEqual({
      query: "What is Systems Intelligence?",
      retrieval_model: {
        search_method: "keyword_search",
        reranking_enable: false,
        top_k: 3,
        score_threshold_enabled: true,
        score_threshold: 0.4,
      },
    });
    expect(result.passages).toEqual([
      {
        title: "Systems Intelligence Architecture",
        url: "https://sysdom.ai/articles/systems-intelligence-architecture",
        content: "A verified Sysdom canon passa…",
        score: 0.91,
        documentId: "document-1",
        chunkId: "chunk-1",
      },
    ]);
  });

  it("drops malformed records and enforces the total response bound", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({
      records: [
        { segment: { id: "bad", document_id: "bad" }, score: 1 },
        {
          segment: {
            id: "chunk-1",
            document_id: "document-1",
            content: "123456789012345678901234567890",
            document: { name: "One" },
          },
          score: 0.8,
        },
        {
          segment: {
            id: "chunk-2",
            document_id: "document-2",
            content: "abcdefghijklmnopqrstuvwxyz",
            document: { name: "Two" },
          },
          score: 0.7,
        },
      ],
    }));
    const retriever = new DifyKnowledgeRetriever(config, fetchFn);

    const result = await retriever.query({ query: "bounds", topK: 5, scoreThreshold: null });

    expect(result.passages).toHaveLength(2);
    expect(result.passages.map((passage) => passage.content.length).reduce((a, b) => a + b, 0))
      .toBeLessThanOrEqual(45);
  });

  it("returns a sanitized upstream error", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ message: "credential secret-token failed" }, 401),
    );
    const retriever = new DifyKnowledgeRetriever(config, fetchFn);

    await expect(
      retriever.query({ query: "test", topK: 5, scoreThreshold: null }),
    ).rejects.toMatchObject({
      code: "upstream_error",
      status: 401,
      message: "Canon retrieval upstream returned 401",
    });
  });
});
