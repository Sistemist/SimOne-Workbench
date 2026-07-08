// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "./OnboardingWizard";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetSelectedCompanyId = vi.hoisted(() => vi.fn());
const mockCloseOnboarding = vi.hoisted(() => vi.fn());
const mockSetOnboardingRouteDismissed = vi.hoisted(() => vi.fn());
const mockCompaniesApi = vi.hoisted(() => ({
  create: vi.fn(),
}));
const mockGoalsApi = vi.hoisted(() => ({
  create: vi.fn(),
}));
const mockTeamCatalogApi = vi.hoisted(() => ({
  install: vi.fn(),
}));

vi.mock("@/lib/router", () => ({
  useLocation: () => ({ pathname: "/onboarding" }),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));

vi.mock("../context/DialogContext", () => ({
  useDialog: () => ({
    onboardingOpen: true,
    onboardingOptions: {},
    onboardingRouteDismissed: false,
    closeOnboarding: mockCloseOnboarding,
    setOnboardingRouteDismissed: mockSetOnboardingRouteDismissed,
  }),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    companies: [],
    selectedCompany: null,
    setSelectedCompanyId: mockSetSelectedCompanyId,
    loading: false,
  }),
}));

vi.mock("../api/companies", () => ({
  companiesApi: mockCompaniesApi,
}));

vi.mock("../api/goals", () => ({
  goalsApi: mockGoalsApi,
}));

vi.mock("../api/teamCatalog", () => ({
  teamCatalogApi: mockTeamCatalogApi,
}));

vi.mock("./AsciiArtAnimation", () => ({
  AsciiArtAnimation: () => <div data-testid="ascii-art-animation" />,
}));

function renderWizard(container: HTMLElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <OnboardingWizard />
      </QueryClientProvider>
    );
  });
  return root;
}

function findButton(root: ParentNode, label: string) {
  const button = Array.from(root.querySelectorAll("button")).find((candidate) =>
    (candidate.textContent ?? "").includes(label)
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function updateTextField(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  flushSync(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("OnboardingWizard SIM Starter path", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    mockCompaniesApi.create.mockResolvedValue({
      id: "company-1",
      name: "Sysdom",
      issuePrefix: "SYS",
    });
    mockGoalsApi.create.mockResolvedValue({ id: "goal-1" });
    mockTeamCatalogApi.install.mockResolvedValue({
      portabilityImport: {
        agents: [{ action: "created" }],
        projects: [{ action: "created" }],
      },
    });
  });

  afterEach(() => {
    flushSync(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("creates a company and installs the SimOne starter without model setup", async () => {
    root = renderWizard(container);

    flushSync(() => {
      findButton(document.body, "Start with SIM Starter").dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    const companyInput = document.body.querySelector<HTMLInputElement>(
      'input[placeholder="Acme Corp"]'
    );
    expect(companyInput).not.toBeNull();
    updateTextField(companyInput!, "Sysdom");

    flushSync(() => {
      findButton(document.body, "Next").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const missionInput = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="Paste the messy version: what are you building, selling, teaching, or trying to fix?"]'
    );
    expect(missionInput).not.toBeNull();
    updateTextField(missionInput!, "Teach nontechnical founders how to run an AI-first company.");

    expect(document.body.textContent ?? "").toContain("SIM Starter will create:");
    expect(document.body.textContent ?? "").toContain("First draft preview");
    expect(document.body.textContent ?? "").toContain("Assumptions SimOne will check");
    expect(document.body.textContent ?? "").toContain("You approve before agents act on customers, money, public claims, or company structure");
    expect(document.body.textContent ?? "").toContain(
      "CEO/controller plus Product, Customer, Cash, and Skills engine leads"
    );

    flushSync(() => {
      findButton(document.body, "Create SIM Starter").dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });
    await flushReact();

    expect(mockCompaniesApi.create).toHaveBeenCalledWith({ name: "Sysdom" });
    expect(mockGoalsApi.create).toHaveBeenCalledWith("company-1", {
      title: "Teach nontechnical founders how to run an AI-first company.",
      level: "company",
      status: "active",
    });
    expect(mockTeamCatalogApi.install).toHaveBeenCalledWith(
      "company-1",
      "paperclipai/bundled/simone/simone-starter",
      {
        targetManagerAgentId: null,
        collisionStrategy: "rename",
        sourcePolicy: {
          allowExternalSources: false,
          allowUnpinnedOptionalSources: false,
          allowLocalPathSources: false,
        },
      }
    );
    expect(mockSetSelectedCompanyId).toHaveBeenCalledWith("company-1");
    expect(mockCloseOnboarding).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/SYS/dashboard");
  });

  it("frames the starter input as messy venture context before setup", () => {
    root = renderWizard(container);

    flushSync(() => {
      findButton(document.body, "Start with SIM Starter").dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    const companyInput = document.body.querySelector<HTMLInputElement>(
      'input[placeholder="Acme Corp"]'
    );
    expect(companyInput).not.toBeNull();
    updateTextField(companyInput!, "Sysdom");

    flushSync(() => {
      findButton(document.body, "Next").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(document.body.textContent ?? "").toContain("Paste the messy version");
    expect(document.body.textContent ?? "").toContain("SimOne will draft a first map from it");
    expect(document.body.textContent ?? "").toContain("Product, Customer, Cash, and Skills");
    expect(document.body.textContent ?? "").toContain("approval boundary");
    expect(document.body.textContent ?? "").not.toContain("Choose a model");
    expect(document.body.textContent ?? "").not.toContain("Provider");

    const messyContextInput = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="Paste the messy version: what are you building, selling, teaching, or trying to fix?"]'
    );
    expect(messyContextInput).not.toBeNull();
    expect(document.body.textContent ?? "").toContain("Messy venture context");
    expect(document.body.textContent ?? "").not.toContain("MissionBuild a SaaS product");
  });

  it("starts the SIM Starter path from a saved public bottleneck scan", () => {
    localStorage.setItem(
      "simone:bottleneck-scan",
      JSON.stringify({
        input: {
          startupUrl: "https://example.com",
          founderNote: "We have leads, but follow-up and approvals are scattered.",
        },
        result: {
          headline: "Customer loop is leaking",
          engine: "Customer Engine",
          nextAction: "Make one review queue for replies, prospects, and proof points.",
        },
      }),
    );

    root = renderWizard(container);

    expect(document.body.textContent ?? "").toContain("Name your company");
    expect(document.body.textContent ?? "").not.toContain("Welcome to SimOne");

    const companyInput = document.body.querySelector<HTMLInputElement>(
      'input[placeholder="Acme Corp"]'
    );
    expect(companyInput).not.toBeNull();
    updateTextField(companyInput!, "Sysdom");

    flushSync(() => {
      findButton(document.body, "Next").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const missionInput = document.body.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder="Paste the messy version: what are you building, selling, teaching, or trying to fix?"]'
    );
    expect(missionInput?.value).toContain("Customer loop is leaking");
    expect(missionInput?.value).toContain("Make one review queue for replies, prospects, and proof points.");
  });
});
