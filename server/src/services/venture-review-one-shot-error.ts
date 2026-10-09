/** Bounded error diagnostics only. Never return raw bodies, headers or arbitrary messages. */
import { abortable } from "./venture-review.js";

export const CU01_ERROR_BODY_BYTES = 16_384;
const categories = new Set([
  "rate_limit_exceeded", "rate_limited", "too_many_requests", "overloaded", "capacity_exceeded", "resource_exhausted",
  "insufficient_credits", "insufficient_quota", "invalid_api_key", "authentication_error",
  "permission_denied", "invalid_request", "invalid_request_error", "context_length_exceeded",
  "server", "server_error", "provider_error", "timeout", "unavailable",
  "openrouter_in_flight_budget", "openrouter_key_limit", "openrouter_credits",
  "in_flight_budget_exhausted", "weight_exceeds_budget",
]);
const messages = new Set([
  "rate limit exceeded", "too many requests", "provider returned error", "insufficient credits",
  "invalid api key", "unauthorized", "service unavailable", "internal server error",
]);
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const safeText = (value: unknown, key: string) =>
  typeof value === "string" && value.length <= 160 && (!key || !value.includes(key)) ? value : null;
const identifier = (value: unknown, key: string) => {
  const text = safeText(value, key);
  return text && /^(?:(?:gen|req|chatcmpl)-[A-Za-z0-9_-]{1,120}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(text) ? text : null;
};
const integerHeader = (value: string | null) => value && /^\d{1,10}$/.test(value) ? Number(value) : null;

export function cu01ErrorHeaders(response: Response, key: string) {
  const retry = safeText(response.headers.get("retry-after"), key);
  const retryAfter = retry && (/^\d{1,10}$/.test(retry) ||
    (/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(retry) && new Date(retry).toUTCString() === retry)) ? retry : null;
  return {
    httpStatus: response.status,
    requestId: identifier(response.headers.get("x-request-id"), key) ?? identifier(response.headers.get("x-openrouter-request-id"), key),
    generationId: null as string | null,
    retryAfter,
    rateLimit: {
      limit: integerHeader(safeText(response.headers.get("x-ratelimit-limit"), key)),
      remaining: integerHeader(safeText(response.headers.get("x-ratelimit-remaining"), key)),
      reset: integerHeader(safeText(response.headers.get("x-ratelimit-reset"), key)),
    },
    code: null as number | null,
    errorType: null as string | null,
    providerCode: null as string | null,
    reportedProvider: null as "Fireworks" | "OpenRouter" | null,
    limitSource: null as string | null,
    reason: null as string | null,
    // This is a recognized normalized message, not a raw provider string.
    message: "unrecognized_message_omitted",
    bodyStatus: "unavailable" as "unavailable" | "captured" | "too_large" | "malformed" | "aborted",
  };
}
export type Cu01HttpFailure = ReturnType<typeof cu01ErrorHeaders>;

/** Mutates only the safe diagnostic object, so headers survive body timeout/cancellation. */
export async function captureCu01ErrorBody(response: Response, signal: AbortSignal, key: string, diagnostic: Cu01HttpFailure) {
  const reader = response.body?.getReader();
  if (!reader) return;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > CU01_ERROR_BODY_BYTES) { diagnostic.bodyStatus = "too_large"; return; }
      chunks.push(chunk.value);
    }
    const root = object(JSON.parse(Buffer.concat(chunks, size).toString("utf8")));
    const error = object(root.error);
    const metadata = object(error.metadata);
    const category = (value: unknown) => {
      const text = safeText(value, key);
      return text && categories.has(text) ? text : null;
    };
    diagnostic.code = typeof error.code === "number" && Number.isInteger(error.code) && error.code >= 100 && error.code <= 599 ? error.code : null;
    diagnostic.errorType = category(metadata.error_type);
    diagnostic.providerCode = category(metadata.provider_code);
    if (metadata.provider_name === "Fireworks" || metadata.provider_name === "OpenRouter") diagnostic.reportedProvider = metadata.provider_name;
    diagnostic.limitSource = category(metadata.limit_source);
    diagnostic.reason = category(metadata.reason);
    const message = safeText(error.message, key)?.trim().toLowerCase();
    if (message && messages.has(message)) diagnostic.message = message;
    const id = identifier(root.id, key);
    if (id?.startsWith("gen-")) diagnostic.generationId = id;
    diagnostic.requestId ??= identifier(root.request_id, key);
    diagnostic.bodyStatus = "captured";
  } catch {
    diagnostic.bodyStatus = signal.aborted ? "aborted" : "malformed";
  } finally {
    // Do not await a provider stream that ignores cancellation; never retry its read.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
