/** Frozen CU01 v2 pair. Explicit injected transport only; no route, CLI, secret lookup or auto-run. */
import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { abortable } from "./venture-review.js";
import { captureCu01ErrorBody, cu01ErrorHeaders, type Cu01HttpFailure } from "./venture-review-one-shot-error.js";
import { readBoundedReviewJson, readReviewBilling, reviewBillingKeySchema, REVIEW_BILLING_IDENTITIES, type ExpectedReviewBilling } from "./venture-review-billing-reconciliation.js";

export const REVIEW_PAIR = Object.freeze({
  messagesSha256: "4b9156529a40ae4b41d0bd7629fdc6868d308d0a00811f81b0bdd40e89df2c7a",
  criteriaSha256: "2ab22cbfbe2084024428852a370543854da7e10bea154bee9fbd12e37d47a49d",
  inputReservation: 32768, generatedTokens: 8192, timeoutMs: 120000, totalBudgetUsd: 3,
  sessionTimeoutMs: 480000, authorization: "cu01-corrected-pair-v2",
});
export type ReviewArm = "glm" | "sol";
const configs = {
  glm: { model: "z-ai/glm-5.3-flash", provider: "Fireworks", tag: "fireworks", effort: "max",
    tokenParameter: "max_tokens", inputPrice: 0.15, outputPrice: 0.5, inputWritePrice: 0.15, estimatedMaxUsd: 0.0090112 },
  sol: { model: "openai/gpt-5.6-sol", provider: "Azure", tag: "azure", effort: "high",
    tokenParameter: "max_completion_tokens", inputPrice: 5, outputPrice: 30, inputWritePrice: 6.25, estimatedMaxUsd: 0.45056 },
} as const;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const id = z.string().regex(/^gen-[A-Za-z0-9-]{1,160}$/);
const money = z.number().finite().nonnegative();
const messagesSchema = z.tuple([
  z.object({ role: z.literal("system"), content: z.string().min(1) }).strict(),
  z.object({ role: z.literal("user"), content: z.string().min(1) }).strict(),
]);

export function buildReviewComparisonRequest(arm: ReviewArm, rawMessages: unknown) {
  if (arm !== "glm" && arm !== "sol") throw new Error("Unapproved comparison arm");
  const c = configs[arm];
  if (!c) throw new Error("Unapproved comparison arm");
  const messages = messagesSchema.parse(rawMessages);
  if (sha(JSON.stringify(messages)) !== REVIEW_PAIR.messagesSha256) throw new Error("Frozen messages mismatch");
  if (Buffer.byteLength(JSON.stringify(messages)) > REVIEW_PAIR.inputReservation) throw new Error("Input byte screen failed; never truncate");
  const body = { model: c.model, messages, stream: false, [c.tokenParameter]: REVIEW_PAIR.generatedTokens,
    reasoning: { effort: c.effort, exclude: true, ...(arm === "sol" ? { mode: "standard" } : {}) },
    provider: { only: [c.tag], order: [c.tag], ...(arm === "sol" ? { ignore: ["azure/us", "azure/eu"] } : {}),
      allow_fallbacks: false, require_parameters: true, data_collection: "deny", zdr: true,
      max_price: { prompt: c.inputPrice, completion: c.outputPrice } },
  };
  const serialized = JSON.stringify(body);
  return { serialized, bodySha256: sha(serialized), messagesSha256: REVIEW_PAIR.messagesSha256 };
}

