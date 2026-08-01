// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { SimCycle } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuidedSimCycle } from "./GuidedSimCycle";

const mockFounderCockpitApi = vi.hoisted(() => ({
  startCycle: vi.fn(),
  submitCycleMap: vi.fn(),
  decideCycleDiagnosis: vi.fn(),
  commitCycleLeverage: vi.fn(),
  delegateCycleIntervention: vi.fn(),
  completeCycleCompound: vi.fn(),
  pauseCycle: vi.fn(),
  resumeCycle: vi.fn(),
  cycleEvents: vi.fn(),
}));

vi.mock("@/api/founderCockpit", () => ({
  founderCockpitApi: mockFounderCockpitApi,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function cycle(overrides: Partial<SimCycle> = {}): SimCycle {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    companyId: "company-1",
    status: "active",
    phase: "map",
    constitutionRevisionId: "22222222-2222-4222-8222-222222222222",
    startingStateRevisionId: null,
    currentStateRevisionId: null,
    contextProjectionId: null,
    startReason: "Run one deliberate founder-triggered cycle.",
    mapOutput: null,
    diagnoseOutput: null,
    leverageOutput: null,
    compoundOutput: null,
    startedByUserId: "founder-1",
    pausedReason: null,
    pausedAt: null,
    resumedAt: null,
    completedAt: null,
    createdAt: new Date("2026-07-31T20:00:00.000Z"),
    updatedAt: new Date("2026-07-31T20:00:00.000Z"),
    ...overrides,
  };
}

async function flushReact() {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function renderCycle(activeCycle: SimCycle | null) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  flushSync(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GuidedSimCycle
            companyId="company-1"
            cycle={activeCycle}
            currentState={null}
            constitutionActive
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return { container, root };
}

function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

async function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  expect(button).toBeTruthy();
  await act(async () => {
    (button as HTMLButtonElement).click();
    await Promise.resolve();
  });
  await flushReact();
}

describe("GuidedSimCycle", () => {
  beforeEach(() => {
    mockFounderCockpitApi.cycleEvents.mockResolvedValue([]);
    for (const method of [
      mockFounderCockpitApi.startCycle,
      mockFounderCockpitApi.submitCycleMap,
      mockFounderCockpitApi.decideCycleDiagnosis,
      mockFounderCockpitApi.commitCycleLeverage,
      mockFounderCockpitApi.delegateCycleIntervention,
      mockFounderCockpitApi.completeCycleCompound,
      mockFounderCockpitApi.pauseCycle,
      mockFounderCockpitApi.resumeCycle,
    ]) {
      method.mockResolvedValue(cycle());
    }
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("starts only through an explicit founder action and explains every bounded phase", async () => {
    const { container, root } = renderCycle(null);

    expect(container.textContent).toContain("Founder-triggered and resumable");
    expect(container.textContent).toContain("MAP");
    expect(container.textContent).toContain("DIAGNOSE");
    expect(container.textContent).toContain("LEVERAGE");
    expect(container.textContent).toContain("COMPOUND");
    expect(container.textContent).toContain("One current four-engine venture map");
    expect(container.textContent).toContain("one promoted learning");

    await clickButton(container, "Start guided cycle");
    expect(mockFounderCockpitApi.startCycle).toHaveBeenCalledWith("company-1", {
      startReason: "Run one deliberate founder-triggered SIM Cycle.",
    });

    await act(async () => root.unmount());
  });

  it("submits a complete four-engine MAP with explicit provenance", async () => {
    const { container, root } = renderCycle(cycle({ phase: "map" }));
    const values: Record<string, string> = {
      "cycle-venture-summary": "Controlled early-access founder cohort.",
      "cycle-map-product": "Cockpit is the current product proof.",
      "cycle-map-customer": "First founder cohort has not started.",
      "cycle-map-cash": "No paid-model spend is authorized.",
      "cycle-map-skills": "The control-plane foundation is present.",
      "cycle-map-source": "Founder MAP review",
    };

    await act(async () => {
      for (const [id, value] of Object.entries(values)) {
        setValue(container.querySelector(`#${id}`) as HTMLInputElement | HTMLTextAreaElement, value);
      }
    });
    await flushReact();
    await clickButton(container, "Complete MAP and continue");

    expect(mockFounderCockpitApi.submitCycleMap).toHaveBeenCalledWith(
      "company-1",
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({
        content: expect.objectContaining({
          ventureSummary: "Controlled early-access founder cohort.",
          engines: {
            product: expect.objectContaining({ summary: "Cockpit is the current product proof." }),
            customer: expect.objectContaining({ summary: "First founder cohort has not started." }),
            cash: expect.objectContaining({ summary: "No paid-model spend is authorized." }),
            skills: expect.objectContaining({ summary: "The control-plane foundation is present." }),
          },
        }),
        sourceRefs: [expect.objectContaining({ kind: "founder_map", label: "Founder MAP review" })],
      }),
    );

    await act(async () => root.unmount());
  });

  it("keeps diagnosis under a visible founder accept/reject gate and supports pause/resume", async () => {
    const diagnosisCycle = cycle({
      phase: "diagnose",
      currentStateRevisionId: "state-1",
      contextProjectionId: "projection-1",
    });
    const { container, root } = renderCycle(diagnosisCycle);

    await act(async () => {
      setValue(
        container.querySelector("#cycle-diagnose-hypothesis") as HTMLTextAreaElement,
        "The first founder cohort is the current constraint.",
      );
      setValue(
        container.querySelector("#cycle-diagnose-source") as HTMLInputElement,
        "Cohort recruitment evidence",
      );
      setValue(
        container.querySelector("#cycle-diagnose-note") as HTMLTextAreaElement,
        "Founder accepts this constraint for one cycle.",
      );
    });
    await flushReact();
    expect(container.textContent).toContain("Reject hypothesis");
    expect(container.textContent).toContain("Accept constraint and continue");

    await clickButton(container, "Accept constraint and continue");
    expect(mockFounderCockpitApi.decideCycleDiagnosis).toHaveBeenCalledWith(
      "company-1",
      diagnosisCycle.id,
      expect.objectContaining({
        hypothesis: "The first founder cohort is the current constraint.",
        decision: "accepted",
        decisionNote: "Founder accepts this constraint for one cycle.",
      }),
    );

    const pauseInput = container.querySelector("#cycle-pause-reason") as HTMLInputElement;
    await act(async () => setValue(pauseInput, "Pause for founder evidence."));
    await flushReact();
    await clickButton(container, "Pause cycle");
    expect(mockFounderCockpitApi.pauseCycle).toHaveBeenCalledWith(
      "company-1",
      diagnosisCycle.id,
      { reason: "Pause for founder evidence." },
    );

    await act(async () => root.unmount());

    const paused = renderCycle(cycle({
      status: "paused",
      phase: "diagnose",
      pausedReason: "Pause for founder evidence.",
      pausedAt: new Date("2026-07-31T21:00:00.000Z"),
    }));
    expect(paused.container.textContent).toContain("Cycle paused in DIAGNOSE");
    await clickButton(paused.container, "Resume DIAGNOSE");
    expect(mockFounderCockpitApi.resumeCycle).toHaveBeenCalled();
    await act(async () => paused.root.unmount());
  });

  it("shows the intervention commitment and evidence-promotion controls in order", async () => {
    const leverage = renderCycle(cycle({
      phase: "leverage",
      diagnoseOutput: {
        constraint: {
          engine: "customer",
          hypothesis: "Cohort recruitment is the constraint.",
          confidence: "medium",
          evidence: [{ kind: "cohort", label: "Cohort evidence" }],
          decision: "accepted",
          decisionNote: "Accepted.",
          decidedByUserId: "founder-1",
          decidedAt: "2026-07-31T20:00:00.000Z",
        },
        approvedByUserId: "founder-1",
        approvedAt: "2026-07-31T20:00:00.000Z",
      },
    }));
    expect(leverage.container.textContent).toContain("Bounded intervention");
    expect(leverage.container.textContent).toContain("Success signal");
    expect(leverage.container.textContent).toContain("Founder commitment note");
    expect(leverage.container.textContent).toContain("Commit intervention and continue");
    await act(async () => leverage.root.unmount());

    const compoundCycle = cycle({
      phase: "compound",
      contextProjectionId: "44444444-4444-4444-8444-444444444444",
      leverageOutput: {
        intervention: {
          title: "Run one founder onboarding session",
          rationale: "Test the controlled loop.",
          engine: "customer",
          successSignal: "One founder completes the path.",
          approvalRequired: true,
          evidence: [],
        },
        commitmentNote: "Founder approves this bounded intervention.",
        committedByUserId: "founder-1",
        committedAt: "2026-08-01T10:00:00.000Z",
      },
    });
    mockFounderCockpitApi.delegateCycleIntervention.mockResolvedValue({
      cycle: compoundCycle,
      created: true,
      issue: {
        id: "55555555-5555-4555-8555-555555555555",
        identifier: "SYS-101",
        status: "backlog",
        assigneeAgentId: null,
      },
      contextProjection: {
        id: compoundCycle.contextProjectionId,
        version: 4,
      },
    });
    const compound = renderCycle(compoundCycle);
    expect(compound.container.textContent).toContain("Create bounded task");
    expect(compound.container.textContent).toContain("does not start an agent or make a model call");
    await clickButton(compound.container, "Create bounded task");
    expect(mockFounderCockpitApi.delegateCycleIntervention).toHaveBeenCalledWith(
      "company-1",
      compoundCycle.id,
    );
    expect(compound.container.textContent).toContain("Task SYS-101 is backlog and unassigned.");
    expect(compound.container.querySelector('a[href="/issues/SYS-101"]')).toBeTruthy();
    expect(compound.container.textContent).toContain("Observed outcome");
    expect(compound.container.textContent).toContain("Outcome evidence");
    expect(compound.container.textContent).toContain("Learning to promote");
    expect(compound.container.textContent).toContain("Next bounded move after this cycle");
    expect(compound.container.textContent).toContain("Promote evidence and complete cycle");
    await act(async () => compound.root.unmount());
  });
});
