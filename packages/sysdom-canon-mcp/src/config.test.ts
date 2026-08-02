import { describe, expect, it } from "vitest";
import { normalizeDifyApiUrl, readConfigFromEnv } from "./config.js";

describe("Sysdom canon MCP config", () => {
  it("uses bounded retrieval-only defaults", () => {
    const config = readConfigFromEnv({
      DIFY_API_KEY: "secret",
      DIFY_DATASET_ID: "11111111-1111-4111-8111-111111111111",
    });

    expect(config.apiUrl).toBe("https://api.dify.ai/v1");
    expect(config.searchMethod).toBe("keyword_search");
    expect(config.defaultTopK).toBe(5);
    expect(config.timeoutMs).toBe(10_000);
  });

  it("requires the server-side secret and dataset id", () => {
    expect(() => readConfigFromEnv({})).toThrow("Missing DIFY_API_KEY");
    expect(() => readConfigFromEnv({ DIFY_API_KEY: "secret" })).toThrow("Missing DIFY_DATASET_ID");
  });

  it("rejects insecure non-local API endpoints", () => {
    expect(() => normalizeDifyApiUrl("http://example.com/v1")).toThrow("must use HTTPS");
    expect(normalizeDifyApiUrl("http://localhost:5001/v1/")).toBe("http://localhost:5001/v1");
  });
});
