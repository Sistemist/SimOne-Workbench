import { describe, expect, it, vi } from "vitest";
import {
  fetchCustomerEngineBridgeSnapshot,
  type CustomerEngineBridgeFetch,
} from "./customer-engine-bridge.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("customer engine bridge service", () => {
  it("returns unavailable when the bridge token is not configured", async () => {
    const fetcher = vi.fn<CustomerEngineBridgeFetch>();

    const snapshot = await fetchCustomerEngineBridgeSnapshot({
      baseUrl: "https://app.tissuu.ai/api/simone/customer-engine",
      token: "",
      fetcher,
    });

    expect(snapshot.status).toBe("unavailable");
    if (snapshot.status === "unavailable") {
      expect(snapshot.reason).toBe("bridge_not_configured");
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches and normalizes all live Tissuu bridge surfaces", async () => {
    const fetcher = vi.fn<CustomerEngineBridgeFetch>(async (url, init) => {
      expect(init?.headers).toEqual({ Authorization: "Bearer test-token" });
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/digest")) {
        return jsonResponse({
          headline: "33 items waiting on you (10 high-priority)",
          summary: "10 replies + 3 posts to review",
          nextActions: [
            {
              title: "Approve reply to @fchollet",
              priority: "high",
              deepLink: "https://app.tissuu.ai/drafts",
            },
          ],
        });
      }
      if (path.endsWith("/actions")) {
        return jsonResponse({
          count: 33,
          actions: [
            {
              id: "reply:286",
              kind: "approve_reply",
              title: "Approve reply to @fchollet",
              priority: "high",
              reason: "Grounded in a real signal.",
              deepLink: "https://app.tissuu.ai/drafts",
              source: "voice-watch",
            },
          ],
        });
      }
      if (path.endsWith("/metrics")) {
        return jsonResponse({
          waitlistTotal: 11,
          weeklyNew: 0,
          qualifiedLeads: 2,
          replyRate: 0.03,
          proofEvents: 10,
        });
      }
      if (path.endsWith("/ops")) {
        return jsonResponse({
          overall: "healthy",
          jobs: [{ name: "voice-watch", status: "ok", lastRunAt: "2026-07-07T08:53:06Z" }],
          staleSignals: [],
        });
      }
      return jsonResponse({ error: "not found" }, 404);
    });

    const snapshot = await fetchCustomerEngineBridgeSnapshot({
      baseUrl: "https://app.tissuu.ai/api/simone/customer-engine",
      token: "test-token",
      fetcher,
    });

    expect(snapshot).toMatchObject({
      status: "live",
      digest: {
        headline: "33 items waiting on you (10 high-priority)",
        summary: "10 replies + 3 posts to review",
      },
      actions: {
        count: 33,
      },
      metrics: {
        waitlistTotal: 11,
        qualifiedLeads: 2,
      },
      ops: {
        overall: "healthy",
      },
    });
    if (snapshot.status !== "live") throw new Error("Expected live snapshot");
    expect(snapshot.actions.items[0]).toMatchObject({
      title: "Approve reply to @fchollet",
      deepLink: "https://app.tissuu.ai/drafts",
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("returns an unavailable snapshot when Tissuu rejects the bridge request", async () => {
    const fetcher = vi.fn<CustomerEngineBridgeFetch>(async () => jsonResponse({ error: "nope" }, 401));

    const snapshot = await fetchCustomerEngineBridgeSnapshot({
      baseUrl: "https://app.tissuu.ai/api/simone/customer-engine",
      token: "wrong-token",
      fetcher,
    });

    expect(snapshot.status).toBe("unavailable");
    if (snapshot.status === "unavailable") {
      expect(snapshot.reason).toBe("upstream_unauthorized");
    }
  });
});
