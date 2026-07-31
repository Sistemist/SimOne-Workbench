import { z } from "zod";
import { VENTURE_CONSTITUTION_STATUSES } from "../types/venture-constitution.js";

const boundedText = z.string().trim().min(1).max(4_000);
const boundedList = z.array(boundedText).max(50);

export const ventureSourceRefSchema = z.object({
  kind: z.string().trim().min(1).max(100),
  id: z.string().trim().min(1).max(500).optional(),
  label: z.string().trim().min(1).max(500),
  url: z.string().url().max(2_000).optional(),
  capturedAt: z.string().datetime({ offset: true }).optional(),
});

export const ventureConstitutionContentSchema = z.object({
  purpose: boundedText,
  intendedImpact: boundedText,
  customerPrinciples: boundedList,
  qualityPrinciples: boundedList,
  voice: z.object({
    desired: boundedList,
    examples: boundedList,
    counterexamples: boundedList,
  }),
  nonNegotiables: boundedList,
  antiGoals: boundedList,
  decisionRights: z.object({
    founder: boundedList,
    delegated: boundedList,
    approvalRequired: boundedList,
  }),
  riskTolerance: z.object({
    financial: boundedText,
    security: boundedText,
    privacy: boundedText,
    reputational: boundedText,
  }),
  evidenceStandards: boundedList,
});

export const createVentureConstitutionRevisionSchema = z.object({
  content: ventureConstitutionContentSchema,
  changeReason: z.string().trim().min(1).max(2_000),
  sourceRefs: z.array(ventureSourceRefSchema).max(100).optional().default([]),
});

export const activateVentureConstitutionRevisionSchema = z.object({
  approvalNote: z.string().trim().min(1).max(2_000),
});

export const restoreVentureConstitutionRevisionSchema = z.object({
  changeReason: z.string().trim().min(1).max(2_000),
});

export const ventureConstitutionStatusSchema = z.enum(VENTURE_CONSTITUTION_STATUSES);

export type CreateVentureConstitutionRevision = z.infer<typeof createVentureConstitutionRevisionSchema>;
export type ActivateVentureConstitutionRevision = z.infer<typeof activateVentureConstitutionRevisionSchema>;
export type RestoreVentureConstitutionRevision = z.infer<typeof restoreVentureConstitutionRevisionSchema>;
