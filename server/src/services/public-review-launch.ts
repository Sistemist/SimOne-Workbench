import { createHash, randomUUID } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { isIP } from "node:net";
import { z } from "zod";
import { publicWebsiteNetwork } from "./safe-website-evidence.js";
import { PublicVentureReview } from "./public-venture-review.js";
import { loadPrivateReviewMethod } from "./venture-review-method.js";
import { createProviderVentureReviewTransport, VENTURE_REVIEW_WORKING_ROUTE } from "./venture-review-provider.js";
import { publicReviewBudget } from "./public-review-budget.js";
import { readBoundedReviewJson } from "./venture-review-billing-reconciliation.js";

const launchSchema = z.object({
  authorizationId: z.string().min(1).max(120), approvedAt: z.string().datetime(),
  publicOrigin: z.literal("https://app.sysdom.ai"), methodDirectory: z.string(), budgetDirectory: z.string(),
  monthlyCents: z.number().int().positive(), runCents: z.number().int().positive(), maxConcurrent: z.number().int().min(1).max(100),
  trustedProxyAddresses: z.array(z.string().refine(ip => isIP(ip) !== 0)).max(8),
  keySha256: z.string().regex(/^[a-f0-9]{64}$/), accountPrivacyVerifiedAt: z.string().datetime(),
  noPromptLoggingOrTrainingOrBroadcast: z.literal(true),
  // Account credit refills do not enlarge the independently verified monthly key cap.
  accountAutomaticReload: z.enum(["disabled", "pre_existing_enabled"]),
  singleReplicaDedicatedKey: z.literal(true),
}).strict();

/** Inert unless an operator supplies a separately approved launch file AND a dedicated secret.
 * The evaluation key is explicitly forbidden. No keychain lookup or alternate provider exists. */
