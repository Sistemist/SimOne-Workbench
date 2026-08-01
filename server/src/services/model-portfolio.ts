import { and, desc, eq, max, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { modelPortfolioRevisions } from "@paperclipai/db";
import type {
  CreateModelPortfolioRevision,
  ModelRouteCandidate,
  RestoreModelPortfolioRevision,
} from "@paperclipai/shared";
import { conflict, notFound, unprocessable } from "../errors.js";

export interface ModelPortfolioActor {
  agentId: string | null;
  userId: string | null;
}

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

const PLACEHOLDER_IDENTITIES = new Set(["adapter-default", "auto", "default", "unknown"]);

async function lockCompany(tx: DbTransaction, companyId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${companyId}))`);
}

async function nextVersion(tx: DbTransaction, companyId: string) {
  const row = await tx
    .select({ value: max(modelPortfolioRevisions.version) })
    .from(modelPortfolioRevisions)
    .where(eq(modelPortfolioRevisions.companyId, companyId))
    .then((rows) => rows[0]);
  return (row?.value ?? 0) + 1;
}

export function modelPortfolioActivationBlockers(
  candidates: ModelRouteCandidate[],
  evaluatedAt: Date,
) {
  const blockers: string[] = [];
  if (candidates.length === 0) blockers.push("portfolio_has_no_candidates");
  if (!candidates.some((candidate) => candidate.enabled)) {
    blockers.push("portfolio_has_no_enabled_candidates");
  }

  const identities = new Set<string>();
  for (const candidate of candidates) {
    const provider = candidate.provider.trim().toLowerCase();
    const model = candidate.model.trim().toLowerCase();
    const modelTail = model.split("/").at(-1)?.split(":")[0] ?? model;
    const identity = `${provider}/${model}`;
    if (identities.has(identity)) blockers.push(`duplicate_candidate:${identity}`);
    identities.add(identity);

    if (PLACEHOLDER_IDENTITIES.has(provider)) {
      blockers.push(`provider_not_exact:${identity}`);
    }
    if (PLACEHOLDER_IDENTITIES.has(model) || PLACEHOLDER_IDENTITIES.has(modelTail)) {
      blockers.push(`model_not_exact:${identity}`);
    }
    if (candidate.billingType === "unknown") blockers.push(`billing_unknown:${identity}`);
    if (!candidate.evidence) {
      blockers.push(`evidence_missing:${identity}`);
      continue;
    }
    const verifiedAt = new Date(candidate.evidence.verifiedAt);
    const expiresAt = new Date(candidate.evidence.expiresAt);
    if (verifiedAt.getTime() > evaluatedAt.getTime()) {
      blockers.push(`evidence_verified_in_future:${identity}`);
    }
    if (expiresAt.getTime() <= evaluatedAt.getTime()) {
      blockers.push(`evidence_stale:${identity}`);
    }
  }

  return [...new Set(blockers)];
}

export function modelPortfolioService(db: Db) {
  return {
    list: (companyId: string) =>
      db
        .select()
        .from(modelPortfolioRevisions)
        .where(eq(modelPortfolioRevisions.companyId, companyId))
        .orderBy(desc(modelPortfolioRevisions.version)),

    current: (companyId: string) =>
      db
        .select()
        .from(modelPortfolioRevisions)
        .where(
          and(
            eq(modelPortfolioRevisions.companyId, companyId),
            eq(modelPortfolioRevisions.status, "active"),
          ),
        )
        .then((rows) => rows[0] ?? null),

    createDraft: (
      companyId: string,
      data: CreateModelPortfolioRevision,
      actor: ModelPortfolioActor,
    ) =>
      db.transaction(async (tx) => {
        await lockCompany(tx, companyId);
        const version = await nextVersion(tx, companyId);
        return tx
          .insert(modelPortfolioRevisions)
          .values({
            companyId,
            version,
            status: "draft",
            candidates: data.candidates,
            changeReason: data.changeReason,
            sourceRefs: data.sourceRefs,
            createdByAgentId: actor.agentId,
            createdByUserId: actor.userId,
          })
          .returning()
          .then((rows) => rows[0]!);
      }),

    activate: (
      companyId: string,
      id: string,
      userId: string,
      approvalNote: string,
      evaluatedAt = new Date(),
    ) =>
      db.transaction(async (tx) => {
        await lockCompany(tx, companyId);
        const target = await tx
          .select()
          .from(modelPortfolioRevisions)
          .where(
            and(
              eq(modelPortfolioRevisions.companyId, companyId),
              eq(modelPortfolioRevisions.id, id),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (!target) throw notFound("Model portfolio revision not found");
        if (target.status === "active") return target;
        if (target.status !== "draft") {
          throw conflict("Superseded model portfolios must be restored into a new draft");
        }

        const blockers = modelPortfolioActivationBlockers(target.candidates, evaluatedAt);
        if (blockers.length > 0) {
          throw unprocessable(`Model portfolio cannot be activated: ${blockers.join(", ")}`);
        }

        await tx
          .update(modelPortfolioRevisions)
          .set({ status: "superseded", supersededAt: evaluatedAt })
          .where(
            and(
              eq(modelPortfolioRevisions.companyId, companyId),
              eq(modelPortfolioRevisions.status, "active"),
            ),
          );

        return tx
          .update(modelPortfolioRevisions)
          .set({
            status: "active",
            activatedByUserId: userId,
            approvalNote,
            activatedAt: evaluatedAt,
            supersededAt: null,
          })
          .where(
            and(
              eq(modelPortfolioRevisions.companyId, companyId),
              eq(modelPortfolioRevisions.id, id),
              eq(modelPortfolioRevisions.status, "draft"),
            ),
          )
          .returning()
          .then((rows) => {
            const revision = rows[0];
            if (!revision) throw conflict("Model portfolio revision changed before activation");
            return revision;
          });
      }),

    restoreDraft: (
      companyId: string,
      id: string,
      data: RestoreModelPortfolioRevision,
      actor: ModelPortfolioActor,
    ) =>
      db.transaction(async (tx) => {
        await lockCompany(tx, companyId);
        const source = await tx
          .select()
          .from(modelPortfolioRevisions)
          .where(
            and(
              eq(modelPortfolioRevisions.companyId, companyId),
              eq(modelPortfolioRevisions.id, id),
            ),
          )
          .then((rows) => rows[0] ?? null);
        if (!source) throw notFound("Model portfolio revision not found");
        const version = await nextVersion(tx, companyId);
        return tx
          .insert(modelPortfolioRevisions)
          .values({
            companyId,
            version,
            status: "draft",
            candidates: source.candidates,
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