const proofSchema = z.object({
  checkedAt: z.string().datetime(), evidenceRef: z.string().min(1),
  model: z.string(), provider: z.string(), eligibleTags: z.array(z.string()),
  supportedParameters: z.array(z.string()), supportedEfforts: z.array(z.string()),
  contextTokens: z.number().int().min(40960), inputPrice: money, outputPrice: money, inputWritePrice: money,
  zdr: z.literal(true), noTrainingOrPersistentContent: z.literal(true), generatedLimitIncludesReasoning: z.literal(true),
  // Existing account-credit top-up is recorded, never configured here. It does not reset or
  // increase the independently read dedicated key's non-resetting lifetime spending cap.
  dedicatedOnlyConsumer: z.literal(true), autoReload: z.boolean(), byok: z.literal(false),
  promptLogging: z.literal(false), dataSharing: z.literal(false), broadcast: z.literal(false),
  budgetProof: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("verified_input_bound"), upperBoundTokens: z.number().int().positive().max(32768), evidenceRef: z.string().min(1) }).strict(),
    // The existing $3 cumulative authority is sufficient; no lower cap or new approval is needed.
    // Rely on the provider's published spending-cap contract plus fresh independent key readback.
    // This does not claim an audit of its internal reservation/settlement implementation.
    // Neither a local budget nor the unrelated public model catalog establishes this contract.
    z.object({ mode: z.literal("remaining_authorized_budget"),
      providerEnforcedKeyCreditLimit: z.literal(true), evidenceRef: z.string().min(1) }).strict(),
  ]),
}).strict();
export type ReviewComparisonProof = z.infer<typeof proofSchema>;
type BillingReadback = Awaited<ReturnType<typeof readReviewBilling>>;

/** Fresh public catalog read, no key and no private prompt transmitted. Owner controls and local
 * token/cap evidence must be supplied separately; a public listing cannot attest account settings. */
export async function readReviewComparisonPublicProof(arm: ReviewArm, input: {
  owner: Pick<ReviewComparisonProof, "dedicatedOnlyConsumer" | "autoReload" | "byok" | "promptLogging" | "dataSharing" | "broadcast">;
  budgetProof: ReviewComparisonProof["budgetProof"];
}, fetcher: typeof fetch, signal?: AbortSignal): Promise<ReviewComparisonProof> {
  if (arm !== "glm" && arm !== "sol") throw new Error("Unknown arm");
  const c = configs[arm], snapshot = structuredClone(input);
  return bounded(signal, 30000, async s => {
    const read = async (url: string) => {
      s.throwIfAborted();
      const response = await abortable(fetcher(url, { method: "GET", redirect: "error", signal: s }), s);
      if (!response.ok) throw new Error("Public route read unavailable");
      return readBoundedReviewJson(response, s, 8 * 1024 * 1024);
    };
    const price = z.object({ prompt: z.string(), completion: z.string(), input_cache_write: z.string().optional(), request: z.string().optional() });
    const endpoint = z.object({ tag: z.string(), name: z.string(), model_id: z.string(), provider_name: z.string(), status: z.number(), pricing: price,
      supported_parameters: z.array(z.string()), context_length: z.number(), max_completion_tokens: z.number().nullable() });
    const endpoints = z.object({ data: z.object({ id: z.literal(c.model), endpoints: z.array(endpoint) }) })
      .parse(await read(`https://openrouter.ai/api/v1/models/${c.model}/endpoints`)).data.endpoints;
    const zdr = z.object({ data: z.array(z.object({ model_id: z.string(), tag: z.string() })) })
      .parse(await read("https://openrouter.ai/api/v1/endpoints/zdr")).data;
    const models = z.object({ data: z.array(z.object({ id: z.string(), canonical_slug: z.string().optional(), reasoning: z.object({ supported_efforts: z.array(z.string()).optional() }).nullable().optional() })) })
      .parse(await read("https://openrouter.ai/api/v1/models")).data;
    const eligible = endpoints.filter(e => (e.tag === c.tag || e.tag.startsWith(c.tag + "/")) &&
      !(arm === "sol" && ["azure/us", "azure/eu"].includes(e.tag)) && e.provider_name === c.provider && e.status === 0 &&
      Number(e.pricing.prompt) > 0 && Number(e.pricing.prompt) * 1e6 <= c.inputPrice &&
      Number(e.pricing.completion) > 0 && Number(e.pricing.completion) * 1e6 <= c.outputPrice &&
      zdr.some(zdrEntry => zdrEntry.model_id === c.model && zdrEntry.tag === e.tag) &&
      e.supported_parameters.includes(c.tokenParameter) && e.supported_parameters.includes("reasoning") &&
      e.max_completion_tokens !== null && e.max_completion_tokens >= REVIEW_PAIR.generatedTokens);
    if (eligible.length !== 1 || eligible[0]!.tag !== c.tag) throw new Error("Exact unique approved endpoint unavailable");
    const e = eligible[0]!;
    const selectedModels = models.filter(m => m.id === c.model);
    const canonical = REVIEW_BILLING_IDENTITIES[c.model].canonical;
    if (selectedModels.length !== 1 || selectedModels[0]!.canonical_slug !== canonical ||
        e.model_id !== c.model || e.name !== `${c.provider} | ${canonical}`) throw new Error("Published canonical model mapping changed");
    if (e.pricing.request !== undefined && Number(e.pricing.request) !== 0) throw new Error("Unexpected request fee");
    const result = proofSchema.parse({ ...snapshot.owner, budgetProof: snapshot.budgetProof,
      checkedAt: new Date().toISOString(), evidenceRef: "public-endpoints+zdr+model-catalog; published-provider-combined-token-contract",
      model: c.model, provider: c.provider, eligibleTags: eligible.map(x => x.tag), supportedParameters: e.supported_parameters,
      supportedEfforts: models.find(m => m.id === c.model)?.reasoning?.supported_efforts ?? [], contextTokens: e.context_length,
      inputPrice: Number(e.pricing.prompt) * 1e6, outputPrice: Number(e.pricing.completion) * 1e6,
      inputWritePrice: Number(e.pricing.input_cache_write ?? e.pricing.prompt) * 1e6,
      zdr: true, noTrainingOrPersistentContent: true, generatedLimitIncludesReasoning: true });
    if (result.inputPrice !== c.inputPrice || result.outputPrice !== c.outputPrice || result.inputWritePrice !== c.inputWritePrice ||
        !result.supportedEfforts.includes(c.effort)) throw new Error("Published route price/effort drift");
    return result;
  });
}

