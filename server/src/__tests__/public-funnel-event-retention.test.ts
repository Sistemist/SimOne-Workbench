import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PUBLIC_FUNNEL_RETENTION_DAYS,
  prunePublicFunnelEvents,
  publicFunnelRetentionCutoff,
  resolvePublicFunnelRetentionDays,
} from "../services/public-funnel-event-retention.js";

describe("public funnel event retention", () => {
  it("defaults to 90 days and rejects unsafe configuration", () => {
    expect(resolvePublicFunnelRetentionDays(undefined)).toBe(DEFAULT_PUBLIC_FUNNEL_RETENTION_DAYS);
    expect(resolvePublicFunnelRetentionDays("30")).toBe(30);
    expect(resolvePublicFunnelRetentionDays("0")).toBe(DEFAULT_PUBLIC_FUNNEL_RETENTION_DAYS);
    expect(resolvePublicFunnelRetentionDays("366")).toBe(DEFAULT_PUBLIC_FUNNEL_RETENTION_DAYS);
    expect(resolvePublicFunnelRetentionDays("forever")).toBe(DEFAULT_PUBLIC_FUNNEL_RETENTION_DAYS);
  });

  it("computes the cutoff from an explicit clock", () => {
    expect(publicFunnelRetentionCutoff(30, new Date("2026-08-02T12:00:00.000Z")).toISOString())
      .toBe("2026-07-03T12:00:00.000Z");
  });

  it("deletes only through the created-at cutoff and reports the removed row count", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "one" }, { id: "two" }]);
    const where = vi.fn(() => ({ returning }));
    const deleteRows = vi.fn(() => ({ where }));

    const deleted = await prunePublicFunnelEvents(
      { delete: deleteRows } as any,
      30,
      new Date("2026-08-02T12:00:00.000Z"),
    );

    expect(deleteRows).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledOnce();
    expect(returning).toHaveBeenCalledWith(expect.any(Object));
    expect(deleted).toBe(2);
  });
});
