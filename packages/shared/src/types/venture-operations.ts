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

export interface VentureContextProjectionReceipt {
  id: string;
  version: number;
  constitutionRevisionId: string;
  ventureStateRevisionId: string;
  creationReason: string;
  createdAt: string;
  content: VentureContextProjectionContent;
  sourceRefs: VentureSourceRef[];
}

export interface DelegatedSimCycleIntervention {
  cycle: SimCycle;
  issue: import("./issue.js").Issue;
  contextProjection: VentureContextProjection;
  created: boolean;
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
  activeCycle: SimCycle | null;
  latestCycle: SimCycle | null;
}

export interface FounderCoachMemoryEntry {
  id: string;
  kind: "venture_state" | "context_projection";
  version: number;
  status: "current" | "superseded";
  summary: string;
  creationReason: string;
  sourceRefs: VentureSourceRef[];
  basedOnCycleId: string | null;
  createdAt: Date;
  supersededAt: Date | null;
}

export interface FounderCoachGuidance {
  headline: string;
  explanation: string;
  engine: SimEngine | null;
  approvalRequired: boolean;
  nextAction: {
    title: string;
    href: "/cockpit";
  };
  activeConstraint: VentureConstraintHypothesis | null;
  promotedLearning: string | null;
  sourceRefs: VentureSourceRef[];
  stateVersion: number;
  projectionVersion: number | null;
}

export interface FounderCoachSnapshot {
  guidance: FounderCoachGuidance | null;
  currentMemory: FounderCoachMemoryEntry[];
  supersededMemory: FounderCoachMemoryEntry[];
  activeCycle: SimCycle | null;
  latestCycle: SimCycle | null;
}

export interface FounderCoachMemoryPromotion {
  state: VentureStateRevision;
  contextProjection: VentureContextProjection;
  created: boolean;
}

export const SIM_CYCLE_PHASES = ["map", "diagnose", "leverage", "compound", "complete"] as const;
export type SimCyclePhase = (typeof SIM_CYCLE_PHASES)[number];

export const SIM_CYCLE_STATUSES = ["active", "paused", "completed"] as const;
export type SimCycleStatus = (typeof SIM_CYCLE_STATUSES)[number];

export interface SimCycleMapOutput {
  ventureStateRevisionId: string;
  completedAt: string;
}

export interface SimCycleDiagnoseOutput {
  constraint: VentureConstraintHypothesis;
  approvedByUserId: string | null;
  approvedAt: string | null;
}

export interface SimCycleIntervention {
  title: string;
  rationale: string;
  engine: SimEngine;
  successSignal: string;
  approvalRequired: boolean;
  evidence: VentureSourceRef[];
}

export interface SimCycleLeverageOutput {
  intervention: SimCycleIntervention;
  commitmentNote: string;
  committedByUserId: string;
  committedAt: string;
}

export interface SimCycleCompoundOutput {
  outcome: string;
  evidence: VentureSourceRef[];
  learning: string;
  promotedStateRevisionId: string;
  completedAt: string;
}

export interface SimCycle {
  id: string;
  companyId: string;
  status: SimCycleStatus;
  phase: SimCyclePhase;
  constitutionRevisionId: string;
  startingStateRevisionId: string | null;
  currentStateRevisionId: string | null;
  contextProjectionId: string | null;
  startReason: string;
  mapOutput: SimCycleMapOutput | null;
  diagnoseOutput: SimCycleDiagnoseOutput | null;
  leverageOutput: SimCycleLeverageOutput | null;
  compoundOutput: SimCycleCompoundOutput | null;
  startedByUserId: string;
  pausedReason: string | null;
  pausedAt: Date | null;
  resumedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SimCycleEvent {
  id: string;
  companyId: string;
  cycleId: string;
  type: string;
  phase: SimCyclePhase;
  actorUserId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}
