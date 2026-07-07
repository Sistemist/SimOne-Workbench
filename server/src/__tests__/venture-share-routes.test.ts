import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VentureShareSnapshot } from "@paperclipai/shared";

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockVentureShareService = vi.hoisted(() => ({
  createFromCompany: vi.fn(),
  getById: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  ventureShareService: () => mockVentureShareService,
}));

async function createApp(actor?: Record<string, unknown>) {
  const [{ ventureShareRoutes }, { errorHandler }] = await Promise.all([
    import("../routes/venture-shares.js"),
    import("../middleware/index.js"),
  ]);
  const app = express();
  app.use(express.json());
  if (actor) {
    app.use((req, _res, next) => {
      (req as any).actor = actor;
      next();
    });
  }
  app.use("/api", ventureShareRoutes({} as any));
  app.use(errorHandler);
  return app;
}

const companyId = "11111111-1111-4111-8111-111111111111";

const snapshot: VentureShareSnapshot = {
  schemaVersion: 1,
  shareId: "share-1",
  generatedAt: "2026-07-07T21:00:00.000Z",
  company: {
    name: "Acme Systems",
    description: "Turns messy customer work into one calm review loop.",
    brandColor: "#18a999",
  },
  agents: [{ name: "Thomasina", title: "Founder", role: "CEO", capabilities: "Decides what matters." }],
  projects: [{ name: "Customer Engine", description: "Keep relationship signal moving.", status: "active" }],
  nextMoves: [{ title: "Review customer replies", priority: "high", status: "open", projectName: "Customer Engine" }],
  principles: ["Human judgment stays visible."],
};

describe("venture share routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.getById.mockResolvedValue({ id: "ceo-agent", companyId, role: "ceo" });
    mockVentureShareService.createFromCompany.mockResolvedValue({
      shareId: "share-1",
      shareUrl: "/share/venture/share-1",
      snapshot,
    });
    mockVentureShareService.getById.mockResolvedValue({
      id: "share-1",
      companyId,
      snapshot,
      createdAt: "2026-07-07T21:00:00.000Z",
    });
  });

  it("allows a board user to create a public venture share for their company", async () => {
    const app = await createApp({
      type: "board",
      userId: "user-1",
      companyIds: [companyId],
      source: "session",
      isInstanceAdmin: false,
    });

    const res = await request(app)
      .post(`/api/companies/${companyId}/venture-shares`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.shareUrl).toBe("/share/venture/share-1");
    expect(res.body.snapshot.company.name).toBe("Acme Systems");
    expect(mockVentureShareService.createFromCompany).toHaveBeenCalledWith(companyId, {
      createdByUserId: "user-1",
    });
  });

  it("serves a venture share snapshot without board authentication", async () => {
    const app = await createApp();

    const res = await request(app).get("/api/venture-shares/share-1");

    expect(res.status).toBe(200);
    expect(res.body.snapshot.company.name).toBe("Acme Systems");
    expect(JSON.stringify(res.body)).not.toMatch(/adapterConfig|runtimeConfig|OPENAI_API_KEY/);
    expect(mockVentureShareService.getById).toHaveBeenCalledWith("share-1");
  });
});
