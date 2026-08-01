import {
  modelRouteRecommendationInputSchema,
  modelRouteRecommendationSchema,
  type ModelRouteCandidate,
  type ModelRouteCandidateAssessment,
  type ModelRouteDecisionRiskLevel,
  type ModelRouteRecommendation,
  type ModelRouteRecommendationInput,
  type ModelRouteRecommendationLane,
} from "@paperclipai/shared";

const RISK_ORDER = ["low", "medium", "high", "critical"] as const;
const HIGH_IMPACT_EXTERNAL_EFFECTS = new Set([
  "financial",
  "security",
  "privacy",
  "deletion",
  "governance",
]);
const PLACEHOLDER_MODEL_NAMES = new Set([
  "adapter-default",
  "auto",
  "default",
  "unknown",
]);

function elevateRisk(
  current: Exclude<ModelRouteDecisionRiskLevel, "unknown">,
  minimum: Exclude<ModelRouteDecisionRiskLevel, "unknown">,
) {
  return RISK_ORDER.indexOf(current) >= RISK_ORDER.indexOf(minimum) ? current : minimum;
}

function deriveRiskLevel(
  input: ModelRouteRecommendationInput,
): Exclude<ModelRouteDecisionRiskLevel, "unknown"> {
  const { task, simContext } = input;
  let risk = task.criticality;

  if (!task.reversible) risk = elevateRisk(risk, "high");
  if (task.externalEffects.some((effect) => HIGH_IMPACT_EXTERNAL_EFFECTS.has(effect))) {
    risk = elevateRisk(risk, "critical");
  } else if (task.externalEffects.length > 0) {
    risk = elevateRisk(risk, "high");
  }
  if (task.dataSensitivity === "restricted") risk = elevateRisk(risk, "critical");
  if (task.dataSensitivity === "confidential") risk = elevateRisk(risk, "high");
  if (task.evidenceRequirement === "independent_review") risk = elevateRisk(risk, "high");
  if (task.approvalRequired || simContext?.nextMoveApprovalRequired) {
    risk = elevateRisk(risk, "high");
  }

  return risk;
}

function deriveLane(
  input: ModelRouteRecommendationInput,
  riskLevel: Exclude<ModelRouteDecisionRiskLevel, "unknown">,
): ModelRouteRecommendationLane {
  if (input.task.taskClass === "deterministic") return "no_model";
  if (riskLevel === "critical" || input.task.evidenceRequirement === "independent_review") {
    return "deliberation_audit";
  }
  if (input.task.taskClass === "specialist") return "external_specialist";
  if (riskLevel === "high" || input.task.taskClass === "strategy") return "frontier";
  if (
    riskLevel === "medium"
    || input.task.taskClass === "analysis"
    || input.task.taskClass === "synthesis"
  ) {
    return "workhorse";
  }
  return "background";
}

function deriveApprovalGate(
  input: ModelRouteRecommendationInput,
  riskLevel: Exclude<ModelRouteDecisionRiskLevel, "unknown">,
) {
  const approvalRequired =
    input.task.approvalRequired || input.simContext?.nextMoveApprovalRequired === true;
  if (input.task.externalEffects.length > 0 && (approvalRequired || riskLevel === "high" || riskLevel === "critical")) {
    return "founder_approval_before_external_effect" as const;
  }
  if (approvalRequired || riskLevel === "high" || riskLevel === "critical") {
    return "founder_review_before_execution" as const;
  }
  return "none" as const;
}

