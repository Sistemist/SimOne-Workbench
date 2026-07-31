export const MODEL_EXECUTION_SAFETY_VERSION = "sysdom_model_execution_safety_v1";
export const MODEL_EXECUTION_RECONCILIATION_VERSION = "sysdom_model_execution_reconciliation_v1";

export type ModelExecutionBillingType =
  | "local"
  | "free"
  | "subscription_included"
  | "metered_api"
  | "unknown";

export type ModelExecutionSafetyStatus = "ready" | "blocked" | "unverified";

export type ModelExecutionSafetyBlocker =
  | "policy_missing"
  | "billing_type_unknown"
  | "provider_unpinned"
  | "model_unpinned"
  | "provider_policy_mismatch"
  | "model_policy_mismatch"
  | "timeout_missing"
  | "max_turns_missing"
  | "max_runs_not_one"
  | "automatic_retries_enabled"
  | "concurrency_not_one"
  | "provider_cap_missing"
  | "provider_cap_source_missing"
  | "provider_cap_verification_missing"
  | "provider_cap_expiry_missing"
  | "provider_cap_evidence_stale"
  | "run_cap_missing"
  | "run_cap_exceeds_provider_cap"
  | "subscription_source_missing"
  | "subscription_verification_missing"
  | "subscription_expiry_missing"
  | "subscription_evidence_stale"
  | "subscription_overage_enabled";

export interface ModelExecutionSafetyAssessment {
  version: typeof MODEL_EXECUTION_SAFETY_VERSION;
  source: "heartbeat_pre_dispatch";
  status: ModelExecutionSafetyStatus;
  enforced: boolean;
  billingType: ModelExecutionBillingType;
  provider: string;
  model: string;
  blockers: ModelExecutionSafetyBlocker[];
  controls: {
    timeoutSec: number | null;
    maxTurnsPerRun: number | null;
    maxRuns: number | null;
    maxRetries: number | null;
    concurrency: number | null;
    maxRunCostCents: number | null;
    providerHardCapCents: number | null;
    providerHardCapEvidenceSource: string | null;
    providerHardCapVerifiedAt: string | null;
    providerHardCapExpiresAt: string | null;
    subscriptionEvidenceSource: string | null;
    subscriptionVerifiedAt: string | null;
    subscriptionExpiresAt: string | null;
    meteredOverageAllowed: boolean | null;
  };
}

export interface ModelExecutionSafetyInput {
  provider: string;
  model: string;
  timeoutSec?: unknown;
  maxTurnsPerRun?: unknown;
  maxConcurrentRuns?: unknown;
  maxDailyRuns?: unknown;
  policy?: unknown;
  now?: Date;
}

export type ModelExecutionReconciliationStatus = "reconciled" | "blocked" | "unverified";

export type ModelExecutionReconciliationBlocker =
  | "pre_dispatch_policy_unverified"
  | "actual_provider_missing"
  | "actual_model_missing"
  | "actual_provider_mismatch"
  | "actual_model_mismatch"
  | "actual_billing_type_unknown"
  | "actual_billing_type_mismatch"
  | "actual_cost_missing"
  | "run_cost_exceeded";

export interface ModelExecutionReconciliation {
  version: typeof MODEL_EXECUTION_RECONCILIATION_VERSION;
  source: "heartbeat_post_run";
  status: ModelExecutionReconciliationStatus;
  terminalOutcome: "succeeded" | "failed" | "cancelled" | "timed_out";
  blockers: ModelExecutionReconciliationBlocker[];
  expected: {
    provider: string;
    model: string;
    billingType: ModelExecutionBillingType;
    maxRunCostCents: number | null;
  };
  actual: {
    provider: string | null;
    model: string | null;
    billingType: string;
    costKnown: boolean;
    costCents: number | null;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  };
  reconciledAt: string;
}

export interface ModelExecutionReconciliationInput {
  assessment: ModelExecutionSafetyAssessment;
  terminalOutcome: ModelExecutionReconciliation["terminalOutcome"];
  provider?: unknown;
  model?: unknown;
  billingType?: unknown;
  costUsd?: unknown;
  usage?: {
    inputTokens?: unknown;
    cachedInputTokens?: unknown;
    outputTokens?: unknown;
  } | null;
  reconciledAt?: Date;
}

const BILLING_TYPES = new Set<ModelExecutionBillingType>([
  "local",
  "free",
  "subscription_included",
  "metered_api",
  "unknown",
]);

