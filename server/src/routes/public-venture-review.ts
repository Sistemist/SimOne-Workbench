import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { Router } from "express";
import { PUBLIC_REVIEW_CONSENT_VERSION, publicReviewInputSchema } from "@paperclipai/shared";
import { PublicVentureReview } from "../services/public-venture-review.js";
import { createFileResourceLimiter } from "./file-resources.js";
import { HttpError } from "../errors.js";

export function publicVentureReviewRoutes(options: { service?: PublicVentureReview; publicOrigin?: string | (() => string); trustedProxyAddresses?: string[]; getOperations?: () => Promise<unknown> } = {}) {
  const router = Router(), limiter = createFileResourceLimiter({ maxConcurrent: 100, maxRequests: 180, windowMs: 60000 });
  const starts = createFileResourceLimiter({ maxConcurrent: 30, maxRequests: 30, windowMs: 60000 });
  const sessions = createFileResourceLimiter({ maxConcurrent: 2, maxRequests: 30, windowMs: 60000 });
  const normalize = (ip: string) => ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
  if (options.trustedProxyAddresses?.some(ip => !isIP(ip))) throw new Error("Exact trusted proxy addresses required");
  const trusted = new Set((options.trustedProxyAddresses ?? []).map(normalize));
  const clientIp = (req: import("express").Request) => {
    const peer = normalize(req.socket.remoteAddress ?? "unknown"), forwarded = req.header("x-real-ip");
    return trusted.has(peer) && forwarded && isIP(forwarded) ? normalize(forwarded) : peer;
  };
  router.use("/public/venture-review", (req, res, next) => {
    res.once("finish", () => options.service?.recordHttpStatus(res.statusCode));
    res.setHeader("Cache-Control", "no-store"); res.setHeader("Referrer-Policy", "no-referrer");
    if (req.originalUrl.includes("?")) { res.status(400).json({ error: "Query parameters are not accepted." }); return; }
    const origin = typeof options.publicOrigin === "function" ? options.publicOrigin() : options.publicOrigin;
    if (req.method !== "GET" && (!origin || req.headers.origin !== origin || !req.is("application/json"))) { res.status(403).json({ error: "Same-origin JSON request required." }); return; }
    // Cancellation must remain available while a run occupies the rate/concurrency slot.
    if (req.method === "POST" && /^\/sessions\/[^/]+\/cancel$/.test(req.path)) { next(); return; }
    let release: (() => void) | undefined;
    try {
      const ipRelease = limiter.acquire(clientIp(req));
      try {
        const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? "")?.[1];
        const sessionRelease = token ? sessions.acquire(createHash("sha256").update(token).digest("hex")) : undefined;
        release = () => { ipRelease(); sessionRelease?.(); };
      } catch (e) { ipRelease(); throw e; }
    } catch { res.status(429).json({ error: "Too many requests. Try later." }); return; }
    let ended = false; const done = () => { if (!ended) { ended = true; release?.(); } };
    res.once("finish", done); res.once("close", done); next();
  });
  router.get("/public/venture-review/capability", async (_req, res) => {
    try { res.json(options.service ? await options.service.capability() : {
      state: "disabled", mode: "disabled", consentVersion: PUBLIC_REVIEW_CONSENT_VERSION, methodVersion: "sim-aulet-local-2026-10-08",
      model: "openai/gpt-6.1-sol", reasoningEffort: "high", recipients: [], retention: "No review service is active. Your draft stays in this page until you choose to share it.", maxNoteChars: 8000, sessionMinutes: 15,
    }); } catch { res.status(503).json({ error: "Review unavailable. Your draft has not been sent." }); }
  });
  router.post("/public/venture-review/sessions", async (req, res) => {
    try {
      if (!options.service) throw new HttpError(503, "Review is not available yet. No model call was made.");
      if (!req.body || Object.keys(req.body).length) throw new HttpError(400, "Session creation accepts no evidence.");
      const release = starts.acquire(clientIp(req));
      try { res.status(201).json(await options.service.create()); } finally { release(); }
    } catch (error) { res.status(error instanceof HttpError ? error.status : 503).json({ error: error instanceof HttpError ? error.message : "Review unavailable." }); }
  });
  for (const action of ["status", "run", "cancel", "sources"] as const) {
    const handler = async (req: import("express").Request, res: import("express").Response) => {
      try {
        if (!options.service) throw new HttpError(503, "Review is not available yet.");
        const token = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? "")?.[1] ?? "";
        const id = String(req.params.id);
        if (action === "run") {
          const input = publicReviewInputSchema.safeParse(req.body);
          if (!input.success) { res.status(400).json({ error: "Check the question, note length and sharing approval." }); return; }
          res.json(await options.service.run(id, token, input.data));
        } else if (action === "sources") res.json(await options.service.inspect(id, token, req.body));
        else res.json(action === "status" ? options.service.get(id, token) : options.service.cancel(id, token));
      } catch (error) { res.status(error instanceof HttpError ? error.status : 400).json({ error: error instanceof HttpError ? error.message : "Review request could not be completed. No automatic retry was made." }); }
    };
    if (action === "status") router.get("/public/venture-review/sessions/:id", handler);
    else router.post(`/public/venture-review/sessions/:id/${action}`, handler);
  }
  return router;
}
