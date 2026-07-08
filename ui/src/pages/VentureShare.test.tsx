// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VentureShare } from "./VentureShare";

const ventureSharesApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("../api/ventureShares", () => ({
  ventureSharesApi: ventureSharesApiMock,
}));

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForAssertion(assertion: () => void, attempts = 50) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await flush();
    }
  }
  throw lastError;
}

function renderShare(container: HTMLElement) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <MemoryRouter initialEntries={["/share/venture/share-1"]}>
        <Routes>
          <Route path="/share/venture/:shareId" element={<VentureShare />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return root;
}

describe("VentureShare", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    ventureSharesApiMock.get.mockReset();
  });

  afterEach(() => {
    container.remove();
  });

  it("renders a public-safe venture architecture snapshot", async () => {
    ventureSharesApiMock.get.mockResolvedValue({
      id: "share-1",
      companyId: "company-1",
      createdAt: "2026-07-07T21:00:00.000Z",
      snapshot: {
        schemaVersion: 1,
        shareId: "share-1",
        generatedAt: "2026-07-07T21:00:00.000Z",
        company: {
          name: "Acme Systems",
          description: "Turns messy customer work into one calm review loop.",
          brandColor: "#18a999",
        },
        agents: [{ name: "Thomasina", title: "Founder", role: "CEO", capabilities: "Decides what matters." }],
        projects: [{ name: "Customer Engine", description: "Keep relationship signal moving.", status: "active" }],
        nextMoves: [{ title: "Review customer replies", priority: "high", status: "open", projectName: "Customer Engine" }],
        principles: ["Human judgment stays visible."],
      },
    });

    const root = renderShare(container);

    await waitForAssertion(() => {
      const text = container.textContent ?? "";
      expect(text).toContain("Acme Systems");
      expect(text).toContain("Venture Architecture Map");
      expect(text).toContain("What this map means");
      expect(text).toContain("A public, safe view of how Acme Systems is organized to move work forward.");
      expect(text).toContain("1 operating role");
      expect(text).toContain("1 work stream");
      expect(text).toContain("1 next move");
      expect(text).toContain("Public preview");
      expect(text).toContain("Opening line");
      expect(text).toContain("Acme Systems is organizing 1 operating role and 1 work stream around Customer Engine.");
      expect(text).toContain("What to notice first");
      expect(text).toContain("The next judgment is Review customer replies.");
      expect(text).toContain("Suggested follow-up");
      expect(text).toContain("Which proof would make Review customer replies worth doing next?");
      expect(text).toContain("Sprint Zero brief");
      expect(text).toContain("What is clear");
      expect(text).toContain("Acme Systems has 1 operating role and 1 work stream in motion.");
      expect(text).toContain("What needs proof");
      expect(text).toContain("Review customer replies is the next move to test.");
      expect(text).toContain("Human review boundary");
      expect(text).toContain("Review the next move before customers, money, public claims, or structure change.");
      expect(text).toContain("Proof context");
      expect(text).toContain("Ready for Sprint Zero, not proof of market fit.");
      expect(text).toContain("Use this map to decide what to test next; do not treat it as customer validation.");
      expect(text).toContain("Public-safe by design");
      expect(text).toContain("Raw notes, customer queues, internal costs, run logs, and technical setup details are not included.");
      expect(text).toContain("What to ask next");
      expect(text).toContain("Which assumption should be proven before this venture changes offer, pricing, or public claims?");
      expect(text).toContain("Thomasina");
      expect(text).toContain("Customer Engine");
      expect(text).toContain("Review customer replies");
      expect(text).toContain("Human judgment stays visible");
      expect(text).not.toMatch(/model|provider|api key|runtime/i);
    });
    expect(ventureSharesApiMock.get).toHaveBeenCalledWith("share-1");

    flushSync(() => {
      root.unmount();
    });
  });
});
