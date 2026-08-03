import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "../types.js";
import {
  asNumber,
  asString,
  parseObject,
} from "../utils.js";
import {
  renderPaperclipWakePrompt,
} from "@paperclipai/adapter-utils/server-utils";
import {
  buildOpenRouterGovernedRequest,
  OPENROUTER_CHAT_COMPLETIONS_URL,
} from "./request.js";

function buildMessages(ctx: AdapterExecutionContext) {
  const config = parseObject(ctx.config);
  const context = parseObject(ctx.context);
  const systemPrompt = asString(
    config.systemPrompt,
    `You are ${ctx.agent.name}, working inside a founder-governed Sysdom AI run. Return a concise, evidence-aware result and do not perform external side effects.`,
  );
  const explicitPrompt = asString(config.prompt, "").trim();
  const wakePrompt = renderPaperclipWakePrompt(context.paperclipWake).trim();
  const taskMarkdown = asString(context.paperclipTaskMarkdown, "").trim();
  const handoffMarkdown = asString(
    context.paperclipSessionHandoffMarkdown,
    "",
  ).trim();
  const userPrompt = [
    explicitPrompt,
    wakePrompt,
    taskMarkdown,
    handoffMarkdown,
  ].filter(Boolean).join("\n\n---\n\n");

  if (!userPrompt) {
    throw new Error(
      "configuration incomplete: OpenRouter adapter requires a prompt or structured Paperclip task context",
    );
  }

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];
}

function readOpenRouterApiKey(config: Record<string, unknown>) {
  const env = parseObject(config.env);
  return asString(env.OPENROUTER_API_KEY, "").trim();
}

function readStructuredResponseFormat(config: Record<string, unknown>) {
  if (config.responseFormat === undefined) return undefined;
  const responseFormat = parseObject(config.responseFormat);
  const name = asString(responseFormat.name, "").trim();
  const schema = parseObject(responseFormat.schema);
  if (!name || Object.keys(schema).length === 0) {
    throw new Error(
      "configuration incomplete: OpenRouter structured response format requires a name and JSON schema",
    );
  }
  return { name, schema };
}

function readResponseContent(payload: Record<string, unknown>) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = parseObject(choices[0]);
  const message = parseObject(first.message);
  return asString(message.content, "").trim();
}

function readUsage(payload: Record<string, unknown>) {
  const usage = parseObject(payload.usage);
  const promptDetails = parseObject(usage.prompt_tokens_details);
  return {
    inputTokens: Math.max(0, Math.trunc(asNumber(usage.prompt_tokens, 0))),
    outputTokens: Math.max(0, Math.trunc(asNumber(usage.completion_tokens, 0))),
    cachedInputTokens: Math.max(
      0,
      Math.trunc(asNumber(promptDetails.cached_tokens, 0)),
    ),
    costUsd: typeof usage.cost === "number"
      && Number.isFinite(usage.cost)
      && usage.cost >= 0
      ? usage.cost
      : null,
  };
}

export async function execute(
  ctx: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const config = parseObject(ctx.config);
  const apiKey = readOpenRouterApiKey(config);
  if (!apiKey) {
    throw new Error(
      "configuration incomplete: OpenRouter adapter requires env.OPENROUTER_API_KEY",
    );
  }

  const policy = parseObject(config.modelExecutionSafety);
  const request = buildOpenRouterGovernedRequest({
    rawContract: config.modelRouteExecution,
    configuredProvider: config.provider,
    configuredModel: config.model,
    messages: buildMessages(ctx),
    maxOutputTokens: config.maxOutputTokens,
    temperature: config.temperature,
    maxRunCostCents: policy.maxRunCostCents,
    responseFormat: readStructuredResponseFormat(config),
  });
  await ctx.onMeta?.({
    adapterType: "openrouter",
    command: `POST ${OPENROUTER_CHAT_COMPLETIONS_URL}`,
    context: {
      modelRouteRequest: request.receipt,
    },
  });

  const rawTimeoutSec = asNumber(config.timeoutSec, 0);
  if (
    !Number.isFinite(rawTimeoutSec)
    || !Number.isInteger(rawTimeoutSec)
    || rawTimeoutSec <= 0
  ) {
    throw new Error(
      "configuration incomplete: OpenRouter adapter requires a positive timeoutSec",
    );
  }
  const timeoutSec = rawTimeoutSec;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1_000);

  try {
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sysdom.ai",
        "X-OpenRouter-Title": "Sysdom AI",
      },
      body: request.serializedBody,
      signal: controller.signal,
    });
    const rawPayload = await response.json().catch(() => ({}));
    const payload = parseObject(rawPayload);

    if (!response.ok) {
      const error = parseObject(payload.error);
      const message = asString(error.message, `HTTP ${response.status}`);
      throw new Error(
        `OpenRouter request failed with status ${response.status}: ${message.slice(0, 500)}`,
      );
    }

    const responseModel = asString(payload.model, "").trim();
    if (!responseModel || responseModel.toLowerCase() !== request.contract.model.toLowerCase()) {
      throw new Error(
        "OpenRouter response model did not match the governed exact model",
      );
    }
    const content = readResponseContent(payload);
    if (!content) {
      throw new Error("OpenRouter response did not contain assistant content");
    }
    const usage = readUsage(payload);
    await ctx.onLog("stdout", `${content}\n`);

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      provider: "openrouter",
      biller: "openrouter",
      model: responseModel,
      billingType: "metered_api",
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cachedInputTokens: usage.cachedInputTokens,
      },
      costUsd: usage.costUsd,
      summary: content,
      resultJson: {
        modelRouteRequest: request.receipt,
        openRouter: {
          responseId: asString(payload.id, "") || null,
          responseModel,
          upstreamProvider: asString(payload.provider, "") || null,
        },
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        exitCode: null,
        signal: null,
        timedOut: true,
        errorCode: "timeout",
        errorMessage: `OpenRouter request timed out after ${timeoutSec}s`,
        provider: "openrouter",
        biller: "openrouter",
        model: request.contract.model,
        billingType: "metered_api",
        resultJson: {
          modelRouteRequest: request.receipt,
        },
      };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
