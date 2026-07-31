import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createVentureContextProjectionSchema,
  createVentureStateRevisionSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, ventureOperatingStateService } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";

export function ventureOperatingStateRoutes(db: Db) {
  const router = Router();
  const svc = ventureOperatingStateService(db);

  router.get("/companies/:companyId/founder-cockpit", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.cockpit(companyId));
  });

  router.get("/companies/:companyId/founder-coach", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.coach(companyId));
  });

  router.get("/companies/:companyId/venture-state/revisions", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.listStates(companyId));
  });

  router.post(
    "/companies/:companyId/venture-state/revisions",
    validate(createVentureStateRevisionSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const state = await svc.createState(companyId, req.body, {
        agentId: actor.agentId,
        userId: actor.actorId,
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "venture_state.revision_created",
        entityType: "venture_state_revision",
        entityId: state.id,
        details: { version: state.version, creationReason: state.creationReason },
      });
      res.status(201).json(state);
    },
  );

  router.get("/companies/:companyId/context-projections", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.listProjections(companyId));
  });

  router.post(
    "/companies/:companyId/context-projections",
    validate(createVentureContextProjectionSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const projection = await svc.createProjection(companyId, req.body, {
        agentId: actor.agentId,
        userId: actor.actorType === "user" ? actor.actorId : null,
      });
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "venture_context.projection_created",
        entityType: "venture_context_projection",
        entityId: projection.id,
        details: {
          version: projection.version,
          constitutionRevisionId: projection.constitutionRevisionId,
          ventureStateRevisionId: projection.ventureStateRevisionId,
          creationReason: projection.creationReason,
        },
      });
      res.status(201).json(projection);
    },
  );

  return router;
}
