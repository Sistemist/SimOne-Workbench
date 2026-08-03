import { z } from "zod";
import { modelReasoningEffortSchema } from "./model-route-decision.js";

export const scannerEngineSchema = z.enum([
  "Product Engine",
  "Customer Engine",
  "Cash Engine",
  "Skills Engine",
]);

export const scannerModelAnalysisRequestSchema = z.object({
  founderNote: z.string().trim().min(1).max(8_000),
  deterministicAssessment: z.object({
    primaryEngine: scannerEngineSchema,
    secondaryEngine: scannerEngineSchema.nullable(),
    primaryMatches: z.number().int().nonnegative().max(100),
    secondaryMatches: z.number().int().nonnegative().max(100),
  }).strict(),
}).strict();

export const scannerModelAssessmentSchema = z.object({
  version: z.literal("sysdom_scanner_model_assessment_v1"),
  primaryEngine: scannerEngineSchema,
  secondaryEngine: scannerEngineSchema.nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  summary: z.string().trim().min(1).max(500),
  clarificationQuestion: z.string().trim().min(1).max(500).nullable(),
  evidenceCues: z.array(z.string().trim().min(1).max(300)).max(5),
}).strict();

export const scannerModelAnalysisResponseSchema = z.object({
  version: z.literal("sysdom_scanner_model_analysis_v1"),
  analysisId: z.string().uuid(),
  assessment: scannerModelAssessmentSchema,
  provenance: z.object({
    policyVersion: z.string().trim().min(1).max(200),
    portfolio: z.object({
      revisionId: z.string().uuid(),
      version: z.number().int().positive(),
    }).strict(),
    provider: z.string().trim().min(1).max(200),
    model: z.string().trim().min(1).max(300),
    reasoningEffort: modelReasoningEffortSchema,
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative().nullable(),
    completedAt: z.string().datetime(),
  }).strict(),
}).strict();

export const scannerModelCapabilitySchema = z.object({
  version: z.literal("sysdom_scanner_model_capability_v1"),
  enabled: z.boolean(),
  mode: z.enum(["deterministic_only", "model_assisted"]),
  rawNotesTransmitted: z.boolean(),
  maxFounderNoteChars: z.literal(8_000),
}).strict();

export const scannerSnapshotSchema = z.object({
  id: z.string().uuid(),
  algorithmVersion: z.string().trim().min(1).max(80),
  input: z.object({
    startupUrl: z.string().trim().max(2048),
    founderNote: z.string().trim().max(10_000),
  }).strict(),
  result: z.record(z.unknown()),
  savedAt: z.string().datetime(),
}).strict();

export type ScannerSnapshot = z.infer<typeof scannerSnapshotSchema>;
export type ScannerEngine = z.infer<typeof scannerEngineSchema>;
export type ScannerModelAnalysisRequest = z.infer<typeof scannerModelAnalysisRequestSchema>;
export type ScannerModelAssessment = z.infer<typeof scannerModelAssessmentSchema>;
export type ScannerModelAnalysisResponse = z.infer<typeof scannerModelAnalysisResponseSchema>;
export type ScannerModelCapability = z.infer<typeof scannerModelCapabilitySchema>;

export const createEarlyAccessRequestSchema = z.object({
  requestKey: z.string().uuid(),
  founderName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  useCase: z.string().trim().max(2_000).optional(),
  source: z.string().trim().max(120).optional(),
  consentToRetainScan: z.boolean().default(false),
  scan: scannerSnapshotSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.scan && !value.consentToRetainScan) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["consentToRetainScan"],
      message: "Consent is required before retaining scanner details",
    });
  }
});

export const createEarlyAccessGrantSchema = z.object({
  founderName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  source: z.string().trim().max(120).optional(),
  maxVentures: z.number().int().min(1).max(10).default(3),
  expiresInHours: z.number().int().min(1).max(720).default(72),
  accessRequestId: z.string().uuid().optional(),
}).strict();

export const claimScannerRunSchema = scannerSnapshotSchema;

export const assignScannerRunSchema = z.object({
  companyId: z.string().uuid(),
}).strict();

export type CreateEarlyAccessRequest = z.infer<typeof createEarlyAccessRequestSchema>;
export type CreateEarlyAccessGrant = z.infer<typeof createEarlyAccessGrantSchema>;
export type ClaimScannerRun = z.infer<typeof claimScannerRunSchema>;
export type AssignScannerRun = z.infer<typeof assignScannerRunSchema>;
