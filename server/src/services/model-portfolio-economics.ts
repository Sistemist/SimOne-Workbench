import { z } from "zod";
import {
  modelPortfolioResearchProposalSchema,
  modelRouteRecommendationInputSchema,
  type ModelRouteCandidate,
} from "@paperclipai/shared";
import { unprocessable } from "../errors.js";
import { estimateModelCandidateTextCostUsd } from "./model-portfolio.js";
import { recommendModelRoute } from "./model-route-recommendation.js";

const usageEnvelopeSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
}).strict().superRefine((usage, ctx) => {
  if (usage.cachedInputTokens > usage.inputTokens) {
    ctx.addIssue({
      code: "custom",
      message: "Cached input tokens cannot exceed total input tokens",
      path: ["cachedInputTokens"],
    });
  }
});

const priceOverrideSchema = z.object({
  model: z.string().trim().min(1).max(300),
  inputUsd: z.number().nonnegative(),
  outputUsd: z.number().nonnegative(),
  cachedInputUsd: z.number().nonnegative().nullable(),
}).strict();

const firstLiveBenchmarkProposalSchema = z.object({
  status: z.literal("requires_explicit_approval"),
  provider: z.string().trim().min(1).max(200),
  model: z.string().trim().min(1).max(300),
  purpose: z.string().trim().min(1).max(2_000),
  reasoningEffort: z.enum([
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ]),
  maxInputTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  maxRunCostCents: z.number().int().positive().max(100),
  providerKeyLimitUsd: z.number().positive().max(100),
  providerKeyLimitReset: z.enum(["daily", "weekly", "monthly"]).nullable(),
  providerModelAllowlist: z.array(z.string().trim().min(1).max(300)).min(1).max(20),
  maxTurns: z.literal(1),
  timeoutSec: z.number().int().positive().max(300),
  maxRuns: z.literal(1),
  automaticRetries: z.literal(0),
  concurrency: z.literal(1),
}).strict().superRefine((proposal, ctx) => {
  if (!proposal.providerModelAllowlist.includes(proposal.model)) {
    ctx.addIssue({
      code: "custom",
      message: "The live benchmark model must be present in the provider allowlist",
      path: ["providerModelAllowlist"],
    });
  }
});

export const alphaWorkloadEconomicsPlanSchema = z.object({
  version: z.literal("sysdom_alpha_workload_economics_v1"),
  status: z.literal("synthetic_planning"),
  assumptionsAsOf: z.string().datetime(),
  posture: z.enum(["cost_conscious", "balanced", "quality_first"]),
  includedUsageUsd: z.number().positive(),
  description: z.string().trim().min(1).max(2_000),
  exclusions: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20),
  firstLiveBenchmarkProposal: firstLiveBenchmarkProposalSchema,
  priceScenarios: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(500),
    overrides: z.array(priceOverrideSchema).max(100),
  }).strict()).min(1).max(20),
  workloads: z.array(z.object({
    id: z.string().trim().min(1).max(200),
    label: z.string().trim().min(1).max(500),
    monthlyRuns: z.number().int().positive().max(10_000),
    activeEngine: z.enum(["product", "customer", "cash", "skills"]).nullable(),
    task: modelRouteRecommendationInputSchema.shape.task,
    usage: z.object({
      p50: usageEnvelopeSchema,
      p90: usageEnvelopeSchema,
    }).strict(),
  }).strict()).min(1).max(100),
}).strict().superRefine((plan, ctx) => {
  const scenarioIds = new Set<string>();
  plan.priceScenarios.forEach((scenario, scenarioIndex) => {
    if (scenarioIds.has(scenario.id)) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate price scenario id",
        path: ["priceScenarios", scenarioIndex, "id"],
      });
    }
    scenarioIds.add(scenario.id);
    const models = new Set<string>();
    scenario.overrides.forEach((override, overrideIndex) => {
      if (models.has(override.model)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate model price override",
          path: ["priceScenarios", scenarioIndex, "overrides", overrideIndex, "model"],
        });
      }
      models.add(override.model);
    });
  });

  const workloadIds = new Set<string>();
  plan.workloads.forEach((workload, index) => {
    if (workloadIds.has(workload.id)) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate workload id",
        path: ["workloads", index, "id"],
      });
    }
    workloadIds.add(workload.id);
    if (
      workload.usage.p90.inputTokens < workload.usage.p50.inputTokens
      || workload.usage.p90.outputTokens < workload.usage.p50.outputTokens
    ) {
      ctx.addIssue({
        code: "custom",
        message: "P90 usage must not be below P50 usage",
        path: ["workloads", index, "usage", "p90"],
      });
    }
  });
});

export type AlphaWorkloadEconomicsPlan = z.infer<
  typeof alphaWorkloadEconomicsPlanSchema
>;

export interface AlphaWorkloadEconomicsEstimate {
  workloadId: string;
  label: string;
  lane: string;
  provider: string | null;
  model: string | null;
  monthlyRuns: number;
  pricing: {
    inputUsd: number;
    outputUsd: number;
    cachedInputUsd: number | null;
  } | null;
  p50: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    perRunUsd: number;
    monthlyUsd: number;
  };
  p90: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    perRunUsd: number;
    monthlyUsd: number;
  };
}

