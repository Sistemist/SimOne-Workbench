// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdapterCapabilities } from "./use-adapter-capabilities";
import { useDisabledAdaptersSync } from "./use-disabled-adapters";

const mockAdaptersApi = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock("@/api/adapters", () => ({
  adaptersApi: mockAdaptersApi,
}));

function DisabledAdaptersProbe() {
  useDisabledAdaptersSync({ enabled: false });
  return null;
}

function AdapterCapabilitiesProbe() {
  useAdapterCapabilities({ enabled: false });
  return null;
}

describe("adapter hooks", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
    vi.clearAllMocks();
  });

  it("does not fetch adapters while disabled", async () => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <DisabledAdaptersProbe />
          <AdapterCapabilitiesProbe />
        </QueryClientProvider>,
      );
    });

    expect(mockAdaptersApi.list).not.toHaveBeenCalled();
  });
});
