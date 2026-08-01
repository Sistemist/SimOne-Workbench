import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  commitSimCycleLeverageSchema,
  completeSimCycleCompoundSchema,
  decideSimCycleDiagnosisSchema,
  pauseSimCycleSchema,
  startSimCycleSchema,
  submitSimCycleMapSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { logActivity, simCycleService } from "../services/index.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";

export function simCycleRoutes(db: Db) {
  const router = Router();
  const svc = simCycleService(db);

  router.get("/companies/:companyId/sim-cycles", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.list(companyId));
  });

  router.get("/companies/:companyId/sim-cycles/active", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.active(companyId));
  });

  router.get("/companies/:companyId/sim-cycles/:id/events", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await svc.events(companyId, req.params.id as string));
  });

  async function logCycleMutation(
    companyId: string,
    cycle: { id: string; status: string; phase: string },
    userId: string,
    action: string,
  ) {
    await logActivity(db, {
      companyId,
      actorType: "user",
      actorId: userId,
      action,
      entityType: "sim_cycle",
      entityId: cycle.id,
      details: { status: cycle.status, phase: cycle.phase },
    });
  }

  router.post(
    "/companies/:companyId/sim-cycles",
    validate(startSimCycleSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const userId = req.actor.userId ?? "board";
      const cycle = await svc.start(companyId, req.body, userId);
      await logCycleMutation(companyId, cycle, userId, "sim_cycle.started");
      res.status(201).json(cycle);
    },
  );

  router.post(
    "/companies/:companyId/sim-cycles/:id/map",
    validate(submitSimCycleMapSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const userId = req.actor.userId ?? "board";
      const cycle = await svc.submitMap(companyId, req.params.id as string, req.body, userId);
      await logCycleMutation(companyId, cycle, userId, "sim_cycle.map_completed");
      res.json(cycle);
    },
  );

  router.post(
    "/companies/:companyId/sim-cycles/:id/diagnose",
    validate(decideSimCycleDiagnosisSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const userId = req.actor.userId ?? "board";
      const cycle = await svc.decideDiagnosis(companyId, req.params.id as string, req.body, userId);
      await logCycleMutation(companyId, cycle, userId, `sim_cycle.diagnosis_${req.body.decision}`);
      res.json(cycle);
    },
  );

  router.post(
    "/companies/:companyId/sim-cycles/:id/leverage",
    validate(commitSimCycleLeverageSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const userId = req.actor.userId ?? "board";
      const cycle = await svc.commitLeverage(companyId, req.params.id as string, req.body, userId);
      await logCycleMutation(companyId, cycle, userId, "sim_cycle.intervention_committed");
      res.json(cycle);
    },
  );

  router.post(
    "/companies/:companyId/sim-cycles/:id/compound",
    validate(completeSimCycleCompoundSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const userId = req.actor.userId ?? "board";
      const cycle = await svc.completeCompound(companyId, req.params.id as string, req.body, userId);
      await logCycleMutation(companyId, cycle, userId, "sim_cycle.completed");
      res.json(cycle);
    },
  );

  router.post("/companies/:companyId/sim-cycles/:id/delegate-intervention", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = req.actor.userId ?? "board";
    const result = await svc.delegateIntervention(companyId, req.params.id as string, userId);
    if (result.created) {
      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: userId,
        action: "sim_cycle.intervention_delegated",
        entityType: "issue",
        entityId: result.issue.id,
        details: {
          cycleId: result.cycle.id,
          issueIdentifier: result.issue.identifier,
          contextProjectionId: result.contextProjection.id,
          contextProjectionVersion: result.contextProjection.version,
          status: result.issue.status,
          assigneeAgentId: result.issue.assigneeAgentId,
        },
      });
    }
    res.status(result.created ? 201 : 200).json(result);
  });

  router.post(
    "/companies/:companyId/sim-cycles/:id/pause",
    validate(pauseSimCycleSchema),
    async (req, res) => {
      assertBoard(req);
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const userId = req.actor.userId ?? "board";
      const cycle = await svc.pause(companyId, req.params.id as string, req.body, userId);
      await logCycleMutation(companyId, cycle, userId, "sim_cycle.paused");
      res.json(cycle);
    },
  );

  router.post("/companies/:companyId/sim-cycles/:id/resume", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const userId = req.actor.userId ?? "board";
    const cycle = await svc.resume(companyId, req.params.id as string, userId);
    await logCycleMutation(companyId, cycle, userId, "sim_cycle.resumed");
    res.json(cycle);
  });

  return router;
}
