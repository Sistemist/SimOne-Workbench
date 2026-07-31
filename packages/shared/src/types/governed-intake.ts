import type { PluginCapability } from "../constants.js";
import type { VentureSourceRef } from "./venture-constitution.js";

export const GOVERNED_INTAKE_RESOURCE_KINDS = ["plugin", "paperclip_upstream"] as const;
export type GovernedIntakeResourceKind = (typeof GOVERNED_INTAKE_RESOURCE_KINDS)[number];

export const GOVERNED_INTAKE_DECISIONS = ["adopt", "adapt", "defer", "reject"] as const;
export type GovernedIntakeDecision = (typeof GOVERNED_INTAKE_DECISIONS)[number];

export const GOVERNED_INTAKE_COMPATIBILITY = ["compatible", "needs_review", "incompatible"] as const;
export type GovernedIntakeCompatibility = (typeof GOVERNED_INTAKE_COMPATIBILITY)[number];

export interface GovernedIntakeAssessment {
  id: string;
  resourceKind: GovernedIntakeResourceKind;
  resourceId: string;
  resourceVersion: string;
  displayName: string;
  pluginId: string | null;
  decision: GovernedIntakeDecision;
  compatibility: GovernedIntakeCompatibility;
  capabilitySnapshot: PluginCapability[];
  permissionBoundary: string;
  costBoundary: string;
  productBoundary: string;
  reviewNote: string;
  sourceRefs: VentureSourceRef[];
  reviewedByUserId: string;
  reviewedAt: Date;
  createdAt: Date;
}
