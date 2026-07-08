// @vitest-environment jsdom

import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isSimOneSprintZeroFirstMapIssue,
  SimOneSprintZeroGuide,
} from "./SimOneSprintZeroGuide";

const sprintZeroDescription = `## Messy venture context

We help nontechnical founders turn messy AI ideas into a real company.

## Draft the first SIM map

Use the founder context above to draft a first Venture Architecture Map.

## Approval boundary

Bring decisions back to the human before agents act on customers.`;

describe("SimOneSprintZeroGuide", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    flushSync(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("recognizes the context-seeded first SIM map task", () => {
    expect(
      isSimOneSprintZeroFirstMapIssue({
        title: "Draft the first SIM map",
        description: sprintZeroDescription,
      }),
    ).toBe(true);
  });

  it("does not recognize ordinary tasks", () => {
    expect(
      isSimOneSprintZeroFirstMapIssue({
        title: "Ship settings page",
        description: "Add a new settings page.",
      }),
    ).toBe(false);
  });

  it("shows a plain-language guide for the first-map workspace", () => {
    flushSync(() => {
      root.render(<SimOneSprintZeroGuide />);
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Sprint Zero first map");
    expect(text).toContain("Read the messy context");
    expect(text).toContain("Check source provenance");
    expect(text).toContain("Draft Product, Customer, Cash, and Skills assumptions");
    expect(text).toContain("Ask for approval before customers, money, public claims, or structure");
  });
});
