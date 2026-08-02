import type {
  AdapterConfigSchema,
  ServerAdapterModule,
} from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

function getConfigSchema(): AdapterConfigSchema {
  return {
    fields: [
      {
        key: "provider",
        label: "Provider",
        type: "text",
        default: "openrouter",
        hint: "Governed OpenRouter execution requires this exact provider.",
      },
      {
        key: "model",
        label: "Exact model",
        type: "text",
        hint: "Must match the active founder-approved model portfolio.",
      },
      {
        key: "maxOutputTokens",
        label: "Maximum output tokens",
        type: "number",
        hint: "Must not exceed the active candidate catalog limit.",
      },
      {
        key: "temperature",
        label: "Temperature",
        type: "number",
        default: 0,
      },
      {
        key: "timeoutSec",
        label: "Timeout seconds",
        type: "number",
        default: 120,
      },
      {
        key: "systemPrompt",
        label: "System prompt",
        type: "textarea",
        hint: "Optional governed role guidance.",
      },
    ],
  };
}

export const openRouterAdapter: ServerAdapterModule = {
  type: "openrouter",
  execute,
  testEnvironment,
  getConfigSchema,
  models: [],
  agentConfigurationDoc: `# governed OpenRouter agent configuration

Adapter: openrouter

This adapter only runs with an active Sysdom model portfolio and a matching
sysdom_model_route_execution_v1 contract. It sends the exact model plus the
contract's price, fallback, parameter, data-collection, and ZDR controls in the
OpenRouter request body. It never uses OpenRouter Auto.

Required fields:
- provider: openrouter
- model: exact OpenRouter model id
- maxOutputTokens: positive output cap within the candidate catalog limit
- timeoutSec: bounded request timeout
- env.OPENROUTER_API_KEY: resolved secret binding
- modelExecutionSafety: governed concurrency, retry, run-cost, and provider-cap controls
`,
};
