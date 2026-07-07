// @vitest-environment jsdom

import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerEngine } from "./CustomerEngine";

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockCustomerEngineApi = vi.hoisted(() => ({
  bridgeSnapshot: vi.fn(),
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

describe("CustomerEngine", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
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
    expect(text).toContain("10 replies + 3 posts to review");
    expect(text).toContain("Approve reply to @fchollet");
    expect(text).toContain("33 waiting");
    expect(text).toContain("11 waitlist");
    expect(text).toContain("Engine healthy");
    expect(text).toContain("Daily Readout");
    expect(text).toContain("Human Review Queue");
    expect(text).toContain("Funnel Signals");
    expect(text).toContain("Engine Health");
    expect(text).toContain("First bridge rule");
    expect(text).toContain("Posting, publishing, following, and prospect changes stay in Tissuu");
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
    expect(text).not.toContain("Open in Tissuu");

    flushSync(() => {
      root.unmount();
    });
  });
});