function candidateExclusionReason(
  candidate: ModelRouteCandidate,
  input: ModelRouteRecommendationInput,
  lane: Exclude<ModelRouteRecommendationLane, "no_model">,
): string | null {
  if (!candidate.enabled) return "Candidate is disabled in the allowed model portfolio.";
  if (candidate.lane !== lane) return `Candidate is assigned to the ${candidate.lane} lane, not ${lane}.`;
  if (candidate.billingType === "unknown") return "Candidate billing is unknown and must fail closed.";
  const normalizedProvider = candidate.provider.trim().toLowerCase();
  const normalizedModel = candidate.model.trim().toLowerCase();
  const modelName = normalizedModel.split("/").at(-1)?.split(":")[0] ?? normalizedModel;
  if (PLACEHOLDER_MODEL_NAMES.has(normalizedProvider)) {
    return "Candidate does not pin an exact provider.";
  }
  if (PLACEHOLDER_MODEL_NAMES.has(normalizedModel) || PLACEHOLDER_MODEL_NAMES.has(modelName)) {
    return "Candidate does not pin an exact model.";
  }
  if (!candidate.evidence) {
    return "Candidate provenance and freshness evidence is missing.";
  }
  const evaluatedAt = new Date(input.evaluatedAt).getTime();
  const verifiedAt = new Date(candidate.evidence.verifiedAt).getTime();
  const expiresAt = new Date(candidate.evidence.expiresAt).getTime();
  if (verifiedAt > evaluatedAt) {
    return "Candidate evidence verification is dated after this recommendation.";
  }
  if (expiresAt <= evaluatedAt) {
    return "Candidate catalog evidence is stale.";
  }
  if (input.task.requiresTools && !candidate.supportsTools) {
    return "Candidate does not support the tools required by this task.";
  }
  if (input.task.requiresStructuredOutput && !candidate.supportsStructuredOutput) {
    return "Candidate does not support the required structured output.";
  }
  if (input.task.dataSensitivity === "confidential" && !candidate.supportsConfidentialData) {
    return "Candidate is not approved for confidential venture context.";
  }
  if (input.task.dataSensitivity === "restricted" && !candidate.supportsRestrictedData) {
    return "Candidate is not approved for restricted venture context.";
  }
  return null;
}

function candidateRank(candidate: ModelRouteCandidate, posture: ModelRouteRecommendationInput["posture"]) {
  if (posture === "cost_conscious") return [candidate.costRank, candidate.qualityRank] as const;
  if (posture === "quality_first") return [candidate.qualityRank, candidate.costRank] as const;
  return [candidate.costRank + candidate.qualityRank, candidate.qualityRank, candidate.costRank] as const;
}

