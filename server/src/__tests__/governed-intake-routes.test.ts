import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockService = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  governedIntakeService: () => mockService,
}));

const pluginId = "11111111-1111-4111-8111-111111111111";
const baseBody = {
  resourceKind: "plugin",
  resourceId: "sysdom.test-plugin",
  resourceVersion: "1.2.3",
  displayName: "Test plugin",
  pluginId,
  decision: "defer",
  compatibility: "needs_review",
  permissionBoundary: "Read-only company context.",
  costBoundary: "No paid API calls.",
  productBoundary: "Cannot alter canonical venture state.",
  reviewNote: "Compatibility review remains open.",
  sourceRefs: [{ kind: "plugin_manifest", label: "Manifest review" }],
};

async function createApp(deactivatePlugin = vi.fn()) {
  const [{ governedIntakeRoutes }, { errorHandler }] = await Promise.all([
    import("../routes/governed-intake.js"),
    import("../middleware/index.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = {
      type: "board",
      userId: "founder-1",
      source: "session",
      isInstanceAdmin: true,
      companyIds: [],
    };
    next();
  });
  app.use("/api", governedIntakeRoutes({} as never, { deactivatePlugin }));
  app.use(errorHandler);
  return app;
}

describe("governed intake routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockService.create.mockImplementation(async (input) => ({
      id: "22222222-2222-4222-8222-222222222222",
      ...input,
      capabilitySnapshot: [],
      reviewedByUserId: "founder-1",
      reviewedAt: new Date(),
      createdAt: new Date(),
    }));
  });

  it("deactivates a running plugin when the latest decision does not approve activation", async () => {
    const deactivatePlugin = vi.fn().mockResolvedValue(undefined);
    const app = await createApp(deactivatePlugin);

    const res = await request(app)
      .post("/api/governed-intake/assessments")
      .send(baseBody);

    expect(res.status).toBe(201);
    expect(deactivatePlugin).toHaveBeenCalledWith(
      pluginId,
      "Governed intake defer: Compatibility review remains open.",
    );
  });

  it("records compatible adaptation without auto-activating or deactivating", async () => {
    const deactivatePlugin = vi.fn().mockResolvedValue(undefined);
    const app = await createApp(deactivatePlugin);

    const res = await request(app)
      .post("/api/governed-intake/assessments")
      .send({
        ...baseBody,
        decision: "adapt",
        compatibility: "compatible",
      });

    expect(res.status).toBe(201);
    expect(deactivatePlugin).not.toHaveBeenCalled();
  });
});
