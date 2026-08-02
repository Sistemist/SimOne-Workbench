import { z } from "zod";

const searchMethodSchema = z.enum([
  "keyword_search",
  "full_text_search",
  "semantic_search",
  "hybrid_search",
]);

export type DifySearchMethod = z.infer<typeof searchMethodSchema>;

export interface SysdomCanonConfig {
  apiUrl: string;
  apiKey: string;
  datasetId: string;
  timeoutMs: number;
  defaultTopK: number;
  searchMethod: DifySearchMethod;
  maxPassageChars: number;
  maxTotalChars: number;
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

export function normalizeDifyApiUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("DIFY_API_URL must not be empty");
  const url = new URL(trimmed);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("DIFY_API_URL must use HTTPS unless it targets localhost");
  }
  return trimmed;
}

export function readConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SysdomCanonConfig {
  const apiKey = nonEmpty(env.DIFY_API_KEY);
  if (!apiKey) throw new Error("Missing DIFY_API_KEY");

  const datasetId = nonEmpty(env.DIFY_DATASET_ID);
  if (!datasetId) throw new Error("Missing DIFY_DATASET_ID");
  if (!z.string().uuid().safeParse(datasetId).success) {
    throw new Error("DIFY_DATASET_ID must be a UUID");
  }

  const searchMethod = searchMethodSchema.parse(
    nonEmpty(env.DIFY_RETRIEVAL_SEARCH_METHOD) ?? "keyword_search",
  );

  return {
    apiUrl: normalizeDifyApiUrl(nonEmpty(env.DIFY_API_URL) ?? "https://api.dify.ai/v1"),
    apiKey,
    datasetId,
    timeoutMs: parseInteger(env.DIFY_RETRIEVAL_TIMEOUT_MS, 10_000, 100, 30_000, "DIFY_RETRIEVAL_TIMEOUT_MS"),
    defaultTopK: parseInteger(env.DIFY_RETRIEVAL_TOP_K, 5, 1, 10, "DIFY_RETRIEVAL_TOP_K"),
    searchMethod,
    maxPassageChars: parseInteger(
      env.SYSDOM_CANON_MAX_PASSAGE_CHARS,
      4_000,
      500,
      8_000,
      "SYSDOM_CANON_MAX_PASSAGE_CHARS",
    ),
    maxTotalChars: parseInteger(
      env.SYSDOM_CANON_MAX_TOTAL_CHARS,
      16_000,
      2_000,
      32_000,
      "SYSDOM_CANON_MAX_TOTAL_CHARS",
    ),
  };
}
