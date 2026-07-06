// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarLink } from "../src/ui/index.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

type BridgeGlobal = typeof globalThis & {
  __paperclipPluginBridge__?: {
    sdkUi?: Record<string, unknown>;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("SidebarLink", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as BridgeGlobal).__paperclipPluginBridge__ = {
      sdkUi: {
        useHostNavigation: () => ({
          resolveHref: (to: string) => `/PAP${to.startsWith("/") ? to : `/${to}`}`,
          navigate: () => undefined,
          linkProps: (to: string) => ({
            href: `/PAP${to.startsWith("/") ? to : `/${to}`}`,
            onClick: () => undefined,
          }),
        }),
      },
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete (globalThis as BridgeGlobal).__paperclipPluginBridge__;
    vi.restoreAllMocks();
  });

  it("renders the inline icon without React key warnings", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    act(() => {
      root.render(createElement(SidebarLink, {
        context: { companyId: COMPANY_ID, companyPrefix: "PAP" },
      } as never));
    });

    const keyWarnings = consoleError.mock.calls.filter((call) =>
      String(call[0] ?? "").includes('Each child in a list should have a unique "key" prop')
    );

    expect(keyWarnings).toEqual([]);
  });
});
