import type { SysdomCanonConfig } from "./config.js";
import type {
  CanonPassage,
  CanonQuery,
  CanonQueryResult,
  CanonRetriever,
} from "./retriever.js";

type FetchLike = typeof fetch;

interface DifyRecord {
  segment?: {
    id?: unknown;
    document_id?: unknown;
    content?: unknown;
    document?: {
      id?: unknown;
      name?: unknown;
      doc_metadata?: unknown;
    };
  };
  score?: unknown;
}

interface DifyRetrieveResponse {
  records?: unknown;
}

export class DifyRetrievalError extends Error {
  readonly code: "timeout" | "network_error" | "upstream_error" | "invalid_response";
  readonly status: number | null;

  constructor(
    code: DifyRetrievalError["code"],
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = "DifyRetrievalError";
    this.code = code;
    this.status = status;
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataUrl(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  for (const key of ["canonical_url", "source_url", "url", "source"]) {
    const candidate = text(record[key]);
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch {
      // Ignore malformed metadata values; citations still retain document ids.
    }
  }
  return null;
}

function truncate(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  return `${value.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`;
}

function normalizeRecord(record: DifyRecord, maxPassageChars: number): CanonPassage | null {
  const segment = record.segment;
  const content = text(segment?.content);
  const chunkId = text(segment?.id);
  const documentId = text(segment?.document_id) ?? text(segment?.document?.id);
  if (!content || !chunkId || !documentId) return null;

  return {
    title: text(segment?.document?.name) ?? "Sysdom canon source",
    url: metadataUrl(segment?.document?.doc_metadata),
    content: truncate(content, maxPassageChars),
    score: number(record.score),
    documentId,
    chunkId,
  };
}

function boundedPassages(
  records: DifyRecord[],
  maxPassageChars: number,
  maxTotalChars: number,
): CanonPassage[] {
  const passages: CanonPassage[] = [];
  let totalChars = 0;

  for (const record of records) {
    const passage = normalizeRecord(record, maxPassageChars);
    if (!passage) continue;
    const remaining = maxTotalChars - totalChars;
    if (remaining <= 0) break;
    const bounded = remaining < passage.content.length
      ? { ...passage, content: truncate(passage.content, remaining) }
      : passage;
    if (!bounded.content) break;
    passages.push(bounded);
    totalChars += bounded.content.length;
  }

  return passages;
}

async function parseJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export class DifyKnowledgeRetriever implements CanonRetriever {
  constructor(
    private readonly config: SysdomCanonConfig,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  async query(input: CanonQuery): Promise<CanonQueryResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let response: Response;

    try {
      response = await this.fetchFn(
        `${this.config.apiUrl}/datasets/${encodeURIComponent(this.config.datasetId)}/retrieve`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: input.query,
            retrieval_model: {
              search_method: this.config.searchMethod,
              reranking_enable: false,
              top_k: input.topK,
              score_threshold_enabled: input.scoreThreshold !== null,
              score_threshold: input.scoreThreshold,
            },
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (controller.signal.aborted) {
        throw new DifyRetrievalError("timeout", "Canon retrieval timed out");
      }
      throw new DifyRetrievalError(
        "network_error",
        error instanceof Error ? `Canon retrieval failed: ${error.name}` : "Canon retrieval failed",
      );
    } finally {
      clearTimeout(timeout);
    }

    const parsed = await parseJson(response);
    if (!response.ok) {
      throw new DifyRetrievalError(
        "upstream_error",
        `Canon retrieval upstream returned ${response.status}`,
        response.status,
      );
    }
    if (!parsed || typeof parsed !== "object") {
      throw new DifyRetrievalError("invalid_response", "Canon retrieval returned an invalid response");
    }

    const records = (parsed as DifyRetrieveResponse).records;
    if (!Array.isArray(records)) {
      throw new DifyRetrievalError("invalid_response", "Canon retrieval response has no records");
    }

    return {
      query: input.query,
      passages: boundedPassages(
        records as DifyRecord[],
        this.config.maxPassageChars,
        this.config.maxTotalChars,
      ),
    };
  }
}
