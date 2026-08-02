import { z } from "zod";

export const modelRouteDecisionLaneSchema = z.enum([
  "background",
  "workhorse",
  "frontier",
  "deliberation_audit",
  "external_specialist",
]);

export const modelRouteDecisionRiskLevelSchema = z.enum([
  "unknown",
  "low",
  "medium",
  "high",
  "critical",
]);

export const modelRouteDecisionOutputConfidenceSchema = z.enum([
  "unknown",
  "low",
  "medium",
  "high",
]);

export const modelRouteDecisionReviewStatusSchema = z.enum([
  "pending",
  "approved",
  "needs_revision",
  "rejected",
]);

export const modelExecutionBillingTypeSchema = z.enum([
  "local",
  "free",
  "subscription_included",
  "metered_api",
  "unknown",
]);

export const modelRoutePostureSchema = z.enum([
  "cost_conscious",
  "balanced",
  "quality_first",
]);

export const modelRouteTaskClassSchema = z.enum([
  "deterministic",
  "triage",
  "synthesis",
  "analysis",
  "strategy",
  "specialist",
]);

export const modelRouteExternalEffectSchema = z.enum([
  "public",
  "customer",
  "financial",
  "security",
  "privacy",
  "deletion",
  "governance",
]);

export const modelRouteDataSensitivitySchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);

export const modelRouteEvidenceRequirementSchema = z.enum([
  "none",
  "standard",
  "provenance_required",
  "independent_review",
]);

export const modelRouteLatencyNeedSchema = z.enum([
  "batch",
  "interactive",
  "urgent",
]);

export const modelRouteTaskSignalsSchema = z.object({
  version: z.literal("sysdom_model_route_task_signals_v1"),
  taskClass: modelRouteTaskClassSchema,
  criticality: z.enum(["low", "medium", "high", "critical"]),
  reversible: z.boolean(),
  externalEffects: z.array(modelRouteExternalEffectSchema).max(7).default([]),
  dataSensitivity: modelRouteDataSensitivitySchema,
  evidenceRequirement: modelRouteEvidenceRequirementSchema,
  latencyNeed: modelRouteLatencyNeedSchema.default("interactive"),
  requiresTools: z.boolean().default(false),
  requiresStructuredOutput: z.boolean().default(true),
  approvalRequired: z.boolean().default(false),
}).strict();

export const modelRouteRecommendationLaneSchema = z.enum([
  "no_model",
  ...modelRouteDecisionLaneSchema.options,
]);

export const modelRouteCandidateEvidenceSchema = z.object({
  sourceKind: z.enum([
    "provider_docs",
    "provider_api",
    "manual_review",
    "benchmark",
  ]),
  authority: z.enum([
    "provider",
    "independent",
    "sysdom_review",
  ]).optional(),
  sourceLabel: z.string().trim().min(1).max(500),
  sourceUrl: z.string().url().max(2_000).nullable().optional().default(null),
  verifiedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
}).strict();

export const modelRouteCandidateCatalogSchema = z.object({
  canonicalSlug: z.string().trim().min(1).max(300),
  lifecycle: z.enum(["stable", "preview"]),
  contextWindowTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  pricing: z.object({
    currency: z.literal("USD"),
    unit: z.literal("per_million_tokens"),
    inputUsd: z.number().nonnegative(),
    outputUsd: z.number().nonnegative(),
    cachedInputUsd: z.number().nonnegative().nullable().optional().default(null),
  }).strict(),
  providerRouting: z.object({
    sort: z.enum(["price", "throughput", "latency"]),
    allowFallbacks: z.boolean(),
    requireParameters: z.boolean(),
    dataCollection: z.enum(["allow", "deny"]),
    zeroDataRetention: z.boolean(),
    maxInputTokensPerRequest: z.number().int().positive(),
    maxInputUsdPerMillion: z.number().nonnegative(),
    maxOutputUsdPerMillion: z.number().nonnegative(),
  }).strict(),
}).strict();

