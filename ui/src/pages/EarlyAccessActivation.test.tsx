// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EarlyAccessActivationPage } from "./EarlyAccessActivation";

const getActivationMock = vi.hoisted(() => vi.fn());
const activateMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/api/early-access", () => ({
  earlyAccessApi: {
    getActivation: (token: string) => getActivationMock(token),
    activate: (token: string) => activateMock(token),
  },
}));

vi.mock("@/api/auth", () => ({
  authApi: {
    getSession: () => getSessionMock(),
  },
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompany: null,
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function LocationProbe() {
  const location = useLocation();
  return <output>{`${location.pathname}${location.search}`}</output>;
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("EarlyAccessActivationPage", () => {
  beforeEach(() => {
    const grant = {
      id: "grant-1",
      requestId: "request-1",
      founderName: "Ada Founder",
      email: "ada@example.com",
      source: "founder-session",
      maxVentures: 3,
      expiresAt: "2026-08-06T12:00:00.000Z",
      activatedAt: null,
      revokedAt: null,
      status: "ready",
    };
    getActivationMock.mockResolvedValue(grant);
    activateMock.mockResolvedValue({
      ...grant,
      activatedAt: "2026-08-03T12:00:00.000Z",
      status: "activated",
      activatedByUserId: "user-1",
    });
    getSessionMock.mockResolvedValue({
      session: { id: "session-1", userId: "user-1" },
      user: {
        id: "user-1",
        name: "Ada Founder",
        email: "ada@example.com",
        image: null,
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("restores the retained scanner handoff after activation", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/activate/founder-token"]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route path="/activate/:token" element={<EarlyAccessActivationPage />} />
              <Route path="/onboarding" element={<LocationProbe />} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
    await flushReact();

    const activateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Activate founder access"),
    );
    expect(activateButton).toBeDefined();

    await act(async () => {
      activateButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(activateMock).toHaveBeenCalledWith("founder-token");
    expect(container.querySelector("output")?.textContent).toBe(
      "/onboarding?from=scanner&via=early-access",
    );

    await act(async () => {
      root.unmount();
    });
  });
});
