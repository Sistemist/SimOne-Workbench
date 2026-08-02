import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asNumber, asString, parseObject } from "../utils.js";

function summarize(
  checks: AdapterEnvironmentCheck[],
): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const config = parseObject(ctx.config);
  const env = parseObject(config.env);
  const checks: AdapterEnvironmentCheck[] = [];
  const provider = asString(config.provider, "").trim();
  const model = asString(config.model, "").trim();
  const apiKeyPresent = asString(env.OPENROUTER_API_KEY, "").trim().length > 0;
  const maxOutputTokens = asNumber(config.maxOutputTokens, 0);

  checks.push({
    code: provider === "openrouter"
      ? "openrouter_provider_pinned"
      : "openrouter_provider_invalid",
    level: provider === "openrouter" ? "info" : "error",
    message: provider === "openrouter"
      ? "Provider is pinned to OpenRouter."
      : "OpenRouter adapter requires provider=openrouter.",
  });
  checks.push({
    code: model && !["auto", "default", "unknown"].includes(model.toLowerCase())
      ? "openrouter_model_pinned"
      : "openrouter_model_missing",
    level: model && !["auto", "default", "unknown"].includes(model.toLowerCase())
      ? "info"
      : "error",
    message: model
      ? `Configured exact model: ${model}`
      : "OpenRouter adapter requires an exact model.",
  });
  checks.push({
    code: apiKeyPresent ? "openrouter_key_present" : "openrouter_key_missing",
    level: apiKeyPresent ? "info" : "error",
    message: apiKeyPresent
      ? "OPENROUTER_API_KEY is available through the resolved environment."
      : "OPENROUTER_API_KEY is missing from the resolved environment.",
  });
  checks.push({
    code: Number.isInteger(maxOutputTokens) && maxOutputTokens > 0
      ? "openrouter_output_limit_present"
      : "openrouter_output_limit_missing",
    level: Number.isInteger(maxOutputTokens) && maxOutputTokens > 0
      ? "info"
      : "error",
    message: Number.isInteger(maxOutputTokens) && maxOutputTokens > 0
      ? `Maximum output tokens: ${maxOutputTokens}`
      : "OpenRouter adapter requires a positive maxOutputTokens.",
  });
  checks.push({
    code: "openrouter_live_probe_skipped",
    level: "info",
    message: "No live provider request was made by this environment check.",
  });

  return {
    adapterType: ctx.adapterType,
    status: summarize(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
