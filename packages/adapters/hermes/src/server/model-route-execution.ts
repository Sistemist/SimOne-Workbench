import {
  modelRouteExecutionContractSchema,
  type ModelRouteExecutionContract,
} from "@paperclipai/shared";

export type HermesModelRouteExecutionBlocker =
  | "contract_invalid"
  | "provider_mismatch"
  | "model_mismatch"
  | "provider_routing_not_supported";

export interface HermesModelRouteExecutionAssessment {
  status: "not_required" | "ready" | "blocked";
  blockers: HermesModelRouteExecutionBlocker[];
  contract: ModelRouteExecutionContract | null;
}

function sameIdentity(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function assessHermesModelRouteExecution(input: {
  rawContract: unknown;
  resolvedProvider: string;
  model: string;
}): HermesModelRouteExecutionAssessment {
  if (input.rawContract === undefined || input.rawContract === null) {
    return {
      status: "not_required",
      blockers: [],
      contract: null,
    };
  }

  const parsed = modelRouteExecutionContractSchema.safeParse(input.rawContract);
  if (!parsed.success) {
    return {
      status: "blocked",
      blockers: ["contract_invalid"],
      contract: null,
    };
  }

  const blockers: HermesModelRouteExecutionBlocker[] = [];
  if (!sameIdentity(parsed.data.provider, input.resolvedProvider)) {
    blockers.push("provider_mismatch");
  }
  if (!sameIdentity(parsed.data.model, input.model)) {
    blockers.push("model_mismatch");
  }
  if (parsed.data.providerRouting) {
    blockers.push("provider_routing_not_supported");
  }

  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    contract: parsed.data,
  };
}

export function hermesModelRouteExecutionBlockMessage(
  assessment: HermesModelRouteExecutionAssessment,
) {
  if (assessment.status !== "blocked") return "model route execution contract is ready";
  return `model route execution contract blocked Hermes dispatch: ${assessment.blockers.join(", ")}`;
}
