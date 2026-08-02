import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readConfigFromEnv, type SysdomCanonConfig } from "./config.js";
import { createGetSysdomDestinationsTool } from "./destinations.js";
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
  const destinationsTool = createGetSysdomDestinationsTool();
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
  server.registerTool(
    destinationsTool.name,
    {
      title: "Get Sysdom destinations",
      description: destinationsTool.description,
      inputSchema: destinationsTool.schema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    destinationsTool.execute,
  );

  return { server, tool, destinationsTool, retriever };
}

export async function runServer(config: SysdomCanonConfig = readConfigFromEnv()) {
  const { server } = createSysdomCanonMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export type { CanonPassage, CanonQuery, CanonQueryResult, CanonRetriever } from "./retriever.js";
export { DifyKnowledgeRetriever, DifyRetrievalError } from "./dify.js";
export { readConfigFromEnv } from "./config.js";
export {
  createGetSysdomDestinationsTool,
  SYSDOM_DESTINATIONS,
  sysdomDestinationCategorySchema,
} from "./destinations.js";
export type {
  SysdomDestination,
  SysdomDestinationCategory,
} from "./destinations.js";
export { readHttpConfigFromEnv } from "./http-config.js";
export { createSysdomCanonHttpService } from "./http-server.js";
export { createQuerySysdomCanonTool } from "./tools.js";
