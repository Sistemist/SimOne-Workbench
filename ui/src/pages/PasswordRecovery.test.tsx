// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordRecoveryPage } from "./PasswordRecovery";

const requestPasswordResetMock = vi.hoisted(() => vi.fn());
const resetPasswordMock = vi.hoisted(() => vi.fn());

vi.mock("../api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/auth")>();
  return {
    ...actual,
    authApi: {
      requestPasswordReset: (input: unknown) => requestPasswordResetMock(input),
      resetPassword: (input: unknown) => resetPasswordMock(input),
    },
  };
});

vi.mock("@/components/AsciiArtAnimation", () => ({
  AsciiArtAnimation: () => null,
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn(), toggleTheme: vi.fn() }),
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompany: null,
    selectedCompanyId: null,
    companies: [],
    selectionSource: "manual",
    loading: false,
    error: null,
    setSelectedCompanyId: vi.fn(),
    reloadCompanies: vi.fn(),
    createCompany: vi.fn(),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
  flushSync(() => {});
}

describe("PasswordRecoveryPage", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    requestPasswordResetMock.mockResolvedValue(undefined);
    resetPasswordMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  async function mount(initialEntry: string) {
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route path="/auth/forgot-password" element={<PasswordRecoveryPage />} />
              <Route path="/auth/reset-password" element={<PasswordRecoveryPage />} />
              <Route path="/auth" element={<p>Sign-in destination</p>} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
    await flushReact();
    return root;
  }

  function setInput(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("requests recovery with account-neutral confirmation wording", async () => {
    const root = await mount("/auth/forgot-password");
    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
    await act(async () => setInput(emailInput, "owner@example.test"));

    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushReact();

    expect(requestPasswordResetMock).toHaveBeenCalledWith({
      email: "owner@example.test",
      redirectTo: "http://localhost:3000/auth/reset-password",
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain("If an account exists");

    await act(async () => root.unmount());
  });

  it("rejects a missing or expired token without submitting a password", async () => {
    const root = await mount("/auth/reset-password?error=INVALID_TOKEN");

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("invalid or has expired");
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    expect(resetPasswordMock).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it("submits matching passwords with the one-time token and returns to sign in", async () => {
    const root = await mount("/auth/reset-password?token=one-time-test-token");
    const inputs = Array.from(container.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
    await act(async () => {
      setInput(inputs[0]!, "replacement-test-password");
      setInput(inputs[1]!, "replacement-test-password");
    });

    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushReact();

    expect(resetPasswordMock).toHaveBeenCalledWith({
      token: "one-time-test-token",
      newPassword: "replacement-test-password",
    });
    expect(container.textContent).toContain("Sign-in destination");

    await act(async () => root.unmount());
  });

  it("shows the same invalid-link message when a used token is rejected", async () => {
    resetPasswordMock.mockRejectedValueOnce(new Error("INVALID_TOKEN"));
    const root = await mount("/auth/reset-password?token=used-test-token");
    const inputs = Array.from(container.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
    await act(async () => {
      setInput(inputs[0]!, "replacement-test-password");
      setInput(inputs[1]!, "replacement-test-password");
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushReact();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("invalid or has expired");

    await act(async () => root.unmount());
  });
});
