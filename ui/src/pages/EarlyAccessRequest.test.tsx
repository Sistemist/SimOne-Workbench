// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EarlyAccessRequestPage } from "./EarlyAccessRequest";
import { saveScannerSnapshot } from "@/lib/scanner-storage";

const requestAccessMock = vi.hoisted(() => vi.fn());

vi.mock("@/api/early-access", () => ({
  earlyAccessApi: {
    requestAccess: (input: unknown) => requestAccessMock(input),
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function updateField(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  await act(async () => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("EarlyAccessRequestPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    requestAccessMock.mockResolvedValue({
      accepted: true,
      id: "request-1",
      status: "pending",
      scanRetained: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("submits an invite-only request with explicit scan-retention consent", async () => {
    const scan = {
      id: "11111111-1111-4111-8111-111111111111",
      algorithmVersion: "scanner-patterns-v1",
      input: {
        startupUrl: "https://example.com",
        founderNote: "Customer follow-up is scattered.",
      },
      result: { engine: "Customer Engine" },
      savedAt: "2026-08-03T12:00:00.000Z",
    };
    saveScannerSnapshot(scan);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/request-access?scan=${scan.id}&source=viveka`]}>
          <EarlyAccessRequestPage />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Invite-only early access");
    expect(container.textContent).toContain("Keep this scan with my request");
    expect(container.textContent).toContain("up to 30 days");

    const inputs = container.querySelectorAll<HTMLInputElement>("input");
    const nameInput = inputs[0]!;
    const emailInput = inputs[1]!;
    await updateField(nameInput, "Ada Founder");
    await updateField(emailInput, "ada@example.com");
    await updateField(
      container.querySelector<HTMLTextAreaElement>("textarea")!,
      "A founder operating system",
    );

    await act(async () => {
      container.querySelector("form")!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(requestAccessMock).toHaveBeenCalledWith(expect.objectContaining({
      founderName: "Ada Founder",
      email: "ada@example.com",
      useCase: "A founder operating system",
      source: "viveka",
      consentToRetainScan: true,
      scan,
    }));
    expect(container.textContent).toContain("Request received");

    await act(async () => {
      root.unmount();
    });
  });
});
