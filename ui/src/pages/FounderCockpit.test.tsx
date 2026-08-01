// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FounderCockpit } from "./FounderCockpit";

const mockSetBreadcrumbs = vi.hoisted(() => vi.fn());
const mockSearchParams = vi.hoisted(() => ({ value: "" }));
const mockFounderCockpitApi = vi.hoisted(() => ({
  get: vi.fn(),
  constitutionRevisions: vi.fn(),
  stateRevisions: vi.fn(),
  createConstitutionRevision: vi.fn(),
  activateConstitutionRevision: vi.fn(),
  restoreConstitutionRevision: vi.fn(),
  createContextProjection: vi.fn(),
}));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: mockSetBreadcrumbs }),
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

vi.mock("@/api/founderCockpit", () => ({
  founderCockpitApi: mockFounderCockpitApi,
}));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(mockSearchParams.value)],
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const constitution = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "company-1",
  version: 2,
  status: "active",
  content: {
    purpose: "Keep the founder in control of a coherent venture loop.",
    intendedImpact: "Useful ventures with human judgment intact.",
    customerPrinciples: ["Start with observed constraints."],
    qualityPrinciples: ["Prefer inspectable evidence."],
    voice: {
      desired: ["Grounded"],
      examples: ["Show the next bounded move."],
      counterexamples: ["Promise autonomous success."],
    },
    nonNegotiables: ["Founder approval before consequential change."],
    antiGoals: ["Autonomous weekly scheduling."],
    decisionRights: {
      founder: ["Choose the active constraint."],
      delegated: ["Prepare bounded proposals."],
      approvalRequired: ["Public commitments"],
    },
    riskTolerance: {
      financial: "Bounded",
      security: "Fail closed",
      privacy: "Minimum necessary context",
      reputational: "No unverified claims",
    },
    evidenceStandards: ["Record provenance."],
  },
  changeReason: "Clarify founder control.",
  sourceRefs: [],
  restoredFromRevisionId: null,
  createdByAgentId: null,
  createdByUserId: "founder-1",
  activatedByUserId: "founder-1",
  approvalNote: "Approved.",
  activatedAt: "2026-07-31T19:00:00.000Z",
  supersededAt: null,
  createdAt: "2026-07-31T18:00:00.000Z",
};

const state = {
  id: "22222222-2222-4222-8222-222222222222",
  companyId: "company-1",
  version: 3,
  status: "current",
  content: {
    ventureSummary: "Sysdom AI is preparing a controlled founder cohort.",
    engines: {
      product: {
        summary: "Founder Cockpit is the next product proof.",
        evidence: [{ kind: "product_review", label: "Product review" }],
        freshness: "2026-07-31T20:00:00.000Z",
      },
      customer: {
        summary: "Founder cohort recruitment has not started.",
        evidence: [{ kind: "customer_review", label: "Customer review" }],
        freshness: "2026-07-31T20:00:00.000Z",
      },
      cash: {
        summary: "No paid-model spend is authorized.",
        evidence: [{ kind: "cash_review", label: "Cash review" }],
        freshness: "2026-07-31T20:00:00.000Z",
      },
      skills: {
        summary: "Core control-plane capability is present.",
        evidence: [{ kind: "skills_review", label: "Skills review" }],
        freshness: "2026-07-31T20:00:00.000Z",
      },
    },
    activeConstraint: {
      engine: "customer",
      hypothesis: "Recruiting and learning from the first founder cohort is the current bottleneck.",
      confidence: "medium",
      evidence: [{ kind: "clickup", id: "86eyeztfu", label: "Scanner outcome" }],
      decision: "accepted",
      decisionNote: "Founder selected this constraint.",
      decidedByUserId: "founder-1",
      decidedAt: "2026-07-31T20:00:00.000Z",
    },
    nextMove: {
      title: "Run one founder onboarding session",
      rationale: "Test the loop before increasing acquisition.",
      engine: "customer",
      approvalRequired: true,
    },
    learnings: ["Founder control must remain explicit."],
    refreshedAt: "2026-07-31T20:00:00.000Z",
  },
  creationReason: "Guided SIM Cycle map.",
  sourceRefs: [],
  constitutionRevisionId: constitution.id,
  basedOnCycleId: null,
  createdByAgentId: null,
  createdByUserId: "founder-1",
  createdAt: "2026-07-31T20:00:00.000Z",
  supersededAt: null,
};

