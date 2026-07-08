// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelRoutingAudit } from "./ModelRoutingAudit";

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockModelRoutingApi = vi.hoisted(() => ({
  listDecisions: vi.fn(),
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

describe("ModelRoutingAudit", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders recent route decisions with review and cost evidence", async () => {
    mockModelRoutingApi.listDecisions.mockResolvedValue({
      items: [
        {
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
          metadata: { source: "SYS-202" },
          createdByAgentId: null,
          createdByUserId: "user-1",
          createdByRunId: null,
          createdAt: "2026-07-08T10:00:00.000Z",
          costEventCount: 1,
          costCents: 87,
        },
      ],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    flushSync(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ModelRoutingAudit />
        </QueryClientProvider>,
      );
    });
    await waitForText(container, "Model routing audit");

    const text = container.textContent ?? "";
    expect(text).toContain("Inspect why a model lane was chosen");
    expect(text).toContain("External specialist");
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
    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([
      { label: "Settings", href: "/company/settings" },
      { label: "Instance settings", href: "/company/settings/instance/general" },
      { label: "Model routing" },
    ]);

    flushSync(() => {
      root.unmount();
    });
  });
});
