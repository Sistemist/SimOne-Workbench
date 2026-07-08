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
});

export type CreateModelRouteDecision = z.infer<typeof createModelRouteDecisionSchema>;
export type UpdateModelRouteDecisionReview = z.infer<typeof updateModelRouteDecisionReviewSchema>;
export type ModelRouteDecisionLane = z.infer<typeof modelRouteDecisionLaneSchema>;
export type ModelRouteDecisionRiskLevel = z.infer<typeof modelRouteDecisionRiskLevelSchema>;
export type ModelRouteDecisionOutputConfidence = z.infer<typeof modelRouteDecisionOutputConfidenceSchema>;
export type ModelRouteDecisionReviewStatus = z.infer<typeof modelRouteDecisionReviewStatusSchema>;
