// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GovernedIntake } from "./GovernedIntake";

const mockGovernedIntakeApi = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
}));
const mockPluginsApi = vi.hoisted(() => ({
  list: vi.fn(),
}));
const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockPushToast = vi.hoisted(() => vi.fn());

vi.mock("@/api/governedIntake", () => ({ governedIntakeApi: mockGovernedIntakeApi }));
vi.mock("@/api/plugins", () => ({ pluginsApi: mockPluginsApi }));
vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: mockSetBreadcrumbs }),
}));
vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompany: { id: "company-1", name: "Sysdom Alpha" } }),
}));
vi.mock("@/context/ToastContext", () => ({
  useToastActions: () => ({ pushToast: mockPushToast }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("GovernedIntake", () => {
  beforeEach(() => {
    mockGovernedIntakeApi.list.mockResolvedValue([]);
    mockPluginsApi.list.mockResolvedValue([{
      id: "11111111-1111-4111-8111-111111111111",
      pluginKey: "sysdom.context-projection",
      packageName: "@sysdom/context-projection",
      version: "1.2.3",
      status: "installed",
      manifestJson: {
        id: "sysdom.context-projection",
        displayName: "Context Projection",
        version: "1.2.3",
        capabilities: ["companies.read"],
      },
    }]);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("shows exact-version activation state and the bounded review fields", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    flushSync(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <GovernedIntake />
        </QueryClientProvider>,
      );
    });
    await flushReact();

    const text = container.textContent ?? "";
    expect(text).toContain("Governed intake");
    expect(text).toContain("Context Projection");
    expect(text).toContain("sysdom.context-projection@1.2.3");
    expect(text).toContain("Review required");
    expect(text).toContain("Permission boundary");
    expect(text).toContain("Cost boundary");
    expect(text).toContain("Product boundary");
    expect(text).toContain("No assessment exists for this exact installed version.");

    flushSync(() => root.unmount());
  });
});
