import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  publicFunnelEventRoutes,
  summarizePublicFunnelEvents,
} from "../routes/public-funnel-events.js";
import { errorHandler } from "../middleware/index.js";

const onConflictDoNothing = vi.fn();
const values = vi.fn(() => ({ onConflictDoNothing }));
const insert = vi.fn(() => ({ values }));
const originalMonitorTokenFile = process.env.SYSDOM_HEALTH_MONITOR_TOKEN_FILE;

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

  it("keeps summary private but permits the dedicated read-only monitor token", async () => {
    const token = "monitor-test-token-that-is-at-least-thirty-two-bytes";
    const directory = mkdtempSync(join(tmpdir(), "sysdom-health-monitor-"));
    const tokenFile = join(directory, "token");
    writeFileSync(tokenFile, token, { mode: 0o600 });
    process.env.SYSDOM_HEALTH_MONITOR_TOKEN_FILE = tokenFile;

    const rows = [{ eventName: "venture_review_view", visitorId: "00000000-0000-0000-0000-000000000000", resultCategory: null, isTest: false }];
    const select = vi.fn(() => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => rows }) }) }) }));
    const app = express();
    app.use((req, _res, next) => { (req as any).actor = { type: "none", source: "none" }; next(); });
    app.use("/api", publicFunnelEventRoutes({ select } as any));
    app.use(errorHandler);

    try {
      expect((await request(app).get("/api/public/funnel-events/summary")).status).toBe(403);
      expect((await request(app).get("/api/public/funnel-events/summary").set("Authorization", "Bearer wrong-token-that-is-at-least-thirty-two-bytes")).status).toBe(403);
      const response = await request(app).get("/api/public/funnel-events/summary").set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body.counts.venture_review_view).toBe(1);
    } finally {
      if (originalMonitorTokenFile === undefined) delete process.env.SYSDOM_HEALTH_MONITOR_TOKEN_FILE;
      else process.env.SYSDOM_HEALTH_MONITOR_TOKEN_FILE = originalMonitorTokenFile;
      rmSync(directory, { recursive: true, force: true });
    }
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

it("stores review events as aggregate counts and rejects identifiers or raw content", async () => {
  const event = { eventKey: "11111111-1111-4111-8111-111111111111", eventName: "venture_review_result", path: "/venture-review" };
  const app = createApp();
  expect((await request(app).post("/api/public/funnel-events").send(event)).status).toBe(202);
  const sentinel = "00000000-0000-0000-0000-000000000000";
  expect(values).toHaveBeenLastCalledWith({ ...event, isTest: false, visitorId: sentinel, sessionId: sentinel });
  for (const extra of [{ visitorId: event.eventKey, sessionId: event.eventKey }, { founderNote: "private" }, { source: "founder" }, { path: "/venture-review?private=true" }]) {
    expect((await request(app).post("/api/public/funnel-events").send({ ...event, ...extra })).status).toBe(400);
  }
  const summary = summarizePublicFunnelEvents(["venture_review_start", "venture_review_start", "venture_review_result", "venture_review_access_request"].map(eventName => ({ eventName, visitorId: sentinel, resultCategory: null, isTest: false })));
  expect(summary.uniqueVisitors).toBe(0);
  expect(summary.conversions.reviewStartToResult).toBe(0.5);
  expect(summary.conversions.reviewResultToAccessRequest).toBe(1);
});

it("protects operational aggregates from anonymous visitors, ordinary founders and agents", async () => {
  for (const actor of [{ type: "none", source: "none" }, { type: "board", source: "session", isInstanceAdmin: false }, { type: "agent", source: "agent_key" }]) {
    expect((await request(createApp(actor)).get("/api/venture-review/operations")).status).toBe(403);
  }
});
it("returns only aggregate request/activation and operational fields to an instance admin", async () => {
  const select = vi.fn(() => ({ from: () => ({ where: async () => [{ count: 2 }], innerJoin: () => ({ where: async () => [{ count: 1 }] }) }) }));
  const operations = vi.fn(async () => ({ state: "available", budget: { monthlyLimitUsd: 100 }, service: { inFlight: 0, queueDepth: 0 } }));
  const app = express();
  app.use((req, _res, next) => { (req as any).actor = { type: "board", source: "session", isInstanceAdmin: true }; next(); });
  app.use("/api", publicFunnelEventRoutes({ select } as any, operations)); app.use(errorHandler);
  const response = await request(app).get("/api/venture-review/operations?days=7");
  expect(response.status).toBe(200); expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.body).toMatchObject({ days: 7, acquisition: { acceptedRequests: 2, activatedInvitations: 1 }, operations: { budget: { monthlyLimitUsd: 100 } } });
  expect(select).toHaveBeenCalledTimes(2); expect(operations).toHaveBeenCalledOnce();
  expect(JSON.stringify(response.body)).not.toMatch(/email|founderName|useCase|token/);
});

it("permits the dedicated read-only monitor token to read operational aggregates", async () => {
  const token = "monitor-test-token-that-is-at-least-thirty-two-bytes";
  const directory = mkdtempSync(join(tmpdir(), "sysdom-health-monitor-"));
  const tokenFile = join(directory, "token");
  writeFileSync(tokenFile, token, { mode: 0o600 });
  process.env.SYSDOM_HEALTH_MONITOR_TOKEN_FILE = tokenFile;
  const select = vi.fn(() => ({ from: () => ({ where: async () => [{ count: 0 }], innerJoin: () => ({ where: async () => [{ count: 0 }] }) }) }));
  const operations = vi.fn(async () => ({ state: "available" }));
  const app = express();
  app.use((req, _res, next) => { (req as any).actor = { type: "none", source: "none" }; next(); });
  app.use("/api", publicFunnelEventRoutes({ select } as any, operations));
  app.use(errorHandler);

  try {
    const response = await request(app).get("/api/venture-review/operations").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.operations).toEqual({ state: "available" });
  } finally {
    if (originalMonitorTokenFile === undefined) delete process.env.SYSDOM_HEALTH_MONITOR_TOKEN_FILE;
    else process.env.SYSDOM_HEALTH_MONITOR_TOKEN_FILE = originalMonitorTokenFile;
    rmSync(directory, { recursive: true, force: true });
  }
});