export function verifyReviewComparisonGate(arm: ReviewArm, raw: unknown, billing: BillingReadback, now = Date.now()) {
  const p = proofSchema.parse(raw), c = configs[arm];
  const fresh = (time: string) => now >= Date.parse(time) && now - Date.parse(time) <= 300000;
  if (!c || !fresh(p.checkedAt) || !fresh(billing.checkedAt) || !billing.assessment.reconciled || !billing.key ||
      p.model !== c.model || p.provider !== c.provider || JSON.stringify(p.eligibleTags) !== JSON.stringify([c.tag]) ||
      !p.supportedParameters.includes(c.tokenParameter) || !p.supportedParameters.includes("reasoning") ||
      !p.supportedEfforts.includes(c.effort) || p.inputPrice !== c.inputPrice || p.outputPrice !== c.outputPrice ||
      p.inputWritePrice !== c.inputWritePrice || billing.key.limit <= 0 || billing.key.limit > REVIEW_PAIR.totalBudgetUsd || billing.key.limit_reset !== null ||
      !Number.isFinite(billing.key.limit_remaining) || !Number.isFinite(billing.key.usage) || billing.key.usage < 0 ||
      Math.abs(billing.key.limit_remaining - (billing.key.limit - billing.key.usage)) > 1e-9 ||
      billing.key.limit_remaining <= 0 || billing.key.usage > REVIEW_PAIR.totalBudgetUsd || Date.parse(billing.key.expires_at) <= now) {
    throw new Error("Fresh matching route, privacy, price, cap and billing evidence required");
  }
  const remainingAuthorizedUsd = Math.min(billing.key.limit_remaining, REVIEW_PAIR.totalBudgetUsd - billing.key.usage);
  const runReservationUsd = p.budgetProof.mode === "verified_input_bound"
    ? (p.budgetProof.upperBoundTokens * c.inputWritePrice + REVIEW_PAIR.generatedTokens * c.outputPrice) / 1e6
    : remainingAuthorizedUsd;
  if (runReservationUsd <= 0 || runReservationUsd > remainingAuthorizedUsd + 1e-12) throw new Error("Run reservation unavailable");
  // Exclusive session/arm claims reserve this amount locally; they are not provider-side holds.
  return { proof: p, runReservationUsd, remainingAuthorizedUsd, estimatedMaxUsd: c.estimatedMaxUsd };
}

