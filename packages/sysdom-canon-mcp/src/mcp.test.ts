import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import type { SysdomCanonConfig } from "./config.js";
import { createSysdomCanonMcpServer } from "./index.js";
import type { CanonRetriever } from "./retriever.js";

const config: SysdomCanonConfig = {
  apiUrl: "https://api.dify.test/v1",
  apiKey: "server-side-only",
  datasetId: "11111111-1111-4111-8111-111111111111",
  timeoutMs: 1_000,
  defaultTopK: 5,
  searchMethod: "keyword_search",
  maxPassageChars: 4_000,
  maxTotalChars: 16_000,
};

describe("Sysdom canon MCP protocol", () => {
  it("advertises and executes the read-only canon tool", async () => {
    const retriever: CanonRetriever = {
      query: async (input) => ({
        query: input.query,
        passages: [{
          title: "Sysdom Thesis",
          url: "https://sysdom.ai/articles/the-sysdom-thesis",
          content: "The product centers one living venture model.",
          score: 0.88,
          documentId: "doc-1",
          chunkId: "chunk-1",
        }],
      }),
    };
    const { server } = createSysdomCanonMcpServer(config, retriever);
    const client = new Client({ name: "sysdom-canon-test", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    try {
      const listed = await client.listTools();
      expect(listed.tools).toEqual([
        expect.objectContaining({
          name: "query_sysdom_canon",
          annotations: expect.objectContaining({
            readOnlyHint: true,
            destructiveHint: false,
          }),
        }),
      ]);

      const result = await client.callTool({
        name: "query_sysdom_canon",
        arguments: { query: "What is the Sysdom thesis?" },
      });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([
        expect.objectContaining({
          type: "text",
          text: expect.stringContaining("chunk-1"),
        }),
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
