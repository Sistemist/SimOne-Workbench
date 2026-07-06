// @vitest-environment jsdom

import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimCoach } from "./SimCoach";

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());

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
  const root = createRoot(container);
  flushSync(() => {
    root.render(<SimCoach />);
  });
  return root;
}

describe("SimCoach", () => {
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
    expect(links.some((link) => link.getAttribute("href") === "/company/settings/instance/plugins")).toBe(true);
    expect(links.some((link) => link.getAttribute("href") === "/wiki/query")).toBe(false);
    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([{ label: "SIM Coach" }]);

    flushSync(() => {
      root.unmount();
    });
  });
});
