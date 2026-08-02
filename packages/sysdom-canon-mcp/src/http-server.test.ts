import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it } from "vitest";
import type { SysdomCanonConfig } from "./config.js";
import type { SysdomCanonHttpConfig } from "./http-config.js";
import {
  createSysdomCanonHttpService,
  type SysdomCanonHttpService,
} from "./http-server.js";
import type { CanonRetriever } from "./retriever.js";

const canonConfig: SysdomCanonConfig = {
  apiUrl: "https://api.dify.test/v1",
  apiKey: "server-side-only",
  datasetId: "11111111-1111-4111-8111-111111111111",
  timeoutMs: 1_000,
  defaultTopK: 5,
  searchMethod: "keyword_search",
  maxPassageChars: 4_000,
  maxTotalChars: 16_000,
};

const token = "test-token-".padEnd(40, "x");
const httpConfig: SysdomCanonHttpConfig = {
  host: "127.0.0.1",
  port: 0,
  mcpPath: "/mcp",
  healthPath: "/healthz",
  bearerToken: token,
  allowedHosts: new Set(["127.0.0.1"]),
  maxContentLengthBytes: 262_144,
};

const retriever: CanonRetriever = {
  query: async (input) => ({
    query: input.query,
    passages: [{
      title: "Systems Intelligence Architecture",
      url: "https://sysdom.ai/articles/systems-intelligence-architecture",
      content: "The map preserves one coherent venture model.",
      score: 0.91,
      documentId: "doc-1",
      chunkId: "chunk-1",
    }],
  }),
};

const quietLogger = {
  info: () => undefined,
  error: () => undefined,
};

let service: SysdomCanonHttpService | null = null;

afterEach(async () => {
  await service?.close();
  service = null;
});

describe("Sysdom canon Streamable HTTP service", () => {
  it("serves public health without exposing configuration", async () => {
    service = createSysdomCanonHttpService(
      canonConfig,
      httpConfig,
      retriever,
      quietLogger,
    );
    const { port } = await service.listen();
    const response = await fetch(`http://127.0.0.1:${port}/healthz`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "sysdom-canon-mcp",
      retrievalOnly: true,
    });
  });

  it("rejects unauthenticated MCP requests", async () => {
    service = createSysdomCanonHttpService(
      canonConfig,
      httpConfig,
      retriever,
      quietLogger,
    );
    const { port } = await service.listen();
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("executes the read-only tool over authenticated Streamable HTTP", async () => {
    service = createSysdomCanonHttpService(
      canonConfig,
      httpConfig,
      retriever,
      quietLogger,
    );
    const { port } = await service.listen();
    const client = new Client({ name: "sysdom-http-test", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`),
      {
        requestInit: {
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    );

    await client.connect(transport);
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
        "get_sysdom_destinations",
        "query_sysdom_canon",
      ]);

      const result = await client.callTool({
        name: "query_sysdom_canon",
        arguments: { query: "What does the map preserve?" },
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
    }
  });
});
