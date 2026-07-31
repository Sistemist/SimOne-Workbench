import { z } from "zod";
import { SIM_ENGINES } from "../types/venture-operations.js";
import { ventureSourceRefSchema } from "./venture-constitution.js";

const boundedText = z.string().trim().min(1).max(4_000);
const evidenceList = z.array(ventureSourceRefSchema).max(100);

export const simEngineSchema = z.enum(SIM_ENGINES);

export const ventureEngineStateSchema = z.object({
  summary: boundedText,
  evidence: evidenceList.optional().default([]),
  freshness: z.string().datetime({ offset: true }),
});

export const ventureConstraintHypothesisSchema = z.object({
  engine: simEngineSchema,
  hypothesis: boundedText,
  confidence: z.enum(["low", "medium", "high"]),
  evidence: evidenceList.optional().default([]),
  decision: z.enum(["proposed", "accepted", "rejected"]).optional().default("proposed"),
  decisionNote: z.string().trim().min(1).max(2_000).nullable().optional().default(null),
  decidedByUserId: z.string().trim().min(1).max(500).nullable().optional().default(null),
  decidedAt: z.string().datetime({ offset: true }).nullable().optional().default(null),
});

export const ventureNextMoveSchema = z.object({
  title: boundedText,
  rationale: boundedText,
  engine: simEngineSchema,
  approvalRequired: z.boolean(),
});

export const ventureStateContentSchema = z.object({
  ventureSummary: boundedText,
  engines: z.object({
    product: ventureEngineStateSchema,
    customer: ventureEngineStateSchema,
    cash: ventureEngineStateSchema,
    skills: ventureEngineStateSchema,
  }),
  activeConstraint: ventureConstraintHypothesisSchema.nullable().optional().default(null),
  nextMove: ventureNextMoveSchema.nullable().optional().default(null),
  learnings: z.array(boundedText).max(100).optional().default([]),
  refreshedAt: z.string().datetime({ offset: true }),
});

export const createVentureStateRevisionSchema = z.object({
  content: ventureStateContentSchema,
  sourceRefs: evidenceList.optional().default([]),
  creationReason: z.string().trim().min(1).max(2_000),
});

export const createVentureContextProjectionSchema = z.object({
  ventureStateRevisionId: z.string().uuid().optional(),
  creationReason: z.string().trim().min(1).max(2_000),
});

export type CreateVentureStateRevision = z.infer<typeof createVentureStateRevisionSchema>;
export type CreateVentureContextProjection = z.infer<typeof createVentureContextProjectionSchema>;
