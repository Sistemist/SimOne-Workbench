import { readFile } from "node:fs/promises";
import { modelPortfolioResearchProposalSchema } from "../packages/shared/src/validators/model-portfolio.ts";
import type { ModelRouteCandidate } from "../packages/shared/src/validators/model-route-decision.ts";

const proposalUrl = new URL(
  "../evals/fixtures/sysdom-model-portfolio.proposal.v1.json",
  import.meta.url,
);

interface OpenRouterModel {
  id: string;
  canonical_slug: string;
  context_length: number;
  expiration_date: string | null;
  pricing: {
    prompt: string;
    completion: string;
    input_cache_read?: string;
  };
  supported_parameters: string[];
  top_provider: {
    max_completion_tokens: number;
  };
}

interface OpenRouterZdrEndpoint {
  model_id: string;
}

function usdPerMillion(value: string | undefined) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1_000_000 : null;
}

function samePrice(actual: number | null, expected: number | null) {
  if (actual === null || expected === null) return actual === expected;
  return Math.abs(actual - expected) < 0.000001;
}

function compareCandidate(
  candidate: ModelRouteCandidate,
  model: OpenRouterModel,
  zdrModelIds: Set<string>,
) {
  const blockers: string[] = [];
  const catalog = candidate.catalog;
  if (!catalog) return ["catalog_missing"];
  if (model.id !== candidate.model) blockers.push("model_id_changed");
  if (model.canonical_slug !== catalog.canonicalSlug) blockers.push("canonical_slug_changed");
  if (model.context_length !== catalog.contextWindowTokens) blockers.push("context_window_changed");
  if (model.top_provider.max_completion_tokens !== catalog.maxOutputTokens) {
    blockers.push("max_output_changed");
  }
  if (!model.supported_parameters.includes("tools")) blockers.push("tools_missing");
  if (!model.supported_parameters.includes("structured_outputs")) {
    blockers.push("structured_outputs_missing");
  }
  if (!model.supported_parameters.includes("reasoning")) {
    blockers.push("reasoning_control_missing");
  }
  if (!samePrice(usdPerMillion(model.pricing.prompt), catalog.pricing.inputUsd)) {
    blockers.push("input_price_changed");
  }
  if (!samePrice(usdPerMillion(model.pricing.completion), catalog.pricing.outputUsd)) {
    blockers.push("output_price_changed");
  }
  if (!samePrice(
    usdPerMillion(model.pricing.input_cache_read),
    catalog.pricing.cachedInputUsd,
  )) {
    blockers.push("cached_input_price_changed");
  }
  if (
    model.expiration_date
    && new Date(model.expiration_date).getTime() <= Date.now()
  ) {
    blockers.push("model_expired");
  }
  if (
    catalog.providerRouting.zeroDataRetention
    && !zdrModelIds.has(candidate.model)
  ) {
    blockers.push("zdr_endpoint_missing");
  }
  return blockers;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Catalog request failed (${response.status}) for ${url}`);
  }
  return response.json() as Promise<T>;
}

const proposal = modelPortfolioResearchProposalSchema.parse(
  JSON.parse(await readFile(proposalUrl, "utf8")),
);
const zdrResponse = await fetchJson<{ data: OpenRouterZdrEndpoint[] }>(
  "https://openrouter.ai/api/v1/endpoints/zdr",
);
const zdrModelIds = new Set(zdrResponse.data.map((endpoint) => endpoint.model_id));
let failed = false;

for (const candidate of proposal.candidates) {
  if (!candidate.evidence?.sourceUrl) {
    console.log(`${candidate.lane}\t${candidate.model}\tBLOCKED\tevidence_url_missing`);
    failed = true;
    continue;
  }
  const response = await fetchJson<{ data: OpenRouterModel }>(
    candidate.evidence.sourceUrl,
  );
  const blockers = compareCandidate(candidate, response.data, zdrModelIds);
  if (blockers.length > 0) failed = true;
  console.log([
    candidate.lane,
    candidate.model,
    blockers.length === 0 ? "CURRENT" : "DRIFTED",
    blockers.join(",") || "-",
  ].join("\t"));
}

if (new Date(proposal.expiresAt).getTime() <= Date.now()) {
  console.error(`Proposal evidence expired at ${proposal.expiresAt}`);
  failed = true;
}
if (failed) process.exitCode = 1;
