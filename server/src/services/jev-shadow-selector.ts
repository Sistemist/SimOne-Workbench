export const JEV_PINNED_MODEL = "jev-1.13.0";
export const JEV_AUTOMATIC_RETRIES = 0;

export interface JevEligibleOption {
  id: string;
  allowed: boolean;
  reason?: string;
}

export interface JevShadowRecommendation {
  model: typeof JEV_PINNED_MODEL;
  optionId: string | null;
  probability: number;
  confidence: "low" | "medium" | "high";
  mode: "shadow";
}

export interface JevRecommendationTransport {
  recommend(input: {
    state: string;
    question: string;
    optionIds: string[];
    model: typeof JEV_PINNED_MODEL;
    maxRetries: 0;
  }, signal?: AbortSignal): Promise<{ optionId: string; probability: number }>;
}

export async function recommendWithJevShadow(input: {
  state: string;
  question: string;
  options: JevEligibleOption[];
  transport: JevRecommendationTransport;
  recheck: (optionId: string) => boolean;
  signal?: AbortSignal;
}): Promise<JevShadowRecommendation> {
  const eligible = input.options.filter((option) => option.allowed);
  if (eligible.length === 0) return noRecommendation();
  if (input.signal?.aborted) throw new DOMException("Jev shadow recommendation cancelled", "AbortError");

  const raw = await input.transport.recommend({
    state: input.state,
    question: input.question,
    optionIds: eligible.map((option) => option.id),
    model: JEV_PINNED_MODEL,
    maxRetries: JEV_AUTOMATIC_RETRIES,
  }, input.signal);
  if (!eligible.some((option) => option.id === raw.optionId)) return noRecommendation();
  if (!Number.isFinite(raw.probability) || raw.probability < 0 || raw.probability > 1) {
    return noRecommendation();
  }
  if (raw.probability < 0.6 || !input.recheck(raw.optionId)) return noRecommendation();
  return {
    model: JEV_PINNED_MODEL,
    optionId: raw.optionId,
    probability: raw.probability,
    confidence: raw.probability >= 0.85 ? "high" : raw.probability >= 0.7 ? "medium" : "low",
    mode: "shadow",
  };
}

function noRecommendation(): JevShadowRecommendation {
  return {
    model: JEV_PINNED_MODEL,
    optionId: null,
    probability: 0,
    confidence: "low",
    mode: "shadow",
  };
}

export function createFixtureJevTransport(scores: Record<string, number>): JevRecommendationTransport {
  return {
    async recommend(input) {
      const ranked = input.optionIds
        .map((optionId) => ({ optionId, probability: scores[optionId] ?? 0 }))
        .sort((left, right) => right.probability - left.probability);
      return ranked[0] ?? { optionId: "none", probability: 0 };
    },
  };
}
