// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PluginRecord } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerEngine } from "./CustomerEngine";

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockCustomerEngineApi = vi.hoisted(() => ({
  bridgeSnapshot: vi.fn(),
}));
const mockPluginsApi = vi.hoisted(() => ({
  list: vi.fn(),
  bridgePerformAction: vi.fn(),
}));

vi.mock("@/api/plugins", () => ({
  pluginsApi: mockPluginsApi,
}));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, className }: { to: string; children?: ReactNode; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
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

vi.mock("../api/customerEngine", () => ({
  customerEngineApi: mockCustomerEngineApi,
}));

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

describe("CustomerEngine", () => {
  beforeEach(() => {
    mockPluginsApi.list.mockResolvedValue([]);
    mockPluginsApi.bridgePerformAction.mockResolvedValue({
      data: {
        status: "ok",
        path: "wiki/synthesis/customer-engine-2026-07-08-proof-readout.md",
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("renders live read-only Customer Engine bridge data", async () => {
    mockCustomerEngineApi.bridgeSnapshot.mockResolvedValue({
      status: "live",
      generatedAt: "2026-07-07T08:53:06Z",
      digest: {
        headline: "33 items waiting on you (10 high-priority)",
        summary: "10 replies + 3 posts to review",
        nextActions: [{ title: "Approve reply to @fchollet", priority: "high", deepLink: "https://app.tissuu.ai/drafts" }],
      },
      actions: {
        count: 33,
        items: [{ id: "reply:286", kind: "approve_reply", title: "Approve reply to @fchollet", priority: "high", reason: "Grounded in a real signal.", deepLink: "https://app.tissuu.ai/drafts", dueAt: null, source: "voice-watch" }],
      },
      metrics: {
        waitlistTotal: 11,
        weeklyNew: 0,
        qualifiedLeads: 2,
        replyRate: 0.03,
        proofEvents: 10,
      },
      ops: { overall: "healthy", jobs: [{ name: "voice-watch", status: "ok", lastRunAt: "2026-07-07T08:53:06Z" }], staleSignals: [] },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    flushSync(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CustomerEngine />
        </QueryClientProvider>
      );
    });
    await waitForText(container, "33 items waiting on you (10 high-priority)");

    const text = container.textContent ?? "";
    expect(text).toContain("Turn customer signal into company judgment.");
    expect(text).toContain("Customer Review Loop");
    expect(text).toContain("10 replies + 3 posts to review");
    expect(text).toContain("Approve reply to @fchollet");
    expect(text).toContain("33 items");
    expect(text).toContain("11 people");
    expect(text).toContain("Engine healthy");
    expect(text).toContain("Approval stays in Tissuu");
    expect(text).toContain("What changed");
    expect(text).toContain("Ready for your judgment");
    expect(text).toContain("Becomes SIM memory");
    expect(text).toContain("Promote only proof, positioning, or relationship decisions");
    expect(text).toContain("Grounded in a real signal.");
    expect(text).toContain("Decide what changes in Product, Cash, or SIM memory.");
    expect(text).toContain("Ask why this stays human");
    expect(text).toContain("Daily Readout");
    expect(text).toContain("Human Review Queue");
    expect(text).toContain("Funnel Signals");
    expect(text).toContain("SIM Memory");
    expect(text).toContain("Human-promoted");
    expect(text).toContain("Why SimOne stops here");
    expect(text).toContain("Customer replies and proof points can change the company map");
    expect(text).toContain("Ops check: engine healthy across 1 observed job.");
    expect(text).toContain("First bridge rule");
    expect(text).toContain("Posting, publishing, following, and prospect changes stay in Tissuu");
    expect(text).not.toContain("Save proof readout to SIM Wiki");
    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([{ label: "Customer Engine" }]);

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(links.some((link) => link.getAttribute("href") === "/sim-coach")).toBe(true);
    expect(links.some((link) => link.getAttribute("href") === "/issues")).toBe(true);
    expect(links.some((link) => link.getAttribute("href") === "/customer-engine")).toBe(true);
    expect(links.some((link) => link.getAttribute("href") === "https://app.tissuu.ai/drafts")).toBe(true);

    flushSync(() => {
      root.unmount();
    });
  });

  it("renders a clear unavailable state when the bridge is not configured", async () => {
    mockCustomerEngineApi.bridgeSnapshot.mockResolvedValue({
      status: "unavailable",
      reason: "bridge_not_configured",
      message: "Tissuu Customer Engine bridge token is not configured.",
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    flushSync(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CustomerEngine />
        </QueryClientProvider>
      );
    });
    await waitForText(container, "Bridge unavailable");

    const text = container.textContent ?? "";
    expect(text).toContain("Tissuu Customer Engine bridge token is not configured.");
    expect(text).toContain("Do not invent signal");
    expect(text).toContain("No trusted customer signal is available yet.");
    expect(text).not.toContain("Open in Tissuu");

    flushSync(() => {
      root.unmount();
    });
  });

  it("promotes a live Customer Engine readout into SIM Wiki when the wiki plugin is ready", async () => {
    mockPluginsApi.list.mockResolvedValue([
      {
        id: "plugin-1",
        packageName: "@paperclipai/plugin-llm-wiki",
        status: "ready",
        manifestJson: {
          displayName: "SIM Wiki",
          description: "SimOne wiki",
          version: "0.1.0",
        },
      } as PluginRecord,
    ]);
    mockCustomerEngineApi.bridgeSnapshot.mockResolvedValue({
      status: "live",
      generatedAt: "2026-07-07T08:53:06Z",
      digest: {
        headline: "33 items waiting on you (10 high-priority)",
        summary: "10 replies + 3 posts to review",
        nextActions: [{ title: "Approve reply to @fchollet", priority: "high", deepLink: "https://app.tissuu.ai/drafts" }],
      },
      actions: {
        count: 33,
        items: [{ id: "reply:286", kind: "approve_reply", title: "Approve reply to @fchollet", priority: "high", reason: "Grounded in a real signal.", deepLink: "https://app.tissuu.ai/drafts", dueAt: null, source: "voice-watch" }],
      },
      metrics: {
        waitlistTotal: 11,
        weeklyNew: 0,
        qualifiedLeads: 2,
        replyRate: 0.03,
        proofEvents: 10,
      },
      ops: { overall: "healthy", jobs: [{ name: "voice-watch", status: "ok", lastRunAt: "2026-07-07T08:53:06Z" }], staleSignals: [] },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    flushSync(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <CustomerEngine />
        </QueryClientProvider>
      );
    });
    await waitForText(container, "Save proof readout to SIM Wiki");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T12:34:56.000Z"));

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save proof readout to SIM Wiki")
    ) as HTMLButtonElement;
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton.click();
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });

    expect(mockPluginsApi.bridgePerformAction).toHaveBeenCalledWith(
      "plugin-1",
      "write-page",
      expect.objectContaining({
        companyId: "company-1",
        wikiId: "default",
        spaceSlug: "default",
        path: "wiki/synthesis/customer-engine-2026-07-08-123456-customer-engine-proof-readout.md",
        summary: "Promoted Customer Engine readout from SimOne",
      }),
      "company-1"
    );
    const params = mockPluginsApi.bridgePerformAction.mock.calls[0][2];
    expect(params.contents).toContain("# Customer Engine proof readout");
    expect(params.contents).toContain("source: Tissuu Customer Engine bridge");
    expect(params.contents).toContain("Tissuu is showing customer movement that deserves human judgment");
    expect(params.contents).toContain("Active waitlist signal is present.");
    expect(params.contents).toContain("Qualified customer demand is present.");
    expect(params.contents).toContain("Proof signal is present.");
    expect(params.contents).toContain("At least one customer-facing judgment needs human review.");
    expect(params.contents).toContain("Operational counts, pending queues, customer handles, and draft-specific details stay in Tissuu.");
    expect(params.contents).toContain("Live Tissuu counts stay live. Only proof, positioning, or relationship decisions become durable SIM Wiki pages.");
    expect(params.contents).not.toContain("33 items");
    expect(params.contents).not.toContain("10 replies");
    expect(params.contents).not.toContain("11");
    expect(params.contents).not.toContain("@fchollet");
    expect(params.contents).not.toContain("Grounded in a real signal.");
    expect(container.textContent).toContain("Saved to SIM Wiki");
    const savedPageLink = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find((link) =>
      link.textContent?.includes("Open saved page")
    );
    expect(savedPageLink?.getAttribute("href")).toBe(
      "/wiki/page/wiki/synthesis/customer-engine-2026-07-08-proof-readout.md"
    );

    flushSync(() => {
      root.unmount();
    });
  });
});