export async function loadPublicReviewLaunch(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch) {
  const file = env.SYSDOM_PUBLIC_REVIEW_LAUNCH_FILE;
  if (!file) return undefined;
  if (!path.isAbsolute(file)) throw new Error("Explicit launch file required");
  const c = launchSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const now = Date.now();
  const validApproval = () => Date.parse(c.approvedAt) <= Date.now() && Date.parse(c.accountPrivacyVerifiedAt) <= Date.now();
  if (!validApproval() || !path.isAbsolute(c.methodDirectory) || !path.isAbsolute(c.budgetDirectory)) throw new Error("Launch approval invalid or incomplete");
  const balanceFile = env.SYSDOM_PUBLIC_REVIEW_BALANCE_SNAPSHOT_FILE;
  if (balanceFile && !path.isAbsolute(balanceFile)) throw new Error("Absolute balance snapshot path required");
  const keyFile = env.SYSDOM_PUBLIC_REVIEW_API_KEY_FILE;
  if (keyFile && (!path.isAbsolute(keyFile) || env.SYSDOM_PUBLIC_REVIEW_API_KEY)) throw new Error("Use one explicit secret source");
  const key = (keyFile ? await readFile(keyFile, "utf8") : env.SYSDOM_PUBLIC_REVIEW_API_KEY)?.trim();
  if (!key || createHash("sha256").update(key).digest("hex") !== c.keySha256 || c.keySha256 === "a7a424df24ea6de658ccbbe84df7dbe4eafba4a0875a6f4bf1707b56cf51e632") throw new Error("A separately authorized public-service key is required");
  const manifest = JSON.parse(await readFile(path.join(c.methodDirectory, "runtime-2026-10-08/manifest.json"), "utf8"));
  if (manifest.version !== "sim-aulet-local-2026-10-08") throw new Error("Unexpected method version");
  const method = await loadPrivateReviewMethod({ version: manifest.version, status: "provisional_local", corePath: path.join(c.methodDirectory, "01-sim-core.md"), procedurePath: path.join(c.methodDirectory, "runtime-2026-10-08/procedure.md"),
    coreSha256: manifest.artifacts.find((a: { file: string }) => a.file === "01-sim-core.md")?.sha256,
    procedureSha256: manifest.artifacts.find((a: { file: string }) => a.file === "runtime-2026-10-08/procedure.md")?.sha256 });
  const budget = await publicReviewBudget(c.budgetDirectory, { authorizationId: c.authorizationId, monthlyCents: c.monthlyCents, runCents: c.runCents, maxConcurrent: c.maxConcurrent, timeoutMs: 120000 });
  const route = VENTURE_REVIEW_WORKING_ROUTE;
  const keySchema = z.object({ data: z.object({
    limit: z.number().finite().positive(), limit_remaining: z.number().finite().nonnegative(),
    limit_reset: z.literal("monthly"), usage_monthly: z.number().finite().nonnegative(),
    byok_usage: z.literal(0), is_management_key: z.literal(false), disabled: z.literal(false).optional(),
    expires_at: z.string().datetime({ offset: true }).nullable(),
  }) });
  const readKey = async (signal: AbortSignal) => {
    const response = await fetcher("https://openrouter.ai/api/v1/key", { method: "GET", redirect: "error", signal, headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error("Provider cap unavailable");
    const k = keySchema.parse(await readBoundedReviewJson(response, signal, 64000)).data;
    if (k.limit * 100 !== c.monthlyCents || (k.expires_at && Date.parse(k.expires_at) <= Date.now()) ||
        Math.abs(k.limit_remaining - Math.max(0, k.limit - k.usage_monthly)) > 1e-7) throw new Error("Independent monthly cap mismatch");
    return k;
  };
  let auditInFlight: Promise<void> | undefined;
  const audit = () => auditInFlight ??= (async () => {
    const observedMonth = new Date().toISOString().slice(0, 7);
    try { budget.audit((await readKey(AbortSignal.timeout(10000))).usage_monthly, observedMonth); }
    catch { budget.audit(null, observedMonth); }
  })().finally(() => { auditInFlight = undefined; });
  const service = new PublicVentureReview({ mode: "fresh", methodVersion: method.version, maxConcurrent: c.maxConcurrent, websiteNetwork: publicWebsiteNetwork,
    recipients: ["Sysdom.ai", "OpenRouter", "Azure (OpenAI Sol 6.1 High)"],
    retention: "Sysdom keeps your question and review in process memory for at most 15 minutes; cancelling clears the review. No venture record or account is created. Export only if you want a local copy. The configured provider route disallows training/content retention; provider and hosting security/billing metadata may remain. Closing this page does not recall a submitted request.",
    availability: async () => validApproval() ? budget.availability() : "paused",
    transport: () => {
      const controls = budget.controls();
      return createProviderVentureReviewTransport({ mode: "fresh", method, ...route, apiKey: key, fetcher,
        timeoutMs: 120000, maxRunCostCents: c.runCents, providerBudgetCents: c.monthlyCents, publicServiceAuthorizationId: c.authorizationId, claim: controls.claim,
        receipt: async receipt => { await controls.receipt(receipt); void audit(); },
        contract: { version: "sysdom_model_route_execution_v1", policyVersion: "public-review-service-2026-10-08", evaluatedAt: new Date(now).toISOString(),
          portfolio: { revisionId: randomUUID(), version: 1 }, lane: "workhorse", provider: "openrouter", model: route.model, billingType: "metered_api", reasoningEffort: "high", maxOutputTokens: 8192,
          providerRouting: { sort: "price", allowFallbacks: false, requireParameters: true, dataCollection: "deny", zeroDataRetention: true, maxInputTokensPerRequest: 65536, maxInputUsdPerMillion: 2.5, maxOutputUsdPerMillion: 10 } },
        preflight: async (bodySha256, signal) => {
          if (!validApproval()) throw new Error("Service authorization invalid");
          const get = async (url: string, authenticated = false) => {
            const response = await fetcher(url, { method: "GET", redirect: "error", signal, headers: authenticated ? { Authorization: `Bearer ${key}` } : {} });
            if (!response.ok) throw new Error("Provider proof unavailable");
            return await readBoundedReviewJson(response, signal, 8 * 1024 * 1024) as any;
          };
          const endpointData = await get("https://openrouter.ai/api/v1/models/openai/gpt-6.1-sol-20260929/endpoints");
          const matches = endpointData.data?.endpoints?.filter((e: any) => e.tag === "azure" && e.model_id === route.model && e.provider_name === "Azure");
          if (matches?.length !== 1) throw new Error("Exact route unavailable");
          const endpoint = matches[0];
          if (endpoint.status !== 0 || endpoint.name !== "Azure | openai/gpt-6.1-sol-20260929" || endpoint.max_prompt_tokens < 65536 || endpoint.max_completion_tokens < 8192 || endpoint.context_length < 73728 || !endpoint.supported_parameters.includes("max_completion_tokens") || !endpoint.supported_parameters.includes("reasoning")) throw new Error("Route limits changed");
          for (const [field, ceiling] of [["prompt", 2.5], ["input_cache_write", 2.5], ["completion", 10]] as const) {
            const price = Number(endpoint.pricing[field]) * 1e6;
            if (!Number.isFinite(price) || price <= 0 || price > ceiling) throw new Error("Unverified pricing");
          }
          const zdr = await get("https://openrouter.ai/api/v1/endpoints/zdr");
          if (!zdr.data?.some((e: any) => e.tag === "azure" && e.model_id === route.model && e.name === endpoint.name && e.provider_name === "Azure")) throw new Error("Privacy route unavailable");
          const observedMonth = new Date().toISOString().slice(0, 7);
          const k = await readKey(signal);
          budget.audit(k.usage_monthly, observedMonth);
          if (await budget.availability() !== "available" || k.limit_remaining * 100 < c.runCents) throw new Error("Service budget unavailable");
          const verifiedAt = new Date().toISOString(), expiresAt = new Date(Date.now() + 60000).toISOString();
          return { authorizationId: c.authorizationId, bodySha256, verifiedAt, expiresAt, providerTag: "azure", model: route.model, priorBillingReconciled: false,
            endpointEligible: true, noTrainingOrPersistentContent: true, generatedLimitIncludesReasoning: true, inputTokenUpperBound: 65536,
            providerRemainingCents: k.limit_remaining * 100, contextTokens: endpoint.context_length, keySha256: c.keySha256,
            policy: { provider: "openrouter", model: route.model, billingType: "metered_api", maxRuns: 1, maxRetries: 0, concurrency: 1,
              maxRunCostCents: c.runCents, providerHardCapCents: c.monthlyCents, providerHardCapEvidenceSource: "Dedicated monthly provider cap plus atomic concurrent reservations and response-level cost settlement",
              providerHardCapVerifiedAt: verifiedAt, providerHardCapExpiresAt: expiresAt } };
        },
      });
    },
  });
  const balanceSchema = z.object({ source: z.literal("openrouter_account"), balanceUsd: z.number().finite(), observedAt: z.string().datetime() }).strict();
  async function getOperations() {
    await audit(); // Authenticated monitoring refreshes metadata only; never submits a review.
    const snapshot = budget.summary(), lastAudit = snapshot.audit ? JSON.parse(snapshot.audit) : null;
    const actualUsd = snapshot.spent / 1e9, reservedUsd = snapshot.reserved / 1e9;
    const providerObservedUsd = lastAudit?.month === snapshot.month && typeof lastAudit.usageUsd === "number" ? lastAudit.usageUsd as number : null;
    const alerts: { code: string; thresholdUsd?: number }[] = [50, 75, 90].filter(n => Math.max(actualUsd, providerObservedUsd ?? 0) >= n).map(thresholdUsd => ({ code: `model_budget_${thresholdUsd}`, thresholdUsd }));
    let accountBalance: { state: "fresh" | "stale" | "unavailable"; balanceUsd: number | null; observedAt: string | null } = { state: "unavailable", balanceUsd: null, observedAt: null };
    // Account credit reads require management access; only a trusted numeric snapshot crosses this boundary.
    if (balanceFile) try {
      const handle = await open(balanceFile, "r"), buffer = Buffer.alloc(4097);
      let raw: string;
      try { const { bytesRead } = await handle.read(buffer); if (bytesRead > 4096) throw new Error("Oversized balance snapshot"); raw = buffer.subarray(0, bytesRead).toString("utf8"); }
      finally { await handle.close(); }
      const data = balanceSchema.parse(JSON.parse(raw)), age = Date.now() - Date.parse(data.observedAt);
      accountBalance = { state: age >= 0 && age <= 86400000 ? "fresh" : "stale", balanceUsd: data.balanceUsd, observedAt: data.observedAt };
    } catch { /* Report unavailable; never discover or reuse a management key. */ }
    const lowBalanceUsd = Math.max(5, c.maxConcurrent * c.runCents / 100);
    if (accountBalance.state !== "fresh") alerts.push({ code: `account_balance_${accountBalance.state}` });
    else if (accountBalance.balanceUsd! <= lowBalanceUsd) alerts.push({ code: "account_balance_low", thresholdUsd: lowBalanceUsd });
    if (!lastAudit || lastAudit.status === "unavailable") alerts.push({ code: "provider_audit_unavailable" });
    if (snapshot.state === "paused" || snapshot.state === "exhausted") alerts.push({ code: `model_service_${snapshot.state}` });
    return { capturedAt: new Date().toISOString(), state: snapshot.state, service: service.metrics(),
      budget: { month: snapshot.month, monthlyLimitUsd: c.monthlyCents / 100, actualResponseCostUsd: actualUsd, reservedMaximumUsd: reservedUsd,
        committedMaximumUsd: actualUsd + reservedUsd, remainingUnreservedUsd: Math.max(0, c.monthlyCents / 100 - actualUsd - reservedUsd),
        perAttemptMaximumUsd: c.runCents / 100, estimatedDispatchedMaximumUsd: snapshot.attempts.dispatched * c.runCents / 100,
        attempts: snapshot.attempts, providerObservedUsd, providerAudit: lastAudit }, accountBalance, alerts,
      resourceTelemetry: { available: false, reason: "CPU and memory telemetry is not exposed by the existing app health surface" } };
  }
  return { service, publicOrigin: c.publicOrigin, trustedProxyAddresses: c.trustedProxyAddresses, getOperations };
}
