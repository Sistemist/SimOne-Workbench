import { and, desc, eq, max, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { ventureConstitutionRevisions } from "@paperclipai/db";
import type {
  CreateVentureConstitutionRevision,
  RestoreVentureConstitutionRevision,
} from "@paperclipai/shared";
import { conflict, notFound } from "../errors.js";

export interface VentureConstitutionActor {
  agentId: string | null;
  userId: string | null;
}

async function lockCompanyRevisionSequence(tx: Parameters<Parameters<Db["transaction"]>[0]>[0], companyId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${companyId}))`);
}

async function nextVersion(tx: Parameters<Parameters<Db["transaction"]>[0]>[0], companyId: string) {
  const row = await tx
    .select({ value: max(ventureConstitutionRevisions.version) })
    .from(ventureConstitutionRevisions)
    .where(eq(ventureConstitutionRevisions.companyId, companyId))
    .then((rows) => rows[0]);
  return (row?.value ?? 0) + 1;
}

export function ventureConstitutionService(db: Db) {
  return {
    list: (companyId: string) =>
      db
        .select()
        .from(ventureConstitutionRevisions)
        .where(eq(ventureConstitutionRevisions.companyId, companyId))
        .orderBy(desc(ventureConstitutionRevisions.version)),

    current: (companyId: string) =>
      db
        .select()
        .from(ventureConstitutionRevisions)
        .where(
          and(
            eq(ventureConstitutionRevisions.companyId, companyId),
            eq(ventureConstitutionRevisions.status, "active"),
          ),
        )
        .then((rows) => rows[0] ?? null),

    getById: (id: string) =>
      db
        .select()
        .from(ventureConstitutionRevisions)
        .where(eq(ventureConstitutionRevisions.id, id))
        .then((rows) => rows[0] ?? null),

    createDraft: (
      companyId: string,
      data: CreateVentureConstitutionRevision,
      actor: VentureConstitutionActor,
    ) =>
      db.transaction(async (tx) => {
        await lockCompanyRevisionSequence(tx, companyId);
        const version = await nextVersion(tx, companyId);
        return tx
          .insert(ventureConstitutionRevisions)
          .values({
            companyId,
            version,
            status: "draft",
            content: data.content,
            changeReason: data.changeReason,
            sourceRefs: data.sourceRefs,
            createdByAgentId: actor.agentId,
            createdByUserId: actor.userId,
          })
          .returning()
          .then((rows) => rows[0]!);
      }),

    activate: (companyId: string, id: string, userId: string, approvalNote: string) =>
      db.transaction(async (tx) => {
        await lockCompanyRevisionSequence(tx, companyId);
        const target = await tx
          .select()
          .from(ventureConstitutionRevisions)
          .where(
            and(
              eq(ventureConstitutionRevisions.id, id),
              eq(ventureConstitutionRevisions.companyId, companyId),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (!target) throw notFound("Venture Constitution revision not found");
        if (target.status === "active") return target;
        if (target.status !== "draft") {
          throw conflict("Superseded revisions must be restored into a new draft before activation");
        }

        const now = new Date();
        await tx
          .update(ventureConstitutionRevisions)
          .set({ status: "superseded", supersededAt: now })
          .where(
            and(
              eq(ventureConstitutionRevisions.companyId, companyId),
              eq(ventureConstitutionRevisions.status, "active"),
            ),
          );

        return tx
          .update(ventureConstitutionRevisions)
          .set({
            status: "active",
            activatedByUserId: userId,
            approvalNote,
            activatedAt: now,
            supersededAt: null,
          })
          .where(
            and(
              eq(ventureConstitutionRevisions.id, id),
              eq(ventureConstitutionRevisions.companyId, companyId),
              eq(ventureConstitutionRevisions.status, "draft"),
            ),
          )
          .returning()
          .then((rows) => {
            const revision = rows[0];
            if (!revision) throw conflict("Venture Constitution revision changed before activation");
            return revision;
          });
      }),

    restoreDraft: (
      companyId: string,
      id: string,
      data: RestoreVentureConstitutionRevision,
      actor: VentureConstitutionActor,
    ) =>
      db.transaction(async (tx) => {
        await lockCompanyRevisionSequence(tx, companyId);
        const source = await tx
          .select()
          .from(ventureConstitutionRevisions)
          .where(
            and(
              eq(ventureConstitutionRevisions.id, id),
              eq(ventureConstitutionRevisions.companyId, companyId),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (!source) throw notFound("Venture Constitution revision not found");

        const version = await nextVersion(tx, companyId);
        return tx
          .insert(ventureConstitutionRevisions)
          .values({
            companyId,
            version,
            status: "draft",
            content: source.content,
            changeReason: data.changeReason,
            sourceRefs: source.sourceRefs,
            restoredFromRevisionId: source.id,
            createdByAgentId: actor.agentId,
            createdByUserId: actor.userId,
          })
          .returning()
          .then((rows) => rows[0]!);
      }),
  };
}
