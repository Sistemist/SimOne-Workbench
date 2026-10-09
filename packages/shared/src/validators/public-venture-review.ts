import { z } from "zod";
import { ventureReviewResultSchema } from "./venture-review.js";

export const PUBLIC_REVIEW_CONSENT_VERSION = "public-review-consent-2026-10-08";
export const publicReviewCapabilitySchema = z.object({
  state: z.enum(["available", "disabled", "busy", "exhausted", "paused"]),
  mode: z.enum(["disabled", "recorded", "fresh"]),
  consentVersion: z.string(), methodVersion: z.string(),
  model: z.literal("openai/gpt-6.1-sol"), reasoningEffort: z.literal("high"),
  recipients: z.array(z.string()), retention: z.string(),
  maxNoteChars: z.literal(8000), sessionMinutes: z.literal(15),
}).strict();
export const publicReviewInputSchema = z.object({
  question: z.string().trim().min(5).max(2000), notes: z.string().trim().min(30).max(8000),
  selectedSourceIds: z.array(z.string().regex(/^public-[01]$/)).max(2).default([]),
  sourceHashes: z.record(z.string().regex(/^public-[01]$/), z.string().regex(/^[a-f0-9]{64}$/)).default({}),
  consent: z.literal(true), consentVersion: z.string(), requestId: z.string().uuid(),
}).strict();
export const publicReviewSnapshotSchema = z.object({
  reviewId: z.string().uuid(), phase: z.enum(["ready", "running", "complete", "failed", "cancelled"]),
  expiresAt: z.string().datetime(), mode: z.enum(["recorded", "fresh"]),
  result: ventureReviewResultSchema.nullable(),
}).strict();
export type PublicReviewCapability = z.infer<typeof publicReviewCapabilitySchema>;
export type PublicReviewInput = z.infer<typeof publicReviewInputSchema>;
export type PublicReviewSnapshot = z.infer<typeof publicReviewSnapshotSchema>;

export const publicReviewSourcesInputSchema = z.object({ website: z.string().trim().max(2000).default(""), github: z.string().trim().max(2000).default("") }).strict();
export const publicReviewSourceSchema = z.object({ id: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), url: z.string(), title: z.string(), text: z.string().max(4000), capturedAt: z.string().datetime(), status: z.enum(["retrieved", "partial", "inaccessible", "cancelled"]), omissions: z.array(z.string()), simulated: z.boolean() }).strict();
export type PublicReviewSource = z.infer<typeof publicReviewSourceSchema>;
