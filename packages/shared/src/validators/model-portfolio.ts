import { z } from "zod";
import {
  modelRouteCandidateSchema,
  modelRouteDecisionLaneSchema,
  modelRouteExternalEffectSchema,
  modelRouteTaskClassSchema,
} from "./model-route-decision.js";

export const modelPortfolioRevisionStatusSchema = z.enum([
  "draft",
  "active",
  "superseded",
]);

export const modelPortfolioSourceRefSchema = z.object({
  kind: z.enum([
    "provider_docs",
    "provider_api",
    "manual_review",
    "benchmark",
    "founder_decision",
  ]),
  label: z.string().trim().min(1).max(500),
  url: z.string().url().max(2_000).nullable().optional().default(null),
  capturedAt: z.string().datetime(),
}).strict();

export const createModelPortfolioRevisionSchema = z.object({
  candidates: z.array(modelRouteCandidateSchema).max(100).optional().default([]),
  changeReason: z.string().trim().min(1).max(4_000),
  sourceRefs: z.array(modelPortfolioSourceRefSchema).max(100).optional().default([]),
}).strict();

export const activateModelPortfolioRevisionSchema = z.object({
  approvalNote: z.string().trim().min(1).max(4_000),
}).strict();

export const restoreModelPortfolioRevisionSchema = z.object({
  changeReason: z.string().trim().min(1).max(4_000),
}).strict();

export const modelRouteEngineBenchmarkOutputSchema = z.object({
  summary: z.string().trim().min(1).max(8_000),
  nextMove: z.string().trim().min(1).max(4_000),
  evidenceRefIds: z.array(z.string().trim().min(1).max(200)).max(100),
  approvalRequired: z.boolean(),
  proposedActions: z.array(z.string().trim().min(1).max(2_000)).max(50),
  numericFacts: z.record(z.string().trim().min(1).max(200), z.number()).optional().default({}),
}).strict();

export const modelRouteEngineBenchmarkFixtureSchema = z.object({
  id: z.string().trim().min(1).max(200),
  engine: z.enum(["product", "customer", "cash", "skills"]),
  workflow: z.string().trim().min(1).max(500),
  routingTask: z.object({
    intent: z.string().trim().min(1).max(4_000),
    taskClass: modelRouteTaskClassSchema,
    criticality: z.enum(["low", "medium", "high", "critical"]),
    reversible: z.boolean(),
    externalEffects: z.array(modelRouteExternalEffectSchema).max(7),
    dataSensitivity: z.enum(["public", "internal", "confidential", "restricted"]),
    evidenceRequirement: z.enum([
      "none",
      "standard",
      "provenance_required",
      "independent_review",
    ]),
    approvalRequired: z.boolean(),
  }).strict(),
  evidence: z.array(z.object({
    id: z.string().trim().min(1).max(200),
    statement: z.string().trim().min(1).max(4_000),
  }).strict()).min(1).max(100),
  expected: z.object({
    lane: z.enum(["no_model", ...modelRouteDecisionLaneSchema.options]),
    approvalGate: z.enum([
      "none",
      "founder_review_before_execution",
      "founder_approval_before_external_effect",
    ]),
    outputApprovalRequired: z.boolean(),
    requiredEvidenceRefIds: z.array(z.string().trim().min(1).max(200)).max(100),
    requiredConceptGroups: z.array(z.array(
      z.string().trim().min(1).max(200),
    ).min(1).max(20)).max(50),
    forbiddenActionTerms: z.array(z.string().trim().min(1).max(200)).max(50),
    numericFacts: z.record(
      z.string().trim().min(1).max(200),
      z.object({
        value: z.number(),
        tolerance: z.number().nonnegative(),
      }).strict(),
    ).optional().default({}),
    passingScore: z.number().int().min(1).max(100),
  }).strict(),
  referenceOutput: modelRouteEngineBenchmarkOutputSchema,
}).strict();

export const modelRouteEngineBenchmarkSuiteSchema = z.object({
  version: z.literal("sysdom_engine_benchmarks_v1"),
  description: z.string().trim().min(1).max(2_000),
  fixtures: z.array(modelRouteEngineBenchmarkFixtureSchema).length(4),
}).strict().superRefine((suite, ctx) => {
  const engines = suite.fixtures.map((fixture) => fixture.engine);
  for (const engine of ["product", "customer", "cash", "skills"] as const) {
    if (engines.filter((value) => value === engine).length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: `Benchmark suite must contain exactly one ${engine} fixture`,
        path: ["fixtures"],
      });
    }
  }
});

export type ModelPortfolioRevisionStatus = z.infer<typeof modelPortfolioRevisionStatusSchema>;
export type ModelPortfolioSourceRef = z.infer<typeof modelPortfolioSourceRefSchema>;
export type CreateModelPortfolioRevision = z.infer<typeof createModelPortfolioRevisionSchema>;
export type ActivateModelPortfolioRevision = z.infer<typeof activateModelPortfolioRevisionSchema>;
export type RestoreModelPortfolioRevision = z.infer<typeof restoreModelPortfolioRevisionSchema>;
export type ModelRouteEngineBenchmarkOutput = z.infer<typeof modelRouteEngineBenchmarkOutputSchema>;
export type ModelRouteEngineBenchmarkFixture = z.infer<typeof modelRouteEngineBenchmarkFixtureSchema>;
export type ModelRouteEngineBenchmarkSuite = z.infer<typeof modelRouteEngineBenchmarkSuiteSchema>;
