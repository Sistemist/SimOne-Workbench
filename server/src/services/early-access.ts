import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  authUsers,
  companyMemberships,
  earlyAccessGrants,
  earlyAccessRequests,
  scannerRuns,
} from "@paperclipai/db";
import type {
  CreateEarlyAccessGrant,
  CreateEarlyAccessRequest,
  ScannerSnapshot,
} from "@paperclipai/shared";
import { conflict, forbidden, notFound } from "../errors.js";

const UNCLAIMED_SCAN_RETENTION_DAYS = 30;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicGrant(row: typeof earlyAccessGrants.$inferSelect) {
  const now = Date.now();
  return {
    id: row.id,
    requestId: row.requestId,
    founderName: row.founderName,
    email: row.email,
    source: row.source,
    maxVentures: row.maxVentures,
    expiresAt: row.expiresAt,
    activatedAt: row.activatedAt,
    revokedAt: row.revokedAt,
    status: row.revokedAt
      ? "revoked"
      : row.activatedAt
        ? "activated"
        : row.expiresAt.getTime() <= now
          ? "expired"
          : "ready",
  } as const;
}

function scanValues(snapshot: ScannerSnapshot) {
  return {
    id: snapshot.id,
    algorithmVersion: snapshot.algorithmVersion,
    inputPayload: snapshot.input,
    resultPayload: snapshot.result,
    clientSavedAt: new Date(snapshot.savedAt),
  };
}

