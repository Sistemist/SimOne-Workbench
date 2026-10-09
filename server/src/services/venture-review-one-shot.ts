/** Local CU01 test preparation only. No route, CLI, credential discovery or default transport. */
import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { OPENROUTER_CHAT_COMPLETIONS_URL } from "../adapters/openrouter/request.js";
import { abortable } from "./venture-review.js";
import { assessModelExecutionSafety } from "./model-execution-safety.js";
import { captureCu01ErrorBody, cu01ErrorHeaders, type Cu01HttpFailure } from "./venture-review-one-shot-error.js";

export const CU01_LIMITS = Object.freeze({ model: "z-ai/glm-5.3-flash", provider: "fireworks", inputTokens: 32_768,
  generatedTokens: 8_192, timeoutMs: 120_000, totalBudgetUsd: 3, requestBudgetUsd: 0.02,
  inputPricePerMillion: 0.15, outputPricePerMillion: 0.5 });
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const messagesSchema = z.tuple([
  z.object({ role: z.literal("system"), content: z.string().min(1) }).strict(),
  z.object({ role: z.literal("user"), content: z.string().min(1) }).strict(),
]);
const APPROVED_MESSAGES_SHA256 = "2eb53bbfee4826b5ecb96f0bb1ecfd0c3f34b00b857baa31452785c1c4b868a1";

/** Select only the sealed candidate messages, never evaluatorOnly/worked references.
 * The fixed hash binds full core/procedure AND evidence; edits require a new reviewed input. */
export function selectApprovedCu01Messages(raw: unknown) {
  const envelope = z.object({ inputs: z.array(z.object({ caseId: z.string(), arm: z.string(), messages: z.unknown() })) }).parse(raw);
  const matches = envelope.inputs.filter((entry) => entry.caseId === "CU01" && entry.arm === "sim");
  if (matches.length !== 1) throw new Error("Exactly one approved CU01 SIM input required");
  const messages = messagesSchema.parse(matches[0]!.messages);
  if (sha(JSON.stringify(messages)) !== APPROVED_MESSAGES_SHA256) throw new Error("Approved CU01 input integrity mismatch");
  return messages;
}
export async function loadApprovedCu01Messages(m1Directory: string) {
  return selectApprovedCu01Messages(JSON.parse(await readFile(path.join(m1Directory, "evaluation-inputs.json"), "utf8")));
}

/** Operator-supplied fresh evidence, NOT a substitute for provider/account readback.
 * The wrapper cannot attest its own assertions or change account settings. */
export const cu01PreflightSchema = z.object({
  verifiedAt: z.string().datetime(), evidenceRef: z.string().min(1),
  keySha256: digest, messagesSha256: digest,
  keyLimitUsd: z.number().positive().max(3), keyRemainingUsd: z.number().positive().max(3), keyUsageUsd: z.number().nonnegative(),
  keyLimitReset: z.null(), dedicatedOnlyConsumer: z.literal(true), autoReload: z.literal(false),
  byokDisabled: z.literal(true),
  promptLogging: z.literal(false), dataSharing: z.literal(false), broadcast: z.literal(false),
  provider: z.literal("fireworks"), model: z.literal("z-ai/glm-5.3-flash"),
  endpointEligible: z.literal(true), noTrainingOrPersistentContent: z.literal(true),
  inputTokensIncludingTemplate: z.number().int().positive().max(32_768),
  contextTokens: z.number().int().min(40_960), generatedTokenLimitIncludesReasoning: z.literal(true),
  tokenBoundEvidenceRef: z.string().min(1),
}).strict();
export type Cu01Preflight = z.infer<typeof cu01PreflightSchema>;

/** Atomic cross-process tombstone in a caller-approved directory. Never remove on
 * failure/cancellation. Reuse this SAME directory for this authorization forever. */
export function cu01FileClaim(directory: string) {
  const file = path.join(directory, "cu01-glm-5.3-flash-consumed.json");
  return async (receipt: { bodySha256: string; attemptedAt: string }) => {
    const handle = await open(file, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify(receipt)); await handle.sync(); }
    finally { await handle.close(); }
  };
}

export function buildCu01WireRequest(rawMessages: unknown) {
  const messages = messagesSchema.parse(rawMessages);
  const messageBytes = Buffer.byteLength(JSON.stringify(messages), "utf8");
  // Conservative byte screen only; preflight separately requires tokenizer/template evidence.
  if (messageBytes > CU01_LIMITS.inputTokens) throw new Error("Input exceeds local byte bound; never truncate the method");
  const body = { model: CU01_LIMITS.model, messages, stream: false, max_tokens: CU01_LIMITS.generatedTokens,
    reasoning: { effort: "low", exclude: true },
    provider: { only: [CU01_LIMITS.provider], allow_fallbacks: false, require_parameters: true,
      data_collection: "deny", zdr: true,
      max_price: { prompt: CU01_LIMITS.inputPricePerMillion, completion: CU01_LIMITS.outputPricePerMillion } },
  };
  const serializedBody = JSON.stringify(body);
  return { serializedBody, bodySha256: sha(serializedBody), messagesSha256: sha(JSON.stringify(messages)), messageBytes };
}

