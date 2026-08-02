import { z } from "zod";
import {
  modelExecutionBillingTypeSchema,
  modelRouteDecisionLaneSchema,
} from "./model-route-decision.js";
import {
  modelRouteEngineBenchmarkOutputSchema,
  modelRouteOutputRubricSchema,
} from "./model-portfolio.js";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const modelRouteExperimentEvidenceClassSchema = z.enum([
  "synthetic_fixture",
  "recorded_run",
]);

export const modelRouteExperimentFixtureSchema = z.object({
  id: z.string().trim().min(1).max(200),
  engine: z.enum(["product", "customer", "cash", "skills"]),
  workflow: z.string().trim().min(1).max(500),
  challengerLane: z.enum(["deliberation_audit", "external_specialist"]),
  task: z.object({
    intent: z.string().trim().min(1).max(4_000),
    boundary: z.string().trim().min(1).max(4_000),
    approvalGate: z.enum([
      "none",
      "founder_review_before_execution",
      "founder_approval_before_external_effect",
    ]),
  }).strict(),
  context: z.object({
    evidenceRefIds: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
    summary: z.string().trim().min(1).max(8_000),
    approvalBoundaries: z.array(z.string().trim().min(1).max(2_000)).max(50),
  }).strict(),
  taskSha256: sha256Schema,
  contextSha256: sha256Schema,
  requiresTools: z.boolean(),
  rubric: modelRouteOutputRubricSchema,
  thresholds: z.object({
    minimumQualityDelta: z.number().int().min(0).max(100),
    maximumCostMultiplier: z.number().positive().max(100),
    maximumLatencyMultiplier: z.number().positive().max(100),
  }).strict(),
}).strict();

export const modelRouteExperimentSuiteSchema = z.object({
  version: z.literal("sysdom_model_route_experiments_v1"),
  description: z.string().trim().min(1).max(2_000),
  fixtures: z.array(modelRouteExperimentFixtureSchema).length(2),
}).strict().superRefine((suite, ctx) => {
  for (const lane of ["deliberation_audit", "external_specialist"] as const) {
    if (suite.fixtures.filter((fixture) => fixture.challengerLane === lane).length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: `Experiment suite must contain exactly one ${lane} fixture`,
        path: ["fixtures"],
      });
    }
  }
});

export const modelRouteExperimentOutcomeSchema = z.object({
  fixtureId: z.string().trim().min(1).max(200),
  role: z.enum(["sovereign_control", "experiment_challenger"]),
  provider: z.string().trim().min(1).max(200),
  model: z.string().trim().min(1).max(300),
  lane: modelRouteDecisionLaneSchema,
  taskSha256: sha256Schema,
  contextSha256: sha256Schema,
  routeDecisionId: z.string().uuid().nullable().optional().default(null),
  heartbeatRunId: z.string().uuid().nullable().optional().default(null),
  output: modelRouteEngineBenchmarkOutputSchema,
  observed: z.object({
    providerRequestMade: z.boolean(),
    billingType: modelExecutionBillingTypeSchema,
    latencyMs: z.number().int().nonnegative().nullable(),
    costUsd: z.number().nonnegative().nullable(),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    toolCalls: z.number().int().nonnegative().nullable(),
    contextTokens: z.number().int().nonnegative().nullable(),
    usageReconciled: z.boolean(),
    toolUseSucceeded: z.boolean(),
    contextHandled: z.boolean(),
    reviewOutcome: z.enum(["accepted", "needs_revision", "rejected"]),
  }).strict(),
}).strict();

export const modelRouteExperimentEvaluationInputSchema = z.object({
  version: z.literal("sysdom_model_route_experiment_input_v1"),
  evidenceClass: modelRouteExperimentEvidenceClassSchema,
  evaluatedAt: z.string().datetime(),
  suite: modelRouteExperimentSuiteSchema,
  outcomes: z.array(modelRouteExperimentOutcomeSchema).length(4),
}).strict().superRefine((input, ctx) => {
  const fixtureIds = new Set(input.suite.fixtures.map((fixture) => fixture.id));
  const outcomeKeys = new Set<string>();
  input.outcomes.forEach((outcome, index) => {
    if (!fixtureIds.has(outcome.fixtureId)) {
      ctx.addIssue({
        code: "custom",
        message: "Experiment outcome references an unknown fixture",
        path: ["outcomes", index, "fixtureId"],
      });
    }
    const key = `${outcome.fixtureId}/${outcome.role}`;
    if (outcomeKeys.has(key)) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate experiment outcome role for fixture",
        path: ["outcomes", index, "role"],
      });
    }
    outcomeKeys.add(key);
    if (input.evidenceClass === "synthetic_fixture") {
      if (
        outcome.observed.providerRequestMade
        || outcome.routeDecisionId
        || outcome.heartbeatRunId
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Synthetic experiment outcomes cannot claim provider or run execution",
          path: ["outcomes", index],
        });
      }
    } else if (
      !outcome.observed.providerRequestMade
      || !outcome.routeDecisionId
      || !outcome.heartbeatRunId
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Recorded experiment outcomes require provider, route-decision, and run evidence",
        path: ["outcomes", index],
      });
    }
  });
  input.suite.fixtures.forEach((fixture) => {
    for (const role of ["sovereign_control", "experiment_challenger"] as const) {
      if (!outcomeKeys.has(`${fixture.id}/${role}`)) {
        ctx.addIssue({
          code: "custom",
          message: `Experiment fixture ${fixture.id} is missing ${role}`,
          path: ["outcomes"],
        });
      }
    }
  });
});

export type ModelRouteExperimentEvidenceClass = z.infer<
  typeof modelRouteExperimentEvidenceClassSchema
>;
export type ModelRouteExperimentFixture = z.infer<typeof modelRouteExperimentFixtureSchema>;
export type ModelRouteExperimentSuite = z.infer<typeof modelRouteExperimentSuiteSchema>;
export type ModelRouteExperimentOutcome = z.infer<typeof modelRouteExperimentOutcomeSchema>;
export type ModelRouteExperimentEvaluationInput = z.infer<
  typeof modelRouteExperimentEvaluationInputSchema
>;
