// @vitest-environment jsdom

import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomerEngine } from "./CustomerEngine";

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

describe("CustomerEngine", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders the read-only Customer Engine bridge shape", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    flushSync(() => {
      root.render(<CustomerEngine />);
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Turn customer signal into company judgment.");
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

    flushSync(() => {
      root.unmount();
    });
  });
});
