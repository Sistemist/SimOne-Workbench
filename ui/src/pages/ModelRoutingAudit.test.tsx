// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelRoutingAudit } from "./ModelRoutingAudit";

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockModelRoutingApi = vi.hoisted(() => ({
  listDecisions: vi.fn(),
  listPolicies: vi.fn(),
  updatePolicy: vi.fn(),
  updateReview: vi.fn(),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({
    setBreadcrumbs: mockSetBreadcrumbs,
  }),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
  }),
}));

vi.mock("../api/modelRouting", () => ({
  modelRoutingApi: mockModelRoutingApi,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function flushReact() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function waitForText(container: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.textContent?.includes(text)) return;
    await flushReact();
  }
  expect(container.textContent).toContain(text);
}

function renderAuditPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  flushSync(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ModelRoutingAudit />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });

  return { container, root };
}

function modelRouteDecision(overrides: Record<string, unknown> = {}) {
  return {
    id: "decision-1",
    companyId: "company-1",
    agentId: "agent-1",
    issueId: null,
    projectId: null,
    goalId: null,
    heartbeatRunId: "run-1",
    lane: "external_specialist",
    provider: "sakana",
    model: "fugu-ultra",
    reason: "Delegate a complex execution task while preserving an auditable spend trail.",
    riskLevel: "medium",
    taskIntent: "Run specialist execution for a Skills Engine task.",
    contextSummary: "Compressed task brief and acceptance criteria.",
    approvalGate: "human_after_draft",
    outputSummary: "Returned a draft implementation plan.",
    outputConfidence: "medium",
    reviewStatus: "needs_revision",
    reviewNote: "Review before using this in a customer-facing output.",
    metadata: {
      source: "SYS-202",
      executionSafety: {
        version: "sysdom_model_execution_safety_v1",
        source: "heartbeat_pre_dispatch",
        status: "ready",
        enforced: true,
        billingType: "metered_api",
        provider: "sakana",
        model: "fugu-ultra",
        blockers: [],
        controls: {
          timeoutSec: 300,
          maxTurnsPerRun: 20,
          maxRuns: 1,
          maxRetries: 0,
          concurrency: 1,
          maxRunCostCents: 25,
          providerHardCapCents: 500,
        },
      },
      executionReconciliation: {
        version: "sysdom_model_execution_reconciliation_v1",
        source: "heartbeat_post_run",
        status: "reconciled",
        terminalOutcome: "succeeded",
        blockers: [],
        expected: {
          provider: "sakana",
          model: "fugu-ultra",
          billingType: "metered_api",
          maxRunCostCents: 100,
        },
        actual: {
          provider: "sakana",
          model: "fugu-ultra",
          billingType: "metered_api",
          costKnown: true,
          costCents: 87,
          inputTokens: 1200,
          cachedInputTokens: 100,
          outputTokens: 450,
        },
        reconciledAt: "2026-07-08T10:01:00.000Z",
      },
      outputArtifacts: [
        {
          id: "artifact-brief-1",
          title: "Sprint Zero Brief",
          href: "/artifacts?groupIssueId=11111111-1111-4111-8111-111111111111",
          source: "work_product",
        },
      ],
    },
    createdByAgentId: null,
    createdByUserId: "user-1",
    createdByRunId: null,
    createdAt: "2026-07-08T10:00:00.000Z",
    costEventCount: 1,
    costCents: 87,
    ...overrides,
  };
}

