// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("offers lived example notes that can seed a scan", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderScanner(container);

    const text = container.textContent ?? "";
    expect(text).toContain("Free first readout, protected full map after sign-in.");
    expect(text).toContain("Use it when you can describe what feels stuck, but you are not ready to set up the whole company yet.");
    expect(text).toContain("Public first read");
    expect(text).toContain("No account needed. Get one bottleneck and one next move from the note you provide.");
    expect(text).toContain("Protected full map");
    expect(text).toContain("Sign in when you want SimOne to save the scan, draft the starter map, and keep decisions behind approval.");
    expect(text).toContain("Customer follow-up");
    expect(text).toContain("Cash runway");
    expect(text).toContain("Skills capacity");
    expect(text).toContain("Product proof");
    expect(text).not.toMatch(/model|provider|LLM|api key|runtime/i);

    const cashExample = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Cash runway"),
    );
    expect(cashExample).toBeTruthy();
    await act(async () => {
      cashExample?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const noteInput = container.querySelector<HTMLTextAreaElement>('textarea[name="founderNote"]');
    expect(noteInput?.value).toContain("runway");
    expect(noteInput?.value).toContain("pricing");

    const scanButton = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Scan"),
    );
    await act(async () => {
      scanButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Cash pressure is steering the system");
    expect(container.textContent).toContain("Cash Engine");

    flushSync(() => {
      root.unmount();
    });
  });

  it("shows signal strength and a secondary engine for mixed notes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderScanner(container);

    const noteInput = container.querySelector<HTMLTextAreaElement>('textarea[name="founderNote"]');
    expect(noteInput).not.toBeNull();
    await updateField(
      noteInput!,
      "Waitlist replies and customer follow-up are stuck in my inbox, and runway plus pricing decisions are also getting tense.",
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
    expect(text).toContain("Signal strength");
    expect(text).toContain("4 signs pointed to Customer Engine.");
    expect(text).toContain("Also watch Cash Engine");
    expect(text).toContain("2 signs pointed there.");
    expect(text).toContain("Calibration status");
    expect(text).toContain("Early pattern match");
    expect(text).toContain("Real submission review still needed.");
    expect(text).toContain("Public summary excludes raw notes and URLs.");
    expect(text).not.toMatch(/model|provider|LLM|api key|runtime/i);

    const storedScan = window.localStorage.getItem("simone:bottleneck-scan");
    expect(storedScan).not.toBeNull();
    expect(JSON.parse(storedScan!)).toMatchObject({
      result: {
        engine: "Customer Engine",
        signalStrength: {
          primaryMatches: 4,
          secondaryEngine: "Cash Engine",
          secondaryMatches: 2,
        },
        calibration: {
          status: "early_pattern_match",
          reviewNeeded: true,
          publicSummaryExcludes: ["founderNote", "startupUrl"],
        },
      },
    });

    flushSync(() => {
      root.unmount();
    });
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
    expect(text).toContain("Why this scan picked Customer Engine");
    expect(text).toContain("Customer signal was present.");
    expect(text).toContain("Follow-up or inbox work looked scattered.");
    expect(text).toContain("Approval was part of the bottleneck.");
    expect(text).toContain("This is a bounded first read, not a private-data audit.");
    expect(text).toContain("Calibration status");
    expect(text).toContain("Early pattern match");
    expect(text).toContain("Real submission review still needed.");
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
    expect(text).toContain("Share this result");
    expect(text).toContain(
      "Built with SimOne: Customer loop is leaking. Focus: Customer Engine. Next move: Make one review queue for replies, prospects, and proof points.",
    );
    expect(text).toContain("The share version leaves out raw notes and URLs.");
    expect(text).toContain("Ask SIM Coach why");
    expect(text).toContain("Coach explains the method before you assign work.");
    expect(text).toContain("Saved in this browser");
    expect(text).toContain("Sign up to keep this readout with your full SimOne map.");
    expect(text).toContain("Your scan will carry into SIM Starter after sign-in.");
    expect(text).toContain("Save the full Customer Engine map");
    const generatedSummary = text.slice(text.indexOf("Why this scan picked Customer Engine"));
    expect(generatedSummary).not.toContain("https://example.com");
    expect(generatedSummary).not.toContain("interested leads and waitlist replies");
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
          calibration: {
            status: "early_pattern_match",
            summary: "Early pattern match. Real submission review still needed.",
            reviewNeeded: true,
            publicSummaryExcludes: ["founderNote", "startupUrl"],
          },
          diagnosisSignals: [
            "Customer signal was present.",
            "Follow-up or inbox work looked scattered.",
            "Approval was part of the bottleneck.",
          ],
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
    expect(
      links.some((link) => link.getAttribute("href") === "/auth?mode=sign_up&next=%2Fsim-coach%3Ffrom%3Dscanner"),
    ).toBe(true);
    expect(
      links.some((link) => link.getAttribute("href") === "/auth?mode=sign_up&next=%2Fonboarding%3Ffrom%3Dscanner%26focus%3Dcustomer-engine"),
    ).toBe(true);

    flushSync(() => {
      root.unmount();
    });
  });

  it("turns the scan result into a plain decision path", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderScanner(container);

    const noteInput = container.querySelector<HTMLTextAreaElement>('textarea[name="founderNote"]');
    expect(noteInput).not.toBeNull();
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
    expect(text).toContain("Decision path");
    expect(text).toContain("Do now");
    expect(text).toContain("Make one review queue for replies, prospects, and proof points.");
    expect(text).toContain("Needs your yes");
    expect(text).toContain("Approve the next customer-facing reply or offer before agents act.");
    expect(text).toContain("Carry into SimOne");
    expect(text).toContain("Save this scan as Sprint Zero context after sign-in.");
    expect(text).not.toMatch(/model|provider|LLM|api key|runtime/i);

    const storedScan = window.localStorage.getItem("simone:bottleneck-scan");
    expect(storedScan).not.toBeNull();
    expect(JSON.parse(storedScan!)).toMatchObject({
      result: {
        approvalPath: {
          doNow: "Make one review queue for replies, prospects, and proof points.",
          needsHumanYes: "Approve the next customer-facing reply or offer before agents act.",
          carryForward: "Save this scan as Sprint Zero context after sign-in.",
        },
      },
    });

    flushSync(() => {
      root.unmount();
    });
  });

  it("creates a safe share-ready summary without raw input", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderScanner(container);

    const urlInput = container.querySelector<HTMLInputElement>('input[name="startupUrl"]');
    const noteInput = container.querySelector<HTMLTextAreaElement>('textarea[name="founderNote"]');
    expect(urlInput).not.toBeNull();
    expect(noteInput).not.toBeNull();

    await updateField(urlInput!, "https://example.com/private");
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
    expect(text).toContain("Share this result");
    expect(text).toContain(
      "Built with SimOne: Customer loop is leaking. Focus: Customer Engine. Next move: Make one review queue for replies, prospects, and proof points.",
    );
    expect(text).toContain("Copy share summary");
    expect(text).toContain("The share version leaves out raw notes and URLs.");
    expect(text).not.toContain("https://example.com/private");

    const copyButton = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Copy share summary"),
    );
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(writeText).toHaveBeenCalledWith(
      "Built with SimOne: Customer loop is leaking. Focus: Customer Engine. Next move: Make one review queue for replies, prospects, and proof points.",
    );
    expect(container.textContent).toContain("Copied. Safe to share: raw notes and URLs stay out.");

    const storedScan = window.localStorage.getItem("simone:bottleneck-scan");
    expect(storedScan).not.toBeNull();
    expect(JSON.parse(storedScan!)).toMatchObject({
      result: {
        shareSummary: {
          title: "Share this result",
          publicText:
            "Built with SimOne: Customer loop is leaking. Focus: Customer Engine. Next move: Make one review queue for replies, prospects, and proof points.",
          excludes: ["founderNote", "startupUrl"],
        },
      },
    });

    flushSync(() => {
      root.unmount();
    });
  });

  it("uses the scan focus in the conversion handoff", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderScanner(container);

    const noteInput = container.querySelector<HTMLTextAreaElement>('textarea[name="founderNote"]');
    expect(noteInput).not.toBeNull();
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
    expect(text).toContain("Turn this into a Customer Engine map");
    expect(text).toContain("SimOne will keep the customer loop, proof question, and approval boundary together after sign-in.");
    expect(text).toContain("What happens after sign-in");
    expect(text).toContain("Saved in this browser");
    expect(text).toContain("Sign up to keep this readout with your full SimOne map.");
    expect(text).toContain("Prefill the starter map with this customer loop readout.");
    expect(text).toContain("Create the first setup task: Make one review queue for replies, prospects, and proof points.");
    expect(text).toContain("Keep any customer, money, public-claim, or structure decision behind your approval.");
    expect(text).toContain("Save the full Customer Engine map");
    expect(text).not.toMatch(/model|provider|LLM|api key|runtime/i);

    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
    expect(
      links.some(
        (link) =>
          link.textContent?.includes("Save the full Customer Engine map") &&
          link.getAttribute("href") === "/auth?mode=sign_up&next=%2Fonboarding%3Ffrom%3Dscanner%26focus%3Dcustomer-engine",
      ),
    ).toBe(true);

    const storedScan = window.localStorage.getItem("simone:bottleneck-scan");
    expect(storedScan).not.toBeNull();
    expect(JSON.parse(storedScan!)).toMatchObject({
      result: {
        conversionPath: {
          title: "Turn this into a Customer Engine map",
          primaryCta: "Save the full Customer Engine map",
          onboardingHref: "/auth?mode=sign_up&next=%2Fonboarding%3Ffrom%3Dscanner%26focus%3Dcustomer-engine",
        },
        handoffPreview: {
          title: "What happens after sign-in",
          items: [
            "Prefill the starter map with this customer loop readout.",
            "Create the first setup task: Make one review queue for replies, prospects, and proof points.",
            "Keep any customer, money, public-claim, or structure decision behind your approval.",
          ],
        },
      },
    });

    flushSync(() => {
      root.unmount();
    });
  });

  it("explains what the public scan can and cannot see", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderScanner(container);

    const noteInput = container.querySelector<HTMLTextAreaElement>('textarea[name="founderNote"]');
    expect(noteInput).not.toBeNull();
    await updateField(
      noteInput!,
      "The roadmap has too many feature ideas, the prototype keeps expanding, and we need one promise we can prove before launch.",
    );

    const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
      candidate.textContent?.includes("Scan"),
    );
    expect(button).toBeTruthy();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const text = container.textContent ?? "";
    expect(text).toContain("What this scan can see");
    expect(text).toContain("It read patterns in the text you provided.");
    expect(text).toContain("What it cannot see yet");
    expect(text).toContain("It did not crawl your site, inspect private tools, or verify the facts.");
    expect(text).toContain("Why it is still useful");
    expect(text).toContain("It gives you one focused next question instead of a full-company diagnosis.");
    expect(text).not.toMatch(/model|provider|LLM|api key|runtime/i);

    const storedScan = window.localStorage.getItem("simone:bottleneck-scan");
    expect(storedScan).not.toBeNull();
    expect(JSON.parse(storedScan!)).toMatchObject({
      result: {
        trustFrame: {
          canSee: "It read patterns in the text you provided.",
          cannotSee: "It did not crawl your site, inspect private tools, or verify the facts.",
          stillUseful: "It gives you one focused next question instead of a full-company diagnosis.",
        },
      },
    });

    flushSync(() => {
      root.unmount();
    });
  });
});
