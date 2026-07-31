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
export type UpdateModelExecutionPolicy = z.infer<typeof updateModelExecutionPolicySchema>;
