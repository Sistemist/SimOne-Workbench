// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";
import { SystemsBottleneckScanner } from "./SystemsBottleneckScanner";

function renderScanner(container: HTMLElement) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(<SystemsBottleneckScanner />);
  });
  return root;
}

async function updateField(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const inputValueSetter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(element),
    "value",
  )?.set;
  await act(async () => {
    inputValueSetter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("SystemsBottleneckScanner", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("turns a messy founder note into a bottleneck, next action, and starter map preview", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderScanner(container);

    expect(container.textContent).toContain("Systems Bottleneck Scanner");
    expect(container.textContent).not.toMatch(/model|provider|LLM/i);

    const urlInput = container.querySelector<HTMLInputElement>('input[name="startupUrl"]');
    const noteInput = container.querySelector<HTMLTextAreaElement>('textarea[name="founderNote"]');
    expect(urlInput).not.toBeNull();
    expect(noteInput).not.toBeNull();

    await updateField(urlInput!, "https://example.com");
    await updateField(
      noteInput!,
      "We have interested leads and waitlist replies, but follow-up is scattered and approvals sit in my inbox.",
    );

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Scan"),
    );
    expect(button).toBeTruthy();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Customer loop is leaking");
    expect(text).toContain("Customer Engine");
    expect(text).toContain("Make one review queue for replies, prospects, and proof points.");
    expect(text).toContain("Questions SimOne would ask next");
    expect(text).toContain("Who should approve the next customer reply or offer?");
    expect(text).toContain("What proof would make this worth doing now?");
    expect(text).toContain("Starter map preview");
    expect(text).toContain("Venture Architecture Map");
    expect(text).toContain("Sprint Zero brief");
    expect(text).toContain("What is clear");
    expect(text).toContain("Customer signal exists, but it is not moving through one trusted review loop.");
    expect(text).toContain("What needs proof");
    expect(text).toContain("What proof would make this worth doing now?");
    expect(text).toContain("Human review boundary");
    expect(text).toContain("Approve the next customer-facing reply or offer before agents act.");
    expect(text).toContain("First move");
    expect(text).toContain("Safe share summary");
    expect(text).toContain("Likely bottleneck: Customer loop is leaking");
    expect(text).toContain("Focus: Customer Engine");
    expect(text).toContain("Next move: Make one review queue for replies, prospects, and proof points.");
    expect(text).toContain("Founder note and startup URL are not included.");
    expect(text).toContain("Your scan will carry into SIM Starter after sign-in.");
    expect(text).toContain("Create my map");
    expect(text).not.toMatch(/model|provider|LLM|api key|runtime/i);

    const storedScan = window.localStorage.getItem("simone:bottleneck-scan");
    expect(storedScan).not.toBeNull();
    expect(JSON.parse(storedScan!)).toMatchObject({
      input: {
        startupUrl: "https://example.com",
        founderNote:
          "We have interested leads and waitlist replies, but follow-up is scattered and approvals sit in my inbox.",
      },
      result: {
        headline: "Customer loop is leaking",
        engine: "Customer Engine",
        questions: [
          "Who should approve the next customer reply or offer?",
          "What proof would make this worth doing now?",
          "Where should the answer be saved so it is not lost?",
        ],
        mapPreview: {
          artifact: "Venture Architecture Map",
          primaryEngine: "Customer Engine",
        },
        sprintZeroBrief: {
          clear: [
            "Likely bottleneck: Customer loop is leaking.",
            "Primary engine: Customer Engine.",
            "Customer signal exists, but it is not moving through one trusted review loop.",
          ],
          needsProof: [
            "What proof would make this worth doing now?",
            "Show the next signal in one review queue before scaling follow-up.",
          ],
          humanReview: [
            "Approve the next customer-facing reply or offer before agents act.",
            "Keep customers, money, public claims, and company structure behind human review.",
          ],
          firstMove: "Make one review queue for replies, prospects, and proof points.",
        },
      },
    });

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(links.some((link) => link.getAttribute("href") === "/auth?next=%2Fonboarding%3Ffrom%3Dscanner")).toBe(true);

    flushSync(() => {
      root.unmount();
    });
  });
});
