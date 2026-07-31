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

export const startSimCycleSchema = z.object({
  startReason: z.string().trim().min(1).max(2_000),
});

export const submitSimCycleMapSchema = z.object({
  content: ventureStateContentSchema,
  sourceRefs: evidenceList.optional().default([]),
});

export const decideSimCycleDiagnosisSchema = z.object({
  engine: simEngineSchema,
  hypothesis: boundedText,
  confidence: z.enum(["low", "medium", "high"]),
  evidence: evidenceList.min(1).max(100),
  decision: z.enum(["accepted", "rejected"]),
  decisionNote: z.string().trim().min(1).max(2_000),
});

export const commitSimCycleLeverageSchema = z.object({
  title: boundedText,
  rationale: boundedText,
  engine: simEngineSchema,
  successSignal: boundedText,
  approvalRequired: z.boolean(),
  evidence: evidenceList.optional().default([]),
  commitmentNote: z.string().trim().min(1).max(2_000),
});

export const completeSimCycleCompoundSchema = z.object({
  outcome: boundedText,
  evidence: evidenceList.min(1).max(100),
  learning: boundedText,
  nextMove: ventureNextMoveSchema.nullable(),
});

export const pauseSimCycleSchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
});

export type CreateVentureStateRevision = z.infer<typeof createVentureStateRevisionSchema>;
export type CreateVentureContextProjection = z.infer<typeof createVentureContextProjectionSchema>;
export type StartSimCycle = z.infer<typeof startSimCycleSchema>;
export type SubmitSimCycleMap = z.infer<typeof submitSimCycleMapSchema>;
export type DecideSimCycleDiagnosis = z.infer<typeof decideSimCycleDiagnosisSchema>;
export type CommitSimCycleLeverage = z.infer<typeof commitSimCycleLeverageSchema>;
export type CompleteSimCycleCompound = z.infer<typeof completeSimCycleCompoundSchema>;
export type PauseSimCycle = z.infer<typeof pauseSimCycleSchema>;
