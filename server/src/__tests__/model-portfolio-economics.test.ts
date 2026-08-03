import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  alphaWorkloadEconomicsPlanSchema,
  evaluateAlphaWorkloadEconomics,
} from "../services/model-portfolio-economics.js";

const proposal = JSON.parse(await readFile(
  new URL("../../../evals/fixtures/sysdom-model-portfolio.proposal.v1.json", import.meta.url),
  "utf8",
));
const plan = JSON.parse(await readFile(
  new URL("../../../evals/fixtures/sysdom-alpha-workload-economics.v1.json", import.meta.url),
  "utf8",
));

describe("Sysdom alpha workload economics", () => {
  it("selects the balanced review candidates without activating or dispatching", () => {
    const report = evaluateAlphaWorkloadEconomics(proposal, plan);

    expect(report).toMatchObject({
      evidenceClass: "synthetic_planning",
      activationAttempted: false,
      providerDispatchAttempted: false,
      firstLiveBenchmarkProposal: {
        status: "requires_explicit_approval",
        provider: "openrouter",
        model: "openai/gpt-5.6-luna",
        reasoningEffort: "low",
        maxInputTokens: 8_000,
        maxOutputTokens: 1_600,
        maxRunCostCents: 1,
        providerKeyLimitUsd: 1,
        maxTurns: 1,
        maxRuns: 1,
        automaticRetries: 0,
        concurrency: 1,
        worstCaseCostCents: 1,
        executionAuthorized: false,
        blockers: [
          "explicit_user_approval_missing",
          "provider_key_limit_not_verified",
          "provider_key_not_attached",
          "live_cost_not_reconciled",
        ],
      },
      selectedRoutes: [
        {
          lane: "workhorse",
          provider: "openrouter",
          model: "openai/gpt-5.6-luna",
        },
        {
          lane: "frontier",
          provider: "openrouter",
          model: "openai/gpt-5.6-terra",
        },
        {
          lane: "deliberation_audit",
          provider: "openrouter",
          model: "anthropic/claude-opus-5",
        },
      ],
    });
  });

  it("keeps the synthetic P90 month inside the $5 allowance under both price scenarios", () => {
    const report = evaluateAlphaWorkloadEconomics(proposal, plan);

    expect(report.scenarios).toEqual([
      expect.objectContaining({
        id: "openrouter_catalog_current",
        aggregate: {
          monthlyRuns: 27,
          monthlyModelCalls: 23,
          p50MonthlyUsd: 0.52786,
          p90MonthlyUsd: 1.52272,
          p50IncludedRemainingUsd: 4.47214,
          p90IncludedRemainingUsd: 3.47728,
          p50WithinIncludedUsage: true,
          p90WithinIncludedUsage: true,
        },
      }),
      expect.objectContaining({
        id: "conservative_direct_list",
        aggregate: {
          monthlyRuns: 27,
          monthlyModelCalls: 23,
          p50MonthlyUsd: 1.0906,
          p90MonthlyUsd: 3.1672,
          p50IncludedRemainingUsd: 3.9094,
          p90IncludedRemainingUsd: 1.8328,
          p50WithinIncludedUsage: true,
          p90WithinIncludedUsage: true,
        },
      }),
    ]);
  });

  it("keeps Cash Engine arithmetic on the no-model path", () => {
    const report = evaluateAlphaWorkloadEconomics(proposal, plan);
    const cash = report.scenarios[0]!.estimates.find(
      (estimate) => estimate.workloadId === "cash-runway-decision",
    );

    expect(cash).toMatchObject({
      lane: "no_model",
      provider: null,
      model: null,
      p50: { perRunUsd: 0, monthlyUsd: 0 },
      p90: { perRunUsd: 0, monthlyUsd: 0 },
    });
  });

  it("rejects a synthetic distribution whose P90 is below P50", () => {
    const invalid = structuredClone(plan);
    invalid.workloads[0].usage.p90.inputTokens = 1;

    expect(() => alphaWorkloadEconomicsPlanSchema.parse(invalid))
      .toThrow("P90 usage must not be below P50 usage");
  });

  it("rejects a P90 workload that exceeds its selected candidate request cap", () => {
    const invalid = structuredClone(plan);
    invalid.workloads[0].usage.p90.inputTokens = 26_000;

    expect(() => evaluateAlphaWorkloadEconomics(proposal, invalid))
      .toThrow("P90 usage exceeds the governed candidate limits");
  });

  it("rejects a live proposal that differs from the balanced Scanner route", () => {
    const invalid = structuredClone(plan);
    invalid.firstLiveBenchmarkProposal.model = "google/gemini-3.6-flash";
    invalid.firstLiveBenchmarkProposal.providerModelAllowlist = [
      "google/gemini-3.6-flash",
    ];

    expect(() => evaluateAlphaWorkloadEconomics(proposal, invalid))
      .toThrow("must match the balanced Scanner route");
  });
});
