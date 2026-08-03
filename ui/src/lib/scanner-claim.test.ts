// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { earlyAccessApi } from "../api/early-access";
import { saveScannerSnapshot } from "./scanner-storage";
import { assignLatestClaimedScanToCompany } from "./scanner-claim";

vi.mock("../api/early-access", () => ({
  earlyAccessApi: {
    getMine: vi.fn(),
    assignScan: vi.fn(),
  },
}));

const getMineMock = vi.mocked(earlyAccessApi.getMine);
const assignScanMock = vi.mocked(earlyAccessApi.assignScan);

describe("assignLatestClaimedScanToCompany", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("assigns the matching claimed scan to the new venture", async () => {
    saveScannerSnapshot({
      id: "scan-1",
      algorithmVersion: "scanner-rules-v1",
      savedAt: "2026-08-03T15:00:00.000Z",
      input: {
        startupUrl: "",
        founderNote: "Customer follow-up is scattered.",
      },
      result: {
        engine: "Customer Engine",
        headline: "Customer loop is leaking",
        nextAction: "Create one follow-up queue.",
      },
    });
    getMineMock.mockResolvedValue({
      grant: { id: "grant-1" } as Awaited<ReturnType<typeof earlyAccessApi.getMine>>["grant"],
      scans: [{ id: "scan-1", companyId: null }] as Awaited<
        ReturnType<typeof earlyAccessApi.getMine>
      >["scans"],
    });
    assignScanMock.mockResolvedValue({} as Awaited<ReturnType<typeof earlyAccessApi.assignScan>>);

    await expect(assignLatestClaimedScanToCompany("company-1")).resolves.toBe(true);
    expect(assignScanMock).toHaveBeenCalledWith("scan-1", "company-1");
  });

  it("does nothing when this browser has no saved scan", async () => {
    await expect(assignLatestClaimedScanToCompany("company-1")).resolves.toBe(false);
    expect(getMineMock).not.toHaveBeenCalled();
    expect(assignScanMock).not.toHaveBeenCalled();
  });
});
