// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FrontDoor } from "./FrontDoor";

describe("FrontDoor", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("offers the SIM starter before the manual setup paths", () => {
    const onChoose = vi.fn();
    const root = createRoot(container);

    flushSync(() => {
      root.render(<FrontDoor onChoose={onChoose} />);
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Start with SIM Starter");
    expect(text).toContain("CEO, four engine leads, and a SIM Wiki-ready Sprint Zero");
    expect(text).toContain("Blank setup");
    expect(text).toContain("Add agents to your org");

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons).toHaveLength(3);

    flushSync(() => {
      buttons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onChoose).toHaveBeenCalledWith("starter");

    flushSync(() => {
      root.unmount();
    });
  });
});
