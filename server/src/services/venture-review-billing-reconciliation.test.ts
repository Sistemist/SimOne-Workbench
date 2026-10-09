import { afterEach, describe, expect, it, vi } from "vitest";
import { assessReviewBilling, readReviewBilling, REVIEW_BILLING_IDENTITIES, type ExpectedReviewBilling } from "./venture-review-billing-reconciliation.js";

const key = "synthetic-key-not-a-credential";
const now = Date.parse("2026-09-21T21:00:00Z");
const expected: ExpectedReviewBilling = { id: "gen-synthetic", model: "z-ai/glm-5.3-flash", provider: "Fireworks",
  responseCostUsd: 0.00123785, priorReconciledUsageUsd: 0, promptTokens: 5009, completionTokens: 973,
  reasoningTokens: 21, nextReservationUsd: 0.4595712 };
function fixtures() {
  return { generation: { data: { id: expected.id, model: expected.model, provider_name: expected.provider,
    total_cost: expected.responseCostUsd, is_byok: false, cancelled: false,
    native_tokens_prompt: 5009, native_tokens_completion: 973, native_tokens_reasoning: 21 } },
  account: { data: { limit: 3, limit_remaining: 3 - expected.responseCostUsd, limit_reset: null,
    usage: expected.responseCostUsd, byok_usage: 0, is_management_key: false, expires_at: "2099-12-20T19:15:00.002Z" } } };
}
afterEach(() => vi.useRealTimers());
describe("review billing independent-readback gate", () => {
  it("reconciles positive matching generation, response and cumulative dedicated-key charge", () => {
    const { generation, account } = fixtures();
    expect(assessReviewBilling(expected, generation, account, now)).toMatchObject({ reconciled: true, billedCostUsd: 0.00123785 });
  });
  it.each([
    { limit: 0 }, { limit: 3.01 }, { limit_reset: "monthly" }, { usage: 0 }, { usage: 0.0013 },
    { limit_remaining: 3 }, { limit_remaining: 0 }, { byok_usage: 0.1 }, { is_management_key: true },
    { expires_at: "2020-01-01T00:00:00Z" }, { usage: null }, { limit: null }, { disabled: true },
  ])("rejects invalid, stale or mismatched key evidence %j", override => {
    const { generation, account } = fixtures();
    expect(assessReviewBilling(expected, generation, { data: { ...account.data, ...override } }, now).reconciled).toBe(false);
  });
  it.each([
    { id: "gen-different" }, { model: "openai/gpt-5.6-sol" }, { provider_name: "Azure" },
    { total_cost: 0 }, { total_cost: null }, { total_cost: 0.01 }, { is_byok: true }, { cancelled: true },
    { native_tokens_prompt: 5008 }, { native_tokens_completion: 974 }, { native_tokens_reasoning: 974 },
  ])("rejects unknown or disagreeing generation evidence %j", override => {
    const { generation, account } = fixtures();
    expect(assessReviewBilling(expected, { data: { ...generation.data, ...override } }, account, now).reconciled).toBe(false);
  });
  it("fails closed on missing readbacks, malformed expectations and insufficient remaining reservation", () => {
    const { generation, account } = fixtures();
    for (const values of [[expected, null, account], [expected, generation, null], [{}, generation, account],
      [{ ...expected, nextReservationUsd: 3 }, generation, account]]) {
      expect(assessReviewBilling(...values as [unknown, unknown, unknown], now).reconciled).toBe(false);
    }
  });
  it("requires exact cumulative usage including a preceding paid run", () => {
    const { generation, account } = fixtures();
    const prior = 0.01;
    account.data.usage += prior; account.data.limit_remaining -= prior;
    expect(assessReviewBilling({ ...expected, priorReconciledUsageUsd: prior }, generation, account, now).reconciled).toBe(true);
    expect(assessReviewBilling(expected, generation, account, now).reconciled).toBe(false);
  });
  it("only performs the two fixed GETs and strips secret-bearing extra fields", async () => {
    const { generation, account } = fixtures();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...generation.data, secret: key } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...account.data, label: key } })));
    const result = await readReviewBilling({ fetcher, apiKey: key, expected });
    expect(result.assessment.reconciled).toBe(true);
    expect(JSON.stringify(result)).not.toContain(key);
    expect(fetcher.mock.calls.map(x => [x[0], x[1]?.method, x[1]?.redirect])).toEqual([
      ["https://openrouter.ai/api/v1/generation?id=gen-synthetic", "GET", "error"],
      ["https://openrouter.ai/api/v1/key", "GET", "error"],
    ]);
  });
  it("captures failed generation HTTP status and still reads the key once, without retry", async () => {
    const { account } = fixtures();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(key, { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(account)));
    const result = await readReviewBilling({ fetcher, apiKey: key, expected });
    expect(result).toMatchObject({ generationLookup: { httpStatus: 404, state: "http_error" }, generation: null,
      assessment: { reconciled: false }, inferenceRequests: 0 });
    expect(JSON.stringify(result)).not.toContain(key); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("bounds each metadata request timeout with no retry, including uncooperative transport", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const work = readReviewBilling({ fetcher, apiKey: key, expected });
    await vi.advanceTimersByTimeAsync(60001);
    expect(await work).toMatchObject({ generationLookup: { state: "cancelled_or_timed_out" },
      keyLookup: { state: "cancelled_or_timed_out" }, assessment: { reconciled: false } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("pre-cancelled work dispatches nothing", async () => {
    const controller = new AbortController(); controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    const result = await readReviewBilling({ fetcher, apiKey: key, expected, signal: controller.signal });
    expect(result.assessment.reconciled).toBe(false); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["not-json", "x".repeat(16385)])("rejects malformed/oversize metadata without leaking body", async body => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(body));
    const result = await readReviewBilling({ fetcher, apiKey: key, expected });
    expect(result.assessment.reconciled).toBe(false);
    expect(result.generationLookup.state).toBe("transport_or_body_error");
  });
  it("records safe failing-field diagnostics without provider values or secret-bearing Zod messages", async () => {
    const { generation, account } = fixtures();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...generation.data, provider_name: key, cancelled: null } })))
      .mockResolvedValueOnce(new Response(JSON.stringify(account)));
    const result = await readReviewBilling({ fetcher, apiKey: key, expected });
    expect(result.generationValidationIssues.map(x => x.field)).toEqual(["provider_name"]);
    expect(result.generation).toBeNull(); expect(result.assessment.reconciled).toBe(false);
    expect(JSON.stringify(result)).not.toContain(key);
  });
  it("cancels a hanging response body and does not start the second GET", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({ start() {} })));
    const work = readReviewBilling({ fetcher, apiKey: key, expected, signal: controller.signal });
    await Promise.resolve(); controller.abort();
    expect((await work).assessment.reconciled).toBe(false); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("distinguishes schema-null ancillary metadata from required positive billing evidence", () => {
    const { generation, account } = fixtures();
    const nullable = { data: { ...generation.data, cancelled: null, native_tokens_reasoning: null,
      native_tokens_prompt: null, native_tokens_completion: null } };
    expect(assessReviewBilling(expected, nullable, account, now)).toMatchObject({ reconciled: true,
      unavailableAncillaryFields: ["cancelled", "native_tokens_prompt", "native_tokens_completion", "native_tokens_reasoning"] });
    for (const override of [{ total_cost: null }, { provider_name: null }, { usage: 0 }, { is_byok: null }]) {
      expect(assessReviewBilling(expected, { data: { ...nullable.data, ...override } }, account, now).reconciled).toBe(false);
    }
  });
  it.each(Object.entries(REVIEW_BILLING_IDENTITIES))("accepts only the publicly mapped canonical identifier for %s", (model, mapping) => {
    const { generation, account } = fixtures();
    const e = { ...expected, model, provider: mapping.provider };
    const g = { data: { ...generation.data, model: mapping.canonical, provider_name: mapping.provider } };
    expect(assessReviewBilling(e, g, account, now)).toMatchObject({ reconciled: true,
      modelIdentity: { matched: true, reportedModel: mapping.canonical, kind: "public_canonical_alias" } });
    for (const invalid of [mapping.canonical + "-extra", mapping.canonical.replace(/\d{8}$/, "20990101"), "another/" + model, "unknown-model"]) {
      expect(assessReviewBilling(e, { data: { ...g.data, model: invalid } }, account, now)).toMatchObject({
        reconciled: false, reason: "model_identity_conflict" });
    }
    expect(assessReviewBilling(e, g, { data: { ...account.data, usage: 0 } }, now).reconciled).toBe(false);
    expect(assessReviewBilling(e, { data: { ...g.data, provider_name: mapping.provider === "Azure" ? "Fireworks" : "Azure" } }, account, now).reconciled).toBe(false);
  });
  it("retains an unknown bounded identifier for diagnosis without accepting its identity or saving unrelated payload", async () => {
    const { generation, account } = fixtures();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ data: {
      ...generation.data, model: "z-ai/glm-unknown-snapshot", private_payload: key } })))
      .mockResolvedValueOnce(new Response(JSON.stringify(account)));
    const result = await readReviewBilling({ fetcher, apiKey: key, expected });
    expect(result.modelIdentity).toMatchObject({ reportedModel: "z-ai/glm-unknown-snapshot", matched: false, kind: "unrecognized" });
    expect(result.assessment).toMatchObject({ reconciled: false, reason: "model_identity_conflict" });
    expect(JSON.stringify(result)).not.toContain(key); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([key, `z-ai/${key}`, "sk-or-v1-not-a-real-key", "https://example.test/credential", "x".repeat(201), "model\nsecret", null, { secret: key }])(
    "redacts malformed or secret-bearing model identifier %#", async model => {
      const { generation, account } = fixtures();
      const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...generation.data, model } })))
        .mockResolvedValueOnce(new Response(JSON.stringify(account)));
      const result = await readReviewBilling({ fetcher, apiKey: key, expected });
      expect(result.modelIdentity.reportedModel).toBeNull(); expect(result.generation).toBeNull();
      expect(result.assessment.reconciled).toBe(false); expect(JSON.stringify(result)).not.toContain(key);
    });
  it("preserves a safe actual model identifier even when another billing field is invalid", async () => {
    const { generation, account } = fixtures();
    const model = REVIEW_BILLING_IDENTITIES[expected.model].canonical;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...generation.data, model, total_cost: null } })))
      .mockResolvedValueOnce(new Response(JSON.stringify(account)));
    const result = await readReviewBilling({ fetcher, apiKey: key, expected });
    expect(result.modelIdentity.reportedModel).toBe(model); expect(result.assessment.reconciled).toBe(false);
    expect(result.generationValidationIssues).toContainEqual({ field: "total_cost", code: "invalid_type" });
  });
});