function modelExecutionPolicy(overrides: Record<string, unknown> = {}) {
  return {
    agentId: "agent-1",
    agentName: "SIM Coach",
    agentStatus: "idle",
    adapterType: "codex_local",
    policy: {
      provider: "openrouter",
      model: "openai/gpt-oss-120b",
      billingType: "metered_api",
      timeoutSec: 300,
      maxTurnsPerRun: 20,
      maxRuns: 1,
      maxRetries: 0,
      concurrency: 1,
      maxRunCostCents: 25,
      providerHardCapCents: 500,
      providerHardCapEvidenceSource: "Provider billing settings",
      providerHardCapVerifiedAt: "2026-07-31T08:00:00.000Z",
      providerHardCapExpiresAt: "2026-08-01T08:00:00.000Z",
      subscriptionEvidenceSource: null,
      subscriptionVerifiedAt: null,
      subscriptionExpiresAt: null,
      meteredOverageAllowed: false,
    },
    assessment: {
      status: "blocked",
      enforced: true,
      blockers: ["provider_cap_evidence_stale"],
      controls: {
        providerHardCapEvidenceSource: "Provider billing settings",
        providerHardCapVerifiedAt: "2026-07-31T08:00:00.000Z",
        providerHardCapExpiresAt: "2026-08-01T08:00:00.000Z",
        subscriptionEvidenceSource: null,
        subscriptionVerifiedAt: null,
        subscriptionExpiresAt: null,
      },
    },
    ...overrides,
  };
}

