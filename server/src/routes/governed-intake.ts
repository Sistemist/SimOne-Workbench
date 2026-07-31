import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { createGovernedIntakeAssessmentSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { governedIntakeService } from "../services/index.js";
import { assertBoard, assertInstanceAdmin, getActorInfo } from "./authz.js";

export interface GovernedIntakeRouteDeps {
  deactivatePlugin?: (pluginId: string, reason: string) => Promise<void>;
}

export function governedIntakeRoutes(db: Db, deps: GovernedIntakeRouteDeps = {}) {
  const router = Router();
  const svc = governedIntakeService(db);

  router.get("/governed-intake/assessments", async (req, res) => {
    assertBoard(req);
    res.json(await svc.list());
  });

  router.post(
    "/governed-intake/assessments",
    validate(createGovernedIntakeAssessmentSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      const actor = getActorInfo(req);
      const assessment = await svc.create(req.body, actor.actorId);
      const activationApproved = assessment.compatibility === "compatible"
        && (assessment.decision === "adopt" || assessment.decision === "adapt");
      if (assessment.pluginId && !activationApproved) {
        await deps.deactivatePlugin?.(
          assessment.pluginId,
          `Governed intake ${assessment.decision}: ${assessment.reviewNote}`,
        );
      }
      res.status(201).json(assessment);
    },
  );

  return router;
}
