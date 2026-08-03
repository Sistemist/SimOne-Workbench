// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  findScannerSnapshot,
  readLatestScannerSnapshot,
  readScannerHistory,
  saveScannerSnapshot,
} from "./scanner-storage";

function snapshot(id: string, engine: string) {
  return {
    id,
    algorithmVersion: "scanner-patterns-v1",
    input: {
      startupUrl: "",
      founderNote: `${engine} note`,
    },
    result: { engine },
    savedAt: new Date().toISOString(),
  };
}

describe("scanner storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps separate immutable local history while preserving the latest Starter handoff", () => {
    const first = snapshot("11111111-1111-4111-8111-111111111111", "Customer Engine");
    const second = snapshot("22222222-2222-4222-8222-222222222222", "Product Engine");

    saveScannerSnapshot(first);
    saveScannerSnapshot(second);

    expect(readScannerHistory().map((scan) => scan.id)).toEqual([second.id, first.id]);
    expect(readLatestScannerSnapshot()?.id).toBe(second.id);
    expect(findScannerSnapshot(first.id)?.result).toEqual({ engine: "Customer Engine" });
  });

  it("replaying the same scan id does not create a duplicate history entry", () => {
    const scan = snapshot("33333333-3333-4333-8333-333333333333", "Cash Engine");
    saveScannerSnapshot(scan);
    saveScannerSnapshot(scan);
    expect(readScannerHistory()).toHaveLength(1);
  });
});
