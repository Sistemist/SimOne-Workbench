import { z } from "zod";

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
