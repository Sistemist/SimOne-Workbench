import { api } from "./client";

export interface ModelRouteDecisionAuditRow {
  id: string;
  companyId: string;
  agentId: string;
  issueId: string | null;
  projectId: string | null;
  goalId: string | null;
  heartbeatRunId: string | null;
  lane: string;
  provider: string;
  model: string;
  reason: string;
  riskLevel: string;
  taskIntent: string | null;
  contextSummary: string | null;
  approvalGate: string | null;
  outputSummary: string | null;
  outputConfidence: string;
  reviewStatus: string;
  reviewNote: string | null;
  metadata: Record<string, unknown>;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdByRunId: string | null;
  createdAt: string;
  costEventCount: number;
  costCents: number;
}

export interface ModelRouteDecisionOutputArtifact {
  id: string;
  title: string;
  href: string;
  source?: "document" | "attachment" | "work_product";
}

export interface ModelRouteDecisionListResponse {
  items: ModelRouteDecisionAuditRow[];
}

export interface UpdateModelRouteDecisionReviewInput {
  outputSummary?: string | null;
  outputConfidence: string;
  reviewStatus: "pending" | "approved" | "needs_revision" | "rejected";
  reviewNote?: string | null;
  outputArtifacts?: ModelRouteDecisionOutputArtifact[];
}

export type ModelExecutionBillingType =
  | "local"
  | "free"
  | "subscription_included"
  | "metered_api"
  | "unknown";

export interface ModelExecutionPolicyInput {
  provider: string;
  model: string;
  billingType: ModelExecutionBillingType;
  timeoutSec: number;
  maxTurnsPerRun: number;
  maxRuns: 1;
  maxRetries: 0;
  concurrency: 1;
  maxRunCostCents: number | null;
  providerHardCapCents: number | null;
  providerHardCapEvidenceSource: string | null;
  providerHardCapVerifiedAt: string | null;
  providerHardCapExpiresAt: string | null;
  subscriptionEvidenceSource: string | null;
  subscriptionVerifiedAt: string | null;
  subscriptionExpiresAt: string | null;
  meteredOverageAllowed: boolean;
}

export interface ModelExecutionPolicySnapshot {
  agentId: string;
  agentName: string;
  agentStatus: string;
  adapterType: string;
  policy: ModelExecutionPolicyInput;
  assessment: {
    status: "ready" | "blocked" | "unverified";
    enforced: boolean;
    blockers: string[];
    controls: {
      providerHardCapEvidenceSource: string | null;
      providerHardCapVerifiedAt: string | null;
      providerHardCapExpiresAt: string | null;
      subscriptionEvidenceSource: string | null;
      subscriptionVerifiedAt: string | null;
      subscriptionExpiresAt: string | null;
    };
  };
}

export interface ModelExecutionPolicyListResponse {
  items: ModelExecutionPolicySnapshot[];
}

export interface ModelPortfolioCandidate {
  provider: string;
  model: string;
  lane: string;
  billingType: ModelExecutionBillingType;
  costRank: number;
  qualityRank: number;
  enabled: boolean;
  evidence: {
    sourceKind: string;
    sourceLabel: string;
    sourceUrl: string | null;
    verifiedAt: string;
    expiresAt: string;
  } | null;
  catalog: {
    canonicalSlug: string;
    lifecycle: "stable" | "preview";
    contextWindowTokens: number;
    maxOutputTokens: number;
    pricing: {
      currency: "USD";
      unit: "per_million_tokens";
      inputUsd: number;
      outputUsd: number;
      cachedInputUsd: number | null;
    };
    providerRouting: {
      sort: "price" | "throughput" | "latency";
      allowFallbacks: boolean;
      requireParameters: boolean;
      dataCollection: "allow" | "deny";
      zeroDataRetention: boolean;
      maxInputTokensPerRequest: number;
      maxInputUsdPerMillion: number;
      maxOutputUsdPerMillion: number;
    };
  } | null;
}

export interface ModelPortfolioRevision {
  id: string;
  companyId: string;
  version: number;
  status: "draft" | "active" | "superseded";
  candidates: ModelPortfolioCandidate[];
  changeReason: string;
  sourceRefs: Array<{
    kind: string;
    label: string;
    url: string | null;
    capturedAt: string;
  }>;
  restoredFromRevisionId: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  activatedByUserId: string | null;
  approvalNote: string | null;
  activatedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
}

export const modelRoutingApi = {
  listDecisions: (companyId: string, options: { limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    return api.get<ModelRouteDecisionListResponse>(
      `/companies/${companyId}/model-route-decisions${qs ? `?${qs}` : ""}`,
    );
  },
  updateReview: (
    companyId: string,
    decisionId: string,
    input: UpdateModelRouteDecisionReviewInput,
  ) => api.patch<ModelRouteDecisionAuditRow>(
    `/companies/${companyId}/model-route-decisions/${decisionId}/review`,
    input,
  ),
  listPolicies: (companyId: string) =>
    api.get<ModelExecutionPolicyListResponse>(
      `/companies/${companyId}/model-execution-policies`,
    ),
  updatePolicy: (
    companyId: string,
    agentId: string,
    input: ModelExecutionPolicyInput,
  ) => api.put<ModelExecutionPolicySnapshot>(
    `/companies/${companyId}/model-execution-policies/${agentId}`,
    input,
  ),
  listPortfolioRevisions: (companyId: string) =>
    api.get<ModelPortfolioRevision[]>(
      `/companies/${companyId}/model-portfolios/revisions`,
    ),
};
