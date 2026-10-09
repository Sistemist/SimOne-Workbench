/** Read-only billing gate. No credentials, default transport, inference, retries or writes. */
import { z } from "zod";
import { abortable } from "./venture-review.js";

const usd = z.number().finite().nonnegative();
// Exact mappings read from OpenRouter's public /models canonical_slug and confirmed by each
// approved endpoint's name/model_id on 2026-09-21 (Sol 6.1 refreshed 2026-10-08).
// Never strip dates or accept prefix matches.
export const REVIEW_BILLING_IDENTITIES = Object.freeze({
  "z-ai/glm-5.3-flash": { canonical: "z-ai/glm-5.3-flash-20260826", provider: "Fireworks" },
  "openai/gpt-5.6-sol": { canonical: "openai/gpt-5.6-sol-20260709", provider: "Azure" },
  "openai/gpt-6.1-sol": { canonical: "openai/gpt-6.1-sol-20260929", provider: "Azure" },
});
const modelIdentifier = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/)
  .refine(value => !value.includes("://") && !/(?:^|[/:-])(?:sk-|bearer|api[_-]?key|token=)/i.test(value));
export function reviewBillingModelIdentity(expectedModel: string, reported: unknown, credential?: string) {
  const parsed = modelIdentifier.safeParse(reported);
  const reportedModel = parsed.success && !(credential && parsed.data.includes(credential)) ? parsed.data : null;
  const mapping = REVIEW_BILLING_IDENTITIES[expectedModel as keyof typeof REVIEW_BILLING_IDENTITIES];
  const kind = reportedModel === null ? "invalid_or_redacted" : reportedModel === expectedModel && mapping
    ? "exact" : mapping && reportedModel === mapping.canonical ? "public_canonical_alias" : "unrecognized";
  return { expectedModel, reportedModel, kind,
    matched: kind === "exact" || kind === "public_canonical_alias",
    evidenceUrl: kind === "public_canonical_alias" ? "https://openrouter.ai/api/v1/models" : null };
}
export const reviewBillingKeySchema = z.object({ data: z.object({
  limit: usd.positive().max(3), limit_remaining: usd, limit_reset: z.null(), usage: usd,
  byok_usage: z.literal(0), is_management_key: z.literal(false),
  disabled: z.literal(false).optional(), expires_at: z.string().datetime({ offset: true }),
}) });
const keySchema = reviewBillingKeySchema;
const generationSchema = z.object({ data: z.object({
  id: z.string().regex(/^gen-[A-Za-z0-9-]{1,160}$/),
  model: modelIdentifier, provider_name: z.enum(["Fireworks", "Azure"]),
  total_cost: usd.positive(), usage: usd.optional(), is_byok: z.literal(false),
  // Public schema permits null here. Missing ancillary metadata is not a zero-cost inference.
  cancelled: z.boolean().nullable().optional(),
  native_tokens_prompt: z.number().int().nonnegative().nullable().optional(),
  native_tokens_completion: z.number().int().nonnegative().nullable().optional(),
  native_tokens_reasoning: z.number().int().nonnegative().nullable().optional(),
}) });
const expectedSchema = z.object({
  id: z.string().regex(/^gen-[A-Za-z0-9-]{1,160}$/),
  model: z.enum(["z-ai/glm-5.3-flash", "openai/gpt-5.6-sol", "openai/gpt-6.1-sol"]),
  provider: z.enum(["Fireworks", "Azure"]), responseCostUsd: usd.positive(),
  priorReconciledUsageUsd: usd, promptTokens: z.number().int().positive(),
  completionTokens: z.number().int().positive(), reasoningTokens: z.number().int().nonnegative(),
  nextReservationUsd: usd.max(3),
}).strict();
export type ExpectedReviewBilling = z.infer<typeof expectedSchema>;
const equalUsd = (a: number, b: number) => Math.abs(a - b) <= 1e-9;

/** Unknown, zero-positive disagreement, extra cumulative charges, and exhausted caps fail closed.
 * Inputs are readbacks, not assertions that this function has independently contacted a provider. */
