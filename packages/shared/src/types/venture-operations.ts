import type { VentureSourceRef } from "./venture-constitution.js";

export const SIM_ENGINES = ["product", "customer", "cash", "skills"] as const;
export type SimEngine = (typeof SIM_ENGINES)[number];

export const VENTURE_STATE_STATUSES = ["current", "superseded"] as const;
export type VentureStateStatus = (typeof VENTURE_STATE_STATUSES)[number];

export const VENTURE_CONSTRAINT_DECISIONS = ["proposed", "accepted", "rejected"] as const;
export type VentureConstraintDecision = (typeof VENTURE_CONSTRAINT_DECISIONS)[number];

export interface VentureEngineState {
  summary: string;
  evidence: VentureSourceRef[];
  freshness: string;
}

export interface VentureConstraintHypothesis {
  engine: SimEngine;
  hypothesis: string;
  confidence: "low" | "medium" | "high";
  evidence: VentureSourceRef[];
  decision: VentureConstraintDecision;
  decisionNote: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
}

export interface VentureNextMove {
  title: string;
  rationale: string;
  engine: SimEngine;
  approvalRequired: boolean;
}

export interface VentureStateContent {
  ventureSummary: string;
  engines: Record<SimEngine, VentureEngineState>;
  activeConstraint: VentureConstraintHypothesis | null;
  nextMove: VentureNextMove | null;
  learnings: string[];
  refreshedAt: string;
}

export interface VentureStateRevision {
  id: string;
  companyId: string;
  version: number;
  status: VentureStateStatus;
  content: VentureStateContent;
  creationReason: string;
  sourceRefs: VentureSourceRef[];
  constitutionRevisionId: string;
  basedOnCycleId: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  supersededAt: Date | null;
}

export const VENTURE_CONTEXT_PROJECTION_STATUSES = ["current", "superseded"] as const;
export type VentureContextProjectionStatus = (typeof VENTURE_CONTEXT_PROJECTION_STATUSES)[number];

export interface VentureContextProjectionContent {
  purpose: string;
  nonNegotiables: string[];
  approvalBoundaries: string[];
  ventureSummary: string;
  engines: Record<SimEngine, Pick<VentureEngineState, "summary" | "freshness">>;
  activeConstraint: VentureConstraintHypothesis | null;
  nextMove: VentureNextMove | null;
}

export interface VentureContextProjection {
  id: string;
  companyId: string;
  version: number;
  status: VentureContextProjectionStatus;
  constitutionRevisionId: string;
  ventureStateRevisionId: string;
  creationReason: string;
  content: VentureContextProjectionContent;
  sourceRefs: VentureSourceRef[];
  supersedesProjectionId: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  supersededAt: Date | null;
}

export interface FounderCockpitSnapshot {
  company: {
    id: string;
    name: string;
    updatedAt: Date;
  };
  constitution: import("./venture-constitution.js").VentureConstitutionRevision | null;
  ventureState: VentureStateRevision | null;
  contextProjection: VentureContextProjection | null;
  approvals: {
    pending: number;
  };
  work: {
    active: number;
    blocked: number;
    completed: number;
  };
  freshness: {
    projectedAt: string;
    sources: VentureSourceRef[];
  };
}
