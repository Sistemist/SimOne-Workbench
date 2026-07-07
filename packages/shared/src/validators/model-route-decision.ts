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
  approvalGate: z.string().min(1).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  createdByRunId: z.string().uuid().optional().nullable(),
});

export type CreateModelRouteDecision = z.infer<typeof createModelRouteDecisionSchema>;
export type ModelRouteDecisionLane = z.infer<typeof modelRouteDecisionLaneSchema>;
export type ModelRouteDecisionRiskLevel = z.infer<typeof modelRouteDecisionRiskLevelSchema>;