const previousState = {
  ...state,
  id: "22222222-2222-4222-8222-111111111111",
  version: 2,
  status: "superseded",
  content: {
    ...state.content,
    ventureSummary: "Sysdom AI has a working control plane but no founder operating loop.",
    engines: {
      ...state.content.engines,
      customer: {
        summary: "Founder cohort definition is incomplete.",
        evidence: [{ kind: "customer_review", label: "Earlier customer review" }],
        freshness: "2026-07-30T20:00:00.000Z",
      },
    },
    activeConstraint: null,
    nextMove: null,
    learnings: [],
    refreshedAt: "2026-07-30T20:00:00.000Z",
  },
  creationReason: "Initial deterministic venture map.",
  sourceRefs: [{ kind: "founder_map", label: "Initial founder map" }],
  createdAt: "2026-07-30T20:00:00.000Z",
  supersededAt: "2026-07-31T20:00:00.000Z",
};

const projection = {
  id: "33333333-3333-4333-8333-333333333333",
  companyId: "company-1",
  version: 3,
  status: "current",
  constitutionRevisionId: constitution.id,
  ventureStateRevisionId: state.id,
  creationReason: "Prepare bounded context for a guided SIM Cycle.",
  content: {
    purpose: constitution.content.purpose,
    nonNegotiables: constitution.content.nonNegotiables,
    approvalBoundaries: constitution.content.decisionRights.approvalRequired,
    ventureSummary: state.content.ventureSummary,
    engines: Object.fromEntries(
      Object.entries(state.content.engines).map(([key, value]) => [
        key,
        { summary: value.summary, freshness: value.freshness },
      ]),
    ),
    activeConstraint: state.content.activeConstraint,
    nextMove: state.content.nextMove,
  },
  sourceRefs: [
    {
      kind: "venture_constitution_revision",
      id: constitution.id,
      label: "Venture Constitution v2",
    },
    {
      kind: "venture_state_revision",
      id: state.id,
      label: "Canonical venture state v3",
    },
  ],
  supersedesProjectionId: null,
  createdByAgentId: null,
  createdByUserId: "founder-1",
  createdAt: "2026-07-31T20:01:00.000Z",
  supersededAt: null,
};

const snapshot = {
  company: { id: "company-1", name: "Sysdom AI", updatedAt: "2026-07-31T20:00:00.000Z" },
  constitution,
  ventureState: state,
  contextProjection: projection,
  approvals: { pending: 2 },
  work: { active: 4, blocked: 1, completed: 8 },
  freshness: { projectedAt: "2026-07-31T20:02:00.000Z", sources: projection.sourceRefs },
  activeCycle: null,
  latestCycle: null,
};

const completedCycle = {
  id: "cycle-1",
  companyId: "company-1",
  status: "completed",
  phase: "complete",
  constitutionRevisionId: constitution.id,
  startingStateRevisionId: null,
  currentStateRevisionId: state.id,
  contextProjectionId: "consumed-projection-1",
  startReason: "Run one deliberate founder-triggered SIM Cycle.",
  mapOutput: {
    ventureStateRevisionId: "state-1",
    completedAt: "2026-07-31T19:30:00.000Z",
  },
  diagnoseOutput: null,
  leverageOutput: null,
  compoundOutput: {
    outcome: "The founder completed the first operating loop.",
    evidence: [],
    learning: "Keep the next action visible across every handoff.",
    promotedStateRevisionId: state.id,
    completedAt: "2026-07-31T20:00:00.000Z",
  },
  startedByUserId: "founder-1",
  pausedReason: null,
  pausedAt: null,
  resumedAt: null,
  completedAt: "2026-07-31T20:00:00.000Z",
  createdAt: "2026-07-31T19:00:00.000Z",
  updatedAt: "2026-07-31T20:00:00.000Z",
};

async function flushReact() {
  await act(async () => {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

async function waitForText(container: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.textContent?.includes(text)) return;
    await flushReact();
  }
  expect(container.textContent).toContain(text);
}

function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  flushSync(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <FounderCockpit />
      </QueryClientProvider>,
    );
  });
  return { container, root };
}

