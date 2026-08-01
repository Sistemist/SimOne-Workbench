import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  activateModelPortfolioRevisionSchema,
  createModelPortfolioRevisionSchema,
  restoreModelPortfolioRevisionSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, modelPortfolioService } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function modelPortfolioRoutes(db: Db) {
  const router = Router();
  const portfolios = modelPortfolioService(db);

  router.get("/companies/:companyId/model-portfolios/active", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    res.json(await portfolios.current(companyId));
  });

  router.get("/companies/:companyId/model-portfolios/revisions", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    assertBoard(req);
    res.json(await portfolios.list(companyId));
  });

  router.post(
    "/companies/:companyId/model-portfolios/revisions",
    validate(createModelPortfolioRevisionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const revision = await portfolios.createDraft(companyId, req.body, {
        agentId: actor.agentId,
        userId: actor.actorType === "user" ? actor.actorId : null,
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "model_portfolio.revision_proposed",
        entityType: "model_portfolio_revision",
        entityId: revision.id,
        details: {
          version: revision.version,
          candidateCount: revision.candidates.length,
          changeReason: revision.changeReason,
        },
      });
      res.status(201).json(revision);
    },
  );

  router.post(
    "/companies/:companyId/model-portfolios/revisions/:id/activate",
    validate(activateModelPortfolioRevisionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const id = req.params.id as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const revision = await portfolios.activate(
        companyId,
        id,
        req.actor.userId ?? "board",
        req.body.approvalNote,
      );
      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "model_portfolio.revision_activated",
        entityType: "model_portfolio_revision",
        entityId: revision.id,
        details: {
          version: revision.version,
          candidateCount: revision.candidates.length,
          approvalNote: revision.approvalNote,
        },
      });
      res.json(revision);
    },
  );

  router.post(
    "/companies/:companyId/model-portfolios/revisions/:id/restore",
    validate(restoreModelPortfolioRevisionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const id = req.params.id as string;
      assertCompanyAccess(req, companyId);
      assertBoard(req);
      const actor = getActorInfo(req);
      const revision = await portfolios.restoreDraft(companyId, id, req.body, {
        agentId: actor.agentId,
        userId: actor.actorType === "user" ? actor.actorId : null,
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "model_portfolio.revision_restored",
        entityType: "model_portfolio_revision",
        entityId: revision.id,
        details: {
          version: revision.version,
          restoredFromRevisionId: revision.restoredFromRevisionId,
          candidateCount: revision.candidates.length,
          changeReason: revision.changeReason,
        },
      });
      res.status(201).json(revision);
    },
  );

  return router;
}
