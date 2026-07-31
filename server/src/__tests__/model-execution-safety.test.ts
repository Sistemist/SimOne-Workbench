import { describe, expect, it } from "vitest";
import {
  assessModelExecutionSafety,
  modelExecutionReconciliationBlockMessage,
  modelExecutionSafetyBlockMessage,
  modelExecutionSafetyDisablesAutomaticRetries,
  reconcileModelExecution,
} from "../services/model-execution-safety.ts";

describe("model execution safety assessment", () => {
  it("marks legacy routes unverified instead of claiming they are safe", () => {
    const assessment = assessModelExecutionSafety({
      provider: "codex_local",
      model: "adapter-default",
      timeoutSec: 0,
      maxTurnsPerRun: 0,
    });

    expect(assessment).toMatchObject({
      status: "unverified",
      enforced: false,
      billingType: "unknown",
      blockers: ["policy_missing", "model_unpinned"],
    });
  });

  it("accepts a fully pinned and independently capped metered route", () => {
    const assessment = assessModelExecutionSafety({
      provider: "openrouter",
      model: "openai/gpt-oss-120b",
      timeoutSec: 300,
      maxTurnsPerRun: 20,
      maxConcurrentRuns: 1,
      maxDailyRuns: 1,
      policy: {
        billingType: "metered_api",
        provider: "openrouter",
        model: "openai/gpt-oss-120b",
        providerHardCapCents: 500,
        providerHardCapEvidenceSource: "OpenRouter billing settings screenshot",
        providerHardCapVerifiedAt: "2026-07-31T08:00:00.000Z",
        providerHardCapExpiresAt: "2026-08-02T08:00:00.000Z",
        maxRunCostCents: 25,
        maxRuns: 1,
        maxRetries: 0,
        concurrency: 1,
      },
      now: new Date("2026-08-01T08:00:00.000Z"),
    });

    expect(assessment).toMatchObject({
      status: "ready",
      enforced: true,
      billingType: "metered_api",
      provider: "openrouter",
      model: "openai/gpt-oss-120b",
      blockers: [],
      controls: {
        timeoutSec: 300,
        maxTurnsPerRun: 20,
        maxRuns: 1,
        maxRetries: 0,
        concurrency: 1,
        maxRunCostCents: 25,
        providerHardCapCents: 500,
        providerHardCapEvidenceSource: "OpenRouter billing settings screenshot",
        providerHardCapVerifiedAt: "2026-07-31T08:00:00.000Z",
        providerHardCapExpiresAt: "2026-08-02T08:00:00.000Z",
      },
    });
  });

  it("fails closed when a metered route omits caps, timeouts, and bounded execution", () => {
    const assessment = assessModelExecutionSafety({
      provider: "openrouter",
      model: "openai/gpt-oss-120b",
      policy: {
        billingType: "metered_api",
        provider: "openrouter",
        model: "openai/gpt-oss-120b",
        maxRuns: 2,
        maxRetries: 1,
        concurrency: 3,
      },
    });

    expect(assessment.status).toBe("blocked");
    expect(assessment.blockers).toEqual([
      "timeout_missing",
      "max_turns_missing",
      "max_runs_not_one",
      "automatic_retries_enabled",
      "concurrency_not_one",
      "provider_cap_missing",
      "provider_cap_source_missing",
      "provider_cap_verification_missing",
      "provider_cap_expiry_missing",
      "run_cap_missing",
    ]);
    expect(modelExecutionSafetyBlockMessage(assessment)).toContain(
      "provider_cap_missing",
    );
  });

  it("blocks a per-run allowance larger than the verified provider hard cap", () => {
    const assessment = assessModelExecutionSafety({
      provider: "provider-a",
      model: "model-a",
      timeoutSec: 60,
      maxTurnsPerRun: 5,
      maxConcurrentRuns: 1,
      maxDailyRuns: 1,
      policy: {
        billingType: "metered_api",
        provider: "provider-a",
        model: "model-a",
        providerHardCapCents: 100,
        providerHardCapEvidenceSource: "Provider account cap page",
        providerHardCapVerifiedAt: "2026-07-31T08:00:00.000Z",
        providerHardCapExpiresAt: "2026-08-02T08:00:00.000Z",
        maxRunCostCents: 150,
        maxRuns: 1,
        maxRetries: 0,
        concurrency: 1,
      },
      now: new Date("2026-08-01T08:00:00.000Z"),
    });

    expect(assessment.status).toBe("blocked");
    expect(assessment.blockers).toEqual(["run_cap_exceeds_provider_cap"]);
  });

  it("requires verified no-overage evidence for subscription-included routes", () => {
    const assessment = assessModelExecutionSafety({
      provider: "codex_local",
      model: "gpt-5.6",
      timeoutSec: 600,
      maxTurnsPerRun: 20,
      maxConcurrentRuns: 1,
      maxDailyRuns: 1,
      policy: {
        billingType: "subscription_included",
        provider: "codex_local",
        model: "gpt-5.6",
        subscriptionVerifiedAt: "not-a-date",
        meteredOverageAllowed: true,
        maxRuns: 1,
        maxRetries: 0,
        concurrency: 1,
      },
    });

    expect(assessment.status).toBe("blocked");
    expect(assessment.blockers).toEqual([
      "subscription_source_missing",
      "subscription_verification_missing",
      "subscription_expiry_missing",
      "subscription_overage_enabled",
    ]);
  });

  it("fails closed when otherwise complete provider cap evidence has expired", () => {
    const assessment = assessModelExecutionSafety({
      provider: "openrouter",
      model: "openai/gpt-oss-120b",
      timeoutSec: 300,
      maxTurnsPerRun: 20,
      maxConcurrentRuns: 1,
      maxDailyRuns: 1,
      policy: {
        billingType: "metered_api",
        provider: "openrouter",
        model: "openai/gpt-oss-120b",
        providerHardCapCents: 500,
        providerHardCapEvidenceSource: "Provider account cap page",
        providerHardCapVerifiedAt: "2026-07-30T08:00:00.000Z",
        providerHardCapExpiresAt: "2026-07-31T08:00:00.000Z",
        maxRunCostCents: 25,
        maxRuns: 1,
        maxRetries: 0,
        concurrency: 1,
      },
      now: new Date("2026-08-01T08:00:00.000Z"),
    });

    expect(assessment.status).toBe("blocked");
    expect(assessment.blockers).toEqual(["provider_cap_evidence_stale"]);
  });

  it("blocks policy drift from the provider and model selected for execution", () => {
    const assessment = assessModelExecutionSafety({
      provider: "codex_local",
      model: "gpt-5.6",
      timeoutSec: 600,
      maxTurnsPerRun: 20,
      maxConcurrentRuns: 1,
      maxDailyRuns: 1,
      policy: {
        billingType: "local",
        provider: "claude_local",
        model: "claude-opus",
        maxRuns: 1,
        maxRetries: 0,
        concurrency: 1,
      },
    });

    expect(assessment.status).toBe("blocked");
    expect(assessment.blockers).toEqual([
      "provider_policy_mismatch",
      "model_policy_mismatch",
    ]);
  });

  it("only disables automatic retries when an explicit policy sets the limit to zero", () => {
    expect(modelExecutionSafetyDisablesAutomaticRetries(undefined)).toBe(false);
    expect(modelExecutionSafetyDisablesAutomaticRetries({ maxRetries: 1 })).toBe(false);
    expect(modelExecutionSafetyDisablesAutomaticRetries({ maxRetries: 0 })).toBe(true);
  });
});