// Post-response anomaly guard only: this is not an enforced request input-token limit.
const usageSchema = z.object({ prompt_tokens: z.number().int().positive().max(32768),
  completion_tokens: z.number().int().positive().max(8192),
  completion_tokens_details: z.object({ reasoning_tokens: z.number().int().nonnegative().max(8192) }),
  cost: money.positive(), is_byok: z.literal(false).optional(),
});
const responseSchema = z.object({ id, model: z.string(), provider: z.string(),
  choices: z.tuple([z.object({ finish_reason: z.literal("stop"), message: z.object({
    content: z.string().min(1), tool_calls: z.array(z.never()).optional(), function_call: z.never().optional(),
  }) })]), usage: usageSchema,
});
type Receipt = {
  arm: ReviewArm; model: string; provider: string; bodySha256: string; messagesSha256: string;
  startedAt: string; elapsedMs: number; dispatched: boolean; status: "stopped" | "response_received";
  budgetMode: ReviewComparisonProof["budgetProof"]["mode"]; runReservationUsd: number; estimatedMaxUsd: number;
  generationId: string | null; knownCostUsd: number | null; answer: string | null;
  usage: z.infer<typeof usageSchema> | null; httpFailure: Cu01HttpFailure | null;
  priorBilling: BillingReadback;
  billing: BillingReadback | null; failureKeyReadback: unknown; stopReason: string | null;
};
type ClaimDetails = { authorization: string; messagesSha256: string; criteriaSha256: string; bodySha256?: string;
  runReservationUsd?: number; attemptedAt: string };

/** Caller supplies the one authorized directory; never switch directories to retry an authorization.
 * Fixed versioned names preserve old one-shot tombstones. All files use exclusive creation. */
export function reviewComparisonFileControls(directory: string, continuation?: "receipt-identity-03" | "sol-only-04") {
  if (continuation !== undefined && continuation !== "receipt-identity-03" && continuation !== "sol-only-04") throw new Error("Unapproved continuation");
  const writeOnce = async (name: string, value: unknown) => {
    const h = await open(path.join(directory, name), "wx", 0o600);
    try { await h.writeFile(JSON.stringify(value, null, 2) + "\n"); await h.sync(); } finally { await h.close(); }
  };
  return {
    claim: async (name: "session" | ReviewArm, value: ClaimDetails) => {
      // Fresh owner-authorized metadata correction, never a reset or inference retry. Arm claims
      // retain their original names, so no continuation can repeat an already attempted model.
      if (continuation === "sol-only-04" && name === "glm") throw new Error("GLM must never run in Sol continuation");
      if (name === "session" && continuation === "receipt-identity-03") {
        z.object({ status: z.literal("stopped"), stoppedAt: z.literal("glm_prior_billing"),
          inferenceRequests: z.literal(0), receipts: z.tuple([]) })
          .parse(JSON.parse(await readFile(path.join(directory, "execution-result-02.json"), "utf8")));
        await readFile(path.join(directory, "cu01-v2-session-claimed.json"), "utf8");
      }
      if (name === "session" && continuation === "sol-only-04") {
        z.object({ status: z.literal("stopped"), inferenceRequests: z.literal(1), receipts: z.tuple([
          z.object({ arm: z.literal("glm"), dispatched: z.literal(true), status: z.literal("response_received"),
            generationId: z.literal("gen-1790025863-e4YCQXHPjndKnXJbzuPm"), knownCostUsd: z.literal(0.0028659) }),
        ]) }).parse(JSON.parse(await readFile(path.join(directory, "execution-result-03.json"), "utf8")));
        await readFile(path.join(directory, "cu01-v2-glm-claimed.json"), "utf8");
      }
      return writeOnce(`cu01-v2-${name === "session" && continuation ? continuation + "-session" : name}-claimed.json`, value);
    },
    persist: (receipt: Receipt) => writeOnce(`cu01-v2-${receipt.arm}-receipt.json`, receipt),
  };
}

async function bounded<T>(signal: AbortSignal | undefined, ms: number, work: (signal: AbortSignal) => Promise<T>) {
  const c = new AbortController(), abort = () => c.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, ms);
  try { c.signal.throwIfAborted(); return await abortable(work(c.signal), c.signal); }
  finally { clearTimeout(timer); c.abort(); signal?.removeEventListener("abort", abort); }
}

