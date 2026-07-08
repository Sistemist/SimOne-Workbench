// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";
import { SimOnePublicLanding } from "./SimOnePublicLanding";

function renderLanding(container: HTMLElement) {
  const root = createRoot(container);
  flushSync(() => {
    root.render(<SimOnePublicLanding />);
  });
  return root;
}

describe("SimOnePublicLanding", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("makes the scanner the primary public CTA and splits sign-in from sign-up", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = renderLanding(container);

    const text = container.textContent ?? "";
    expect(text).toContain("A conscious operating layer for AI-first companies.");
    expect(text).toContain("Find your bottleneck");
    expect(text).toContain("Sign in");
    expect(text).toContain("Sign up");
    expect(text).not.toContain("Sign in / Create account");
    expect(text).not.toContain("Join early access");

    const links = Array.from(container.querySelectorAll("a"));
    const scanner = links.find((link) => link.textContent?.includes("Find your bottleneck"));
    const signIn = links.find((link) => link.textContent === "Sign in");
    const signUp = links.find((link) => link.textContent === "Sign up");

    expect(scanner?.getAttribute("href")).toBe("/scanner");
    expect(scanner?.className).toContain("bg-white");
    expect(signIn?.getAttribute("href")).toBe("/auth?next=%2Fapp");
    expect(signIn?.className).not.toContain("border");
    expect(signUp?.getAttribute("href")).toBe("/auth?mode=sign_up&next=%2Fapp");
    expect(signUp?.className).toContain("bg-white");

    flushSync(() => {
      root.unmount();
    });
  });
});
