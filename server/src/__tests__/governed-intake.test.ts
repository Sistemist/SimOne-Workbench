import { describe, expect, it, vi } from "vitest";
import { createGovernedIntakeAssessmentSchema } from "@paperclipai/shared";
import { governedIntakeService } from "../services/governed-intake.js";

const pluginId = "11111111-1111-4111-8111-111111111111";
const reviewedAt = new Date("2026-07-31T12:00:00.000Z");

function assessmentInput() {
  return {
    resourceKind: "plugin" as const,
    resourceId: "sysdom.test-plugin",
    resourceVersion: "1.2.3",
    displayName: "Test plugin",
    pluginId,
    decision: "adopt" as const,
    compatibility: "compatible" as const,
    permissionBoundary: "Read-only venture context.",
    costBoundary: "No paid APIs or metered services.",
    productBoundary: "Cannot alter canonical venture state.",
    reviewNote: "Manifest and deterministic contract tests reviewed.",
    sourceRefs: [{
      kind: "plugin_manifest",
      id: "sysdom.test-plugin@1.2.3",
      label: "Reviewed manifest",
      capturedAt: reviewedAt.toISOString(),
    }],
  };
}

describe("governed intake", () => {
  it("rejects adoption while compatibility still needs review", () => {
    const result = createGovernedIntakeAssessmentSchema.safeParse({
      ...assessmentInput(),
      compatibility: "needs_review",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "compatibility")).toBe(true);
  });

  it("snapshots capabilities from the installed exact version", async () => {
    const inserted = {
      id: "22222222-2222-4222-8222-222222222222",
      ...assessmentInput(),
      capabilitySnapshot: ["companies.read", "plugin.state.read"],
      reviewedByUserId: "founder-1",
      reviewedAt,
      createdAt: reviewedAt,
    };
    const where = vi.fn().mockResolvedValue([{
      id: pluginId,
      pluginKey: "sysdom.test-plugin",
      version: "1.2.3",
      manifestJson: { capabilities: inserted.capabilitySnapshot },
    }]);
    const returning = vi.fn().mockResolvedValue([inserted]);
    const values = vi.fn(() => ({ returning }));
    const db = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })),
      insert: vi.fn(() => ({ values })),
    };

    const result = await governedIntakeService(db as never).create(assessmentInput(), "founder-1");

    expect(result.capabilitySnapshot).toEqual(["companies.read", "plugin.state.read"]);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      pluginId,
      resourceVersion: "1.2.3",
      capabilitySnapshot: ["companies.read", "plugin.state.read"],
      reviewedByUserId: "founder-1",
    }));
  });

  it("requires a matching installed key and version", async () => {
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{
            id: pluginId,
            pluginKey: "sysdom.test-plugin",
            version: "2.0.0",
            manifestJson: { capabilities: [] },
          }]),
        })),
      })),
    };

    await expect(
      governedIntakeService(db as never).create(assessmentInput(), "founder-1"),
    ).rejects.toThrow("exact version");
  });

  it("treats the latest decision as authoritative so a rejection revokes approval", async () => {
    const latest = {
      id: "33333333-3333-4333-8333-333333333333",
      ...assessmentInput(),
      decision: "reject",
      compatibility: "incompatible",
    };
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue([latest]),
          })),
        })),
      })),
    };

    await expect(
      governedIntakeService(db as never).approvedForPluginVersion(pluginId, "1.2.3"),
    ).resolves.toBeNull();
  });
});
