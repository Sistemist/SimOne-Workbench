import { Router } from "express";
import {
  scannerModelAnalysisRequestSchema,
  scannerModelCapabilitySchema,
} from "@paperclipai/shared";
import { HttpError } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { createFileResourceLimiter } from "./file-resources.js";
import {
  runScannerModelAnalysis,
  type ScannerModelAnalyzer,
} from "../services/scanner-model-analysis.js";

export function scannerModelAnalysisRoutes(options: {
  analyzer?: ScannerModelAnalyzer;
  limiter?: ReturnType<typeof createFileResourceLimiter>;
} = {}) {
  const router = Router();
  const limiter = options.limiter ?? createFileResourceLimiter({
    maxConcurrent: 1,
    maxRequests: 5,
    windowMs: 60_000,
    requestLimitMessage: "Too many Scanner analysis requests",
    concurrencyLimitMessage: "A Scanner analysis is already running",
  });

  router.get("/public/scanner/model-capability", (_req, res) => {
    res.json(scannerModelCapabilitySchema.parse({
      version: "sysdom_scanner_model_capability_v1",
      enabled: Boolean(options.analyzer),
      mode: options.analyzer ? "model_assisted" : "deterministic_only",
      rawNotesTransmitted: Boolean(options.analyzer),
      maxFounderNoteChars: 8_000,
    }));
  });

  router.post(
    "/public/scanner/model-analysis",
    validate(scannerModelAnalysisRequestSchema),
    async (req, res) => {
      if (!options.analyzer) {
        throw new HttpError(503, "Scanner model assistance is not enabled", {
          code: "scanner_model_assistance_disabled",
        });
      }
      const release = limiter.acquire(req.ip || "unknown");
      try {
        res.json(await runScannerModelAnalysis(options.analyzer, req.body));
      } finally {
        release();
      }
    },
  );

  return router;
}
