import { createHash } from "node:crypto";
import {
  modelRouteExperimentEvaluationInputSchema,
  type ModelRouteExperimentEvaluationInput,
  type ModelRouteExperimentOutcome,
} from "@paperclipai/shared";
import {
  scoreModelRouteOutputRubric,
  type ModelRouteEngineBenchmarkScore,
} from "./model-route-engine-benchmark.js";

const PLACEHOLDER_IDENTITIES = new Set([
  "adapter-default",
  "auto",
  "default",
  "unknown",
]);

type ExperimentDecision =
  | "simulation_passed"
  | "sovereign_control_retained"
  | "challenger_nominated_for_review"
  | "blocked";

export interface ModelRouteExperimentComparison {
  fixtureId: string;
  challengerLane: "deliberation_audit" | "external_specialist";
  status: "passed" | "blocked";
  decision: ExperimentDecision;
  control: {
    provider: string;
    model: string;
    score: number;
  };
  challenger: {
    provider: string;
    model: string;
    score: number;
  };
  qualityDelta: number;
  costMultiplier: number | null;
  latencyMultiplier: number | null;
  blockers: string[];
}

export interface ModelRouteExperimentEvaluation {
  version: "sysdom_model_route_experiment_evaluation_v1";
  suiteVersion: string;
  evidenceClass: ModelRouteExperimentEvaluationInput["evidenceClass"];
  evaluatedAt: string;
  status: "passed" | "blocked";
  reviewRequired: true;
  eligibleForAdoption: false;
  activationAttempted: false;
  providerDispatchAttempted: false;
  comparisons: ModelRouteExperimentComparison[];
  aggregate: {
    comparisonCount: number;
    blockedCount: number;
    simulationPassCount: number;
    challengerNominationCount: number;
  };
  blockers: string[];
}

function identityBlockers(
  outcome: ModelRouteExperimentOutcome,
  role: ModelRouteExperimentOutcome["role"],
) {
  const normalizedProvider = outcome.provider.trim().toLowerCase();
  const normalizedModel = outcome.model.trim().toLowerCase();
  const modelTail = normalizedModel.split("/").at(-1)?.split(":")[0] ?? normalizedModel;
  return [
    ...(PLACEHOLDER_IDENTITIES.has(normalizedProvider)
      ? [`${role}:provider_not_exact`]
      : []),
    ...(PLACEHOLDER_IDENTITIES.has(normalizedModel) || PLACEHOLDER_IDENTITIES.has(modelTail)
      ? [`${role}:model_not_exact`]
      : []),
  ];
}

function telemetryBlockers(
  outcome: ModelRouteExperimentOutcome,
  role: ModelRouteExperimentOutcome["role"],
  evidenceClass: ModelRouteExperimentEvaluationInput["evidenceClass"],
  requiresTools: boolean,
) {
  const observed = outcome.observed;
  const numericTelemetry = [
    ["latency_ms", observed.latencyMs],
    ["cost_usd", observed.costUsd],
    ["input_tokens", observed.inputTokens],
    ["output_tokens", observed.outputTokens],
    ["tool_calls", observed.toolCalls],
    ["context_tokens", observed.contextTokens],
  ] as const;
  return [
    ...numericTelemetry.flatMap(([name, value]) =>
      value === null ? [`${role}:telemetry_missing:${name}`] : []
    ),
    ...(observed.billingType === "unknown" ? [`${role}:billing_unknown`] : []),
    ...(!observed.usageReconciled ? [`${role}:usage_not_reconciled`] : []),
    ...(evidenceClass === "recorded_run"
      && observed.billingType !== "free"
      && observed.costUsd === 0
      ? [`${role}:zero_cost_not_treated_as_free`]
      : []),
    ...(!observed.contextHandled ? [`${role}:context_handling_failed`] : []),
    ...(requiresTools && (!observed.toolUseSucceeded || observed.toolCalls === 0)
      ? [`${role}:tool_use_failed`]
      : []),
    ...(observed.reviewOutcome === "needs_revision"
      ? [`${role}:review_needs_revision`]
      : observed.reviewOutcome === "rejected"
        ? [`${role}:review_rejected`]
        : []),
  ];
}

function scoreBlockers(
  role: ModelRouteExperimentOutcome["role"],
  score: ModelRouteEngineBenchmarkScore,
) {
  return [
    ...(!score.passed && score.blockers.length === 0
      ? [`${role}:score_below_threshold`]
      : []),
    ...score.blockers.map((blocker) => `${role}:${blocker}`),
  ];
}

