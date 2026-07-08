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

export interface ModelRouteDecisionListResponse {
  items: ModelRouteDecisionAuditRow[];
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
};
