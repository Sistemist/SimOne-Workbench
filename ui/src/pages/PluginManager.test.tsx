// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PluginManager } from "./PluginManager";
import type { AvailableBundledPlugin } from "@/api/plugins";

const mockPluginsApi = vi.hoisted(() => ({
  list: vi.fn(),
  listBundled: vi.fn(),
  install: vi.fn(),
  uninstall: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
}));

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockPushToast = vi.hoisted(() => vi.fn());
const mockSearchParamsState = vi.hoisted(() => ({
  search: "",
}));

vi.mock("@/api/plugins", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/plugins")>();
  return {
    ...actual,
    pluginsApi: mockPluginsApi,
  };
});

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, className, title }: { to: string; children?: ReactNode; className?: string; title?: string }) => (
    <a href={to} className={className} title={title}>
      {children}
    </a>
  ),
  useSearchParams: () => [new URLSearchParams(mockSearchParamsState.search), vi.fn()],
}));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: mockSetBreadcrumbs }),
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompany: { id: "company-1", name: "Smoke Sysdom" },
  }),
}));

vi.mock("@/context/ToastContext", () => ({
  useToastActions: () => ({ pushToast: mockPushToast }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function makeBundledPlugin(overrides: Partial<AvailableBundledPlugin> = {}): AvailableBundledPlugin {
  return {
    packageName: "@paperclipai/plugin-example",
    pluginKey: "paperclipai.plugin-example",
    displayName: "Example Plugin",
    description: "A generic plugin.",
    localPath: "/repo/plugins/plugin-example",
    tag: "example",
    experimental: false,
    hasBuiltEntrypoints: true,
    ...overrides,
  };
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function renderPluginManager(container: HTMLElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <PluginManager />
      </QueryClientProvider>
    );
  });
  return root;
}

describe("PluginManager", () => {
  beforeEach(() => {
    mockSearchParamsState.search = "";
    mockPluginsApi.list.mockResolvedValue([]);
    mockPluginsApi.listBundled.mockResolvedValue([
      makeBundledPlugin({
        packageName: "@paperclipai/plugin-cloudflare-sandbox",
        pluginKey: "paperclipai.plugin-cloudflare-sandbox",
        displayName: "Cloudflare Sandbox Provider",
        description: "Run tools in an isolated sandbox.",
        localPath: "/repo/plugins/plugin-cloudflare-sandbox",
        experimental: true,
      }),
      makeBundledPlugin({
        packageName: "@paperclipai/plugin-llm-wiki",
        pluginKey: "paperclipai.plugin-llm-wiki",
        displayName: "SIM Wiki",
        description: "SimOne's durable knowledge layer for cited coaching.",
        localPath: "/repo/plugins/plugin-llm-wiki",
        tag: "first-party",
      }),
    ]);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("surfaces the focused SIM Wiki plugin before the generic plugin list", async () => {
    mockSearchParamsState.search = "focus=paperclipai.plugin-llm-wiki";
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = await renderPluginManager(container);

    await flushReact();

    const text = container.textContent ?? "";
    expect(text).toContain("Recommended setup");
    expect(text).toContain("SIM Wiki");
    expect(text).toContain("SIM Coach recommends this for durable memory and cited coaching.");
    expect(text).toContain("Install SIM Wiki");
    expect(text.indexOf("Recommended setup")).toBeLessThan(text.indexOf("Cloudflare Sandbox Provider"));

    flushSync(() => {
      root.unmount();
    });
  });
});
