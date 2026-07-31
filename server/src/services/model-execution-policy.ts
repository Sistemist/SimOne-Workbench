import type { UpdateModelExecutionPolicy } from "@paperclipai/shared";
import {
  assessModelExecutionSafety,
  type ModelExecutionSafetyAssessment,
} from "./model-execution-safety.js";

interface ModelExecutionPolicyAgent {
  id: string;
  name: string;
  status: string;
  adapterType: string;
  adapterConfig: unknown;
  runtimeConfig: unknown;
}

export interface ModelExecutionPolicySnapshot {
  agentId: string;
  agentName: string;
  agentStatus: string;
  adapterType: string;
  policy: UpdateModelExecutionPolicy;
  assessment: ModelExecutionSafetyAssessment;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readBillingType(value: unknown): UpdateModelExecutionPolicy["billingType"] {
  return [
    "local",
    "free",
    "subscription_included",
    "metered_api",
    "unknown",
  ].includes(String(value))
    ? value as UpdateModelExecutionPolicy["billingType"]
    : "unknown";
}

function policyFromAgent(
  agent: ModelExecutionPolicyAgent,
): UpdateModelExecutionPolicy {
  const adapterConfig = readObject(agent.adapterConfig);
  const rawPolicy = readObject(adapterConfig.modelExecutionSafety);

  return {
    provider: readString(adapterConfig.provider) ?? agent.adapterType,
    model: readString(adapterConfig.model) ?? "adapter-default",
    billingType: readBillingType(rawPolicy.billingType),
    timeoutSec: readPositiveInteger(adapterConfig.timeoutSec) ?? 300,
    maxTurnsPerRun: readPositiveInteger(adapterConfig.maxTurnsPerRun) ?? 20,
    maxRuns: 1,
    maxRetries: 0,
    concurrency: 1,
    maxRunCostCents: readPositiveInteger(rawPolicy.maxRunCostCents),
    providerHardCapCents: readPositiveInteger(rawPolicy.providerHardCapCents),
    providerHardCapEvidenceSource: readString(rawPolicy.providerHardCapEvidenceSource),
    providerHardCapVerifiedAt: readString(rawPolicy.providerHardCapVerifiedAt),
    providerHardCapExpiresAt: readString(rawPolicy.providerHardCapExpiresAt),
    subscriptionEvidenceSource: readString(rawPolicy.subscriptionEvidenceSource),
    subscriptionVerifiedAt: readString(rawPolicy.subscriptionVerifiedAt),
    subscriptionExpiresAt: readString(rawPolicy.subscriptionExpiresAt),
    meteredOverageAllowed: readBoolean(rawPolicy.meteredOverageAllowed) ?? false,
  };
}

export function modelExecutionPolicySnapshot(
  agent: ModelExecutionPolicyAgent,
  now = new Date(),
): ModelExecutionPolicySnapshot {
  const adapterConfig = readObject(agent.adapterConfig);
  const runtimeConfig = readObject(agent.runtimeConfig);
  const heartbeat = readObject(runtimeConfig.heartbeat);
  const policy = policyFromAgent(agent);

  return {
    agentId: agent.id,
    agentName: agent.name,
    agentStatus: agent.status,
    adapterType: agent.adapterType,
    policy,
    assessment: assessModelExecutionSafety({
      provider: policy.provider,
      model: policy.model,
      timeoutSec: adapterConfig.timeoutSec,
      maxTurnsPerRun: adapterConfig.maxTurnsPerRun,
      maxConcurrentRuns: heartbeat.maxConcurrentRuns,
      maxDailyRuns: heartbeat.maxDailyRuns,
      policy: adapterConfig.modelExecutionSafety,
      now,
    }),
  };
}

export function buildModelExecutionPolicyPatch(
  agent: Pick<ModelExecutionPolicyAgent, "adapterConfig" | "runtimeConfig">,
  input: UpdateModelExecutionPolicy,
) {
  const adapterConfig = readObject(agent.adapterConfig);
  const runtimeConfig = readObject(agent.runtimeConfig);
  const heartbeat = readObject(runtimeConfig.heartbeat);

  return {
    adapterConfig: {
      ...adapterConfig,
      provider: input.provider,
      model: input.model,
      timeoutSec: input.timeoutSec,
      maxTurnsPerRun: input.maxTurnsPerRun,
      modelExecutionSafety: {
        billingType: input.billingType,
        provider: input.provider,
        model: input.model,
        maxRuns: input.maxRuns,
        maxRetries: input.maxRetries,
        concurrency: input.concurrency,
        maxRunCostCents: input.maxRunCostCents,
        providerHardCapCents: input.providerHardCapCents,
        providerHardCapEvidenceSource: input.providerHardCapEvidenceSource,
        providerHardCapVerifiedAt: input.providerHardCapVerifiedAt,
        providerHardCapExpiresAt: input.providerHardCapExpiresAt,
        subscriptionEvidenceSource: input.subscriptionEvidenceSource,
        subscriptionVerifiedAt: input.subscriptionVerifiedAt,
        subscriptionExpiresAt: input.subscriptionExpiresAt,
        meteredOverageAllowed: input.meteredOverageAllowed,
      },
    },
    runtimeConfig: {
      ...runtimeConfig,
      heartbeat: {
        ...heartbeat,
        maxConcurrentRuns: input.concurrency,
        maxDailyRuns: input.maxRuns,
      },
    },
  };
}
