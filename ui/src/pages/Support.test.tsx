// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Support, buildSysdomSupportContext } from "./Support";

const writeTextMock = vi.fn<(text: string) => Promise<void>>();
const setBreadcrumbsMock = vi.fn();

vi.mock("@/lib/router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: setBreadcrumbsMock }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Support", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    window.history.replaceState({}, "", "/support?from=test");
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("builds a versioned context from bounded runtime facts only", () => {
    expect(buildSysdomSupportContext({
      capturedAt: "2026-08-02T12:00:00.000Z",
      companyId: "company-1",
      route: "/costs",
      browser: "Test Browser",
    })).toEqual({
      version: 1,
      product: "Sysdom AI",
      capturedAt: "2026-08-02T12:00:00.000Z",
      companyId: "company-1",
      route: "/costs",
      browser: "Test Browser",
    });
  });

  it("offers recovery paths and copies no prompt, log, credential, or customer content", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<Support />);
    });

    expect(container.textContent).toContain("Venture state or SIM Cycle looks wrong");
    expect(container.textContent).toContain("A task or agent stopped");
    expect(container.textContent).toContain("A routine ran unexpectedly");
    expect(container.textContent).toContain("Usage or spend is unclear");
    expect(container.querySelector('a[href="/cockpit"]')).not.toBeNull();
    expect(container.querySelector('a[href="/inbox"]')).not.toBeNull();
    expect(container.querySelector('a[href="/routines"]')).not.toBeNull();
    expect(container.querySelector('a[href="/costs"]')).not.toBeNull();

    const copyButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Copy safe support context"),
    );
    expect(copyButton).toBeDefined();

    await act(async () => {
      copyButton?.click();
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copied = JSON.parse(writeTextMock.mock.calls[0]?.[0] ?? "{}") as Record<string, unknown>;
    expect(Object.keys(copied).sort()).toEqual([
      "browser",
      "capturedAt",
      "companyId",
      "product",
      "route",
      "version",
    ]);
    expect(copied).toMatchObject({
      version: 1,
      product: "Sysdom AI",
      companyId: "company-1",
      route: "/support?from=test",
    });
    expect(container.textContent).toContain("Support context copied");
    expect(setBreadcrumbsMock).toHaveBeenCalledWith([{ label: "Help & Recovery" }]);

    await act(async () => root.unmount());
  });
});
