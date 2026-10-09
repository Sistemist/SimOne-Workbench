import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVentureReviewClient, prepareVentureReviewPreview } from "@paperclipai/shared";
import { ventureReviewRoutes } from "./venture-review.js";
import { VentureReviewExchange } from "../services/venture-review-exchange.js";
import { createFixtureVentureReviewTransport } from "../services/venture-review.js";

const companyId = randomUUID();
const base = `/api/companies/${companyId}/venture-reviews`;
const services: VentureReviewExchange[] = [];
function harness(maxRequestsPerMinute = 100) {
  const transport = createFixtureVentureReviewTransport();
  const spy = vi.spyOn(transport, "review");
  const exchange = new VentureReviewExchange({ mode: "mock_only", transport, recipients: ["Local fixture reviewer"], purpose: "Fictional review", sessionTtlMs: 60_000, maxSessions: 10, reviewTimeoutMs: 1000,
    websitePolicy: { maxPages: 2, maxBytesPerPage: 2000, maxCharsPerPage: 1000, maxRedirects: 1, timeoutMs: 1000 },
    websiteNetwork: { lookup: async () => [{ address: "93.184.216.34" }], request: async () => ({ status: 200, headers: { "content-type": "text/plain" }, body: new TextEncoder().encode("Fictional website claim") }) } });
  services.push(exchange);
  const audit = vi.fn(async () => {});
  const app = express(); app.use(express.json({ limit: "600kb" }));
  // Stand-in for existing actorMiddleware; tests target company/role enforcement.
  app.use((req, _res, next) => {
    const role = req.header("x-test-role");
    req.actor = role === "none" ? { type: "none", source: "none" } : role === "agent" ?
      { type: "agent", agentId: "test-agent", companyId, source: "agent_key" } :
      { type: "board", userId: "founder", source: "session", companyIds: [companyId], memberships: [{ companyId, membershipRole: role === "viewer" ? "viewer" : "owner", status: "active" }] };
    next();
  });
  app.use("/api", ventureReviewRoutes({ exchange, audit, maxRequestsPerMinute }));
  const fetcher: typeof fetch = async function (this: unknown, url, init) {
    expect(this).toBeUndefined(); // Native WebKit fetch rejects an options-object receiver.
    const route = String(url);
    const response = init?.method === "POST" ? await request(app).post(route).send(JSON.parse(String(init.body))) : await request(app).get(route);
    return new Response(JSON.stringify(response.body), { status: response.status, headers: { "content-type": "application/json" } });
  };
  return { app, audit, spy, client: createVentureReviewClient({ basePath: base, fetcher }) };
}
afterEach(() => services.splice(0).forEach((service) => service.dispose()));

describe("local review HTTP/client path", () => {
  it("connects start, permitted inspection, local preview, approval, review and decline via the same client", async () => {
    const { client, spy, audit } = harness();
    const session = await client.start("What is the next test?");
    const inspection = await client.inspect(session.reviewId, session.requestId, ["https://example.com/"]);
    const page = inspection.receipts[0]!;
    const preview = await prepareVentureReviewPreview({ sources: [{ id: "web-1", kind: "website_page", title: "Fictional website", capturedAt: page.capturedAt, sourceDate: null, excerpt: page.text, omitted: page.omissions, basis: "website_text", provenance: { sourceUri: page.finalUrl, excerptLocation: JSON.stringify(page.excerptLocation), contentSha256: page.bodySha256 } }] });
    expect(spy).not.toHaveBeenCalled();
    const approval = await client.approve(session.reviewId, { requestId: session.requestId, draftSha256: preview.draftSha256, sourceIds: preview.sourceIds, recipients: session.disclosure.recipients, purpose: session.disclosure.purpose });
    const reviewed = await client.submit(session.reviewId, approval.approvalId, preview.draft);
    expect(reviewed.mockOnly).toBe(true);
    expect(reviewed.result!.engineFindings.product_service[0]!.evidenceSourceIds).toEqual(["web-1"]);
    expect((await client.decline(session.reviewId)).phase).toBe("complete");
    expect(JSON.stringify(audit.mock.calls)).not.toContain("Fictional website claim");
    expect(JSON.stringify(audit.mock.calls)).not.toContain("What is the next test?");
    expect((await client.cancel(session.reviewId)).result).toBeNull();
  });

  it("rejects unauthenticated/cross-company/viewer operations and body-supplied tenant identity", async () => {
    const { app } = harness();
    expect((await request(app).post(base).set("x-test-role", "none").send({ question: "Review?" })).status).toBe(401);
    expect((await request(app).post(base.replace(companyId, randomUUID())).send({ question: "Review?" })).status).toBe(403);
    expect((await request(app).post(base).set("x-test-role", "viewer").send({ question: "Review?" })).status).toBe(403);
    expect((await request(app).post(base).send({ question: "Review?", tenantId: randomUUID() })).status).toBe(400);
  });

  it("does not echo schema input or provider errors and allows cancellation despite throttle/audit failure", async () => {
    const { app, client, audit } = harness(1);
    const session = await client.start("Temporary private question");
    expect((await request(app).get(`${base}/${session.reviewId}`)).status).toBe(429);
    audit.mockRejectedValue(new Error("private credential must not leak"));
    const cancelled = await request(app).post(`${base}/${session.reviewId}/cancel`).send({});
    expect(cancelled.status).toBe(200);
    expect(cancelled.headers["cache-control"]).toBe("no-store");
    expect(cancelled.body).toMatchObject({ phase: "cancelled", result: null });
    expect(JSON.stringify(cancelled.body)).not.toContain("private credential");
  });
});
