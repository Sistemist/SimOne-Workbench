import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  activateVentureConstitutionRevisionSchema,
  createVentureConstitutionRevisionSchema,
  restoreVentureConstitutionRevisionSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, ventureConstitutionService } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function ventureConstitutionRoutes(db: Db) {
  const router = Router();
  const svc = ventureConstitutionService(db);

  router.get("/companies/:companyId/venture-constitution", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.current(companyId));
  });

  router.get("/companies/:companyId/venture-constitution/revisions", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.list(companyId));
  });

  router.post(
    "/companies/:companyId/venture-constitution/revisions",
    validate(createVentureConstitutionRevisionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const revision = await svc.createDraft(companyId, req.body, {
        agentId: actor.agentId,
        userId: actor.actorType === "user" ? actor.actorId : null,
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "venture_constitution.revision_proposed",
        entityType: "venture_constitution_revision",
        entityId: revision.id,
        details: { version: revision.version, changeReason: revision.changeReason },
      });
      res.status(201).json(revision);
    },
  );

  router.post(
    "/companies/:companyId/venture-constitution/revisions/:id/activate",
    validate(activateVentureConstitutionRevisionSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      const id = req.params.id as string;
      assertCompanyAccess(req, companyId);
      const revision = await svc.activate(
        companyId,
        id,
        req.actor.userId ?? "board",
        req.body.approvalNote,
      );
      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "venture_constitution.revision_activated",
        entityType: "venture_constitution_revision",
        entityId: revision.id,
        details: { version: revision.version, approvalNote: revision.approvalNote },
      });
      res.json(revision);
    },
  );

  router.post(
    "/companies/:companyId/venture-constitution/revisions/:id/restore",
    validate(restoreVentureConstitutionRevisionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      const id = req.params.id as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const revision = await svc.restoreDraft(companyId, id, req.body, {
        agentId: actor.agentId,
        userId: actor.actorType === "user" ? actor.actorId : null,
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "venture_constitution.revision_restored",
        entityType: "venture_constitution_revision",
        entityId: revision.id,
        details: {
          version: revision.version,
          restoredFromRevisionId: revision.restoredFromRevisionId,
          changeReason: revision.changeReason,
        },
      });
      res.status(201).json(revision);
    },
  );

  return router;
}