function readyMeteredAssessment() {
  return assessModelExecutionSafety({
    provider: "openrouter",
    model: "openai/gpt-oss-120b",
    timeoutSec: 300,
    maxTurnsPerRun: 20,
    maxConcurrentRuns: 1,
    maxDailyRuns: 1,
    policy: {
      billingType: "metered_api",
      provider: "openrouter",
      model: "openai/gpt-oss-120b",
      providerHardCapCents: 500,
      providerHardCapEvidenceSource: "OpenRouter billing settings screenshot",
      providerHardCapVerifiedAt: "2026-07-31T08:00:00.000Z",
      providerHardCapExpiresAt: "2026-08-02T08:00:00.000Z",
      maxRunCostCents: 25,
      maxRuns: 1,
      maxRetries: 0,
      concurrency: 1,
    },
    now: new Date("2026-08-01T08:00:00.000Z"),
  });
}

describe("model execution reconciliation", () => {
  it("reconciles the actual provider, model, billing, usage, and cost after a governed run", () => {
    const reconciliation = reconcileModelExecution({
      assessment: readyMeteredAssessment(),
      terminalOutcome: "succeeded",
      provider: "openrouter",
      model: "openai/gpt-oss-120b",
      billingType: "metered_api",
      costUsd: 0.12,
      usage: {
        inputTokens: 1200,
        cachedInputTokens: 100,
        outputTokens: 450,
      },
      reconciledAt: new Date("2026-07-31T09:00:00.000Z"),
    });

    expect(reconciliation).toMatchObject({
      status: "reconciled",
      terminalOutcome: "succeeded",
      blockers: [],
      expected: {
        provider: "openrouter",
        model: "openai/gpt-oss-120b",
        billingType: "metered_api",
        maxRunCostCents: 25,
      },
      actual: {
        provider: "openrouter",
        model: "openai/gpt-oss-120b",
        billingType: "metered_api",
        costKnown: true,
        costCents: 12,
        inputTokens: 1200,
        cachedInputTokens: 100,
        outputTokens: 450,
      },
      reconciledAt: "2026-07-31T09:00:00.000Z",
    });
  });

  it("fails closed when actual routing or metered cost evidence is missing or inconsistent", () => {
    const reconciliation = reconcileModelExecution({
      assessment: readyMeteredAssessment(),
      terminalOutcome: "succeeded",
      provider: "another-provider",
      model: null,
      billingType: "unknown",
      costUsd: null,
    });

    expect(reconciliation.status).toBe("blocked");
    expect(reconciliation.blockers).toEqual([
      "actual_model_missing",
      "actual_provider_mismatch",
      "actual_billing_type_unknown",
      "actual_cost_missing",
    ]);
    expect(modelExecutionReconciliationBlockMessage(reconciliation)).toContain(
      "actual_cost_missing",
    );
  });

  it("blocks actual spend above the authorized per-run allowance", () => {
    const reconciliation = reconcileModelExecution({
      assessment: readyMeteredAssessment(),
      terminalOutcome: "succeeded",
      provider: "openrouter",
      model: "openai/gpt-oss-120b",
      billingType: "metered_api",
      costUsd: 0.26,
    });

    expect(reconciliation.status).toBe("blocked");
    expect(reconciliation.blockers).toEqual(["run_cost_exceeded"]);
    expect(reconciliation.actual.costCents).toBe(26);
  });

  it.each(["cancelled", "timed_out"] as const)(
    "retains %s terminal evidence without scheduling another run when actual usage reconciles",
    (terminalOutcome) => {
      const reconciliation = reconcileModelExecution({
        assessment: readyMeteredAssessment(),
        terminalOutcome,
        provider: "openrouter",
        model: "openai/gpt-oss-120b",
        billingType: "metered_api",
        costUsd: 0.03,
        usage: { inputTokens: 100, outputTokens: 20 },
      });

      expect(reconciliation).toMatchObject({
        status: "reconciled",
        terminalOutcome,
        blockers: [],
        actual: {
          costKnown: true,
          costCents: 3,
          inputTokens: 100,
          outputTokens: 20,
        },
      });
    },
  );
});
