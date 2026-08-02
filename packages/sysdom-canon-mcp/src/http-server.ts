import { createHash, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server as NodeHttpServer,
  type ServerResponse,
} from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { SysdomCanonConfig } from "./config.js";
import type { SysdomCanonHttpConfig } from "./http-config.js";
import { createSysdomCanonMcpServer } from "./index.js";
import type { CanonRetriever } from "./retriever.js";

export interface HttpServiceLogger {
  info: (event: Record<string, unknown>) => void;
  error: (event: Record<string, unknown>) => void;
}

export interface SysdomCanonHttpService {
  httpServer: NodeHttpServer;
  listen: () => Promise<{ host: string; port: number }>;
  close: () => Promise<void>;
}

const defaultLogger: HttpServiceLogger = {
  info: (event) => console.log(JSON.stringify(event)),
  error: (event) => console.error(JSON.stringify(event)),
};

function writeJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function pathname(request: IncomingMessage): string | null {
  try {
    return new URL(request.url ?? "/", "http://localhost").pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

function requestHost(request: IncomingMessage): string | null {
  const raw = request.headers.host?.trim();
  if (!raw) return null;
  try {
    return new URL(`http://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function equalSecret(candidate: string, expected: string): boolean {
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

function isAuthorized(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 && equalSecret(token, expectedToken);
}

function isOversized(request: IncomingMessage, maximum: number): boolean {
  const value = request.headers["content-length"];
  if (typeof value !== "string") return false;
  const length = Number(value);
  return Number.isFinite(length) && length > maximum;
}

export function createSysdomCanonHttpService(
  canonConfig: SysdomCanonConfig,
  httpConfig: SysdomCanonHttpConfig,
  retriever?: CanonRetriever,
  logger: HttpServiceLogger = defaultLogger,
): SysdomCanonHttpService {
  const activeServers = new Set<ReturnType<typeof createSysdomCanonMcpServer>["server"]>();

  const httpServer = createServer(async (request, response) => {
    const path = pathname(request);
    const host = requestHost(request);

    if (!path || !host || !httpConfig.allowedHosts.has(host)) {
      writeJson(response, 421, { error: "misdirected_request" });
      return;
    }

    if (path === httpConfig.healthPath && request.method === "GET") {
      writeJson(response, 200, {
        status: "ok",
        service: "sysdom-canon-mcp",
        retrievalOnly: true,
      });
      return;
    }

    if (path !== httpConfig.mcpPath) {
      writeJson(response, 404, { error: "not_found" });
      return;
    }

    if (!isAuthorized(request, httpConfig.bearerToken)) {
      writeJson(
        response,
        401,
        { error: "unauthorized" },
        { "WWW-Authenticate": 'Bearer realm="sysdom-canon-mcp"' },
      );
      return;
    }

    if (isOversized(request, httpConfig.maxContentLengthBytes)) {
      writeJson(response, 413, { error: "request_too_large" });
      return;
    }

    let requestMcpServer: ReturnType<typeof createSysdomCanonMcpServer>["server"] | null = null;
    try {
      // The MCP SDK requires a fresh stateless transport for every request.
      // A fresh MCP server keeps each request independent while the retriever
      // remains shared and read-only.
      const { server: mcpServer } = createSysdomCanonMcpServer(canonConfig, retriever);
      requestMcpServer = mcpServer;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      activeServers.add(mcpServer);
      await mcpServer.connect(transport);
      await transport.handleRequest(request, response);
    } catch (error) {
      logger.error({
        event: "sysdom_canon_mcp_request_failed",
        method: request.method,
        path,
        error: error instanceof Error ? error.name : "unknown_error",
      });
      if (!response.headersSent) {
        writeJson(response, 500, { error: "internal_error" });
      } else {
        response.end();
      }
    } finally {
      if (requestMcpServer) {
        activeServers.delete(requestMcpServer);
        await requestMcpServer.close().catch(() => undefined);
      }
    }
  });

  httpServer.requestTimeout = 15_000;
  httpServer.headersTimeout = 10_000;
  httpServer.keepAliveTimeout = 5_000;

  return {
    httpServer,
    listen: async () => {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          httpServer.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          httpServer.off("error", onError);
          resolve();
        };
        httpServer.once("error", onError);
        httpServer.once("listening", onListening);
        httpServer.listen(httpConfig.port, httpConfig.host);
      });

      const address = httpServer.address();
      if (!address || typeof address === "string") {
        throw new Error("HTTP service did not bind to a TCP address");
      }

      logger.info({
        event: "sysdom_canon_mcp_started",
        host: httpConfig.host,
        port: address.port,
        mcpPath: httpConfig.mcpPath,
      });
      return { host: httpConfig.host, port: address.port };
    },
    close: async () => {
      if (httpServer.listening) {
        await new Promise<void>((resolve, reject) => {
          httpServer.close((error) => (error ? reject(error) : resolve()));
        });
      }
      await Promise.all([...activeServers].map((server) => server.close()));
      activeServers.clear();
    },
  };
}
