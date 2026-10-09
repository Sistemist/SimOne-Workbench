import { z } from "zod";
import { ventureReviewEvidenceSourceSchema, ventureReviewResultSchema } from "./venture-review.js";
import { modelReasoningEffortSchema } from "./model-route-decision.js";

// Parse locally for preview, then hash these normalized bytes. No host filesystem
// access, remote calls or implicit source collection exists in this contract.
export const ventureReviewShareDraftSchema = z.object({
  sources: z.array(ventureReviewEvidenceSourceSchema.omit({ consent: true })).min(1).max(40),
  collectionOmissions: z.array(z.string().max(3000)).max(40).default([]),
}).strict().refine((draft) => new Set(draft.sources.map((source) => source.id)).size === draft.sources.length, "Source IDs must be unique");

export const ventureReviewStartSchema = z.object({ question: z.string().trim().min(1).max(2000) }).strict();
export const ventureReviewExecutionSchema = z.object({
  mode: z.enum(["provider_mock", "fresh"]),
  provider: z.string().trim().min(1).max(200), model: z.string().trim().min(1).max(300),
  reasoningEffort: modelReasoningEffortSchema.optional(),
}).strict();
export const ventureReviewApprovalSchema = z.object({
  requestId: z.string().uuid(),
  draftSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceIds: z.array(z.string().trim().min(1).max(120)).min(1).max(40),
  recipients: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  purpose: z.string().trim().min(1).max(500),
  execution: ventureReviewExecutionSchema.optional(),
}).strict();
export const ventureReviewSubmitSchema = z.object({
  approvalId: z.string().uuid(),
  draft: ventureReviewShareDraftSchema,
}).strict();

export type VentureReviewShareDraft = z.infer<typeof ventureReviewShareDraftSchema>;
export type VentureReviewApproval = z.infer<typeof ventureReviewApprovalSchema>;

/** Canonical schema ordering makes browser/server digest comparison deterministic. */
export function serializeVentureReviewShareDraft(raw: unknown): string {
  return JSON.stringify(ventureReviewShareDraftSchema.parse(raw));
}

export const ventureReviewWebsiteLimitsSchema = z.object({
  maxPages: z.number().int().positive(), maxBytesPerPage: z.number().int().positive(),
  maxCharsPerPage: z.number().int().positive(), maxRedirects: z.number().int().nonnegative(), timeoutMs: z.number().int().positive(),
}).strict();
export const ventureReviewWebsiteReceiptSchema = z.object({
  sourceUrl: z.string(), finalUrl: z.string().nullable(), capturedAt: z.string().datetime(),
  status: z.enum(["retrieved", "partial", "inaccessible", "cancelled"]), httpStatus: z.number().nullable(),
  redirects: z.array(z.object({ from: z.string(), to: z.string(), status: z.number() })),
  title: z.string(), text: z.string(), bodySha256: z.string().nullable(), excerptSha256: z.string().nullable(),
  excerptLocation: z.object({ kind: z.literal("static_text_character_range"), start: z.number(), end: z.number(), total: z.number() }).nullable(),
  omissions: z.array(z.string()), untrustedContent: z.literal(true),
}).strict();
export const ventureReviewSnapshotSchema = z.object({
  reviewId: z.string().uuid(), requestId: z.string().uuid(), question: z.string(),
  phase: z.enum(["awaiting_evidence", "running", "needs_evidence", "complete", "failed", "cancelled"]),
  expiresAt: z.string().datetime(), followupsUsed: z.number().int().min(0).max(1),
  result: ventureReviewResultSchema.nullable(), mockOnly: z.boolean(),
  execution: ventureReviewExecutionSchema.optional(),
  disclosure: z.object({ recipients: z.array(z.string()), purpose: z.string(), storage: z.string(), websiteLimits: ventureReviewWebsiteLimitsSchema, websiteMode: z.enum(["fixture", "public_web"]).default("fixture") }).strict(),
}).strict().refine((value) => value.mockOnly ? value.execution?.mode !== "fresh" : value.execution?.mode === "fresh", "Review execution mode mismatch");
export type VentureReviewSnapshot = z.infer<typeof ventureReviewSnapshotSchema>;
export type VentureReviewWebsiteReceipt = z.infer<typeof ventureReviewWebsiteReceiptSchema>;
