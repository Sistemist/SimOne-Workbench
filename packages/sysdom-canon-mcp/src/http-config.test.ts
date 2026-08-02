import { describe, expect, it } from "vitest";
import { readHttpConfigFromEnv } from "./http-config.js";

describe("Sysdom canon HTTP config", () => {
  it("uses a private listener and bounded defaults", () => {
    const config = readHttpConfigFromEnv({
      SYSDOM_CANON_MCP_TOKEN: "x".repeat(32),
    });

    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(3215);
    expect(config.mcpPath).toBe("/mcp");
    expect(config.healthPath).toBe("/healthz");
    expect(config.allowedHosts).toEqual(
      new Set(["localhost", "127.0.0.1", "::1"]),
    );
    expect(config.maxContentLengthBytes).toBe(262_144);
  });

  it("requires a strong bearer token", () => {
    expect(() => readHttpConfigFromEnv({})).toThrow("at least 32 characters");
    expect(() =>
      readHttpConfigFromEnv({ SYSDOM_CANON_MCP_TOKEN: "too-short" }),
    ).toThrow("at least 32 characters");
  });

  it("accepts explicit production hosts and normalized paths", () => {
    const config = readHttpConfigFromEnv({
      SYSDOM_CANON_MCP_TOKEN: "x".repeat(32),
      SYSDOM_CANON_HTTP_HOST: "0.0.0.0",
      SYSDOM_CANON_HTTP_PORT: "8080",
      SYSDOM_CANON_ALLOWED_HOSTS: "mcp.sysdom.ai, MCP.INTERNAL",
      SYSDOM_CANON_MCP_PATH: "/mcp/",
    });

    expect(config.port).toBe(8080);
    expect(config.mcpPath).toBe("/mcp");
    expect(config.allowedHosts.has("mcp.sysdom.ai")).toBe(true);
    expect(config.allowedHosts.has("mcp.internal")).toBe(true);
  });
});
