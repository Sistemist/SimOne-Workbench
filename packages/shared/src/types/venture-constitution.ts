export const VENTURE_CONSTITUTION_STATUSES = ["draft", "active", "superseded"] as const;

export type VentureConstitutionStatus = (typeof VENTURE_CONSTITUTION_STATUSES)[number];

export interface VentureSourceRef {
  kind: string;
  id?: string;
  label: string;
  url?: string;
  capturedAt?: string;
}

export interface VentureConstitutionContent {
  purpose: string;
  intendedImpact: string;
  customerPrinciples: string[];
  qualityPrinciples: string[];
  voice: {
    desired: string[];
    examples: string[];
    counterexamples: string[];
  };
  nonNegotiables: string[];
  antiGoals: string[];
  decisionRights: {
    founder: string[];
    delegated: string[];
    approvalRequired: string[];
  };
  riskTolerance: {
    financial: string;
    security: string;
    privacy: string;
    reputational: string;
  };
  evidenceStandards: string[];
}

export interface VentureConstitutionRevision {
  id: string;
  companyId: string;
  version: number;
  status: VentureConstitutionStatus;
  content: VentureConstitutionContent;
  changeReason: string;
  sourceRefs: VentureSourceRef[];
  restoredFromRevisionId: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  activatedByUserId: string | null;
  approvalNote: string | null;
  activatedAt: Date | null;
  supersededAt: Date | null;
  createdAt: Date;
}
