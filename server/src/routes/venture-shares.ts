import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { forbidden, notFound } from "../errors.js";
import {
  agentService,
  ventureShareService,
} from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

async function assertSameCompanyCeoAgentOrBoard(req: Request, companyId: string) {
  assertCompanyAccess(req, companyId);
  if (req.actor.type === "board") return;
  if (!req.actor.agentId) throw forbidden("Agent authentication required");

  const agents = agentService(req.app.locals.ventureShareRouteDb as Db);
  const actorAgent = await agents.getById(req.actor.agentId);
  if (!actorAgent || actorAgent.companyId !== companyId) {
    throw forbidden("Agent key cannot access another company");
  }
  if (actorAgent.role !== "ceo") {
    throw forbidden("Only CEO agents or board users can create venture shares");
  }
}

export function ventureShareRoutes(db: Db) {
  const router = Router();
  const shares = ventureShareService(db);
  router.use((req, _res, next) => {
    req.app.locals.ventureShareRouteDb = db;
    next();
  });

  router.post("/companies/:companyId/venture-shares", async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertSameCompanyCeoAgentOrBoard(req, companyId);
    const result = await shares.createFromCompany(companyId, {
      createdByUserId: req.actor.type === "board" ? req.actor.userId ?? null : null,
    });
    res.status(201).json(result);
  });

  router.get("/venture-shares/:shareId", async (req, res) => {
    const share = await shares.getById(req.params.shareId as string);
    if (!share) throw notFound("Venture share not found");
    res.json(share);
  });

  return router;
}
