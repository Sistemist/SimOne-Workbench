import { z } from "zod";
import { DifyRetrievalError } from "./dify.js";
import type { CanonRetriever } from "./retriever.js";

const querySysdomCanonSchema = z.object({
  query: z.string().trim().min(2).max(250),
  topK: z.number().int().min(1).max(10).optional(),
  scoreThreshold: z.number().min(0).max(1).nullable().optional(),
});

export interface CanonToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface CanonToolDefinition {
  name: "query_sysdom_canon";
  description: string;
  schema: typeof querySysdomCanonSchema;
  execute: (input: Record<string, unknown>) => Promise<CanonToolResponse>;
}

function success(value: Record<string, unknown>): CanonToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function failure(code: string, message: string): CanonToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: code, message }) }],
    structuredContent: { error: code, message },
    isError: true,
  };
}

export function createQuerySysdomCanonTool(
  retriever: CanonRetriever,
  defaultTopK = 5,
): CanonToolDefinition {
  return {
    name: "query_sysdom_canon",
    description:
      "Retrieve source-backed passages from the verified Sysdom canon. Returns citations and does not generate an answer.",
    schema: querySysdomCanonSchema,
    execute: async (input) => {
      const parsed = querySysdomCanonSchema.safeParse(input);
      if (!parsed.success) {
        return failure("invalid_request", "Query must be 2-250 characters and retrieval limits must be in range.");
      }

      try {
        const result = await retriever.query({
          query: parsed.data.query,
          topK: parsed.data.topK ?? defaultTopK,
          scoreThreshold: parsed.data.scoreThreshold ?? null,
        });
        return success({
          query: result.query,
          count: result.passages.length,
          passages: result.passages,
          retrievalOnly: true,
        });
      } catch (error) {
        if (error instanceof DifyRetrievalError) {
          return failure("retrieval_unavailable", `Sysdom canon retrieval is unavailable (${error.code}).`);
        }
        return failure("retrieval_unavailable", "Sysdom canon retrieval is unavailable.");
      }
    },
  };
}
