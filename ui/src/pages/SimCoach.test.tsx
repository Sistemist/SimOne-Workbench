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
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("SimCoach", () => {
  beforeEach(() => {
    localStorage.clear();
    mockPluginsApi.list.mockResolvedValue([]);
    mockPluginsApi.bridgePerformAction.mockResolvedValue({
      data: {
        status: "ok",
        path: "wiki/synthesis/scanner-2026-07-08-customer-loop-is-leaking.md",
      },
    });
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

  it("shows what the SIM Wiki will preserve before heavy automation starts", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderSimCoach(container);

    const text = container.textContent ?? "";
    expect(text).toContain("SIM Wiki Seed Map");
    expect(text).toContain("Method pages");
    expect(text).toContain("Engines, drivers, system laws, archetypes, and coaching guidance.");
    expect(text).toContain("Venture memory");
    expect(text).toContain("Founder notes, first maps, decisions, proof points, and Sprint Zero context.");
    expect(text).toContain("Promotion rule");
    expect(text).toContain("Live bridge counts stay live. Only useful decisions and proof become durable wiki pages.");
    expect(text).toContain("This keeps SIM understandable without hiding where the knowledge came from.");

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

  it("explains a saved scanner result as a plain-language SIM loop", () => {
    localStorage.setItem(
      "simone:bottleneck-scan",
      JSON.stringify({
        result: {
          headline: "Customer loop is leaking",
          engine: "Customer Engine",
          questions: [
            "Who should approve the next customer reply or offer?",
            "What proof would make this worth doing now?",
          ],
          mapPreview: {
            artifact: "Venture Architecture Map",
            firstSection: "Customer review loop",
          },
        },
      })
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderSimCoach(container);

    const text = container.textContent ?? "";
    expect(text).toContain("From your scanner result");
    expect(text).toContain("Customer loop is leaking");
    expect(text).toContain("Plain English: signal needs a decision, a decision needs an owner, and the answer needs a place to live.");
    expect(text).toContain("Method underneath");
    expect(text).toContain("Customer review loop");
    expect(text).toContain("SIM idea: signal becomes useful only when it moves through judgment and into memory.");
    expect(text).toContain("Use this when customer replies, proof, or promises are scattered.");
    expect(text).toContain("Learn why");
    expect(text).toContain("Who should approve the next customer reply or offer?");
    expect(text).toContain("Venture Architecture Map");
    expect(text).not.toMatch(/model|provider|LLM|api key|runtime/i);

    flushSync(() => {
      root.unmount();
    });
  });

  it("promotes a scanner synthesis into SIM Wiki when the wiki plugin is ready", async () => {
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
    localStorage.setItem(
      "simone:bottleneck-scan",
      JSON.stringify({
        result: {
          headline: "Customer loop is leaking",
          engine: "Customer Engine",
          questions: [
            "Who should approve the next customer reply or offer?",
            "What proof would make this worth doing now?",
          ],
          mapPreview: {
            artifact: "Venture Architecture Map",
            firstSection: "Customer review loop",
          },
        },
      })
    );

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderSimCoach(container);
    await flushReact();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T12:34:56.000Z"));

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save to SIM Wiki")
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
        path: "wiki/synthesis/scanner-2026-07-08-123456-customer-loop-is-leaking.md",
        summary: "Promoted scanner synthesis from SIM Coach",
      }),
      "company-1"
    );
    const params = mockPluginsApi.bridgePerformAction.mock.calls[0][2];
    expect(params.contents).toContain("# Customer loop is leaking");
    expect(params.contents).toContain("engine: Customer Engine");
    expect(params.contents).toContain("SIM idea: signal becomes useful only when it moves through judgment and into memory.");
    expect(params.contents).toContain("Live bridge counts stay live. Only useful decisions and proof become durable SIM Wiki pages.");
    expect(container.textContent).toContain("Saved to SIM Wiki");

    flushSync(() => {
      root.unmount();
    });
    vi.useRealTimers();
  });
});
