import { z } from "zod";
import {
  GOVERNED_INTAKE_COMPATIBILITY,
  GOVERNED_INTAKE_DECISIONS,
  GOVERNED_INTAKE_RESOURCE_KINDS,
} from "../types/governed-intake.js";
import { ventureSourceRefSchema } from "./venture-constitution.js";

const boundary = z.string().trim().min(1).max(4_000);

export const createGovernedIntakeAssessmentSchema = z.object({
  resourceKind: z.enum(GOVERNED_INTAKE_RESOURCE_KINDS),
  resourceId: z.string().trim().min(1).max(500),
  resourceVersion: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(500),
  pluginId: z.string().uuid().nullable().optional().default(null),
  decision: z.enum(GOVERNED_INTAKE_DECISIONS),
  compatibility: z.enum(GOVERNED_INTAKE_COMPATIBILITY),
  permissionBoundary: boundary,
  costBoundary: boundary,
  productBoundary: boundary,
  reviewNote: boundary,
  sourceRefs: z.array(ventureSourceRefSchema).min(1).max(100),
}).superRefine((value, ctx) => {
  if (value.resourceKind === "plugin" && !value.pluginId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pluginId"],
      message: "pluginId is required for plugin intake",
    });
  }
  if (value.resourceKind === "paperclip_upstream" && value.pluginId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pluginId"],
      message: "pluginId must be omitted for Paperclip upstream intake",
    });
  }
  if (value.decision === "adopt" && value.compatibility !== "compatible") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compatibility"],
      message: "Adoption requires compatible evidence; use adapt, defer, or reject otherwise",
    });
  }
});

export type CreateGovernedIntakeAssessment = z.infer<typeof createGovernedIntakeAssessmentSchema>;
