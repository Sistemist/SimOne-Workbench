import { z } from "zod";

export const ventureShareSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  shareId: z.string().min(1),
  generatedAt: z.string().datetime(),
  company: z.object({
    name: z.string().min(1),
    description: z.string().nullable(),
    brandColor: z.string().nullable(),
  }),
  agents: z.array(z.object({
    name: z.string().min(1),
    title: z.string().nullable(),
    role: z.string().min(1),
    capabilities: z.string().nullable(),
  })),
  projects: z.array(z.object({
    name: z.string().min(1),
    description: z.string().nullable(),
    status: z.string().nullable(),
  })),
  nextMoves: z.array(z.object({
    title: z.string().min(1),
    priority: z.string().nullable(),
    status: z.string().nullable(),
    projectName: z.string().nullable(),
  })),
  reviewPackage: z.object({
    headline: z.string().min(1),
    proofStatus: z.string().min(1),
    reviewBoundary: z.string().min(1),
    suggestedQuestion: z.string().min(1),
  }).optional(),
  principles: z.array(z.string().min(1)),
});