function compareCandidates(
  left: ModelRouteCandidate,
  right: ModelRouteCandidate,
  posture: ModelRouteRecommendationInput["posture"],
) {
  const leftRank = candidateRank(left, posture);
  const rightRank = candidateRank(right, posture);
  for (let index = 0; index < Math.max(leftRank.length, rightRank.length); index += 1) {
    const delta = (leftRank[index] ?? 0) - (rightRank[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return `${left.provider}/${left.model}`.localeCompare(`${right.provider}/${right.model}`);
}

function recommendationReason(
  lane: ModelRouteRecommendationLane,
  riskLevel: Exclude<ModelRouteDecisionRiskLevel, "unknown">,
  selectedCandidate: ModelRouteCandidate | null,
  portfolio: ModelRouteRecommendationInput["portfolio"],
) {
  if (lane === "no_model") {
    return "This task is deterministic, so Sysdom Auto recommends code or rules instead of model inference.";
  }
  if (!selectedCandidate) {
    if (!portfolio) {
      return "Sysdom Auto cannot select a model because no active versioned model portfolio is available.";
    }
    return `Sysdom Auto recommends the ${lane} lane for ${riskLevel}-risk work, but no permitted exact model satisfies the task controls.`;
  }
  return `Sysdom Auto recommends ${selectedCandidate.provider}/${selectedCandidate.model} in the ${lane} lane for ${riskLevel}-risk work.`;
}

export function recommendModelRoute(rawInput: ModelRouteRecommendationInput): ModelRouteRecommendation {
  const input = modelRouteRecommendationInputSchema.parse(rawInput);
  const riskLevel = deriveRiskLevel(input);
  const lane = deriveLane(input, riskLevel);
  const approvalRequired =
    input.task.approvalRequired || input.simContext?.nextMoveApprovalRequired === true;

  if (lane === "no_model") {
    return modelRouteRecommendationSchema.parse({
      version: "sysdom_model_route_recommendation_v1",
      mode: "shadow",
      policyVersion: input.policyVersion,
      evaluatedAt: input.evaluatedAt,
      status: "no_model",
      posture: input.posture,
      portfolio: input.portfolio,
      lane,
      riskLevel,
      selectedCandidate: null,
      candidateAssessments: input.candidates.map((candidate) => ({
        provider: candidate.provider,
        model: candidate.model,
        lane: candidate.lane,
        outcome: "excluded",
        reason: "A model is unnecessary for deterministic work.",
      })),
      confidence: "high",
      reason: recommendationReason(lane, riskLevel, null, input.portfolio),
      approvalGate: deriveApprovalGate(input, riskLevel),
      signals: {
        taskClass: input.task.taskClass,
        criticality: input.task.criticality,
        reversible: input.task.reversible,
        externalEffects: input.task.externalEffects,
        dataSensitivity: input.task.dataSensitivity,
        evidenceRequirement: input.task.evidenceRequirement,
        approvalRequired,
        activeEngine: input.simContext?.activeEngine ?? null,
        projectionId: input.simContext?.projectionId ?? null,
        projectionVersion: input.simContext?.projectionVersion ?? null,
        constitutionRevisionId: input.simContext?.constitutionRevisionId ?? null,
      },
    });
  }

  const assessments = new Map<string, string>();
  const eligible = input.candidates.filter((candidate) => {
    const reason = candidateExclusionReason(candidate, input, lane);
    if (reason) assessments.set(`${candidate.provider}/${candidate.model}`, reason);
    return reason === null;
  });
  eligible.sort((left, right) => compareCandidates(left, right, input.posture));
  const selectedCandidate = eligible[0] ?? null;

  const candidateAssessments: ModelRouteCandidateAssessment[] = input.candidates.map((candidate) => {
    const key = `${candidate.provider}/${candidate.model}`;
    if (
      selectedCandidate
      && candidate.provider === selectedCandidate.provider
      && candidate.model === selectedCandidate.model
    ) {
      return {
        provider: candidate.provider,
        model: candidate.model,
        lane: candidate.lane,
        outcome: "selected",
        reason: `Best eligible candidate for the ${input.posture} posture.`,
      };
    }
    return {
      provider: candidate.provider,
      model: candidate.model,
      lane: candidate.lane,
      outcome: "excluded",
      reason: assessments.get(key) ?? "A higher-ranked eligible candidate was selected.",
    };
  });

  return modelRouteRecommendationSchema.parse({
    version: "sysdom_model_route_recommendation_v1",
    mode: "shadow",
    policyVersion: input.policyVersion,
    evaluatedAt: input.evaluatedAt,
    status: selectedCandidate ? "ready" : "blocked",
    posture: input.posture,
    portfolio: input.portfolio,
    lane,
    riskLevel,
    selectedCandidate,
    candidateAssessments,
    confidence: selectedCandidate
      ? input.simContext?.projectionId ? "high" : "medium"
      : "low",
    reason: recommendationReason(lane, riskLevel, selectedCandidate, input.portfolio),
    approvalGate: deriveApprovalGate(input, riskLevel),
    signals: {
      taskClass: input.task.taskClass,
      criticality: input.task.criticality,
      reversible: input.task.reversible,
      externalEffects: input.task.externalEffects,
      dataSensitivity: input.task.dataSensitivity,
      evidenceRequirement: input.task.evidenceRequirement,
      approvalRequired,
      activeEngine: input.simContext?.activeEngine ?? null,
      projectionId: input.simContext?.projectionId ?? null,
      projectionVersion: input.simContext?.projectionVersion ?? null,
      constitutionRevisionId: input.simContext?.constitutionRevisionId ?? null,
    },
  });
}
