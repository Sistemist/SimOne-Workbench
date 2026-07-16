import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
  createDb,
} from "@paperclipai/db";
import type { Config } from "../config.js";
import { createBetterAuthInstance } from "../auth/better-auth.js";
import type { PasswordResetDelivery, PasswordResetEmail } from "../auth/password-reset-delivery.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres password recovery tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("password recovery", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let deliveries: PasswordResetEmail[];
  let auth!: ReturnType<typeof createBetterAuthInstance>;
  const originalSecret = process.env.BETTER_AUTH_SECRET;
  const baseUrl = "http://simone.test";

  const config = {
    deploymentMode: "authenticated",
    deploymentExposure: "private",
    authBaseUrlMode: "explicit",
    authPublicBaseUrl: baseUrl,
    authDisableSignUp: false,
    allowedHostnames: ["simone.test"],
    port: 3100,
  } as Config;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-password-recovery-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "password-recovery-test-secret-at-least-32-characters";
    deliveries = [];
    const delivery: PasswordResetDelivery = {
      configured: true,
      provider: "resend",
      async send(input) {
        deliveries.push(input);
      },
    };
    auth = createBetterAuthInstance(db, config, [baseUrl], { passwordResetDelivery: delivery });
  });

  afterEach(async () => {
    await db.delete(authSessions);
    await db.delete(authVerifications);
    await db.delete(authAccounts);
    await db.delete(authUsers);
  });

  afterAll(async () => {
    if (originalSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = originalSecret;
    await tempDb?.cleanup();
  });

  async function post(path: string, body: Record<string, unknown>, ip: string) {
    return auth.handler(new Request(`${baseUrl}/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }));
  }

  async function createCredentialUser(ip: string) {
    const email = `${randomUUID()}@example.test`;
    const response = await post("/sign-up/email", {
      name: "Recovery Owner",
      email,
      password: "initial-test-password",
    }, ip);
    expect(response.status).toBe(200);
    return email;
  }

  async function requestReset(email: string, ip: string) {
    const response = await post("/request-password-reset", {
      email,
      redirectTo: `${baseUrl}/auth/reset-password`,
    }, ip);
    await Promise.resolve();
    return response;
  }

  it("consumes a valid token once and revokes existing sessions", async () => {
    const email = await createCredentialUser("192.0.2.10");
    expect((await db.select().from(authSessions)).length).toBe(1);

    const requestResponse = await requestReset(email, "192.0.2.11");
    expect(requestResponse.status).toBe(200);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.resetUrl).not.toContain(email);

    const resetResponse = await post("/reset-password", {
      token: deliveries[0]!.token,
      newPassword: "replacement-test-password",
    }, "192.0.2.12");
    expect(resetResponse.status).toBe(200);
    expect(await resetResponse.json()).toEqual({ status: true });
    expect(await db.select().from(authSessions)).toHaveLength(0);

    const reusedResponse = await post("/reset-password", {
      token: deliveries[0]!.token,
      newPassword: "another-test-password",
    }, "192.0.2.13");
    expect(reusedResponse.status).toBe(400);
  });

  it("rejects expired and invalid reset tokens", async () => {
    const email = await createCredentialUser("192.0.2.20");
    expect((await requestReset(email, "192.0.2.21")).status).toBe(200);
    const token = deliveries[0]!.token;

    await db.update(authVerifications)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(authVerifications.identifier, `reset-password:${token}`));

    const expiredResponse = await post("/reset-password", {
      token,
      newPassword: "replacement-test-password",
    }, "192.0.2.22");
    expect(expiredResponse.status).toBe(400);

    const invalidResponse = await post("/reset-password", {
      token: "invalid-test-token",
      newPassword: "replacement-test-password",
    }, "192.0.2.23");
    expect(invalidResponse.status).toBe(400);
  });

  it("uses account-neutral request wording and limits requests to three per minute", async () => {
    const existingEmail = await createCredentialUser("192.0.2.30");
    const unknownResponse = await requestReset("unknown@example.test", "192.0.2.31");
    const existingResponse = await requestReset(existingEmail, "192.0.2.32");

    expect(unknownResponse.status).toBe(200);
    expect(existingResponse.status).toBe(200);
    expect(await unknownResponse.clone().json()).toEqual(await existingResponse.clone().json());

    const rateLimitIp = "192.0.2.40";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await requestReset("unknown@example.test", rateLimitIp)).status).toBe(200);
    }
    const limitedResponse = await requestReset("unknown@example.test", rateLimitIp);
    expect(limitedResponse.status).toBe(429);
  });
});
