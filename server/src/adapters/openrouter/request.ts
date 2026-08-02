import { createHash } from "node:crypto";
import {
  modelRouteExecutionContractSchema,
  type ModelRouteExecutionContract,
} from "@paperclipai/shared";

export const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_REQUEST_RECEIPT_VERSION =
  "sysdom_openrouter_request_receipt_v1";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface OpenRouterGovernedRequest {
  contract: ModelRouteExecutionContract;
  body: {
    model: string;
    messages: OpenRouterMessage[];
    max_tokens: number;
    temperature: number;
    stream: false;
    provider: {
      sort: "price" | "throughput" | "latency";
      allow_fallbacks: boolean;
      require_parameters: boolean;
      data_collection: "allow" | "deny";
      zdr: boolean;
      max_price: {
        prompt: number;
        completion: number;
      };
    };
  };
  serializedBody: string;
  receipt: {
    version: typeof OPENROUTER_REQUEST_RECEIPT_VERSION;
    endpoint: typeof OPENROUTER_CHAT_COMPLETIONS_URL;
    method: "POST";
    contractVersion: ModelRouteExecutionContract["version"];
    policyVersion: string;
    portfolio: ModelRouteExecutionContract["portfolio"];
    provider: "openrouter";
    model: string;
    bodySha256: string;
    messageBytes: number;
    conservativeInputTokenLimit: number;
    maxOutputTokens: number;
    maxInputUsdPerMillion: number;
    maxOutputUsdPerMillion: number;
    worstCaseCostCents: number;
  };
}

function readPositiveInteger(value: unknown) {
  return typeof value === "number"
    && Number.isInteger(value)
    && value > 0
    ? value
    : null;
}

function readFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function sameIdentity(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function buildOpenRouterGovernedRequest(input: {
  rawContract: unknown;
  configuredProvider: unknown;
  configuredModel: unknown;
  messages: OpenRouterMessage[];
  maxOutputTokens: unknown;
  temperature?: unknown;
  maxRunCostCents: unknown;
}): OpenRouterGovernedRequest {
  const contract = modelRouteExecutionContractSchema.parse(input.rawContract);
  if (!sameIdentity(contract.provider, "openrouter")) {
    throw new Error("configuration incomplete: OpenRouter adapter requires provider=openrouter");
  }
  if (
    typeof input.configuredProvider !== "string"
    || !sameIdentity(input.configuredProvider, contract.provider)
  ) {
    throw new Error("configuration incomplete: OpenRouter provider does not match the governed contract");
  }
  if (
    typeof input.configuredModel !== "string"
    || !sameIdentity(input.configuredModel, contract.model)
  ) {
    throw new Error("configuration incomplete: OpenRouter model does not match the governed contract");
  }
  if (!contract.providerRouting) {
    throw new Error("configuration incomplete: OpenRouter provider-routing controls are missing");
  }

  const maxOutputTokens = readPositiveInteger(input.maxOutputTokens);
  if (!maxOutputTokens || maxOutputTokens > contract.maxOutputTokens) {
    throw new Error(
      "configuration incomplete: maxOutputTokens must be positive and no greater than the governed model limit",
    );
  }
  const maxRunCostCents = readPositiveInteger(input.maxRunCostCents);
  if (!maxRunCostCents) {
    throw new Error("configuration incomplete: governed OpenRouter requests require maxRunCostCents");
  }
  const temperature = readFiniteNumber(input.temperature) ?? 0;
  if (temperature < 0 || temperature > 2) {
    throw new Error("configuration incomplete: OpenRouter temperature must be between 0 and 2");
  }
  if (input.messages.length === 0 || input.messages.some((message) => !message.content.trim())) {
    throw new Error("configuration incomplete: OpenRouter messages must contain non-empty content");
  }

  const providerRouting = contract.providerRouting;
  const messageBytes = Buffer.byteLength(JSON.stringify(input.messages), "utf8");
  if (messageBytes > providerRouting.maxInputTokensPerRequest) {
    throw new Error(
      "configuration incomplete: request exceeds the conservative governed input-token limit",
    );
  }

  const worstCaseCostUsd = (
    providerRouting.maxInputTokensPerRequest
      * providerRouting.maxInputUsdPerMillion
    + maxOutputTokens * providerRouting.maxOutputUsdPerMillion
  ) / 1_000_000;
  const worstCaseCostCents = Math.ceil(worstCaseCostUsd * 100);
  if (worstCaseCostCents > maxRunCostCents) {
    throw new Error(
      "configuration incomplete: governed OpenRouter worst-case request cost exceeds maxRunCostCents",
    );
  }

  const body = {
    model: contract.model,
    messages: input.messages,
    max_tokens: maxOutputTokens,
    temperature,
    stream: false as const,
    provider: {
      sort: providerRouting.sort,
      allow_fallbacks: providerRouting.allowFallbacks,
      require_parameters: providerRouting.requireParameters,
      data_collection: providerRouting.dataCollection,
      zdr: providerRouting.zeroDataRetention,
      max_price: {
        prompt: providerRouting.maxInputUsdPerMillion,
        completion: providerRouting.maxOutputUsdPerMillion,
      },
    },
  };
  const serializedBody = JSON.stringify(body);

  return {
    contract,
    body,
    serializedBody,
    receipt: {
      version: OPENROUTER_REQUEST_RECEIPT_VERSION,
      endpoint: OPENROUTER_CHAT_COMPLETIONS_URL,
      method: "POST",
      contractVersion: contract.version,
      policyVersion: contract.policyVersion,
      portfolio: contract.portfolio,
      provider: "openrouter",
      model: contract.model,
      bodySha256: createHash("sha256").update(serializedBody).digest("hex"),
      messageBytes,
      conservativeInputTokenLimit: providerRouting.maxInputTokensPerRequest,
      maxOutputTokens,
      maxInputUsdPerMillion: providerRouting.maxInputUsdPerMillion,
      maxOutputUsdPerMillion: providerRouting.maxOutputUsdPerMillion,
      worstCaseCostCents,
    },
  };
}
