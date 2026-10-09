import { describe, expect, it, vi } from "vitest";
import { captureCu01ErrorBody, cu01ErrorHeaders, CU01_ERROR_BODY_BYTES } from "./venture-review-one-shot-error.js";

const key = "synthetic-private-key";
async function capture(body: string, headers: Record<string, string> = {}) {
  const response = new Response(body, { status: 429, headers });
  const diagnostic = cu01ErrorHeaders(response, key);
  await captureCu01ErrorBody(response, new AbortController().signal, key, diagnostic);
  return diagnostic;
}

describe("CU01 bounded allowlisted error capture", () => {
  it("retains useful codes and retry headers without arbitrary provider data", async () => {
    const result = await capture(JSON.stringify({ id: "gen-test123", request_id: "req-body123", error: {
      code: 429, message: "Rate limit exceeded", metadata: { error_type: "rate_limit_exceeded", provider_code: "rate_limited",
        limit_source: "openrouter_in_flight_budget", reason: "in_flight_budget_exhausted", provider_name: "Fireworks", raw: "private prompt text" },
    } }), { "retry-after": "60", "x-request-id": "req-header123", "x-ratelimit-limit": "30",
      "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1790000000", "set-cookie": "private cookie" });
    expect(result).toMatchObject({ httpStatus: 429, requestId: "req-header123", generationId: "gen-test123", retryAfter: "60",
      code: 429, errorType: "rate_limit_exceeded", providerCode: "rate_limited", limitSource: "openrouter_in_flight_budget",
      reason: "in_flight_budget_exhausted", reportedProvider: "Fireworks", message: "rate limit exceeded", bodyStatus: "captured",
      rateLimit: { limit: 30, remaining: 0, reset: 1790000000 } });
    expect(JSON.stringify(result)).not.toMatch(/private|cookie|raw/);
  });

  it("omits credentials, prompt fragments and unrecognized text even in nominal diagnostic fields", async () => {
    const raw = { id: `gen-${key}`, request_id: `req-${key}`, error: { code: key, message: `Rate limit exceeded: ${key} private prompt`,
      metadata: { error_type: key, provider_code: "PRIVATE-PROMPT", limit_source: "another secret", reason: key, raw: key } } };
    const result = await capture(JSON.stringify(raw), { "x-request-id": `req-${key}`, "retry-after": key,
      "x-ratelimit-limit": key, Authorization: `Bearer ${key}`, "x-unknown": "PRIVATE-PROMPT" });
    expect(result).toMatchObject({ requestId: null, generationId: null, retryAfter: null, code: null, errorType: null,
      providerCode: null, limitSource: null, reason: null, message: "unrecognized_message_omitted", bodyStatus: "captured" });
    expect(JSON.stringify(result)).not.toMatch(/synthetic-private-key|PRIVATE-PROMPT|another secret|Bearer/);
  });

  it.each(["NaN", "-1", "1.2", "1e3", "99999999999", "invalid date"])("omits invalid Retry-After %s", async (value) => {
    expect(await capture("{}", { "retry-after": value })).toHaveProperty("retryAfter", null);
  });

  it("supports a canonical HTTP-date retry hint but never waits or retries itself", async () => {
    const value = "Mon, 21 Sep 2026 20:00:00 GMT";
    expect(await capture("{}", { "retry-after": value })).toHaveProperty("retryAfter", value);
  });

  it.each(["not JSON private prompt", "{", ""])("keeps headers when the body is malformed", async (body) => {
    expect(await capture(body, { "retry-after": "10", "x-openrouter-request-id": "req-fallback" }))
      .toMatchObject({ bodyStatus: "malformed", requestId: "req-fallback", retryAfter: "10", message: "unrecognized_message_omitted" });
  });

  it("does not mislabel gateway IDs as generation IDs", async () => {
    expect(await capture(JSON.stringify({ id: "req-gateway", request_id: "req-body", error: { code: 429 } })))
      .toMatchObject({ generationId: null, requestId: "req-body" });
  });

  it("stops reading after the 16KiB bound and cancels the stream", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(CU01_ERROR_BODY_BYTES + 1));
    }, cancel }), { status: 429, headers: { "retry-after": "5" } });
    const result = cu01ErrorHeaders(response, key);
    await captureCu01ErrorBody(response, new AbortController().signal, key, result);
    expect(result).toMatchObject({ bodyStatus: "too_large", retryAfter: "5" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("honors cancellation during an ignoring body and retains already captured headers", async () => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ pull: () => new Promise(() => {}), cancel }),
      { status: 429, headers: { "x-request-id": "req-cancelled" } });
    const result = cu01ErrorHeaders(response, key);
    const controller = new AbortController();
    const work = captureCu01ErrorBody(response, controller.signal, key, result);
    controller.abort(); await work;
    expect(result).toMatchObject({ bodyStatus: "aborted", requestId: "req-cancelled" });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