export function earlyAccessService(db: Db) {
  async function pruneExpiredUnclaimedScans() {
    await db
      .delete(scannerRuns)
      .where(and(
        isNull(scannerRuns.ownerUserId),
        isNotNull(scannerRuns.expiresAt),
        lte(scannerRuns.expiresAt, new Date()),
      ));
  }

  async function createRequest(input: CreateEarlyAccessRequest) {
    await pruneExpiredUnclaimedScans();
    const request = await db
      .insert(earlyAccessRequests)
      .values({
        requestKey: input.requestKey,
        founderName: input.founderName,
        email: input.email,
        emailNormalized: normalizeEmail(input.email),
        useCase: input.useCase || null,
        source: input.source || null,
      })
      .onConflictDoNothing({ target: earlyAccessRequests.requestKey })
      .returning()
      .then((rows) => rows[0] ?? null);

    const persisted = request ?? await db
      .select()
      .from(earlyAccessRequests)
      .where(eq(earlyAccessRequests.requestKey, input.requestKey))
      .then((rows) => rows[0] ?? null);
    if (!persisted) throw conflict("Could not reconcile early-access request");

    if (input.consentToRetainScan && input.scan) {
      const expiresAt = new Date(
        Date.now() + UNCLAIMED_SCAN_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      await db
        .insert(scannerRuns)
        .values({
          ...scanValues(input.scan),
          accessRequestId: persisted.id,
          expiresAt,
        })
        .onConflictDoNothing({ target: scannerRuns.id });
    }

    return {
      id: persisted.id,
      status: persisted.status,
      scanRetained: Boolean(input.consentToRetainScan && input.scan),
    };
  }

  async function createGrant(
    input: CreateEarlyAccessGrant,
    createdByUserId: string | null,
  ) {
    const token = `sysdom_ea_${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);
    const grant = await db
      .insert(earlyAccessGrants)
      .values({
        requestId: input.accessRequestId ?? null,
        founderName: input.founderName,
        email: input.email,
        emailNormalized: normalizeEmail(input.email),
        source: input.source || null,
        tokenHash: hashToken(token),
        maxVentures: input.maxVentures,
        expiresAt,
        createdByUserId,
      })
      .returning()
      .then((rows) => rows[0]!);

    if (input.accessRequestId) {
      await db
        .update(earlyAccessRequests)
        .set({ status: "invited", updatedAt: new Date() })
        .where(eq(earlyAccessRequests.id, input.accessRequestId));
    }

    return { grant: publicGrant(grant), token };
  }

  async function approveRequest(
    requestId: string,
    input: Omit<CreateEarlyAccessGrant, "accessRequestId" | "founderName" | "email">,
    createdByUserId: string | null,
  ) {
    const request = await db
      .select()
      .from(earlyAccessRequests)
      .where(eq(earlyAccessRequests.id, requestId))
      .then((rows) => rows[0] ?? null);
    if (!request) throw notFound("Early-access request not found");
    return createGrant({
      founderName: request.founderName,
      email: request.email,
      source: input.source || request.source || undefined,
      maxVentures: input.maxVentures,
      expiresInHours: input.expiresInHours,
      accessRequestId: request.id,
    }, createdByUserId);
  }

  async function getGrantByToken(token: string) {
    const grant = await db
      .select()
      .from(earlyAccessGrants)
      .where(eq(earlyAccessGrants.tokenHash, hashToken(token)))
      .then((rows) => rows[0] ?? null);
    if (!grant) throw notFound("Activation link not found");
    return grant;
  }

  async function grantSummary(token: string) {
    return publicGrant(await getGrantByToken(token));
  }

  async function activate(token: string, userId: string) {
    const grant = await getGrantByToken(token);
    if (grant.revokedAt) throw forbidden("This activation link was revoked");
    if (!grant.activatedAt && grant.expiresAt.getTime() <= Date.now()) {
      throw forbidden("This activation link has expired");
    }
    if (grant.activatedByUserId && grant.activatedByUserId !== userId) {
      throw conflict("This activation link was already used by another account");
    }

    const user = await db
      .select({ id: authUsers.id, email: authUsers.email })
      .from(authUsers)
      .where(eq(authUsers.id, userId))
      .then((rows) => rows[0] ?? null);
    if (!user) throw notFound("Authenticated user not found");
    if (normalizeEmail(user.email) !== grant.emailNormalized) {
      throw forbidden(`Sign in with ${grant.email} to activate this invitation`);
    }

    if (!grant.activatedAt) {
      const now = new Date();
      const activated = await db
        .update(earlyAccessGrants)
        .set({
          activatedByUserId: userId,
          activatedAt: now,
          updatedAt: now,
        })
        .where(and(
          eq(earlyAccessGrants.id, grant.id),
          isNull(earlyAccessGrants.activatedByUserId),
        ))
        .returning({ activatedByUserId: earlyAccessGrants.activatedByUserId })
        .then((rows) => rows[0] ?? null);
      if (!activated) {
        const winner = await db
          .select({ activatedByUserId: earlyAccessGrants.activatedByUserId })
          .from(earlyAccessGrants)
          .where(eq(earlyAccessGrants.id, grant.id))
          .then((rows) => rows[0] ?? null);
        if (winner?.activatedByUserId !== userId) {
          throw conflict("This activation link was already used by another account");
        }
      }
      if (grant.requestId) {
        await db
          .update(earlyAccessRequests)
          .set({ status: "activated", updatedAt: now })
          .where(eq(earlyAccessRequests.id, grant.requestId));
        await db
          .update(scannerRuns)
          .set({
            ownerUserId: userId,
            claimedAt: now,
            expiresAt: null,
            updatedAt: now,
          })
          .where(and(
            eq(scannerRuns.accessRequestId, grant.requestId),
            isNull(scannerRuns.ownerUserId),
          ));
      }
    }

    return {
      ...(await grantSummary(token)),
      activatedByUserId: userId,
    };
  }

  async function claimScan(snapshot: ScannerSnapshot, userId: string) {
    await db
      .insert(scannerRuns)
      .values({
        ...scanValues(snapshot),
        ownerUserId: userId,
        claimedAt: new Date(),
      })
      .onConflictDoNothing({ target: scannerRuns.id });

    const existing = await db
      .select()
      .from(scannerRuns)
      .where(eq(scannerRuns.id, snapshot.id))
      .then((rows) => rows[0] ?? null);
    if (!existing) throw conflict("Could not reconcile scanner run");
    if (existing.ownerUserId && existing.ownerUserId !== userId) {
      throw conflict("This scanner run is already claimed by another account");
    }
    if (!existing.ownerUserId) {
      const now = new Date();
      await db
        .update(scannerRuns)
        .set({
          ownerUserId: userId,
          claimedAt: now,
          expiresAt: null,
          updatedAt: now,
        })
        .where(and(eq(scannerRuns.id, snapshot.id), isNull(scannerRuns.ownerUserId)));
    }
    const claimed = await db
      .select()
      .from(scannerRuns)
      .where(eq(scannerRuns.id, snapshot.id))
      .then((rows) => rows[0]!);
    if (claimed.ownerUserId !== userId) {
      throw conflict("This scanner run is already claimed by another account");
    }
    return claimed;
  }

  async function listUserScans(userId: string) {
    return db
      .select()
      .from(scannerRuns)
      .where(eq(scannerRuns.ownerUserId, userId))
      .orderBy(desc(scannerRuns.createdAt));
  }

  async function assignScan(scanId: string, companyId: string, userId: string) {
    const scan = await db
      .select()
      .from(scannerRuns)
      .where(eq(scannerRuns.id, scanId))
      .then((rows) => rows[0] ?? null);
    if (!scan || scan.ownerUserId !== userId) throw notFound("Scanner run not found");
    if (scan.companyId && scan.companyId !== companyId) {
      throw conflict("This scanner run is already assigned to another venture");
    }
    if (!scan.companyId) {
      const now = new Date();
      await db
        .update(scannerRuns)
        .set({ companyId, assignedAt: now, updatedAt: now })
        .where(and(eq(scannerRuns.id, scanId), isNull(scannerRuns.companyId)));
    }
    const assigned = await db
      .select()
      .from(scannerRuns)
      .where(eq(scannerRuns.id, scanId))
      .then((rows) => rows[0]!);
    if (assigned.companyId !== companyId) {
      throw conflict("This scanner run is already assigned to another venture");
    }
    return assigned;
  }

  async function userGrant(userId: string) {
    const grants = await db
      .select()
      .from(earlyAccessGrants)
      .where(and(
        eq(earlyAccessGrants.activatedByUserId, userId),
        isNull(earlyAccessGrants.revokedAt),
      ))
      .orderBy(desc(earlyAccessGrants.activatedAt));
    const grant = grants[0] ?? null;
    if (!grant) return null;
    const ownedVentures = await db
      .select({ value: count() })
      .from(companyMemberships)
      .where(and(
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, userId),
        eq(companyMemberships.membershipRole, "owner"),
        eq(companyMemberships.status, "active"),
      ))
      .then((rows) => Number(rows[0]?.value ?? 0));
    return {
      ...publicGrant(grant),
      ownedVentures,
      remainingVentures: Math.max(0, grant.maxVentures - ownedVentures),
    };
  }

  async function listAdminState() {
    const [requests, grants] = await Promise.all([
      db.select().from(earlyAccessRequests).orderBy(desc(earlyAccessRequests.createdAt)),
      db.select().from(earlyAccessGrants).orderBy(desc(earlyAccessGrants.createdAt)),
    ]);
    return {
      requests,
      grants: grants.map(publicGrant),
    };
  }

  return {
    pruneExpiredUnclaimedScans,
    createRequest,
    createGrant,
    approveRequest,
    grantSummary,
    activate,
    claimScan,
    listUserScans,
    assignScan,
    userGrant,
    listAdminState,
  };
}