export interface AlphaWorkloadEconomicsReport {
  version: "sysdom_alpha_workload_economics_report_v1";
  evidenceClass: "synthetic_planning";
  assumptionsAsOf: string;
  posture: AlphaWorkloadEconomicsPlan["posture"];
  includedUsageUsd: number;
  activationAttempted: false;
  providerDispatchAttempted: false;
  exclusions: string[];
  firstLiveBenchmarkProposal: AlphaWorkloadEconomicsPlan["firstLiveBenchmarkProposal"] & {
    worstCaseCostCents: number;
    executionAuthorized: false;
    blockers: [
      "explicit_user_approval_missing",
      "provider_key_limit_not_verified",
      "provider_key_not_attached",
      "live_cost_not_reconciled",
    ];
  };
  selectedRoutes: Array<{
    lane: string;
    provider: string;
    model: string;
  }>;
  scenarios: Array<{
    id: string;
    label: string;
    estimates: AlphaWorkloadEconomicsEstimate[];
    aggregate: {
      monthlyRuns: number;
      monthlyModelCalls: number;
      p50MonthlyUsd: number;
      p90MonthlyUsd: number;
      p50IncludedRemainingUsd: number;
      p90IncludedRemainingUsd: number;
      p50WithinIncludedUsage: boolean;
      p90WithinIncludedUsage: boolean;
    };
  }>;
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function withPriceOverride(
  candidate: ModelRouteCandidate,
  override: z.infer<typeof priceOverrideSchema> | undefined,
) {
  if (!override) return candidate;
  if (!candidate.catalog) {
    throw unprocessable(`Cannot override missing pricing for ${candidate.model}`);
  }
  return {
    ...candidate,
    catalog: {
      ...candidate.catalog,
      pricing: {
        ...candidate.catalog.pricing,
        inputUsd: override.inputUsd,
        outputUsd: override.outputUsd,
        cachedInputUsd: override.cachedInputUsd,
      },
    },
  };
}

function estimateUsage(
  candidate: ModelRouteCandidate | null,
  usage: z.infer<typeof usageEnvelopeSchema>,
  monthlyRuns: number,
) {
  const perRunUsd = candidate
    ? estimateModelCandidateTextCostUsd(candidate, usage)
    : 0;
  if (perRunUsd === null) {
    throw unprocessable(`Catalog pricing is missing for ${candidate?.model ?? "unknown model"}`);
  }
  return {
    ...usage,
    perRunUsd,
    monthlyUsd: roundUsd(perRunUsd * monthlyRuns),
  };
}

export function evaluateAlphaWorkloadEconomics(
  rawProposal: unknown,
  rawPlan: unknown,
): AlphaWorkloadEconomicsReport {
  const proposal = modelPortfolioResearchProposalSchema.parse(rawProposal);
  const plan = alphaWorkloadEconomicsPlanSchema.parse(rawPlan);
  const selectedByWorkload = new Map<string, {
    lane: string;
    candidate: ModelRouteCandidate | null;
  }>();

  for (const workload of plan.workloads) {
    const recommendation = recommendModelRoute({
      policyVersion: "sysdom-auto-alpha-economics-v1",
      evaluatedAt: plan.assumptionsAsOf,
      posture: plan.posture,
      portfolio: {
        revisionId: "55555555-5555-4555-8555-555555555555",
        version: 1,
      },
      task: workload.task,
      simContext: {
        projectionId: "22222222-2222-4222-8222-222222222222",
        projectionVersion: 1,
        constitutionRevisionId: "33333333-3333-4333-8333-333333333333",
        activeEngine: workload.activeEngine,
        activeConstraintDecision: "accepted",
        nextMoveApprovalRequired: workload.task.approvalRequired,
        approvalBoundaries: [],
      },
      candidates: proposal.candidates,
    });
    if (recommendation.status === "blocked") {
      throw unprocessable(
        `Economics route is blocked for ${workload.id}: ${recommendation.reason}`,
      );
    }
    if (
      recommendation.selectedCandidate?.catalog
      && (
        workload.usage.p90.inputTokens
          > recommendation.selectedCandidate.catalog.providerRouting.maxInputTokensPerRequest
        || workload.usage.p90.outputTokens
          > recommendation.selectedCandidate.catalog.maxOutputTokens
      )
    ) {
      throw unprocessable(
        `P90 usage exceeds the governed candidate limits for ${workload.id}`,
      );
    }
    selectedByWorkload.set(workload.id, {
      lane: recommendation.lane,
      candidate: recommendation.selectedCandidate,
    });
  }

  const selectedRoutes = [...new Map(
    [...selectedByWorkload.values()]
      .filter((selection) => selection.candidate)
      .map((selection) => {
        const candidate = selection.candidate!;
        return [
          `${selection.lane}/${candidate.provider}/${candidate.model}`,
          {
            lane: selection.lane,
            provider: candidate.provider,
            model: candidate.model,
          },
        ] as const;
      }),
  ).values()];

  const liveProposal = plan.firstLiveBenchmarkProposal;
  const liveCandidate = proposal.candidates.find(
    (candidate) =>
      candidate.provider === liveProposal.provider
      && candidate.model === liveProposal.model,
  );
  if (!liveCandidate?.catalog) {
    throw unprocessable(
      `Live benchmark proposal references unavailable candidate ${liveProposal.provider}/${liveProposal.model}`,
    );
  }
  const scannerSelection = selectedByWorkload.get("scanner-primary-constraint");
  if (
    scannerSelection?.candidate?.provider !== liveProposal.provider
    || scannerSelection.candidate.model !== liveProposal.model
  ) {
    throw unprocessable(
      "Live benchmark proposal must match the balanced Scanner route",
    );
  }
  if (
    liveProposal.maxInputTokens
      > liveCandidate.catalog.providerRouting.maxInputTokensPerRequest
    || liveProposal.maxOutputTokens > liveCandidate.catalog.maxOutputTokens
  ) {
    throw unprocessable("Live benchmark token limits exceed the governed candidate limits");
  }
  const worstCaseCostUsd = (
    liveProposal.maxInputTokens * liveCandidate.catalog.providerRouting.maxInputUsdPerMillion
    + liveProposal.maxOutputTokens
      * liveCandidate.catalog.providerRouting.maxOutputUsdPerMillion
  ) / 1_000_000;
  const worstCaseCostCents = Math.ceil(worstCaseCostUsd * 100);
  if (worstCaseCostCents > liveProposal.maxRunCostCents) {
    throw unprocessable("Live benchmark worst-case cost exceeds its per-run hard cap");
  }

  const scenarios = plan.priceScenarios.map((scenario) => {
    const overrides = new Map(
      scenario.overrides.map((override) => [override.model, override]),
    );
    for (const model of overrides.keys()) {
      if (!proposal.candidates.some((candidate) => candidate.model === model)) {
        throw unprocessable(
          `Price scenario ${scenario.id} references unknown model ${model}`,
        );
      }
    }

    const estimates = plan.workloads.map<AlphaWorkloadEconomicsEstimate>((workload) => {
      const selection = selectedByWorkload.get(workload.id)!;
      const candidate = selection.candidate
        ? withPriceOverride(
          selection.candidate,
          overrides.get(selection.candidate.model),
        )
        : null;
      return {
        workloadId: workload.id,
        label: workload.label,
        lane: selection.lane,
        provider: candidate?.provider ?? null,
        model: candidate?.model ?? null,
        monthlyRuns: workload.monthlyRuns,
        pricing: candidate?.catalog
          ? {
            inputUsd: candidate.catalog.pricing.inputUsd,
            outputUsd: candidate.catalog.pricing.outputUsd,
            cachedInputUsd: candidate.catalog.pricing.cachedInputUsd ?? null,
          }
          : null,
        p50: estimateUsage(candidate, workload.usage.p50, workload.monthlyRuns),
        p90: estimateUsage(candidate, workload.usage.p90, workload.monthlyRuns),
      };
    });
    const monthlyRuns = estimates.reduce(
      (total, estimate) => total + estimate.monthlyRuns,
      0,
    );
    const monthlyModelCalls = estimates.reduce(
      (total, estimate) => total + (estimate.model ? estimate.monthlyRuns : 0),
      0,
    );
    const p50MonthlyUsd = roundUsd(estimates.reduce(
      (total, estimate) => total + estimate.p50.monthlyUsd,
      0,
    ));
    const p90MonthlyUsd = roundUsd(estimates.reduce(
      (total, estimate) => total + estimate.p90.monthlyUsd,
      0,
    ));
    return {
      id: scenario.id,
      label: scenario.label,
      estimates,
      aggregate: {
        monthlyRuns,
        monthlyModelCalls,
        p50MonthlyUsd,
        p90MonthlyUsd,
        p50IncludedRemainingUsd: roundUsd(plan.includedUsageUsd - p50MonthlyUsd),
        p90IncludedRemainingUsd: roundUsd(plan.includedUsageUsd - p90MonthlyUsd),
        p50WithinIncludedUsage: p50MonthlyUsd <= plan.includedUsageUsd,
        p90WithinIncludedUsage: p90MonthlyUsd <= plan.includedUsageUsd,
      },
    };
  });

  return {
    version: "sysdom_alpha_workload_economics_report_v1",
    evidenceClass: "synthetic_planning",
    assumptionsAsOf: plan.assumptionsAsOf,
    posture: plan.posture,
    includedUsageUsd: plan.includedUsageUsd,
    activationAttempted: false,
    providerDispatchAttempted: false,
    exclusions: plan.exclusions,
    firstLiveBenchmarkProposal: {
      ...liveProposal,
      worstCaseCostCents,
      executionAuthorized: false,
      blockers: [
        "explicit_user_approval_missing",
        "provider_key_limit_not_verified",
        "provider_key_not_attached",
        "live_cost_not_reconciled",
      ],
    },
    selectedRoutes,
    scenarios,
  };
}
