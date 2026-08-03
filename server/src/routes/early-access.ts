import { Router } from "express";
import {
  assignScannerRunSchema,
  claimScannerRunSchema,
  createEarlyAccessGrantSchema,
  createEarlyAccessRequestSchema,
} from "@paperclipai/shared";
import type { Db } from "@paperclipai/db";
import { forbidden } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { earlyAccessService } from "../services/early-access.js";
import { assertBoard, assertCompanyAccess, assertInstanceAdmin } from "./authz.js";

export function earlyAccessRoutes(db: Db) {
  const router = Router();
  const service = earlyAccessService(db);
  void service.pruneExpiredUnclaimedScans().catch(() => undefined);

  router.post(
    "/public/early-access/requests",
    validate(createEarlyAccessRequestSchema),
    async (req, res) => {
      const created = await service.createRequest(req.body);
      res.status(202).json({ accepted: true, ...created });
    },
  );

  router.get("/public/early-access/activate/:token", async (req, res) => {
    res.json(await service.grantSummary(req.params.token as string));
  });

  router.post("/early-access/activate/:token", async (req, res) => {
    assertBoard(req);
    if (!req.actor.userId) throw forbidden("A user session is required");
    res.json(await service.activate(req.params.token as string, req.actor.userId));
  });

  router.get("/early-access/me", async (req, res) => {
    assertBoard(req);
    if (!req.actor.userId) throw forbidden("A user session is required");
    const [grant, scans] = await Promise.all([
      service.userGrant(req.actor.userId),
      service.listUserScans(req.actor.userId),
    ]);
    res.json({ grant, scans });
  });

  router.post(
    "/early-access/scans/claim",
    validate(claimScannerRunSchema),
    async (req, res) => {
      assertBoard(req);
      if (!req.actor.userId) throw forbidden("A user session is required");
      res.status(201).json(await service.claimScan(req.body, req.actor.userId));
    },
  );

  router.post(
    "/early-access/scans/:scanId/assign",
    validate(assignScannerRunSchema),
    async (req, res) => {
      assertBoard(req);
      if (!req.actor.userId) throw forbidden("A user session is required");
      assertCompanyAccess(req, req.body.companyId);
      res.json(await service.assignScan(
        req.params.scanId as string,
        req.body.companyId,
        req.actor.userId,
      ));
    },
  );

  router.get("/early-access/admin", async (req, res) => {
    assertInstanceAdmin(req);
    res.json(await service.listAdminState());
  });

  router.post(
    "/early-access/admin/grants",
    validate(createEarlyAccessGrantSchema),
    async (req, res) => {
      assertInstanceAdmin(req);
      res.status(201).json(await service.createGrant(req.body, req.actor.userId ?? null));
    },
  );

  router.post(
    "/early-access/admin/requests/:requestId/approve",
    validate(createEarlyAccessGrantSchema.omit({
      founderName: true,
      email: true,
      accessRequestId: true,
    })),
    async (req, res) => {
      assertInstanceAdmin(req);
      res.status(201).json(await service.approveRequest(
        req.params.requestId as string,
        req.body,
        req.actor.userId ?? null,
      ));
    },
  );

  return router;
}
