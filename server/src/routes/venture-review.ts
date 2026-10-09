import { Router, type Request } from "express";
import { z, ZodError } from "zod";
import { HttpError, badRequest } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { VentureReviewExchange, type ReviewPrincipal } from "../services/venture-review-exchange.js";

/** Injection-only local integration. Existing company auth is reused for tests;
 * this does not choose authentication for the public /scanner product. */
export function ventureReviewRoutes(options: {
  exchange: VentureReviewExchange;
  audit: (event: { principal: ReviewPrincipal; reviewId: string; action: string }) => Promise<void>;
  maxRequestsPerMinute: number;
}) {
  if (!Number.isSafeInteger(options.maxRequestsPerMinute) || options.maxRequestsPerMinute < 1) throw new Error("Explicit request limit required");
  const router = Router();
  const base = "/companies/:companyId/venture-reviews";
  const rates = new Map<string, { count: number; expires: number }>();
  function principal(req: Request): ReviewPrincipal {
    const tenantId = z.string().uuid().parse(req.params.companyId);
    assertCompanyAccess(req, tenantId);
    const actor = getActorInfo(req);
    if (actor.actorId === "unknown-agent") throw badRequest("Authenticated actor identity required");
    return { tenantId, actorId: actor.actorId, role: req.actor.type === "agent" ? "agent" : "board" };
  }
  router.use(base, (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  const operations = ["start", "get", "approve", "submit", "inspect", "decline", "cancel"] as const;
  for (const operation of operations) {
    const path = operation === "start" ? base : operation === "get" ? `${base}/:reviewId` : `${base}/:reviewId/${operation}`;
    const method = operation === "get" ? "get" : "post";
    router[method](path, async (req, res) => {
      // Handle errors here: the generic server error context includes req.body.
      // Never pass review excerpts/provider errors to telemetry or request logs.
      try {
        const actor = principal(req);
        const key = `${actor.tenantId}:${actor.actorId}`;
        const now = Date.now();
        for (const [id, rate] of rates) if (rate.expires <= now) rates.delete(id);
        const rate = rates.get(key) ?? { count: 0, expires: now + 60_000 };
        if (operation !== "cancel" && (rate.count >= options.maxRequestsPerMinute || (!rates.has(key) && rates.size >= 1000))) {
          res.status(429).json({ error: "Local review request limit reached" }); return;
        }
        if (operation !== "cancel") { rate.count++; rates.set(key, rate); }
        const reviewId = operation === "start" ? "" : z.string().uuid().parse(req.params.reviewId);
        if (operation !== "start") options.exchange.get(actor, reviewId);
        let result: unknown;
        if (operation === "get") result = options.exchange.get(actor, reviewId);
        else {
          // Audit intent before the effect; failure prevents execution. No evidence,
          // URL, question, hashes, approval token or private method is logged.
          if (operation === "cancel") {
            // A telemetry outage must never prevent a safety stop.
            result = options.exchange.cancel(actor, reviewId);
            await options.audit({ principal: actor, reviewId, action: "venture_review.cancelled" }).catch(() => {});
            res.json(result); return;
          }
          await options.audit({ principal: actor, reviewId: reviewId || actor.tenantId, action: `venture_review.${operation}_requested` });
          switch (operation) {
            case "start": result = options.exchange.start(actor, req.body); break;
            case "approve": result = options.exchange.approve(actor, reviewId, req.body); break;
            case "submit": result = await options.exchange.submit(actor, reviewId, req.body); break;
            case "decline": result = options.exchange.decline(actor, reviewId); break;
            case "inspect": {
              const input = z.object({ requestId: z.string().uuid(), approvedUrls: z.array(z.string().max(2000)).min(1).max(40) }).strict().parse(req.body);
              result = await options.exchange.inspectWebsite(actor, reviewId, input.requestId, input.approvedUrls);
              break;
            }
          }
        }
        res.json(result);
      } catch (error) {
        const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 500;
        res.status(status).json({ error: error instanceof HttpError ? error.message : status === 400 ? "Invalid review request" : "Review operation failed; no automatic retry" });
      }
    });
  }
  return router;
}