export const modelRouteCandidateEvaluationSchema = z.object({
  version: z.literal("sysdom_model_candidate_evaluation_v1"),
  suiteVersion: z.string().trim().min(1).max(200),
  reviewedAt: z.string().datetime(),
  passed: z.boolean(),
  fixtureResults: z.array(z.object({
    fixtureId: z.string().trim().min(1).max(200),
    score: z.number().int().min(0).max(100),
    passed: z.boolean(),
    latencyMs: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    toolCalls: z.number().int().nonnegative(),
    contextTokens: z.number().int().nonnegative(),
    toolUseSucceeded: z.boolean(),
    contextHandled: z.boolean(),
    reviewOutcome: z.enum(["accepted", "needs_revision", "rejected"]),
  }).strict()).min(1).max(100),
  aggregate: z.object({
    qualityScore: z.number().int().min(0).max(100),
    averageLatencyMs: z.number().int().nonnegative(),
    totalCostUsd: z.number().nonnegative(),
    totalInputTokens: z.number().int().nonnegative(),
    totalOutputTokens: z.number().int().nonnegative(),
    totalToolCalls: z.number().int().nonnegative(),
    maxContextTokens: z.number().int().nonnegative(),
  }).strict(),
}).strict();

export const modelRouteCandidateSchema = z.object({
  provider: z.string().trim().min(1).max(200),
  model: z.string().trim().min(1).max(300),
  lane: modelRouteDecisionLaneSchema,
  billingType: modelExecutionBillingTypeSchema,
  costRank: z.number().int().min(1).max(1_000),
  qualityRank: z.number().int().min(1).max(1_000),
  latencyRank: z.number().int().min(1).max(1_000).optional().default(1),
  enabled: z.boolean().optional().default(true),
  supportsTools: z.boolean().optional().default(false),
  supportsStructuredOutput: z.boolean().optional().default(true),
  supportsConfidentialData: z.boolean().optional().default(false),
  supportsRestrictedData: z.boolean().optional().default(false),
  evidence: modelRouteCandidateEvidenceSchema.nullable().optional().default(null),
  catalog: modelRouteCandidateCatalogSchema.nullable().optional().default(null),
  evaluation: modelRouteCandidateEvaluationSchema.nullable().optional().default(null),
}).strict();

export const modelRouteRecommendationInputSchema = z.object({
  policyVersion: z.string().trim().min(1).max(200),
  evaluatedAt: z.string().datetime(),
  posture: modelRoutePostureSchema.optional().default("balanced"),
  portfolio: z.object({
    revisionId: z.string().uuid(),
    version: z.number().int().positive(),
  }).strict().nullable().optional().default(null),
  task: z.object({
    intent: z.string().trim().min(1).max(4_000),
    signalSource: z.enum(["explicit", "derived"]).optional().default("derived"),
    taskClass: modelRouteTaskClassSchema,
    criticality: z.enum(["low", "medium", "high", "critical"]),
    reversible: z.boolean(),
    externalEffects: z.array(modelRouteExternalEffectSchema).max(7).optional().default([]),
    dataSensitivity: modelRouteDataSensitivitySchema,
    evidenceRequirement: modelRouteEvidenceRequirementSchema,
    latencyNeed: modelRouteLatencyNeedSchema.optional().default("interactive"),
    requiresTools: z.boolean().optional().default(false),
    requiresStructuredOutput: z.boolean().optional().default(true),
    approvalRequired: z.boolean().optional().default(false),
  }).strict(),
  simContext: z.object({
    projectionId: z.string().uuid().nullable().optional().default(null),
    projectionVersion: z.number().int().positive().nullable().optional().default(null),
    constitutionRevisionId: z.string().uuid().nullable().optional().default(null),
    activeEngine: z.enum(["product", "customer", "cash", "skills"]).nullable().optional().default(null),
    activeConstraintDecision: z.enum(["proposed", "accepted", "rejected"]).nullable().optional().default(null),
    nextMoveApprovalRequired: z.boolean().optional().default(false),
    approvalBoundaries: z.array(z.string().trim().min(1).max(2_000)).max(100).optional().default([]),
  }).strict().nullable().optional().default(null),
  candidates: z.array(modelRouteCandidateSchema).max(100),
}).strict();

export const modelRouteCandidateAssessmentSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  lane: modelRouteDecisionLaneSchema,
  outcome: z.enum(["selected", "excluded"]),
  reason: z.string().min(1),
});