async function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("ModelRoutingAudit", () => {
  beforeEach(() => {
    mockModelRoutingApi.listPolicies.mockResolvedValue({
      items: [modelExecutionPolicy()],
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders recent route decisions with review and cost evidence", async () => {
    mockModelRoutingApi.listDecisions.mockResolvedValue({
      items: [modelRouteDecision()],
    });

    const { container, root } = renderAuditPage();
    await waitForText(container, "Model routing audit");

    const text = container.textContent ?? "";
    expect(text).toContain("Configure a governed route before execution");
    expect(text).toContain("External specialist");
    expect(text).toContain("External specialist review");
    expect(text).toContain("Task boundary, returned result, evaluation, fallback, and human review must be inspectable before this output becomes trusted.");
    expect(text).toContain("sakana / fugu-ultra");
    expect(text).toContain("medium risk");
    expect(text).toContain("needs revision");
    expect(text).toContain("1 cost event");
    expect(text).toContain("$0.87");
    expect(text).toContain("Execution safety: ready");
    expect(text).toContain("Metered api route has pinned selection, bounded runtime, and recorded external-cap evidence before provider execution.");
    expect(text).toContain("300s timeout");
    expect(text).toContain("$0.25 declared run allowance");
    expect(text).toContain("$5.00 provider hard cap");
    expect(text).toContain("Actual usage reconciliation: reconciled");
    expect(text).toContain("The succeeded run reported the authorized route and billing evidence.");
    expect(text).toContain("Authorized: sakana / fugu-ultra · metered api");
    expect(text).toContain("Reported: sakana / fugu-ultra · metered api");
    expect(text).toContain("Cost: $0.87 / $1.00 allowance");
    expect(text).toContain("Tokens reported: 1,750");
    expect(text).toContain("human after draft");
    expect(text).toContain("Compressed task brief and acceptance criteria.");
    expect(text).toContain("Returned a draft implementation plan.");
    expect(text).toContain("Review before using this in a customer-facing output.");
    expect(mockModelRoutingApi.listDecisions).toHaveBeenCalledWith("company-1", { limit: 50 });
    expect(mockModelRoutingApi.listPolicies).toHaveBeenCalledWith("company-1");
    const runLink = container.querySelector<HTMLAnchorElement>('a[href="/agents/agent-1/runs/run-1"]');
    expect(runLink).toBeTruthy();
    expect(runLink?.textContent).toContain("Run linked");
    const artifactLink = container.querySelector<HTMLAnchorElement>(
      'a[href="/artifacts?groupIssueId=11111111-1111-4111-8111-111111111111"]',
    );
    expect(artifactLink).toBeTruthy();
    expect(artifactLink?.textContent).toContain("Sprint Zero Brief");
    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([
      { label: "Settings", href: "/company/settings" },
      { label: "Instance settings", href: "/company/settings/instance/general" },
      { label: "Model routing" },
    ]);

    flushSync(() => {
      root.unmount();
    });
  });

  it("saves a first-class operator policy while surfacing stale cap evidence", async () => {
    mockModelRoutingApi.listDecisions.mockResolvedValue({ items: [] });
    const readyPolicy = modelExecutionPolicy({
      assessment: {
        status: "ready",
        enforced: true,
        blockers: [],
        controls: {},
      },
    });
    mockModelRoutingApi.updatePolicy.mockResolvedValue(readyPolicy);

    const { container, root } = renderAuditPage();
    await waitForText(container, "Provider cap evidence stale");

    const text = container.textContent ?? "";
    expect(text).toContain("Execution policy");
    expect(text).toContain("Saving never tests or calls the provider.");
    expect(text).toContain("1 run per day · 0 automatic retries · concurrency 1");

    const saveButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "Save execution policy");
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton!.click();
    });
    await flushReact();

    expect(mockModelRoutingApi.updatePolicy).toHaveBeenCalledWith(
      "company-1",
      "agent-1",
      expect.objectContaining({
        provider: "openrouter",
        model: "openai/gpt-oss-120b",
        billingType: "metered_api",
        maxRuns: 1,
        maxRetries: 0,
        concurrency: 1,
        providerHardCapEvidenceSource: "Provider billing settings",
      }),
    );
    await waitForText(container, "Policy saved. Current safety status: ready.");

    flushSync(() => {
      root.unmount();
    });
  });

  it("shows why an enforced route was blocked before provider execution", async () => {
    mockModelRoutingApi.listDecisions.mockResolvedValue({
      items: [
        modelRouteDecision({
          metadata: {
            source: "heartbeat_adapter_execution",
            executionSafety: {
              version: "sysdom_model_execution_safety_v1",
              source: "heartbeat_pre_dispatch",
              status: "blocked",
              enforced: true,
              billingType: "metered_api",
              provider: "openrouter",
              model: "openai/gpt-oss-120b",
              blockers: ["timeout_missing", "provider_cap_missing"],
              controls: {},
            },
          },
        }),
      ],
    });

    const { container, root } = renderAuditPage();
    await waitForText(container, "Execution safety: blocked");

    const text = container.textContent ?? "";
    expect(text).toContain("provider invocation was blocked before execution");
    expect(text).toContain("Timeout missing");
    expect(text).toContain("Provider cap missing");

    flushSync(() => {
      root.unmount();
    });
  });

  it("shows why post-run usage reconciliation stopped further automatic execution", async () => {
    mockModelRoutingApi.listDecisions.mockResolvedValue({
      items: [
        modelRouteDecision({
          metadata: {
            source: "heartbeat_adapter_execution",
            executionSafety: {
              version: "sysdom_model_execution_safety_v1",
              source: "heartbeat_pre_dispatch",
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
              },
            },
            executionReconciliation: {
              version: "sysdom_model_execution_reconciliation_v1",
              source: "heartbeat_post_run",
              status: "blocked",
              terminalOutcome: "succeeded",
              blockers: [
                "actual_provider_mismatch",
                "actual_model_mismatch",
                "actual_cost_missing",
              ],
              expected: {
                provider: "openrouter",
                model: "openai/gpt-oss-120b",
                billingType: "metered_api",
                maxRunCostCents: 25,
              },
              actual: {
                provider: "unexpected-provider",
                model: "unexpected-model",
                billingType: "metered_api",
                costKnown: false,
                costCents: null,
                inputTokens: 0,
                cachedInputTokens: 0,
                outputTokens: 0,
              },
            },
          },
        }),
      ],
    });

    const { container, root } = renderAuditPage();
    await waitForText(container, "Actual usage reconciliation: blocked");

    const text = container.textContent ?? "";
    expect(text).toContain("Further automatic execution remains stopped until board review clears this decision.");
    expect(text).toContain("Authorized: openrouter / openai/gpt-oss-120b · metered api");
    expect(text).toContain("Reported: unexpected-provider / unexpected-model · metered api");
    expect(text).toContain("Cost: unknown / $0.25 allowance");
    expect(text).toContain("Actual provider mismatch");
    expect(text).toContain("Actual model mismatch");
    expect(text).toContain("Actual cost missing");

    flushSync(() => {
      root.unmount();
    });
  });

  it("explains deliberation audit evidence for Fusion-style route decisions", async () => {
    mockModelRoutingApi.listDecisions.mockResolvedValue({
      items: [
        modelRouteDecision({
          id: "decision-fusion",
          lane: "deliberation_audit",
          provider: "openrouter",
          model: "fusion",
          reason: "Use multiple model views before approving a high-risk public claim.",
          riskLevel: "high",
          taskIntent: "Review public positioning before publishing.",
          approvalGate: "human_before_external",
          outputSummary: "Synthesis found disagreement on the strongest claim.",
        }),
      ],
    });

    const { container, root } = renderAuditPage();
    await waitForText(container, "openrouter / fusion");

    const text = container.textContent ?? "";
    expect(text).toContain("Deliberation audit");
    expect(text).toContain("Deliberation audit evidence");
    expect(text).toContain("Prompt, disagreement, blind spots, synthesis, and approval gate should be captured for this high-risk review.");
    expect(text).toContain("high risk");
    expect(text).toContain("human before external");

    flushSync(() => {
      root.unmount();
    });
  });

  it("marks a route decision approved with a review note", async () => {
    const approvedDecision = modelRouteDecision({
      reviewStatus: "approved",
      reviewNote: "Approved for internal use after checking cost and context.",
    });
    mockModelRoutingApi.listDecisions.mockResolvedValue({
      items: [modelRouteDecision({ reviewNote: null })],
    });
    mockModelRoutingApi.updateReview.mockResolvedValue(approvedDecision);

    const { container, root } = renderAuditPage();
    await waitForText(container, "sakana / fugu-ultra");

    const textarea = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Review note for sakana / fugu-ultra"]');
    expect(textarea).toBeTruthy();
    await setTextareaValue(textarea!, "Approved for internal use after checking cost and context.");

    const approveButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "Approve");
    expect(approveButton).toBeTruthy();

    await act(async () => {
      approveButton!.click();
    });
    await flushReact();

    expect(mockModelRoutingApi.updateReview).toHaveBeenCalledWith("company-1", "decision-1", {
      outputSummary: "Returned a draft implementation plan.",
      outputConfidence: "medium",
      reviewStatus: "approved",
      reviewNote: "Approved for internal use after checking cost and context.",
    });

    flushSync(() => {
      root.unmount();
    });
  });

  it("filters route decisions by review status", async () => {
    mockModelRoutingApi.listDecisions.mockResolvedValue({
      items: [
        modelRouteDecision({
          id: "decision-needs-revision",
          provider: "sakana",
          model: "fugu-ultra",
          reviewStatus: "needs_revision",
          reason: "Specialist output needs a second look before use.",
        }),
        modelRouteDecision({
          id: "decision-approved",
          provider: "anthropic",
          model: "claude-fable-5",
          reviewStatus: "approved",
          reason: "Boardroom audit accepted the narrowed recommendation.",
        }),
      ],
    });

    const { container, root } = renderAuditPage();
    await waitForText(container, "claude-fable-5");

    expect(container.textContent).toContain("fugu-ultra");
    expect(container.textContent).toContain("claude-fable-5");

    const needsRevisionButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Needs revision"));
    expect(needsRevisionButton).toBeTruthy();

    await act(async () => {
      needsRevisionButton!.click();
    });
    await flushReact();

    expect(container.textContent).toContain("fugu-ultra");
    expect(container.textContent).not.toContain("claude-fable-5");

    flushSync(() => {
      root.unmount();
    });
  });
});
