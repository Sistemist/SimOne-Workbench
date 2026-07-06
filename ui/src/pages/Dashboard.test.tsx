// @vitest-environment jsdom

import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./Dashboard";

const mockDashboardApi = vi.hoisted(() => ({
  summary: vi.fn(),
}));

const mockActivityApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockAccessApi = vi.hoisted(() => ({
  listUserDirectory: vi.fn(),
}));

const mockIssuesApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockAgentsApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockProjectsApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockOpenOnboarding = vi.hoisted(() => vi.fn());

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

vi.mock("../api/dashboard", () => ({
  dashboardApi: mockDashboardApi,
}));

vi.mock("../api/activity", () => ({
  activityApi: mockActivityApi,
}));

vi.mock("../api/access", () => ({
  accessApi: mockAccessApi,
}));

vi.mock("../api/issues", () => ({
  issuesApi: mockIssuesApi,
}));

vi.mock("../api/agents", () => ({
  agentsApi: mockAgentsApi,
}));

vi.mock("../api/projects", () => ({
  projectsApi: mockProjectsApi,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompanyId: "company-1",
    companies: [{ id: "company-1", name: "Sysdom" }],
  }),
}));

vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({
    openOnboarding: mockOpenOnboarding,
  }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({
    setBreadcrumbs: mockSetBreadcrumbs,
  }),
}));

vi.mock("../components/ActiveAgentsPanel", () => ({
  ActiveAgentsPanel: ({ title, emptyMessage }: { title?: string; emptyMessage?: string }) => (
    <section>
      <h3>{title}</h3>
      <p>{emptyMessage}</p>
    </section>
  ),
}));

vi.mock("../components/ActivityCharts", () => ({
  ChartCard: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  RunActivityChart: () => <div>run activity chart</div>,
  PriorityChart: () => <div>priority chart</div>,
  IssueStatusChart: () => <div>status chart</div>,
  SuccessRateChart: () => <div>success rate chart</div>,
}));

vi.mock("@/plugins/slots", () => ({
  PluginSlotOutlet: () => null,
}));

async function flushReact() {
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function waitForText(container: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.textContent?.includes(text)) return;
    await flushReact();
  }
  expect(container.textContent).toContain(text);
}

function renderDashboard(container: HTMLElement) {
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  flushSync(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>,
    );
  });

  return root;
}

describe("Dashboard", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);

    mockAgentsApi.list.mockResolvedValue([
      {
        id: "agent-1",
        companyId: "company-1",
        name: "CEO",
        urlKey: "ceo",
        role: "ceo",
        title: null,
        icon: null,
        status: "idle",
        reportsTo: null,
        capabilities: null,
        adapterType: "mock",
        adapterConfig: {},
        runtimeConfig: {},
        budgetMonthlyCents: 0,
        spentMonthlyCents: 0,
        pauseReason: null,
        pausedAt: null,
        permissions: { canCreateAgents: true },
        lastHeartbeatAt: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockDashboardApi.summary.mockResolvedValue({
      companyId: "company-1",
      agents: { active: 4, running: 1, paused: 1, error: 0 },
      tasks: { open: 3, inProgress: 1, blocked: 0, done: 2 },
      costs: { monthSpendCents: 1200, monthBudgetCents: 50000, monthUtilizationPercent: 2 },
      pendingApprovals: 1,
      budgets: { activeIncidents: 0, pendingApprovals: 0, pausedAgents: 0, pausedProjects: 0 },
      runActivity: [],
    });
    mockActivityApi.list.mockResolvedValue([]);
    mockIssuesApi.list.mockResolvedValue([]);
    mockProjectsApi.list.mockResolvedValue([]);
    mockAccessApi.listUserDirectory.mockResolvedValue({ users: [] });
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("frames the first dashboard as a SIM operating view", async () => {
    const root = renderDashboard(container);
    await waitForText(container, "Operating Team");

    const text = container.textContent ?? "";

    expect(text).toContain("Active Work");
    expect(text).toContain("No agent work has run yet.");
    expect(text).toContain("Operating Team");
    expect(text).toContain("Open Work");
    expect(text).toContain("AI Spend");
    expect(text).toContain("Human Review");
    expect(text).toContain("Execution Activity");
    expect(text).toContain("Work by Priority");
    expect(text).toContain("Work by Status");
    expect(text).toContain("Run Success");
    expect(text).toContain("No work items yet.");
    expect(text).not.toContain("Agents Enabled");
    expect(text).not.toContain("Tasks In Progress");
    expect(text).not.toContain("Month Spend");
    expect(text).not.toContain("Pending Approvals");

    flushSync(() => {
      root.unmount();
    });
  });
});
