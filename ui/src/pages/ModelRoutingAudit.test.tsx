// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelRoutingAudit } from "./ModelRoutingAudit";

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockModelRoutingApi = vi.hoisted(() => ({
  listDecisions: vi.fn(),
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

async function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("ModelRoutingAudit", () => {
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
    expect(text).toContain("Inspect why a model lane was chosen");
    expect(text).toContain("External specialist");
    expect(text).toContain("External specialist review");
    expect(text).toContain("Task boundary, returned result, evaluation, fallback, and human review must be inspectable before this output becomes trusted.");
    expect(text).toContain("sakana / fugu-ultra");
    expect(text).toContain("medium risk");
    expect(text).toContain("needs revision");
    expect(text).toContain("1 cost event");
    expect(text).toContain("$0.87");
    expect(text).toContain("human after draft");
    expect(text).toContain("Compressed task brief and acceptance criteria.");
    expect(text).toContain("Returned a draft implementation plan.");
    expect(text).toContain("Review before using this in a customer-facing output.");
    expect(mockModelRoutingApi.listDecisions).toHaveBeenCalledWith("company-1", { limit: 50 });
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