const responseSchema = z.object({
  id: z.string().min(1), model: z.literal(CU01_LIMITS.model), provider: z.literal("Fireworks"),
  choices: z.tuple([z.object({ finish_reason: z.literal("stop"), message: z.object({
    content: z.string().trim().min(1), tool_calls: z.array(z.never()).optional(), function_call: z.never().optional(),
  }) })]),
  usage: z.object({ prompt_tokens: z.number().int().positive().max(CU01_LIMITS.inputTokens),
    completion_tokens: z.number().int().positive().max(CU01_LIMITS.generatedTokens),
    completion_tokens_details: z.object({ reasoning_tokens: z.number().int().nonnegative() }),
    cost: z.number().positive().max(CU01_LIMITS.requestBudgetUsd) }),
});

/** One instance + persistent claim = one attempt across concurrency/restarts.
 * Inject fetch explicitly; this module NEVER obtains credentials or sends on import.
 * prepare/check helpers accept mock text for tests; live run accepts ONLY sealed CU01. */
export function createCu01OneShot(options: {
  fetcher: typeof fetch;
  claim: ReturnType<typeof cu01FileClaim>;
  now?: () => number;
}) {
  let attempted = false;
  const now = options.now ?? Date.now;
  const { fetcher, claim } = options;
  return {
    async run(input: { messages: unknown; apiKey: string; preflight: unknown; signal?: AbortSignal }) {
      if (attempted) throw new Error("CU01 attempt already consumed; no retry permitted");
      attempted = true;
      // Snapshot the validated credential/signal before the first async boundary.
      const { apiKey, signal } = input;
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      const timer = setTimeout(abort, CU01_LIMITS.timeoutMs);
      let dispatched = false;
      let requestId: string | null = null;
      let knownCostUsd: number | null = null;
      let httpFailure: Cu01HttpFailure | null = null;
      try {
        controller.signal.throwIfAborted();
        const request = buildCu01WireRequest(input.messages);
        const preflight = cu01PreflightSchema.parse(input.preflight);
        if (request.messagesSha256 !== APPROVED_MESSAGES_SHA256) throw new Error("Only sealed CU01 can execute");
        const age = now() - Date.parse(preflight.verifiedAt);
        if (age < 0 || age > 300_000 || !apiKey.trim() || sha(apiKey) !== preflight.keySha256 ||
            request.messagesSha256 !== preflight.messagesSha256 ||
            preflight.keyRemainingUsd > preflight.keyLimitUsd - preflight.keyUsageUsd + 1e-9 ||
            preflight.keyRemainingUsd < CU01_LIMITS.requestBudgetUsd) throw new Error("Fresh matching independent evidence required");
        const safety = assessModelExecutionSafety({ provider: "openrouter", model: CU01_LIMITS.model,
          timeoutSec: CU01_LIMITS.timeoutMs / 1000, maxTurnsPerRun: 1, maxDailyRuns: 1, maxConcurrentRuns: 1,
          policy: { provider: "openrouter", model: CU01_LIMITS.model, billingType: "metered_api", maxRuns: 1,
            maxRetries: 0, concurrency: 1, maxRunCostCents: 2,
            providerHardCapCents: Math.floor(preflight.keyRemainingUsd * 100), providerHardCapEvidenceSource: preflight.evidenceRef,
            providerHardCapVerifiedAt: preflight.verifiedAt, providerHardCapExpiresAt: new Date(Date.parse(preflight.verifiedAt) + 300_001).toISOString() },
          now: new Date(now()) });
        if (safety.status !== "ready") throw new Error("Existing execution safety gate failed");
        await abortable(claim({ bodySha256: request.bodySha256, attemptedAt: new Date(now()).toISOString() }), controller.signal);
        controller.signal.throwIfAborted();
        const dispatchAge = now() - Date.parse(preflight.verifiedAt);
        if (dispatchAge < 0 || dispatchAge > 300_000) throw new Error("Preflight expired before dispatch");
        dispatched = true;
        const response = await abortable(fetcher(OPENROUTER_CHAT_COMPLETIONS_URL, {
          method: "POST", redirect: "error", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: request.serializedBody, signal: controller.signal,
        }), controller.signal);
        if (!response.ok) {
          httpFailure = cu01ErrorHeaders(response, apiKey);
          await captureCu01ErrorBody(response, controller.signal, apiKey, httpFailure);
          // A gateway request ID is not interchangeable with a generation ID.
          requestId = httpFailure.generationId;
          throw new Error("Provider rejected the request; protections are not relaxed");
        }
        const raw: unknown = await abortable(response.json(), controller.signal);
        if (raw && typeof raw === "object") {
          const receipt = raw as { id?: unknown; usage?: { cost?: unknown } };
          if (typeof receipt.id === "string") requestId = receipt.id;
          const cost = receipt.usage?.cost;
          if (typeof cost === "number" && Number.isFinite(cost) && cost > 0) knownCostUsd = cost;
        }
        const result = responseSchema.parse(raw);
        if (result.usage.completion_tokens_details.reasoning_tokens > result.usage.completion_tokens) throw new Error("Inconsistent generated token accounting");
        controller.signal.throwIfAborted();
        return { status: "response_received" as const, answer: result.choices[0].message.content,
          requestId: result.id, model: result.model, provider: result.provider, usage: result.usage,
          bodySha256: request.bodySha256, messagesSha256: request.messagesSha256,
          // A response receipt is not independent generation/key-ledger reconciliation.
          reconciliation: "provider_ledger_check_required" as const, furtherRequestsAllowed: false as const };
      } catch {
        return { status: "stopped" as const, dispatched, requestId, knownCostUsd, httpFailure,
          reason: controller.signal.aborted ? "cancelled_or_timed_out" : "preflight_or_provider_validation_failed",
          reconciliation: dispatched ? "provider_ledger_check_required" : "not_dispatched",
          furtherRequestsAllowed: false as const };
      } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
    },
  };
}
