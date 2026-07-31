export const MODEL_EXECUTION_SAFETY_VERSION = "sysdom_model_execution_safety_v1";

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
  | "provider_cap_verification_missing"
  | "run_cap_missing"
  | "run_cap_exceeds_provider_cap"
  | "subscription_verification_missing"
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
    providerHardCapVerifiedAt: string | null;
    subscriptionVerifiedAt: string | null;
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
  const providerHardCapVerifiedAt = readIsoDate(policy?.providerHardCapVerifiedAt);
  const subscriptionVerifiedAt = readIsoDate(policy?.subscriptionVerifiedAt);
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
      if (providerHardCapVerifiedAt === null) blockers.push("provider_cap_verification_missing");
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
      if (subscriptionVerifiedAt === null) blockers.push("subscription_verification_missing");
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
      providerHardCapVerifiedAt,
      subscriptionVerifiedAt,
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
