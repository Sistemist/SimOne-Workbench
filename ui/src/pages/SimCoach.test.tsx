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

const fakeEventSources: FakeEventSource[] = [];

class FakeEventSource {
  readonly url: string;
  readonly eventSourceInitDict?: EventSourceInit;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly close = vi.fn();

  constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
    this.url = String(url);
    this.eventSourceInitDict = eventSourceInitDict;
    fakeEventSources.push(this);
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
}

describe("SimCoach", () => {
  beforeEach(() => {
    localStorage.clear();
    fakeEventSources.length = 0;
    vi.stubGlobal("EventSource", FakeEventSource);
    mockPluginsApi.list.mockReset();
    mockPluginsApi.bridgePerformAction.mockReset();
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it("explains Coach, Wiki, and the control plane in plain product language", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderSimCoach(container);

    const text = container.textContent ?? "";
    expect(text).toContain("Who does what");
    expect(text).toContain("SIM Coach explains the moment and protects judgment.");
    expect(text).toContain("SIM Wiki preserves durable memory with provenance.");
    expect(text).toContain("The control plane tracks work, agents, runs, costs, and recovery.");
    expect(text).toContain("Use this page when you need to understand before delegating.");
    expect(text).not.toContain("root execution engine");

    flushSync(() => {
      root.unmount();
    });
  });

  it("explains the operating role stack without making providers first-run setup", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderSimCoach(container);

    const text = container.textContent ?? "";
    expect(text).toContain("Operating role stack");
    expect(text).toContain("Human owner keeps final judgment.");
    expect(text).toContain("Boardroom brain advises; it does not own the company.");
    expect(text).toContain("Engine stewards turn Product, Customer, Cash, and Skills signals into bounded work.");
    expect(text).toContain("Specialist adapters return candidate output for review.");
    expect(text).toContain("Task agents leave task, run, cost, and approval receipts.");
    expect(text).not.toMatch(/choose a provider|paste an api key|adapter setup/i);

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

  it("points scanner follow-up at SIM Wiki retrieval before stronger advice", async () => {
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
          questions: ["Who should approve the next customer reply or offer?"],
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

    const text = container.textContent ?? "";
    expect(text).toContain("Retrieve from SIM Wiki");
    expect(text).toContain("Before stronger advice, ask the wiki to check saved method pages, venture memory, and prior promoted syntheses.");
    expect(text).toContain("Ask: What should SIM Coach check before assigning work on Customer loop is leaking?");

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(links.some((link) => link.getAttribute("href") === "/wiki/query")).toBe(true);

    flushSync(() => {
      root.unmount();
    });
  });

  it("queues a SIM Wiki maintainer retrieval from saved scanner context", async () => {
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
          questions: ["Who should approve the next customer reply or offer?"],
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

    const askButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Ask SIM Wiki now")
    ) as HTMLButtonElement;
    expect(askButton).toBeTruthy();
    mockPluginsApi.bridgePerformAction.mockResolvedValueOnce({
      data: {
        status: "running",
        operationId: "operation-1",
        querySessionId: "operation-1",
        channel: "llm-wiki:query:operation-1",
        issue: {
          id: "issue-1",
          identifier: "SYS-777",
          title: "Query SIM Wiki: Customer loop is leaking",
        },
      },
    });

    await act(async () => {
      askButton.click();
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });

    expect(mockPluginsApi.bridgePerformAction).toHaveBeenCalledWith(
      "plugin-1",
      "start-query",
      expect.objectContaining({
        companyId: "company-1",
        wikiId: "default",
        spaceSlug: "default",
        question: "What should SIM Coach check before assigning work on Customer loop is leaking?",
        title: "SIM Coach retrieval: Customer loop is leaking",
      }),
      "company-1"
    );
    expect(container.textContent).toContain("SIM Wiki check queued");
    expect(container.textContent).toContain("Maintainer task: SYS-777");

    const issueLink = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find((link) =>
      link.textContent?.includes("Open maintainer task")
    );
    expect(issueLink?.getAttribute("href")).toBe("/issues/SYS-777");

    flushSync(() => {
      root.unmount();
    });
  });

  it("streams the returned SIM Wiki answer into Coach after queueing retrieval", async () => {
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
          questions: ["Who should approve the next customer reply or offer?"],
          mapPreview: {
            artifact: "Venture Architecture Map",
            firstSection: "Customer review loop",
          },
        },
      })
    );
    mockPluginsApi.bridgePerformAction.mockResolvedValueOnce({
      data: {
        status: "running",
        operationId: "operation-1",
        querySessionId: "operation-1",
        channel: "llm-wiki:query:operation-1",
        issue: {
          id: "issue-1",
          identifier: "SYS-777",
          title: "Query SIM Wiki: Customer loop is leaking",
        },
      },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderSimCoach(container);
    await flushReact();

    const askButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Ask SIM Wiki now")
    ) as HTMLButtonElement;
    expect(askButton).toBeTruthy();

    await act(async () => {
      askButton.click();
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });

    expect(fakeEventSources).toHaveLength(1);
    expect(fakeEventSources[0]?.url).toBe(
      "/api/plugins/plugin-1/bridge/stream/llm-wiki%3Aquery%3Aoperation-1?companyId=company-1"
    );
    expect(fakeEventSources[0]?.eventSourceInitDict).toEqual({ withCredentials: true });

    await act(async () => {
      fakeEventSources[0]?.emitMessage({
        type: "agent.event",
        eventType: "chunk",
        stream: "stdout",
        message: "Check saved method pages. ",
      });
      fakeEventSources[0]?.emitMessage({
        type: "query.done",
        answer: "Check saved method pages. Customer review loop is the durable method here.",
      });
    });

    const text = container.textContent ?? "";
    expect(text).toContain("SIM Wiki answer");
    expect(text).toContain("Check saved method pages. Customer review loop is the durable method here.");
    expect(text).not.toMatch(/model|provider|LLM|api key|runtime/i);

    flushSync(() => {
      root.unmount();
    });
  });

  it("promotes a returned SIM Wiki answer into durable wiki memory", async () => {
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
          questions: ["Who should approve the next customer reply or offer?"],
          mapPreview: {
            artifact: "Venture Architecture Map",
            firstSection: "Customer review loop",
          },
        },
      })
    );
    mockPluginsApi.bridgePerformAction
      .mockResolvedValueOnce({
        data: {
          status: "running",
          operationId: "operation-1",
          querySessionId: "operation-1",
          channel: "llm-wiki:query:operation-1",
          issue: {
            id: "issue-1",
            identifier: "SYS-777",
            title: "Query SIM Wiki: Customer loop is leaking",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: "ok",
          path: "wiki/synthesis/coach-answer-2026-07-08-123456-customer-loop-is-leaking.md",
        },
      });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderSimCoach(container);
    await flushReact();

    const askButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Ask SIM Wiki now")
    ) as HTMLButtonElement;
    expect(askButton).toBeTruthy();

    await act(async () => {
      askButton.click();
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });

    await act(async () => {
      fakeEventSources[0]?.emitMessage({
        type: "query.done",
        answer: "Check saved method pages. Customer review loop is the durable method here.",
        sourceRefs: [
          { kind: "wiki-page", path: "wiki/sim/engines.md" },
          { kind: "raw-source", path: "raw/founder-note.md" },
        ],
      });
    });

    expect(container.textContent).toContain("Sources mentioned");
    expect(container.textContent).toContain("wiki/sim/engines.md");
    expect(container.textContent).toContain("raw/founder-note.md");
    const sourceLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(sourceLinks.some((link) => link.getAttribute("href") === "/wiki/page/wiki/sim/engines.md")).toBe(true);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T12:34:56.000Z"));

    const saveAnswerButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save answer to SIM Wiki")
    ) as HTMLButtonElement;
    expect(saveAnswerButton).toBeTruthy();

    await act(async () => {
      saveAnswerButton.click();
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    });

    expect(mockPluginsApi.bridgePerformAction).toHaveBeenLastCalledWith(
      "plugin-1",
      "write-page",
      expect.objectContaining({
        companyId: "company-1",
        wikiId: "default",
        spaceSlug: "default",
        path: "wiki/synthesis/coach-answer-2026-07-08-123456-customer-loop-is-leaking.md",
        summary: "Promoted SIM Wiki answer from SIM Coach",
      }),
      "company-1"
    );
    const params = mockPluginsApi.bridgePerformAction.mock.calls[1][2];
    expect(params.contents).toContain("# SIM Wiki answer: Customer loop is leaking");
    expect(params.contents).toContain("## SIM Wiki Answer");
    expect(params.contents).toContain(
      "Check saved method pages. Customer review loop is the durable method here."
    );
    expect(params.contents).toContain("## Sources Mentioned");
    expect(params.contents).toContain("- [[wiki/sim/engines.md]]");
    expect(params.contents).toContain("- `raw/founder-note.md`");
    expect(params.contents).toContain("## Scanner Context");
    expect(params.contents).toContain("- engine: Customer Engine");
    expect(params.contents).toContain("- maintainer task: SYS-777");
    expect(params.contents).toContain("Who should approve the next customer reply or offer?");
    expect(params.sourceRefs).toEqual([
      {
        kind: "sim-wiki-query",
        issueRef: "SYS-777",
        operationId: "operation-1",
      },
      {
        kind: "sim-wiki-answer-source",
        sourceKind: "wiki-page",
        path: "wiki/sim/engines.md",
      },
      {
        kind: "sim-wiki-answer-source",
        sourceKind: "raw-source",
        path: "raw/founder-note.md",
      },
      { kind: "simone-bottleneck-scan", artifact: "Venture Architecture Map" },
    ]);
    expect(container.textContent).toContain("Saved answer to SIM Wiki");
    const savedAnswerLink = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find((link) =>
      link.textContent?.includes("Open saved answer")
    );
    expect(savedAnswerLink?.getAttribute("href")).toBe(
      "/wiki/page/wiki/synthesis/coach-answer-2026-07-08-123456-customer-loop-is-leaking.md"
    );

    flushSync(() => {
      root.unmount();
    });
    vi.useRealTimers();
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
    const savedPageLink = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find((link) =>
      link.textContent?.includes("Open saved page")
    );
    expect(savedPageLink?.getAttribute("href")).toBe(
      "/wiki/page/wiki/synthesis/scanner-2026-07-08-customer-loop-is-leaking.md"
    );

    flushSync(() => {
      root.unmount();
    });
    vi.useRealTimers();
  });
});
