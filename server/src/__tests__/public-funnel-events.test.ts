import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  publicFunnelEventRoutes,
  summarizePublicFunnelEvents,
} from "../routes/public-funnel-events.js";
import { errorHandler } from "../middleware/index.js";

const onConflictDoNothing = vi.fn();
const values = vi.fn(() => ({ onConflictDoNothing }));
const insert = vi.fn(() => ({ values }));

function createApp(actor: Record<string, unknown> = { type: "none", source: "none" }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api", publicFunnelEventRoutes({ insert } as any));
  app.use(errorHandler);
  return app;
}

describe("public funnel event summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onConflictDoNothing.mockResolvedValue(undefined);
  });

  it("accepts an anonymous privacy-safe event and deduplicates on its event key", async () => {
    const event = {
      eventKey: "11111111-1111-4111-8111-111111111111",
      visitorId: "22222222-2222-4222-8222-222222222222",
      sessionId: "33333333-3333-4333-8333-333333333333",
      eventName: "scanner_complete",
      path: "/scanner",
      source: "cmu",
      resultCategory: "customer",
    };

    const response = await request(createApp()).post("/api/public/funnel-events").send(event);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ accepted: true });
    expect(values).toHaveBeenCalledWith({ ...event, isTest: false });
    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("rejects raw scanner answers and unknown fields", async () => {
    const response = await request(createApp()).post("/api/public/funnel-events").send({
      eventKey: "11111111-1111-4111-8111-111111111111",
      visitorId: "22222222-2222-4222-8222-222222222222",
      sessionId: "33333333-3333-4333-8333-333333333333",
      eventName: "scanner_complete",
      path: "/scanner",
      founderNote: "private answer",
    });

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports privacy-safe conversion counts while excluding test traffic", () => {
    const rows = [
      { eventName: "scanner_view", visitorId: "visitor-1", resultCategory: null, isTest: false },
      { eventName: "scanner_complete", visitorId: "visitor-1", resultCategory: "customer", isTest: false },
      { eventName: "scanner_signup_click", visitorId: "visitor-1", resultCategory: "customer", isTest: false },
      { eventName: "signup_complete", visitorId: "visitor-1", resultCategory: null, isTest: false },
      { eventName: "starter_reached", visitorId: "visitor-1", resultCategory: null, isTest: false },
      { eventName: "scanner_view", visitorId: "test-visitor", resultCategory: null, isTest: true },
    ];

    const summary = summarizePublicFunnelEvents(rows);

    expect(summary.uniqueVisitors).toBe(1);
    expect(summary.counts.scanner_view).toBe(1);
    expect(summary.counts.scanner_complete).toBe(1);
    expect(summary.conversions.viewToComplete).toBe(1);
    expect(summary.conversions.signupCompleteToStarter).toBe(1);
    expect(summary.resultCategories).toEqual({ customer: 1 });
    expect(summary.excludedTestEvents).toBe(1);
  });
});
