import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  DEFAULT_TISSUU_CUSTOMER_ENGINE_BASE_URL,
  fetchCustomerEngineBridgeSnapshot,
} from "../services/customer-engine-bridge.js";
import { assertCompanyAccess } from "./authz.js";

export function customerEngineBridgeRoutes(_db: Db) {
  const router = Router();

  router.get("/companies/:companyId/customer-engine/bridge", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const snapshot = await fetchCustomerEngineBridgeSnapshot({
      baseUrl:
        process.env.SIMONE_TISSUU_BRIDGE_BASE_URL?.trim() ||
        DEFAULT_TISSUU_CUSTOMER_ENGINE_BASE_URL,
      token: process.env.SIMONE_BRIDGE_TOKEN,
    });
    res.json(snapshot);
  });

  return router;
}
