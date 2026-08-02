import {
  modelRouteExecutionContractSchema,
  type ModelRouteExecutionContract,
  type ModelRouteRecommendation,
} from "@paperclipai/shared";

export const MODEL_ROUTE_EXECUTION_ASSESSMENT_VERSION =
  "sysdom_model_route_execution_assessment_v1";

export type ModelRouteExecutionBlocker =
  | "recommendation_not_ready"
  | "selected_candidate_missing"
  | "configured_provider_mismatch"
  | "configured_model_mismatch";

export interface ModelRouteExecutionAssessment {
  version: typeof MODEL_ROUTE_EXECUTION_ASSESSMENT_VERSION;
  status: "not_required" | "ready" | "blocked";
  enforced: boolean;
  blockers: ModelRouteExecutionBlocker[];
  configuredProvider: string;
  configuredModel: string;
  contract: ModelRouteExecutionContract | null;
}

function sameIdentity(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function assessModelRouteExecution(input: {
  recommendation: ModelRouteRecommendation;
  configuredProvider: string;
  configuredModel: string;
}): ModelRouteExecutionAssessment {
  const base = {
    version: MODEL_ROUTE_EXECUTION_ASSESSMENT_VERSION,
    configuredProvider: input.configuredProvider,
    configuredModel: input.configuredModel,
  } as const;

  if (!input.recommendation.portfolio) {
    return {
      ...base,
      status: "not_required",
      enforced: false,
      blockers: [],
      contract: null,
    };
  }

  const blockers: ModelRouteExecutionBlocker[] = [];
  const selected = input.recommendation.selectedCandidate;
  if (input.recommendation.status !== "ready") {
    blockers.push("recommendation_not_ready");
  }
  if (!selected) {
    blockers.push("selected_candidate_missing");
  } else {
    if (!sameIdentity(selected.provider, input.configuredProvider)) {
      blockers.push("configured_provider_mismatch");
    }
    if (!sameIdentity(selected.model, input.configuredModel)) {
      blockers.push("configured_model_mismatch");
    }
  }

  if (blockers.length > 0 || !selected) {
    return {
      ...base,
      status: "blocked",
      enforced: true,
      blockers,
      contract: null,
    };
  }

  const contract = modelRouteExecutionContractSchema.parse({
    version: "sysdom_model_route_execution_v1",
    policyVersion: input.recommendation.policyVersion,
    evaluatedAt: input.recommendation.evaluatedAt,
    portfolio: input.recommendation.portfolio,
    lane: selected.lane,
    provider: selected.provider,
    model: selected.model,
    billingType: selected.billingType,
    maxOutputTokens: selected.catalog?.maxOutputTokens ?? 1,
    providerRouting: selected.catalog?.providerRouting ?? null,
  });

  return {
    ...base,
    status: "ready",
    enforced: true,
    blockers: [],
    contract,
  };
}

export function applyModelRouteExecutionContract<T extends Record<string, unknown>>(
  runtimeConfig: T,
  assessment: ModelRouteExecutionAssessment,
): T & { modelRouteExecution?: ModelRouteExecutionContract } {
  if (assessment.status !== "ready" || !assessment.contract) return runtimeConfig;
  return {
    ...runtimeConfig,
    modelRouteExecution: assessment.contract,
  };
}
