import { z } from "zod";

export interface SysdomCanonHttpConfig {
  host: string;
  port: number;
  mcpPath: string;
  healthPath: string;
  bearerToken: string;
  allowedHosts: ReadonlySet<string>;
  maxContentLengthBytes: number;
}

function nonEmpty(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (!nonEmpty(value)) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function parsePath(value: string | undefined, fallback: string, name: string): string {
  const parsed = nonEmpty(value) ?? fallback;
  if (!parsed.startsWith("/") || parsed.includes("?") || parsed.includes("#")) {
    throw new Error(`${name} must be an absolute URL path`);
  }
  return parsed.length > 1 ? parsed.replace(/\/+$/, "") : parsed;
}

function normalizeHost(value: string): string {
  const parsed = z.string().trim().min(1).parse(value).toLowerCase();
  if (parsed.includes("/") || parsed.includes("://")) {
    throw new Error("Allowed hosts must be hostnames, not URLs");
  }
  return parsed.replace(/^\[/, "").replace(/\]$/, "");
}

function parseAllowedHosts(value: string | undefined, listenHost: string): ReadonlySet<string> {
  const configured = nonEmpty(value)
    ?.split(",")
    .map((host) => normalizeHost(host))
    .filter(Boolean) ?? [];

  return new Set([
    "localhost",
    "127.0.0.1",
    "::1",
    normalizeHost(listenHost),
    ...configured,
  ]);
}

export function readHttpConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SysdomCanonHttpConfig {
  const bearerToken = nonEmpty(env.SYSDOM_CANON_MCP_TOKEN);
  if (!bearerToken || bearerToken.length < 32) {
    throw new Error("SYSDOM_CANON_MCP_TOKEN must contain at least 32 characters");
  }

  const host = nonEmpty(env.SYSDOM_CANON_HTTP_HOST) ?? "127.0.0.1";
  return {
    host,
    port: parseInteger(env.SYSDOM_CANON_HTTP_PORT, 3215, 0, 65_535, "SYSDOM_CANON_HTTP_PORT"),
    mcpPath: parsePath(env.SYSDOM_CANON_MCP_PATH, "/mcp", "SYSDOM_CANON_MCP_PATH"),
    healthPath: parsePath(
      env.SYSDOM_CANON_HEALTH_PATH,
      "/healthz",
      "SYSDOM_CANON_HEALTH_PATH",
    ),
    bearerToken,
    allowedHosts: parseAllowedHosts(env.SYSDOM_CANON_ALLOWED_HOSTS, host),
    maxContentLengthBytes: parseInteger(
      env.SYSDOM_CANON_MAX_REQUEST_BYTES,
      262_144,
      1_024,
      1_048_576,
      "SYSDOM_CANON_MAX_REQUEST_BYTES",
    ),
  };
}