export const modelRouteRecommendationSchema = z.object({
  version: z.literal("sysdom_model_route_recommendation_v1"),
  mode: z.literal("shadow"),
  policyVersion: z.string().min(1),
  evaluatedAt: z.string().datetime(),
  status: z.enum(["ready", "no_model", "blocked"]),
  posture: modelRoutePostureSchema,
  portfolio: z.object({
    revisionId: z.string().uuid(),
    version: z.number().int().positive(),
  }).strict().nullable(),
  lane: modelRouteRecommendationLaneSchema,
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  selectedCandidate: modelRouteCandidateSchema.nullable(),
  candidateAssessments: z.array(modelRouteCandidateAssessmentSchema).max(100),
  confidence: z.enum(["low", "medium", "high"]),
  reason: z.string().min(1),
  approvalGate: z.enum([
    "none",
    "founder_review_before_execution",
    "founder_approval_before_external_effect",
  ]),
  signals: z.object({
    source: z.enum(["explicit", "derived"]).optional().default("derived"),
    taskClass: modelRouteTaskClassSchema,
    criticality: z.enum(["low", "medium", "high", "critical"]),
    reversible: z.boolean(),
    externalEffects: z.array(modelRouteExternalEffectSchema).max(7),
    dataSensitivity: modelRouteDataSensitivitySchema,
    evidenceRequirement: modelRouteEvidenceRequirementSchema,
    latencyNeed: modelRouteLatencyNeedSchema.optional().default("interactive"),
    approvalRequired: z.boolean(),
    activeEngine: z.enum(["product", "customer", "cash", "skills"]).nullable(),
    projectionId: z.string().uuid().nullable(),
    projectionVersion: z.number().int().positive().nullable(),
    constitutionRevisionId: z.string().uuid().nullable(),
  }).strict(),
}).strict();

export const modelRouteExecutionContractSchema = z.object({
  version: z.literal("sysdom_model_route_execution_v1"),
  policyVersion: z.string().trim().min(1).max(200),
  evaluatedAt: z.string().datetime(),
  portfolio: z.object({
    revisionId: z.string().uuid(),
    version: z.number().int().positive(),
  }).strict(),
  lane: modelRouteDecisionLaneSchema,
  provider: z.string().trim().min(1).max(200),
  model: z.string().trim().min(1).max(300),
  billingType: modelExecutionBillingTypeSchema,
  maxOutputTokens: z.number().int().positive(),
  providerRouting: modelRouteCandidateCatalogSchema.shape.providerRouting.nullable(),
}).strict();

const nullablePositiveInteger = z.number().int().positive().nullable();
const nullableDateTime = z.string().datetime().nullable();
const nullableEvidenceSource = z.string().trim().min(1).max(500).nullable();

export const updateModelExecutionPolicySchema = z.object({
  provider: z.string().trim().min(1).max(200),
  model: z.string().trim().min(1).max(300),
  billingType: modelExecutionBillingTypeSchema,
  timeoutSec: z.number().int().positive().max(86_400),
  maxTurnsPerRun: z.number().int().positive().max(1_000),
  maxRuns: z.literal(1),
  maxRetries: z.literal(0),
  concurrency: z.literal(1),
  maxRunCostCents: nullablePositiveInteger,
  providerHardCapCents: nullablePositiveInteger,
  providerHardCapEvidenceSource: nullableEvidenceSource,
  providerHardCapVerifiedAt: nullableDateTime,
  providerHardCapExpiresAt: nullableDateTime,
  subscriptionEvidenceSource: nullableEvidenceSource,
  subscriptionVerifiedAt: nullableDateTime,
  subscriptionExpiresAt: nullableDateTime,
  meteredOverageAllowed: z.boolean(),
}).strict().superRefine((value, ctx) => {
  const validateEvidenceWindow = (
    verifiedAt: string | null,
    expiresAt: string | null,
    path: "providerHardCapExpiresAt" | "subscriptionExpiresAt",
  ) => {
    if (verifiedAt && expiresAt && new Date(expiresAt).getTime() <= new Date(verifiedAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Evidence expiry must be later than its verification time",
        path: [path],
      });
    }
  };
  validateEvidenceWindow(
    value.providerHardCapVerifiedAt,
    value.providerHardCapExpiresAt,
    "providerHardCapExpiresAt",
  );
  validateEvidenceWindow(
    value.subscriptionVerifiedAt,
    value.subscriptionExpiresAt,
    "subscriptionExpiresAt",
  );
});

export const modelRouteDecisionOutputArtifactSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  href: z.string().regex(/^\/artifacts(?:$|[?#])/, "Artifact links must stay inside the company artifacts surface"),
  source: z.enum(["document", "attachment", "work_product"]).optional(),
});

export const createModelRouteDecisionSchema = z.object({
  agentId: z.string().uuid(),
  issueId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
  heartbeatRunId: z.string().uuid().optional().nullable(),
  lane: modelRouteDecisionLaneSchema,
  provider: z.string().min(1),
  model: z.string().min(1),
  reason: z.string().min(1),
  riskLevel: modelRouteDecisionRiskLevelSchema.optional().default("unknown"),
  taskIntent: z.string().min(1).optional().nullable(),
  contextSummary: z.string().min(1).optional().nullable(),
  contextPayload: z.unknown().optional(),
  approvalGate: z.string().min(1).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  createdByRunId: z.string().uuid().optional().nullable(),
});

export const updateModelRouteDecisionReviewSchema = z.object({
  outputSummary: z.string().min(1).optional().nullable(),
  outputConfidence: modelRouteDecisionOutputConfidenceSchema.optional().default("unknown"),
  reviewStatus: modelRouteDecisionReviewStatusSchema.optional().default("pending"),
  reviewNote: z.string().min(1).optional().nullable(),
  outputArtifacts: z.array(modelRouteDecisionOutputArtifactSchema).max(10).optional(),
});

export type CreateModelRouteDecision = z.infer<typeof createModelRouteDecisionSchema>;
export type UpdateModelRouteDecisionReview = z.infer<typeof updateModelRouteDecisionReviewSchema>;
export type ModelRouteDecisionLane = z.infer<typeof modelRouteDecisionLaneSchema>;
export type ModelRouteDecisionRiskLevel = z.infer<typeof modelRouteDecisionRiskLevelSchema>;
export type ModelRouteDecisionOutputConfidence = z.infer<typeof modelRouteDecisionOutputConfidenceSchema>;
export type ModelRouteDecisionReviewStatus = z.infer<typeof modelRouteDecisionReviewStatusSchema>;
export type ModelRouteDecisionOutputArtifact = z.infer<typeof modelRouteDecisionOutputArtifactSchema>;
export type ModelExecutionBillingTypeInput = z.infer<typeof modelExecutionBillingTypeSchema>;
export type ModelRoutePosture = z.infer<typeof modelRoutePostureSchema>;
export type ModelRouteTaskClass = z.infer<typeof modelRouteTaskClassSchema>;
export type ModelRouteExternalEffect = z.infer<typeof modelRouteExternalEffectSchema>;
export type ModelRouteDataSensitivity = z.infer<typeof modelRouteDataSensitivitySchema>;
export type ModelRouteEvidenceRequirement = z.infer<typeof modelRouteEvidenceRequirementSchema>;
export type ModelRouteLatencyNeed = z.infer<typeof modelRouteLatencyNeedSchema>;
export type ModelRouteTaskSignals = z.infer<typeof modelRouteTaskSignalsSchema>;
export type ModelRouteRecommendationLane = z.infer<typeof modelRouteRecommendationLaneSchema>;
export type ModelRouteCandidateEvidence = z.infer<typeof modelRouteCandidateEvidenceSchema>;
export type ModelRouteCandidateCatalog = z.infer<typeof modelRouteCandidateCatalogSchema>;
export type ModelRouteCandidateEvaluation = z.infer<typeof modelRouteCandidateEvaluationSchema>;
export type ModelRouteCandidate = z.infer<typeof modelRouteCandidateSchema>;
export type ModelRouteRecommendationInput = z.infer<typeof modelRouteRecommendationInputSchema>;
export type ModelRouteCandidateAssessment = z.infer<typeof modelRouteCandidateAssessmentSchema>;
export type ModelRouteRecommendation = z.infer<typeof modelRouteRecommendationSchema>;
export type ModelRouteExecutionContract = z.infer<typeof modelRouteExecutionContractSchema>;
export type UpdateModelExecutionPolicy = z.infer<typeof updateModelExecutionPolicySchema>;
