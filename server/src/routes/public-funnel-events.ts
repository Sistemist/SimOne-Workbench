import { Router } from "express";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { earlyAccessGrants, earlyAccessRequests, publicFunnelEvents, type Db } from "@paperclipai/db";
import {
  PUBLIC_FUNNEL_EVENT_NAMES,
  createPublicFunnelEventSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertBoard, assertInstanceAdmin } from "./authz.js";

const AGGREGATE_ONLY_ID = "00000000-0000-0000-0000-000000000000";

type FunnelEventRow = Pick<
  typeof publicFunnelEvents.$inferSelect,
  "eventName" | "visitorId" | "resultCategory" | "isTest"
>;

export function summarizePublicFunnelEvents(rows: FunnelEventRow[]) {
  const productionRows = rows.filter((row) => !row.isTest);
  const counts = Object.fromEntries(PUBLIC_FUNNEL_EVENT_NAMES.map((name) => [name, 0])) as Record<
    (typeof PUBLIC_FUNNEL_EVENT_NAMES)[number],
    number
  >;
  const uniqueVisitors = new Set<string>();
  const resultCategories: Record<string, number> = {};

  for (const row of productionRows) {
    if (row.eventName in counts) counts[row.eventName as keyof typeof counts] += 1;
    if (row.visitorId !== AGGREGATE_ONLY_ID) uniqueVisitors.add(row.visitorId);
    if (row.eventName === "scanner_complete" && row.resultCategory) {
      resultCategories[row.resultCategory] = (resultCategories[row.resultCategory] ?? 0) + 1;
    }
  }

  const ratio = (numerator: number, denominator: number) => denominator > 0
    ? Number((numerator / denominator).toFixed(4))
    : 0;

  return {
    counts,
    uniqueVisitors: uniqueVisitors.size,
    conversions: {
      reviewViewToClick: ratio(counts.venture_review_click, counts.venture_review_view),
      reviewClickToStart: ratio(counts.venture_review_start, counts.venture_review_click),
      reviewResultToAccessClick: ratio(counts.venture_review_access_click, counts.venture_review_result),
      reviewStartToResult: ratio(counts.venture_review_result, counts.venture_review_start),
      reviewResultToAccessRequest: ratio(counts.venture_review_access_request, counts.venture_review_result),
      viewToComplete: ratio(counts.scanner_complete, counts.scanner_view),
      completeToSignupClick: ratio(counts.scanner_signup_click, counts.scanner_complete),
      signupClickToSignupComplete: ratio(counts.signup_complete, counts.scanner_signup_click),
      signupCompleteToStarter: ratio(counts.starter_reached, counts.signup_complete),
    },
    resultCategories,
    excludedTestEvents: rows.length - productionRows.length,
  };
}

export function publicFunnelEventRoutes(db: Db, getOperations?: () => Promise<unknown>) {
  const router = Router();

  router.post("/public/funnel-events", validate(createPublicFunnelEventSchema), async (req, res) => {
    const body = req.body as z.infer<typeof createPublicFunnelEventSchema>;
    await db.insert(publicFunnelEvents).values("visitorId" in body ? body : { ...body, visitorId: AGGREGATE_ONLY_ID, sessionId: AGGREGATE_ONLY_ID }).onConflictDoNothing({
      target: publicFunnelEvents.eventKey,
    });
    res.status(202).json({ accepted: true });
  });

  router.get("/venture-review/operations", async (req, res) => {
    assertInstanceAdmin(req);
    res.setHeader("Cache-Control", "no-store");
    const days = z.coerce.number().int().min(1).max(90).catch(30).parse(req.query.days);
    const since = new Date(Date.now() - days * 86400000);
    const [requests, activations] = await Promise.all([
      db.select({ count: count() }).from(earlyAccessRequests).where(and(eq(earlyAccessRequests.source, "venture-review"), gte(earlyAccessRequests.createdAt, since))),
      db.select({ count: count() }).from(earlyAccessGrants).innerJoin(earlyAccessRequests, eq(earlyAccessGrants.requestId, earlyAccessRequests.id))
        .where(and(eq(earlyAccessRequests.source, "venture-review"), gte(earlyAccessGrants.activatedAt, since))),
    ]);
    res.json({ days, acquisition: { acceptedRequests: requests[0]?.count ?? 0, activatedInvitations: activations[0]?.count ?? 0, attribution: "existing_request_source; separate event-time windows, not a matched cohort" },
      operations: getOperations ? await getOperations() : { state: "disabled", accountBalance: { state: "unavailable", balanceUsd: null } } });
  });

  router.get("/public/funnel-events/summary", async (req, res) => {
    assertBoard(req);
    const days = z.coerce.number().int().min(1).max(90).catch(30).parse(req.query.days);
    const includeTest = req.query.includeTest === "true";
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filters = includeTest
      ? gte(publicFunnelEvents.createdAt, since)
      : and(gte(publicFunnelEvents.createdAt, since), eq(publicFunnelEvents.isTest, false));
    const rows = await db
      .select({
        eventName: publicFunnelEvents.eventName,
        visitorId: publicFunnelEvents.visitorId,
        resultCategory: publicFunnelEvents.resultCategory,
        isTest: publicFunnelEvents.isTest,
      })
      .from(publicFunnelEvents)
      .where(filters)
      .orderBy(desc(publicFunnelEvents.createdAt))
      .limit(100_000);
    res.json({ days, includeTest, ...summarizePublicFunnelEvents(rows) });
  });

  return router;
}
