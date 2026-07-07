export type CustomerEngineBridgeFetch = typeof fetch;
type CustomerEngineBridgeUnavailableReason =
  | "bridge_not_configured"
  | "upstream_unauthorized"
  | "upstream_error";

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
      reason: CustomerEngineBridgeUnavailableReason;
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

export const DEFAULT_TISSUU_CUSTOMER_ENGINE_BASE_URL =
  "https://app.tissuu.ai/api/simone/customer-engine";

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readPriority(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function readBridgeJson(
  fetcher: CustomerEngineBridgeFetch,
  baseUrl: string,
  token: string,
  surface: "digest" | "actions" | "metrics" | "ops",
) {
  const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/${surface}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const reason: CustomerEngineBridgeUnavailableReason = response.status === 401 || response.status === 403
      ? "upstream_unauthorized"
      : "upstream_error";
    return { ok: false as const, reason };
  }
  return { ok: true as const, value: await response.json() as unknown };
}

export async function fetchCustomerEngineBridgeSnapshot(input: {
  baseUrl?: string;
  token?: string;
  fetcher?: CustomerEngineBridgeFetch;
}): Promise<CustomerEngineBridgeSnapshot> {
  const token = input.token?.trim();
  if (!token) {
    return {
      status: "unavailable",
      reason: "bridge_not_configured",
      message: "Tissuu Customer Engine bridge token is not configured.",
    };
  }

  const fetcher = input.fetcher ?? fetch;
  const baseUrl = input.baseUrl?.trim() || DEFAULT_TISSUU_CUSTOMER_ENGINE_BASE_URL;
  const [digestResult, actionsResult, metricsResult, opsResult] = await Promise.all([
    readBridgeJson(fetcher, baseUrl, token, "digest"),
    readBridgeJson(fetcher, baseUrl, token, "actions"),
    readBridgeJson(fetcher, baseUrl, token, "metrics"),
    readBridgeJson(fetcher, baseUrl, token, "ops"),
  ]);

  const failed = [digestResult, actionsResult, metricsResult, opsResult].find((result) => !result.ok);
  if (failed && !failed.ok) {
    return {
      status: "unavailable",
      reason: failed.reason,
      message:
        failed.reason === "upstream_unauthorized"
          ? "Tissuu rejected the SimOne bridge token."
          : "Tissuu Customer Engine bridge is unavailable.",
    };
  }

  const digest = readObject(digestResult.ok ? digestResult.value : {});
  const actions = readObject(actionsResult.ok ? actionsResult.value : {});
  const metrics = readObject(metricsResult.ok ? metricsResult.value : {});
  const ops = readObject(opsResult.ok ? opsResult.value : {});

  return {
    status: "live",
    generatedAt: new Date().toISOString(),
    digest: {
      headline: readString(digest.headline, "Customer Engine readout"),
      summary: readString(digest.summary, "Tissuu bridge is live."),
      nextActions: readArray(digest.nextActions).slice(0, 5).map((item) => {
        const action = readObject(item);
        return {
          title: readString(action.title, "Review customer signal"),
          priority: readPriority(action.priority),
          deepLink: readString(action.deepLink),
        };
      }),
    },
    actions: {
      count: readNumber(actions.count, readArray(actions.actions).length),
      items: readArray(actions.actions).slice(0, 10).map((item) => {
        const action = readObject(item);
        return {
          id: readString(action.id),
          kind: readString(action.kind, "review"),
          title: readString(action.title, "Review customer signal"),
          priority: readPriority(action.priority),
          reason: readString(action.reason),
          deepLink: readString(action.deepLink),
          dueAt: readString(action.dueAt) || null,
          source: readString(action.source, "tissuu"),
        };
      }),
    },
    metrics: {
      waitlistTotal: readNumber(metrics.waitlistTotal),
      weeklyNew: readNumber(metrics.weeklyNew),
      qualifiedLeads: readNumber(metrics.qualifiedLeads),
      replyRate: readNumber(metrics.replyRate),
      proofEvents: readNumber(metrics.proofEvents),
    },
    ops: {
      overall: ops.overall === "healthy" || ops.overall === "attention" ? ops.overall : "unknown",
      jobs: readArray(ops.jobs).map((item) => {
        const job = readObject(item);
        return {
          name: readString(job.name, "job"),
          status: readString(job.status, "unknown"),
          lastRunAt: readString(job.lastRunAt) || null,
        };
      }),
      staleSignals: readArray(ops.staleSignals).map((signal) => readString(signal)).filter(Boolean),
    },
  };
}
