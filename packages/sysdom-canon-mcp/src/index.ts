import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readConfigFromEnv, type SysdomCanonConfig } from "./config.js";
import { DifyKnowledgeRetriever } from "./dify.js";
import type { CanonRetriever } from "./retriever.js";
import { createQuerySysdomCanonTool } from "./tools.js";

export function createSysdomCanonMcpServer(
  config: SysdomCanonConfig = readConfigFromEnv(),
  retriever: CanonRetriever = new DifyKnowledgeRetriever(config),
) {
  const server = new McpServer({
    name: "sysdom-canon",
    version: "0.1.0",
  });

  const tool = createQuerySysdomCanonTool(retriever, config.defaultTopK);
  server.registerTool(
    tool.name,
    {
      title: "Query Sysdom canon",
      description: tool.description,
      inputSchema: tool.schema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    tool.execute,
  );

  return { server, tool, retriever };
}

export async function runServer(config: SysdomCanonConfig = readConfigFromEnv()) {
  const { server } = createSysdomCanonMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export type { CanonPassage, CanonQuery, CanonQueryResult, CanonRetriever } from "./retriever.js";
export { DifyKnowledgeRetriever, DifyRetrievalError } from "./dify.js";
export { readConfigFromEnv } from "./config.js";
export { readHttpConfigFromEnv } from "./http-config.js";
export { createSysdomCanonHttpService } from "./http-server.js";
export { createQuerySysdomCanonTool } from "./tools.js";