export function assessReviewBilling(expectedRaw: unknown, generationRaw: unknown, keyRaw: unknown, now = Date.now()) {
  const expected = expectedSchema.safeParse(expectedRaw);
  const generation = generationSchema.safeParse(generationRaw);
  const key = keySchema.safeParse(keyRaw);
  if (!expected.success || !generation.success || !key.success || !Number.isFinite(now)) {
    return { reconciled: false as const, reason: "missing_or_invalid_billing_evidence" as const };
  }
  const e = expected.data, g = generation.data.data, k = key.data.data;
  const modelIdentity = reviewBillingModelIdentity(e.model, g.model);
  if (!modelIdentity.matched) return { reconciled: false as const, reason: "model_identity_conflict" as const, modelIdentity };
  if ((e.model === "z-ai/glm-5.3-flash") !== (e.provider === "Fireworks") ||
      g.id !== e.id || g.provider_name !== e.provider ||
      g.cancelled === true || (g.usage !== undefined && !equalUsd(g.usage, g.total_cost)) ||
      (g.native_tokens_prompt != null && g.native_tokens_prompt !== e.promptTokens) ||
      (g.native_tokens_completion != null && g.native_tokens_completion !== e.completionTokens) ||
      (g.native_tokens_reasoning != null && g.native_tokens_reasoning !== e.reasoningTokens) ||
      e.reasoningTokens > e.completionTokens ||
      !equalUsd(g.total_cost, e.responseCostUsd) ||
      !equalUsd(k.usage, e.priorReconciledUsageUsd + g.total_cost) ||
      !equalUsd(k.limit_remaining, k.limit - k.usage) ||
      k.limit_remaining < e.nextReservationUsd || Date.parse(k.expires_at) <= now) {
    return { reconciled: false as const, reason: "billing_or_cap_disagreement" as const };
  }
  return { reconciled: true as const, generationId: g.id, billedCostUsd: g.total_cost,
    modelIdentity,
    cumulativeUsageUsd: k.usage, remainingUsd: k.limit_remaining, limitUsd: k.limit,
    unavailableAncillaryFields: (["cancelled", "native_tokens_prompt", "native_tokens_completion", "native_tokens_reasoning"] as const)
      .filter(field => g[field] == null) };
}

export async function readBoundedReviewJson(response: Response, signal: AbortSignal, maxBytes = 16_384) {
  if (!response.body) throw new Error("empty_body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await abortable(reader.read(), signal);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("metadata_body_too_large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally { void reader.cancel().catch(() => {}); }
}

/** At most one GET per endpoint, 30s each. No POST capability or retry in this function.
 * Response bodies/errors stay internal; return only schemas' sanitized numeric/identity fields. */
export async function readReviewBilling(options: {
  fetcher: typeof fetch; apiKey: string; expected: ExpectedReviewBilling; signal?: AbortSignal;
}) {
  const { fetcher, apiKey, signal } = options;
  const expected = expectedSchema.parse(options.expected); // Snapshot before async work.
  if (!apiKey.trim()) throw new Error("Credential required for read-only billing check");
  const read = async (url: string) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, 30_000);
    let status: number | null = null;
    try {
      controller.signal.throwIfAborted();
      const response = await abortable(fetcher(url, { method: "GET", redirect: "error",
        headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal }), controller.signal);
      status = response.status;
      if (!response.ok) { void response.body?.cancel().catch(() => {}); return { status, state: "http_error" as const, raw: null }; }
      return { status, state: "received" as const, raw: await readBoundedReviewJson(response, controller.signal) };
    } catch {
      return { status, state: controller.signal.aborted ? "cancelled_or_timed_out" as const : "transport_or_body_error" as const, raw: null };
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
  };
  const generation = await read(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(expected.id)}`);
  const key = await read("https://openrouter.ai/api/v1/key");
  const g = generationSchema.safeParse(generation.raw);
  const k = keySchema.safeParse(key.raw);
  // Retain ONLY a bounded identifier, including on schema failure; never save the raw body.
  const observed = z.object({ data: z.object({ model: z.unknown().optional() }) }).safeParse(generation.raw);
  const modelIdentity = reviewBillingModelIdentity(expected.model, observed.success ? observed.data.data.model : undefined, apiKey);
  // Schema paths/codes only, never raw values or Zod's messages (which can echo inputs).
  const diagnostics = (error: z.ZodError | undefined, fields: string[]) => error?.issues.map(issue => ({
    field: issue.path[0] === "data" && typeof issue.path[1] === "string" && fields.includes(issue.path[1])
      ? issue.path[1] : "envelope",
    code: issue.code,
  })) ?? [];
  return { checkedAt: new Date().toISOString(),
    generationLookup: { httpStatus: generation.status, state: generation.state },
    keyLookup: { httpStatus: key.status, state: key.state },
    generationValidationIssues: diagnostics(g.error, Object.keys(generationSchema.shape.data.shape)),
    keyValidationIssues: diagnostics(k.error, Object.keys(keySchema.shape.data.shape)),
    modelIdentity,
    generation: g.success && modelIdentity.reportedModel !== null && g.data.data.id === expected.id ? g.data.data : null,
    key: k.success ? k.data.data : null,
    assessment: modelIdentity.reportedModel === null
      ? { reconciled: false as const, reason: "missing_or_invalid_model_identity" as const }
      : assessReviewBilling(expected, generation.raw, key.raw),
    inferenceRequests: 0 as const };
}