describe("FounderCockpit", () => {
  beforeEach(() => {
    mockSearchParams.value = "";
    mockFounderCockpitApi.get.mockResolvedValue(snapshot);
    mockFounderCockpitApi.constitutionRevisions.mockResolvedValue([constitution]);
    mockFounderCockpitApi.stateRevisions.mockResolvedValue([state, previousState]);
    mockFounderCockpitApi.createContextProjection.mockResolvedValue(projection);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("shows canonical venture state, governance gates, next move, and provenance", async () => {
    const { container, root } = renderPage();
    await waitForText(container, "Run one founder onboarding session");

    const text = container.textContent ?? "";
    expect(text).toContain("Founder control surface");
    expect(text).toContain("Founder practice path");
    expect(text).toContain("Start the next guided cycle");
    expect(text).toContain("Constitution v2");
    expect(text).toContain("State v3");
    expect(text).toContain("4Active work");
    expect(text).toContain("1Blocked");
    expect(text).toContain("2Pending approvals");
    expect(text).toContain(constitution.content.purpose);
    expect(text).toContain("Founder approval before consequential change.");
    expect(text).toContain("Product");
    expect(text).toContain("Customer");
    expect(text).toContain("Cash");
    expect(text).toContain("Skills");
    expect(text).toContain(state.content.activeConstraint.hypothesis);
    expect(text).toContain("accepted");
    expect(text).toContain("Founder approval required");
    expect(text).toContain("Venture Constitution v2");
    expect(text).toContain("Canonical venture state v3");
    expect(text).toContain("What changed in State v3");
    expect(text).toContain("Compared with State v2.");
    expect(text).toContain("Customer changed");
    expect(text).toContain("Constraint changed");
    expect(text).toContain("Next move changed");
    expect(text).toContain("1 learning added");
    expect(text).toContain("Initial deterministic venture map.");
    expect(mockSetBreadcrumbs).toHaveBeenCalledWith([{ label: "Founder Cockpit" }]);

    await act(async () => root.unmount());
  });

  it("preserves the seeded first-MAP task when SIM Starter hands off to the Cockpit", async () => {
    mockSearchParams.value = "from=sim-starter&issue=SYS-1";

    const { container, root } = renderPage();
    await waitForText(container, "SIM Starter is ready in the Founder Cockpit.");

    expect(container.textContent).toContain("Your seeded first-MAP task is preserved as working context.");
    const firstMapLink = Array.from(container.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("Open seeded first-MAP task"),
    );
    expect(firstMapLink?.getAttribute("href")).toBe("/issues/SYS-1");

    await act(async () => root.unmount());
  });

  it("keeps an unactivated Constitution draft visibly pending founder approval", async () => {
    const draft = {
      ...constitution,
      id: "draft-1",
      version: 3,
      status: "draft",
      content: {
        ...constitution.content,
        purpose: "Keep the founder in control while making revision decisions inspectable.",
        decisionRights: {
          ...constitution.content.decisionRights,
          approvalRequired: [
            ...constitution.content.decisionRights.approvalRequired,
            "Plugin exposure changes",
          ],
        },
      },
      activatedAt: null,
    };
    mockFounderCockpitApi.constitutionRevisions.mockResolvedValue([draft, constitution]);

    const { container, root } = renderPage();
    await waitForText(container, "waiting for founder approval");

    expect(container.textContent).toContain("Version 3");
    expect(container.textContent).toContain("draft");
    expect(container.textContent).toContain("Direction");
    expect(container.textContent).toContain("Decision rights");
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "Activate")).toBe(true);

    await act(async () => root.unmount());
  });

  it("keeps current venture state usable when revision history cannot load", async () => {
    mockFounderCockpitApi.stateRevisions.mockRejectedValue(new Error("history unavailable"));

    const { container, root } = renderPage();
    await waitForText(container, "State history could not load.");

    expect(container.textContent).toContain(state.content.activeConstraint.hypothesis);
    expect(container.textContent).toContain("Run one founder onboarding session");
    expect(container.textContent).toContain(
      "The current venture state remains available, but revision comparison is temporarily unavailable.",
    );

    await act(async () => root.unmount());
  });

  it("recovers a failed first load into an ordered empty-state practice path", async () => {
    mockFounderCockpitApi.get
      .mockRejectedValueOnce(new Error("snapshot unavailable"))
      .mockResolvedValue({
        ...snapshot,
        constitution: null,
        ventureState: null,
        contextProjection: null,
        activeCycle: null,
        latestCycle: null,
      });
    mockFounderCockpitApi.constitutionRevisions.mockResolvedValue([]);
    mockFounderCockpitApi.stateRevisions.mockResolvedValue([]);

    const { container, root } = renderPage();
    await waitForText(container, "The Founder Cockpit could not load.");

    expect(container.textContent).not.toContain("Draft and activate the Constitution");
    const retry = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Retry"),
    );
    expect(retry).toBeDefined();

    await act(async () => {
      retry!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitForText(container, "Draft the Constitution");

    const text = container.textContent ?? "";
    expect(text.indexOf("Govern")).toBeLessThan(text.indexOf("Map"));
    expect(text.indexOf("Map")).toBeLessThan(text.indexOf("Run one cycle"));
    expect(text.indexOf("Run one cycle")).toBeLessThan(text.indexOf("Reflect"));
    expect(text).toContain("You trigger every gate.");
    expect(mockFounderCockpitApi.get).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
  });

  it("hands a completed guided cycle directly to SIM Coach", async () => {
    mockFounderCockpitApi.get.mockResolvedValue({
      ...snapshot,
      latestCycle: completedCycle,
    });

    const { container, root } = renderPage();
    await waitForText(container, "Review in SIM Coach");

    expect(container.textContent).toContain("MAP → DIAGNOSE → LEVERAGE → COMPOUND complete");
    expect(container.textContent).toContain("Open SIM Coach");
    const coachLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href="/sim-coach"]'));
    expect(coachLinks).toHaveLength(2);

    await act(async () => root.unmount());
  });
});