export function createReviewComparison(options: {
  fetcher: typeof fetch;
  claim: ReturnType<typeof reviewComparisonFileControls>["claim"];
  persist: ReturnType<typeof reviewComparisonFileControls>["persist"];
  preflight: (arm: ReviewArm, signal: AbortSignal) => Promise<unknown>;
  continuation?: "sol-only-04";
}) {
  const { fetcher, claim, persist, preflight } = options;
  const continuation = options.continuation;
  let attempted = false;
  return {
    async run(input: { messages: unknown; criteriaSha256: string; apiKey: string; signal?: AbortSignal }) {
      if (attempted) throw new Error("Comparison session already attempted; no retry");
      attempted = true;
      const { apiKey, signal, criteriaSha256 } = input;
      const receipts: Receipt[] = [];
      let lastBilling: BillingReadback | null = null;
      let stage = "input_validation";
      try {
        if (!apiKey.trim() || criteriaSha256 !== REVIEW_PAIR.criteriaSha256) throw new Error("Frozen criteria or credential missing");
        if (continuation !== undefined && continuation !== "sol-only-04") throw new Error("Unapproved execution mode");
        // Freeze both request strings before any await. No later mutation can change input/model.
        const wires = { glm: buildReviewComparisonRequest("glm", input.messages), sol: buildReviewComparisonRequest("sol", input.messages) };
        return await bounded(signal, REVIEW_PAIR.sessionTimeoutMs, async sessionSignal => {
          stage = "session_claim";
          await bounded(sessionSignal, 30000, () => claim("session", { authorization: REVIEW_PAIR.authorization,
            messagesSha256: REVIEW_PAIR.messagesSha256, criteriaSha256, attemptedAt: new Date().toISOString() }));
          let previous: ExpectedReviewBilling = continuation ? {
            id: "gen-1790025863-e4YCQXHPjndKnXJbzuPm", model: "z-ai/glm-5.3-flash", provider: "Fireworks",
            responseCostUsd: 0.0028659, priorReconciledUsageUsd: 0.00123785,
            promptTokens: 4716, completionTokens: 4317, reasoningTokens: 3227, nextReservationUsd: 0,
          } : { id: "gen-1790020451-YCCs3AcWQyLXAjBFkJ1L", model: "z-ai/glm-5.3-flash",
            provider: "Fireworks", responseCostUsd: 0.00123785, priorReconciledUsageUsd: 0,
            promptTokens: 5009, completionTokens: 973, reasoningTokens: 21, nextReservationUsd: 0 };
          for (const arm of (continuation ? ["sol"] : ["glm", "sol"]) as ReviewArm[]) {
            const c = configs[arm];
            stage = `${arm}_preflight`;
            const proof = proofSchema.parse(await bounded(sessionSignal, 30000, s => preflight(arm, s)));
            stage = `${arm}_prior_billing`;
            lastBilling = await readReviewBilling({ fetcher, apiKey, expected: previous, signal: sessionSignal });
            const gate = verifyReviewComparisonGate(arm, proof, lastBilling);
            sessionSignal.throwIfAborted();
            const beforeUsage = lastBilling.key!.usage;
            const r: Receipt = { arm, model: c.model, provider: c.provider, bodySha256: wires[arm].bodySha256,
              messagesSha256: REVIEW_PAIR.messagesSha256, startedAt: new Date().toISOString(), elapsedMs: 0,
              budgetMode: proof.budgetProof.mode, runReservationUsd: gate.runReservationUsd, estimatedMaxUsd: gate.estimatedMaxUsd,
              dispatched: false, status: "stopped", generationId: null, knownCostUsd: null, answer: null,
              priorBilling: structuredClone(lastBilling),
              usage: null, httpFailure: null, billing: null, failureKeyReadback: null, stopReason: null };
            receipts.push(r);
            stage = `${arm}_inference`;
            const started = Date.now();
            try {
              await bounded(sessionSignal, REVIEW_PAIR.timeoutMs, async requestSignal => {
                await abortable(claim(arm, { authorization: REVIEW_PAIR.authorization, messagesSha256: REVIEW_PAIR.messagesSha256,
                  criteriaSha256, bodySha256: wires[arm].bodySha256, runReservationUsd: r.runReservationUsd, attemptedAt: r.startedAt }), requestSignal);
                verifyReviewComparisonGate(arm, proof, lastBilling!); // Claim delay must not stale the evidence.
                requestSignal.throwIfAborted();
                r.dispatched = true;
                const response = await abortable(fetcher("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST", redirect: "error", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
                  body: wires[arm].serialized, signal: requestSignal,
                }), requestSignal);
                if (!response.ok) {
                  r.httpFailure = cu01ErrorHeaders(response, apiKey);
                  await captureCu01ErrorBody(response, requestSignal, apiKey, r.httpFailure);
                  r.generationId = r.httpFailure.generationId;
                  throw new Error("Request rejected");
                }
                const raw = await readBoundedReviewJson(response, requestSignal, 262144);
                // Retain safe positive cost/ID even when the answer fails operational validation.
                const partial = z.object({ id, usage: z.object({ cost: money.positive() }) }).safeParse(raw);
                if (partial.success && !partial.data.id.includes(apiKey)) {
                  r.generationId = partial.data.id; r.knownCostUsd = partial.data.usage.cost;
                }
                const result = responseSchema.parse(raw);
                if (result.model !== c.model || result.provider !== c.provider || result.usage.cost > r.runReservationUsd + 1e-9 ||
                    (proof.budgetProof.mode === "verified_input_bound" && result.usage.prompt_tokens > proof.budgetProof.upperBoundTokens) ||
                    result.usage.completion_tokens_details.reasoning_tokens > result.usage.completion_tokens ||
                    !result.choices[0].message.content.trim() || result.id.includes(apiKey) ||
                    result.choices[0].message.content.includes(apiKey)) throw new Error("Unexpected provider result");
                requestSignal.throwIfAborted();
                r.status = "response_received"; r.answer = result.choices[0].message.content;
                r.usage = result.usage;
              });
            } catch { r.stopReason = "claim_request_or_response_failed"; }
            r.elapsedMs = Date.now() - started;
            stage = `${arm}_reconciliation`;
            if (r.status === "response_received" && r.generationId && r.usage) {
              previous = { id: r.generationId, model: c.model, provider: c.provider, responseCostUsd: r.usage.cost,
                priorReconciledUsageUsd: beforeUsage, promptTokens: r.usage.prompt_tokens,
                completionTokens: r.usage.completion_tokens, reasoningTokens: r.usage.completion_tokens_details.reasoning_tokens,
                nextReservationUsd: 0 };
              r.billing = await readReviewBilling({ fetcher, apiKey, expected: previous, signal: sessionSignal });
              lastBilling = r.billing;
              if (!r.billing.assessment.reconciled) r.stopReason = "billing_not_reconciled";
            } else if (r.dispatched) {
              // No complete response to reconcile. Read the ledger once for evidence, never infer free.
              try {
                r.failureKeyReadback = await bounded(sessionSignal, 30000, async s => {
                  const res = await abortable(fetcher("https://openrouter.ai/api/v1/key", { method: "GET", redirect: "error",
                    headers: { Authorization: `Bearer ${apiKey}` }, signal: s }), s);
                  if (!res.ok) return { httpStatus: res.status, key: null };
                  const parsed = reviewBillingKeySchema.safeParse(await readBoundedReviewJson(res, s));
                  return { httpStatus: res.status, key: parsed.success ? parsed.data.data : null };
                });
              } catch { r.failureKeyReadback = { state: "unavailable" }; }
            }
            stage = `${arm}_receipt_persistence`;
            await bounded(sessionSignal, 30000, () => persist(structuredClone(r)));
            if (r.stopReason || r.status !== "response_received") throw new Error("Stop before another inference");
          }
          return { status: "completed" as const, receipts, lastBilling, inferenceRequests: receipts.filter(r => r.dispatched).length,
            furtherRequestsAllowed: false as const };
        });
      } catch {
        return { status: "stopped" as const, stoppedAt: stage, receipts: structuredClone(receipts), lastBilling: structuredClone(lastBilling),
          inferenceRequests: receipts.filter(r => r.dispatched).length, furtherRequestsAllowed: false as const };
      }
    },
  };
}