function multiplier(challenger: number | null, control: number | null) {
  if (challenger === null || control === null) return null;
  if (control === 0) return challenger === 0 ? 1 : null;
  return Number((challenger / control).toFixed(4));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function evaluateModelRouteExperiment(
  rawInput: ModelRouteExperimentEvaluationInput,
): ModelRouteExperimentEvaluation {
  const input = modelRouteExperimentEvaluationInputSchema.parse(rawInput);
  const comparisons = input.suite.fixtures.map<ModelRouteExperimentComparison>((fixture) => {
    const control = input.outcomes.find(
      (outcome) =>
        outcome.fixtureId === fixture.id && outcome.role === "sovereign_control",
    )!;
    const challenger = input.outcomes.find(
      (outcome) =>
        outcome.fixtureId === fixture.id && outcome.role === "experiment_challenger",
    )!;
    const controlScore = scoreModelRouteOutputRubric(fixture.rubric, control.output);
    const challengerScore = scoreModelRouteOutputRubric(fixture.rubric, challenger.output);
    const costMultiplier = multiplier(
      challenger.observed.costUsd,
      control.observed.costUsd,
    );
    const latencyMultiplier = multiplier(
      challenger.observed.latencyMs,
      control.observed.latencyMs,
    );
    const blockers = [
      ...(sha256(fixture.task) !== fixture.taskSha256
        ? ["fixture_task_hash_invalid"]
        : []),
      ...(sha256(fixture.context) !== fixture.contextSha256
        ? ["fixture_context_hash_invalid"]
        : []),
      ...(control.lane !== "frontier" ? ["control_lane_must_be_frontier"] : []),
      ...(challenger.lane !== fixture.challengerLane
        ? ["challenger_lane_mismatch"]
        : []),
      ...(control.taskSha256 !== fixture.taskSha256
        || challenger.taskSha256 !== fixture.taskSha256
        ? ["task_hash_mismatch"]
        : []),
      ...(control.contextSha256 !== fixture.contextSha256
        || challenger.contextSha256 !== fixture.contextSha256
        ? ["context_hash_mismatch"]
        : []),
      ...(input.evidenceClass === "recorded_run"
        && (
          control.routeDecisionId === challenger.routeDecisionId
          || control.heartbeatRunId === challenger.heartbeatRunId
        )
        ? ["recorded_routes_must_be_distinct"]
        : []),
      ...identityBlockers(control, "sovereign_control"),
      ...identityBlockers(challenger, "experiment_challenger"),
      ...telemetryBlockers(
        control,
        "sovereign_control",
        input.evidenceClass,
        fixture.requiresTools,
      ),
      ...telemetryBlockers(
        challenger,
        "experiment_challenger",
        input.evidenceClass,
        fixture.requiresTools,
      ),
      ...scoreBlockers("sovereign_control", controlScore),
      ...scoreBlockers("experiment_challenger", challengerScore),
    ];
    const uniqueBlockers = [...new Set(blockers)].sort();
    const qualityDelta = challengerScore.score - controlScore.score;
    const challengerWithinThresholds =
      qualityDelta >= fixture.thresholds.minimumQualityDelta
      && costMultiplier !== null
      && costMultiplier <= fixture.thresholds.maximumCostMultiplier
      && latencyMultiplier !== null
      && latencyMultiplier <= fixture.thresholds.maximumLatencyMultiplier;
    const decision: ExperimentDecision = uniqueBlockers.length > 0
      ? "blocked"
      : input.evidenceClass === "synthetic_fixture"
        ? "simulation_passed"
        : challengerWithinThresholds
          ? "challenger_nominated_for_review"
          : "sovereign_control_retained";

    return {
      fixtureId: fixture.id,
      challengerLane: fixture.challengerLane,
      status: uniqueBlockers.length > 0 ? "blocked" : "passed",
      decision,
      control: {
        provider: control.provider,
        model: control.model,
        score: controlScore.score,
      },
      challenger: {
        provider: challenger.provider,
        model: challenger.model,
        score: challengerScore.score,
      },
      qualityDelta,
      costMultiplier,
      latencyMultiplier,
      blockers: uniqueBlockers,
    };
  });
  const blockers = comparisons.flatMap((comparison) =>
    comparison.blockers.map((blocker) => `${comparison.fixtureId}:${blocker}`)
  );
  const failClosedComparisons = blockers.length === 0
    ? comparisons
    : comparisons.map((comparison) =>
      comparison.decision === "challenger_nominated_for_review"
        ? { ...comparison, decision: "sovereign_control_retained" as const }
        : comparison
    );

  return {
    version: "sysdom_model_route_experiment_evaluation_v1",
    suiteVersion: input.suite.version,
    evidenceClass: input.evidenceClass,
    evaluatedAt: input.evaluatedAt,
    status: blockers.length > 0 ? "blocked" : "passed",
    reviewRequired: true,
    eligibleForAdoption: false,
    activationAttempted: false,
    providerDispatchAttempted: false,
    comparisons: failClosedComparisons,
    aggregate: {
      comparisonCount: failClosedComparisons.length,
      blockedCount: failClosedComparisons.filter(
        (comparison) => comparison.status === "blocked",
      ).length,
      simulationPassCount: failClosedComparisons.filter(
        (comparison) => comparison.decision === "simulation_passed",
      ).length,
      challengerNominationCount: failClosedComparisons.filter(
        (comparison) => comparison.decision === "challenger_nominated_for_review",
      ).length,
    },
    blockers,
  };
}
