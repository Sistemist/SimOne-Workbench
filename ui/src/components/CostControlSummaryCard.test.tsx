// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CostControlSummary } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CostControlSummaryCard } from "./CostControlSummaryCard";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseSummary: CostControlSummary = {
  companyId: "company-1",
  status: "clear",
  eventCount: 4,
  recordedCostCents: 125,
  tokenCount: 2_000,
  meteredEventCount: 2,
  meteredCostCents: 125,
  meteredTokenCount: 1_200,
  includedOrPrepaidEventCount: 2,
  includedOrPrepaidTokenCount: 800,
  unreconciledEventCount: 0,
  unreconciledTokenCount: 0,
  governedRouteEventCount: 3,
  governedRoutePercent: 75,
};

describe("CostControlSummaryCard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(summary: CostControlSummary) {
    act(() => root.render(<CostControlSummaryCard summary={summary} />));
  }

  it("shows recorded, metered, included, and governed-route evidence without calling it an invoice", () => {
    render(baseSummary);

    expect(container.textContent).toContain("Recorded usage reconciled");
    expect(container.textContent).toContain("$1.25");
    expect(container.textContent).toContain("Included / prepaid");
    expect(container.textContent).toContain("3 of 4 events linked");
    expect(container.textContent).toContain("75%");
    expect(container.textContent).toContain("not a provider invoice");
    expect(container.textContent).toContain("or an independent provider-side spending cap");
  });

  it("fails visibly closed when metered usage has unknown or zero pricing", () => {
    render({
      ...baseSummary,
      status: "needs_reconciliation",
      unreconciledEventCount: 2,
      unreconciledTokenCount: 425,
    });

    expect(container.textContent).toContain("Reconcile before paid runs");
    expect(container.textContent).toContain("425 tokens have unknown or zero-priced metered cost");
    expect(container.textContent).toContain("must be reconciled before further paid runs");
  });
});
