// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PluginRecord } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimCoach } from "./SimCoach";

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockPluginsApi = vi.hoisted(() => ({
  list: vi.fn(),
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
    selectedCompany: { id: "company-1", name: "Smoke Sysdom" },
  }),
}));

function renderSimCoach(container: HTMLElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <SimCoach />
      </QueryClientProvider>
    );
  });
  return root;
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("SimCoach", () => {
  beforeEach(() => {
    mockPluginsApi.list.mockResolvedValue([]);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("points SIM Wiki setup to the plugin manager before the wiki plugin is enabled", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderSimCoach(container);

    const text = container.textContent ?? "";
    expect(text).toContain("Shape Smoke Sysdom before assigning agents.");
    expect(text).toContain("Enable SIM Wiki");
    expect(text).toContain("When enabled, the maintainer compiles durable memory");

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(
      links.some(
        (link) =>
          link.getAttribute("href") ===
          "/company/settings/instance/plugins?focus=paperclipai.plugin-llm-wiki"
      )
    ).toBe(true);
    expect(links.some((link) => link.getAttribute("href") === "/wiki/query")).toBe(false);
    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([{ label: "SIM Coach" }]);

    flushSync(() => {
      root.unmount();
    });
  });

  it("opens SIM Wiki directly once the wiki plugin is ready", async () => {
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
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderSimCoach(container);

    await flushReact();

    const text = container.textContent ?? "";
    expect(text).toContain("SIM Wiki ready");
    expect(text).toContain("Open SIM Wiki");

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(links.some((link) => link.getAttribute("href") === "/wiki")).toBe(true);
    expect(
      links.some(
        (link) =>
          link.getAttribute("href") ===
          "/company/settings/instance/plugins?focus=paperclipai.plugin-llm-wiki"
      )
    ).toBe(false);

    flushSync(() => {
      root.unmount();
    });
  });
});
