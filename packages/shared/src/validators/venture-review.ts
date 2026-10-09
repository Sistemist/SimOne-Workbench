import { z } from "zod";

export const ventureReviewEngineSchema = z.enum([
  "product_service",
  "customer",
  "cash",
  "skills",
]);

export const ventureReviewEvidenceSourceSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: z.enum(["founder_note", "workspace_file", "conversation_excerpt", "website_page", "structured_record"]),
  title: z.string().trim().min(1).max(300),
  capturedAt: z.string().datetime(),
  sourceDate: z.string().date().nullable(),
  excerpt: z.string().max(12_000),
  basis: z.enum(["source_claim", "agent_summary", "checked_excerpt", "website_text"]).default("source_claim"),
  provenance: z.object({
    sourceUri: z.string().max(2000).nullable(),
    excerptLocation: z.string().max(500),
    contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict().optional(),
  omitted: z.array(z.string().trim().min(1).max(300)).max(20),
  consent: z.object({
    approved: z.literal(true),
    purpose: z.string().trim().min(1).max(500),
    recipients: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  }).strict(),
}).strict();

export const ventureReviewEvidencePacketSchema = z.object({
  version: z.literal("sysdom_venture_review_evidence_v1"),
  tenantId: z.string().uuid(),
  reviewId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  founderApprovedAt: z.string().datetime(),
  durableWriteApproved: z.boolean(),
  question: z.string().trim().min(1).max(2000).optional(),
  collectionOmissions: z.array(z.string().max(3000)).max(40).default([]),
  sources: z.array(ventureReviewEvidenceSourceSchema).min(1).max(40),
}).strict().refine((packet) => new Set(packet.sources.map((source) => source.id)).size === packet.sources.length, {
  message: "Evidence source IDs must be unique",
  path: ["sources"],
});

const citedFindingSchema = z.object({
  statement: z.string().trim().min(1).max(1_000),
  evidenceSourceIds: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  confidence: z.enum(["low", "medium", "high"]),
  basis: z.enum(["source_claim", "observed_text", "hypothesis"]).default("hypothesis"),
}).strict();

export const ventureReviewResultSchema = z.object({
  version: z.literal("sysdom_venture_review_result_v1"),
  reviewId: z.string().uuid(),
  tenantId: z.string().uuid(),
  rubricVersion: z.string().trim().min(1).max(120),
  status: z.enum(["complete", "needs_evidence", "cancelled"]),
  businessUnderstanding: citedFindingSchema.optional(),
  strengths: z.array(citedFindingSchema).max(5).optional(),
  engineFindings: z.object({
    product_service: z.array(citedFindingSchema).max(8),
    customer: z.array(citedFindingSchema).max(8),
    cash: z.array(citedFindingSchema).max(8),
    skills: z.array(citedFindingSchema).max(8),
  }).strict(),
  interactions: z.array(z.object({
    engines: z.array(ventureReviewEngineSchema).min(2).max(4),
    statement: z.string().trim().min(1).max(1_000),
    evidenceSourceIds: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  }).strict()).max(8),
  contradictions: z.array(citedFindingSchema).max(12),
  unknowns: z.array(z.string().trim().min(1).max(500)).max(20),
  alternatives: z.array(z.object({
    explanation: z.string().trim().min(1).max(1_000),
    evidenceFor: z.array(z.string().trim().min(1).max(120)).max(12),
    evidenceAgainst: z.array(z.string().trim().min(1).max(120)).max(12),
  }).strict()).max(6),
  nextTest: z.object({
    question: z.string().trim().min(1).max(500),
    action: z.string().trim().min(1).max(1_000),
    successSignal: z.string().trim().min(1).max(500),
    owner: z.literal("founder"),
  }).strict(),
  evidenceRequest: z.object({
    purpose: z.string().trim().min(1).max(500),
    requestedSourceKinds: z.array(ventureReviewEvidenceSourceSchema.shape.kind).min(1).max(5),
    limits: z.string().trim().min(1).max(500),
  }).strict().nullable(),
  omissions: z.array(z.string().trim().min(1).max(500)).max(20),
  durableWritePerformed: z.literal(false),
}).strict();

export type VentureReviewEvidencePacket = z.infer<typeof ventureReviewEvidencePacketSchema>;
export type VentureReviewResult = z.infer<typeof ventureReviewResultSchema>;
export type VentureReviewEngine = z.infer<typeof ventureReviewEngineSchema>;
