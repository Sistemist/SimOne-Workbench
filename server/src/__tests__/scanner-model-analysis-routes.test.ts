import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import { scannerModelAnalysisRoutes } from "../routes/scanner-model-analysis.js";

function createApp(analyzer?: Parameters<typeof scannerModelAnalysisRoutes>[0]["analyzer"]) {
  const app = express();
  app.use(express.json());
  app.use("/api", scannerModelAnalysisRoutes({ analyzer }));
  app.use(errorHandler);
  return app;
}

const requestBody = {
  founderNote: "Customer replies are scattered and nobody returned for a second session.",
  deterministicAssessment: {
    primaryEngine: "Customer Engine",
    secondaryEngine: null,
    primaryMatches: 3,
    secondaryMatches: 0,
  },
};

describe("public Scanner model-analysis boundary", () => {
  it("advertises deterministic-only mode and never accepts a note without an analyzer", async () => {
    const app = createApp();
    const capability = await request(app).get("/api/public/scanner/model-capability");
    const analysis = await request(app)
      .post("/api/public/scanner/model-analysis")
      .send(requestBody);

    expect(capability.status).toBe(200);
    expect(capability.body).toEqual({
      version: "sysdom_scanner_model_capability_v1",
      enabled: false,
      mode: "deterministic_only",
      rawNotesTransmitted: false,
      maxFounderNoteChars: 8_000,
    });
    expect(analysis.status).toBe(503);
    expect(analysis.body).toMatchObject({
      details: {
        code: "scanner_model_assistance_disabled",
      },
    });
  });

  it("validates input and returns only a structured, provenance-backed assessment", async () => {
    const analyzer = {
      analyze: vi.fn(async () => ({
        version: "sysdom_scanner_model_analysis_v1" as const,
        analysisId: "11111111-1111-4111-8111-111111111111",
        assessment: {
          version: "sysdom_scanner_model_assessment_v1" as const,
          primaryEngine: "Customer Engine" as const,
          secondaryEngine: "Product Engine" as const,
          confidence: "medium" as const,
          summary: "Customer follow-up is primary; product messaging may be contributing.",
          clarificationQuestion: "Where do founder follow-up notes currently live?",
          evidenceCues: ["nobody returned", "replies are scattered"],
        },
        provenance: {
          policyVersion: "sysdom-auto-alpha-1",
          portfolio: {
            revisionId: "33333333-3333-4333-8333-333333333333",
            version: 2,
          },
          provider: "openrouter",
          model: "openai/gpt-5.6-luna",
          reasoningEffort: "low" as const,
          inputTokens: 120,
          outputTokens: 80,
          costUsd: 0.00006,
          completedAt: "2026-08-03T20:00:00.000Z",
        },
      })),
    };
    const app = createApp(analyzer);
    const capability = await request(app).get("/api/public/scanner/model-capability");
    const analysis = await request(app)
      .post("/api/public/scanner/model-analysis")
      .send(requestBody);

    expect(capability.body).toMatchObject({
      enabled: true,
      mode: "model_assisted",
      rawNotesTransmitted: true,
    });
    expect(analysis.status).toBe(200);
    expect(analysis.body).toMatchObject({
      assessment: {
        primaryEngine: "Customer Engine",
        secondaryEngine: "Product Engine",
        confidence: "medium",
      },
      provenance: {
        provider: "openrouter",
        model: "openai/gpt-5.6-luna",
        reasoningEffort: "low",
      },
    });
    expect(analyzer.analyze).toHaveBeenCalledWith(requestBody);
  });

  it("rejects oversized or extra raw inputs before invoking the analyzer", async () => {
    const analyzer = { analyze: vi.fn() };
    const response = await request(createApp(analyzer))
      .post("/api/public/scanner/model-analysis")
      .send({
        ...requestBody,
        founderNote: "x".repeat(8_001),
        startupUrl: "https://private.example",
      });

    expect(response.status).toBe(400);
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });
});
