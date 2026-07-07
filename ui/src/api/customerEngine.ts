import { api } from "./client";

export type CustomerEngineBridgeAction = {
  id: string;
  kind: string;
  title: string;
  priority: "high" | "medium" | "low";
  reason: string;
  deepLink: string;
  dueAt: string | null;
  source: string;
};

export type CustomerEngineBridgeSnapshot =
  | {
      status: "unavailable";
      reason: "bridge_not_configured" | "upstream_unauthorized" | "upstream_error";
      message: string;
    }
  | {
      status: "live";
      generatedAt: string;
      digest: {
        headline: string;
        summary: string;
        nextActions: Array<{
          title: string;
          priority: "high" | "medium" | "low";
          deepLink: string;
        }>;
      };
      actions: {
        count: number;
        items: CustomerEngineBridgeAction[];
      };
      metrics: {
        waitlistTotal: number;
        weeklyNew: number;
        qualifiedLeads: number;
        replyRate: number;
        proofEvents: number;
      };
      ops: {
        overall: "healthy" | "attention" | "unknown";
        jobs: Array<{
          name: string;
          status: string;
          lastRunAt: string | null;
        }>;
        staleSignals: string[];
      };
    };

export const customerEngineApi = {
  bridgeSnapshot: (companyId: string) =>
    api.get<CustomerEngineBridgeSnapshot>(
      `/companies/${encodeURIComponent(companyId)}/customer-engine/bridge`,
    ),
};
