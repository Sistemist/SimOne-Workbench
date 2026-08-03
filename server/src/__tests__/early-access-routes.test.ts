import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  activityLog,
  authUsers,
  companies,
  companyMemberships,
  createDb,
  earlyAccessGrants,
  earlyAccessRequests,
  principalPermissionGrants,
  scannerRuns,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { errorHandler } from "../middleware/index.js";
import { companyRoutes } from "../routes/companies.js";
import { earlyAccessRoutes } from "../routes/early-access.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function boardActor(
  userId: string,
  options: { isInstanceAdmin?: boolean; companyIds?: string[] } = {},
): Express.Request["actor"] {
  const companyIds = options.companyIds ?? [];
  return {
    type: "board",
    userId,
    source: "session",
    isInstanceAdmin: options.isInstanceAdmin ?? false,
    companyIds,
    memberships: companyIds.map((companyId) => ({
      companyId,
      membershipRole: "owner",
      status: "active",
    })),
  };
}

function createApp(
  db: ReturnType<typeof createDb>,
  actor: Express.Request["actor"] = { type: "none", source: "none" },
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actor;
    next();
  });
  app.use("/api", earlyAccessRoutes(db));
  app.use("/api/companies", companyRoutes(db));
  app.use(errorHandler);
  return app;
}

function scannerSnapshot(id = randomUUID()) {
  return {
    id,
    algorithmVersion: "scanner-patterns-v1",
    input: {
      startupUrl: "https://example.com",
      founderNote: "Customer follow-up is scattered.",
    },
    result: {
      engine: "Customer Engine",
      headline: "Customer loop is leaking",
    },
    savedAt: new Date().toISOString(),
  };
}

describeEmbeddedPostgres("founder early-access routes", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-early-access-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(activityLog);
    await db.delete(principalPermissionGrants);
    await db.delete(scannerRuns);
    await db.delete(earlyAccessGrants);
    await db.delete(earlyAccessRequests);
    await db.delete(companyMemberships);
    await db.delete(companies);
    await db.delete(authUsers);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedUser(email: string) {
    const now = new Date();
    const id = `user-${randomUUID()}`;
    await db.insert(authUsers).values({
      id,
      name: email.split("@")[0]!,
      email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function createGrant(
    adminId: string,
    input: {
      email: string;
      founderName?: string;
      maxVentures?: number;
      accessRequestId?: string;
    },
  ) {
    return request(createApp(db, boardActor(adminId, { isInstanceAdmin: true })))
      .post("/api/early-access/admin/grants")
      .send({
        founderName: input.founderName ?? "Founder",
        email: input.email,
        source: "test",
        maxVentures: input.maxVentures ?? 3,
        expiresInHours: 72,
        accessRequestId: input.accessRequestId,
      });
  }

  it("deduplicates a public request and retains its explicitly consented scan once", async () => {
    const requestKey = randomUUID();
    const scan = scannerSnapshot();
    const payload = {
      requestKey,
      founderName: "Ada Founder",
      email: "ada@example.com",
      useCase: "A founder operating system",
      source: "scanner",
      consentToRetainScan: true,
      scan,
    };
    const app = createApp(db);

    const first = await request(app).post("/api/public/early-access/requests").send(payload);
    const replay = await request(app).post("/api/public/early-access/requests").send(payload);

    expect(first.status).toBe(202);
    expect(replay.status).toBe(202);
    expect(replay.body.id).toBe(first.body.id);
    expect(await db.select().from(earlyAccessRequests)).toHaveLength(1);
    const savedScans = await db.select().from(scannerRuns);
    expect(savedScans).toHaveLength(1);
    expect(savedScans[0]).toMatchObject({
      id: scan.id,
      ownerUserId: null,
      accessRequestId: first.body.id,
      algorithmVersion: "scanner-patterns-v1",
    });
  });

  it("activates only the invited email and claims the retained scan idempotently", async () => {
    const adminId = await seedUser("admin@sysdom.ai");
    const founderId = await seedUser("founder@example.com");
    const otherId = await seedUser("other@example.com");
    const requestKey = randomUUID();
    const scan = scannerSnapshot();
    const requestResponse = await request(createApp(db))
      .post("/api/public/early-access/requests")
      .send({
        requestKey,
        founderName: "Founder",
        email: "founder@example.com",
        consentToRetainScan: true,
        scan,
      });
    const grantResponse = await createGrant(adminId, {
      email: "founder@example.com",
      accessRequestId: requestResponse.body.id,
    });
    const token = grantResponse.body.token as string;

    const wrongAccount = await request(createApp(db, boardActor(otherId)))
      .post(`/api/early-access/activate/${encodeURIComponent(token)}`)
      .send({});
    expect(wrongAccount.status).toBe(403);

    const founderApp = createApp(db, boardActor(founderId));
    const firstActivation = await request(founderApp)
      .post(`/api/early-access/activate/${encodeURIComponent(token)}`)
      .send({});
    const activationReplay = await request(founderApp)
      .post(`/api/early-access/activate/${encodeURIComponent(token)}`)
      .send({});

    expect(firstActivation.status).toBe(200);
    expect(activationReplay.status).toBe(200);
    const persistedScan = await db
      .select()
      .from(scannerRuns)
      .then((rows) => rows[0]!);
    expect(persistedScan.ownerUserId).toBe(founderId);
    expect(persistedScan.expiresAt).toBeNull();
  });

  it("keeps scanner claims immutable across accounts and safe to replay", async () => {
    const founderId = await seedUser("founder@example.com");
    const otherId = await seedUser("other@example.com");
    const scan = scannerSnapshot();
    const founderApp = createApp(db, boardActor(founderId));

    const first = await request(founderApp).post("/api/early-access/scans/claim").send(scan);
    const replay = await request(founderApp).post("/api/early-access/scans/claim").send({
      ...scan,
      input: { ...scan.input, founderNote: "A changed replay must not overwrite history." },
    });
    const theftAttempt = await request(createApp(db, boardActor(otherId)))
      .post("/api/early-access/scans/claim")
      .send(scan);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(theftAttempt.status).toBe(409);
    const persisted = await db
      .select()
      .from(scannerRuns)
      .then((rows) => rows[0]!);
    expect(persisted.ownerUserId).toBe(founderId);
    expect(persisted.inputPayload.founderNote).toBe("Customer follow-up is scattered.");
  });

  it("allows an activated founder to create separate ventures only within the grant allowance", async () => {
    const adminId = await seedUser("admin@sysdom.ai");
    const founderId = await seedUser("founder@example.com");
    const grantResponse = await createGrant(adminId, {
      email: "founder@example.com",
      maxVentures: 2,
    });
    const token = grantResponse.body.token as string;
    const founderApp = createApp(db, boardActor(founderId));
    expect((await request(founderApp)
      .post(`/api/early-access/activate/${encodeURIComponent(token)}`)
      .send({})).status).toBe(200);

    const first = await request(founderApp).post("/api/companies").send({
      name: "Venture One",
      issuePrefix: "VONE",
    });
    const second = await request(founderApp).post("/api/companies").send({
      name: "Venture Two",
      issuePrefix: "VTWO",
    });
    const third = await request(founderApp).post("/api/companies").send({
      name: "Venture Three",
      issuePrefix: "VTHR",
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(403);
    expect(await db.select().from(companies)).toHaveLength(2);
  });
});