const UNPINNED_VALUES = new Set([
  "",
  "adapter-default",
  "auto",
  "automatic",
  "default",
  "unknown",
]);

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readNonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function readNonNegativeIntegerOrZero(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function readIsoDate(value: unknown): string | null {
  const text = readString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readBillingType(value: unknown): ModelExecutionBillingType {
  const normalized = readString(value) as ModelExecutionBillingType | null;
  return normalized && BILLING_TYPES.has(normalized) ? normalized : "unknown";
}

function isPinned(value: string) {
  return !UNPINNED_VALUES.has(value.trim().toLowerCase());
}

export function assessModelExecutionSafety(
  input: ModelExecutionSafetyInput,
): ModelExecutionSafetyAssessment {
  const provider = input.provider.trim();
  const model = input.model.trim();
  const policy = readObject(input.policy);
  const enforced = policy !== null;
  const billingType = readBillingType(policy?.billingType);
  const timeoutSec = readPositiveInteger(input.timeoutSec);
  const maxTurnsPerRun = readPositiveInteger(input.maxTurnsPerRun);
  const policyMaxRuns = readPositiveInteger(policy?.maxRuns);
  const maxRuns = readPositiveInteger(input.maxDailyRuns);
  const maxRetries = readNonNegativeInteger(policy?.maxRetries);
  const policyConcurrency = readPositiveInteger(policy?.concurrency);
  const concurrency = readPositiveInteger(input.maxConcurrentRuns);
  const maxRunCostCents = readPositiveInteger(policy?.maxRunCostCents);
  const providerHardCapCents = readPositiveInteger(policy?.providerHardCapCents);
  const providerHardCapEvidenceSource = readString(policy?.providerHardCapEvidenceSource);
  const providerHardCapVerifiedAt = readIsoDate(policy?.providerHardCapVerifiedAt);
  const providerHardCapExpiresAt = readIsoDate(policy?.providerHardCapExpiresAt);
  const subscriptionEvidenceSource = readString(policy?.subscriptionEvidenceSource);
  const subscriptionVerifiedAt = readIsoDate(policy?.subscriptionVerifiedAt);
  const subscriptionExpiresAt = readIsoDate(policy?.subscriptionExpiresAt);
  const meteredOverageAllowed = readBoolean(policy?.meteredOverageAllowed);
  const policyProvider = readString(policy?.provider);
  const policyModel = readString(policy?.model);
  const blockers: ModelExecutionSafetyBlocker[] = [];

  if (!policy) {
    blockers.push("policy_missing");
  }
  if (!isPinned(provider)) {
    blockers.push("provider_unpinned");
  }
  if (!isPinned(model)) {
    blockers.push("model_unpinned");
  }

  if (policy) {
    if (billingType === "unknown") blockers.push("billing_type_unknown");
    if (!policyProvider || policyProvider !== provider) blockers.push("provider_policy_mismatch");
    if (!policyModel || policyModel !== model) blockers.push("model_policy_mismatch");
    if (timeoutSec === null) blockers.push("timeout_missing");
    if (maxTurnsPerRun === null) blockers.push("max_turns_missing");
    if (policyMaxRuns !== 1 || maxRuns !== 1) blockers.push("max_runs_not_one");
    if (maxRetries !== 0) blockers.push("automatic_retries_enabled");
    if (policyConcurrency !== 1 || concurrency !== 1) blockers.push("concurrency_not_one");

    if (billingType === "metered_api") {
      if (providerHardCapCents === null) blockers.push("provider_cap_missing");
      if (providerHardCapEvidenceSource === null) blockers.push("provider_cap_source_missing");
      if (providerHardCapVerifiedAt === null) blockers.push("provider_cap_verification_missing");
      if (providerHardCapExpiresAt === null) blockers.push("provider_cap_expiry_missing");
      if (
        providerHardCapExpiresAt !== null &&
        new Date(providerHardCapExpiresAt).getTime() <= (input.now ?? new Date()).getTime()
      ) {
        blockers.push("provider_cap_evidence_stale");
      }
      if (maxRunCostCents === null) blockers.push("run_cap_missing");
      if (
        maxRunCostCents !== null &&
        providerHardCapCents !== null &&
        maxRunCostCents > providerHardCapCents
      ) {
        blockers.push("run_cap_exceeds_provider_cap");
      }
    }

    if (billingType === "subscription_included") {
      if (subscriptionEvidenceSource === null) blockers.push("subscription_source_missing");
      if (subscriptionVerifiedAt === null) blockers.push("subscription_verification_missing");
      if (subscriptionExpiresAt === null) blockers.push("subscription_expiry_missing");
      if (
        subscriptionExpiresAt !== null &&
        new Date(subscriptionExpiresAt).getTime() <= (input.now ?? new Date()).getTime()
      ) {
        blockers.push("subscription_evidence_stale");
      }
      if (meteredOverageAllowed !== false) blockers.push("subscription_overage_enabled");
    }
  }

  return {
    version: MODEL_EXECUTION_SAFETY_VERSION,
    source: "heartbeat_pre_dispatch",
    status: !enforced ? "unverified" : blockers.length === 0 ? "ready" : "blocked",
    enforced,
    billingType,
    provider,
    model,
    blockers,
    controls: {
      timeoutSec,
      maxTurnsPerRun,
      maxRuns,
      maxRetries,
      concurrency,
      maxRunCostCents,
      providerHardCapCents,
      providerHardCapEvidenceSource,
      providerHardCapVerifiedAt,
      providerHardCapExpiresAt,
      subscriptionEvidenceSource,
      subscriptionVerifiedAt,
      subscriptionExpiresAt,
      meteredOverageAllowed,
    },
  };
}

export function modelExecutionSafetyDisablesAutomaticRetries(policy: unknown) {
  const parsed = readObject(policy);
  return parsed !== null && readNonNegativeInteger(parsed.maxRetries) === 0;
}

export function modelExecutionSafetyBlockMessage(
  assessment: ModelExecutionSafetyAssessment,
) {
  return `model execution safety gate blocked provider invocation: ${assessment.blockers.join(", ")}`;
}

function billingTypesMatch(
  expected: ModelExecutionBillingType,
  actual: string,
) {
  if (expected === "metered_api") return actual === "metered_api";
  if (expected === "subscription_included") return actual === "subscription_included";
  if (expected === "local") return actual === "fixed";
  if (expected === "free") return actual === "credits" || actual === "fixed";
  return false;
}

export function reconcileModelExecution(
  input: ModelExecutionReconciliationInput,
): ModelExecutionReconciliation {
  const actualProvider = readString(input.provider);
  const actualModel = readString(input.model);
  const actualBillingType = readString(input.billingType) ?? "unknown";
  const costUsd = readNonNegativeNumber(input.costUsd);
  const costCents = costUsd === null ? null : Math.round(costUsd * 100);
  const blockers: ModelExecutionReconciliationBlocker[] = [];

  if (!input.assessment.enforced || input.assessment.status !== "ready") {
    blockers.push("pre_dispatch_policy_unverified");
  } else {
    if (!actualProvider) blockers.push("actual_provider_missing");
    if (!actualModel) blockers.push("actual_model_missing");
    if (actualProvider && actualProvider !== input.assessment.provider) {
      blockers.push("actual_provider_mismatch");
    }
    if (actualModel && actualModel !== input.assessment.model) {
      blockers.push("actual_model_mismatch");
    }
    if (actualBillingType === "unknown") {
      blockers.push("actual_billing_type_unknown");
    } else if (!billingTypesMatch(input.assessment.billingType, actualBillingType)) {
      blockers.push("actual_billing_type_mismatch");
    }
    if (input.assessment.billingType === "metered_api" && costCents === null) {
      blockers.push("actual_cost_missing");
    }
    if (
      costCents !== null &&
      input.assessment.controls.maxRunCostCents !== null &&
      costCents > input.assessment.controls.maxRunCostCents
    ) {
      blockers.push("run_cost_exceeded");
    }
  }

  return {
    version: MODEL_EXECUTION_RECONCILIATION_VERSION,
    source: "heartbeat_post_run",
    status: !input.assessment.enforced || input.assessment.status !== "ready"
      ? "unverified"
      : blockers.length === 0
        ? "reconciled"
        : "blocked",
    terminalOutcome: input.terminalOutcome,
    blockers,
    expected: {
      provider: input.assessment.provider,
      model: input.assessment.model,
      billingType: input.assessment.billingType,
      maxRunCostCents: input.assessment.controls.maxRunCostCents,
    },
    actual: {
      provider: actualProvider,
      model: actualModel,
      billingType: actualBillingType,
      costKnown: costCents !== null,
      costCents,
      inputTokens: readNonNegativeIntegerOrZero(input.usage?.inputTokens),
      cachedInputTokens: readNonNegativeIntegerOrZero(input.usage?.cachedInputTokens),
      outputTokens: readNonNegativeIntegerOrZero(input.usage?.outputTokens),
    },
    reconciledAt: (input.reconciledAt ?? new Date()).toISOString(),
  };
}

export function modelExecutionReconciliationBlockMessage(
  reconciliation: ModelExecutionReconciliation,
) {
  return `model execution reconciliation blocked further automatic execution: ${reconciliation.blockers.join(", ")}`;
}
