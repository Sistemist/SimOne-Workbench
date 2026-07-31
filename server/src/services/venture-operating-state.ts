import { and, count, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  approvals,
  companies,
  issues,
  simCycles,
  ventureConstitutionRevisions,
  ventureContextProjections,
  ventureStateRevisions,
} from "@paperclipai/db";
import type {
  CreateVentureContextProjection,
  CreateVentureStateRevision,
  VentureContextProjectionContent,
  VentureSourceRef,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";

export interface VentureOperatingActor {
  agentId: string | null;
  userId: string | null;
}

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function lockCompany(tx: DbTransaction, companyId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${companyId}))`);
}

async function currentConstitution(db: Db | DbTransaction, companyId: string) {
  return db
    .select()
    .from(ventureConstitutionRevisions)
    .where(
      and(
        eq(ventureConstitutionRevisions.companyId, companyId),
        eq(ventureConstitutionRevisions.status, "active"),
      ),
    )
    .then((rows) => rows[0] ?? null);
}

async function nextStateVersion(tx: DbTransaction, companyId: string) {
  const row = await tx
    .select({ value: max(ventureStateRevisions.version) })
    .from(ventureStateRevisions)
    .where(eq(ventureStateRevisions.companyId, companyId))
    .then((rows) => rows[0]);
  return (row?.value ?? 0) + 1;
}

async function nextProjectionVersion(tx: DbTransaction, companyId: string) {
  const row = await tx
    .select({ value: max(ventureContextProjections.version) })
    .from(ventureContextProjections)
    .where(eq(ventureContextProjections.companyId, companyId))
    .then((rows) => rows[0]);
  return (row?.value ?? 0) + 1;
}

function uniqueSourceRefs(refs: VentureSourceRef[]) {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.kind}:${ref.id ?? ""}:${ref.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildProjectionContent(
  constitution: typeof ventureConstitutionRevisions.$inferSelect,
  state: typeof ventureStateRevisions.$inferSelect,
): VentureContextProjectionContent {
  return {
    purpose: constitution.content.purpose,
    nonNegotiables: constitution.content.nonNegotiables,
    approvalBoundaries: constitution.content.decisionRights.approvalRequired,
    ventureSummary: state.content.ventureSummary,
    engines: {
      product: {
        summary: state.content.engines.product.summary,
        freshness: state.content.engines.product.freshness,
      },
      customer: {
        summary: state.content.engines.customer.summary,
        freshness: state.content.engines.customer.freshness,
      },
      cash: {
        summary: state.content.engines.cash.summary,
        freshness: state.content.engines.cash.freshness,
      },
      skills: {
        summary: state.content.engines.skills.summary,
        freshness: state.content.engines.skills.freshness,
      },
    },
    activeConstraint: state.content.activeConstraint,
    nextMove: state.content.nextMove,
  };
}

function buildProjectionSourceRefs(
  constitution: typeof ventureConstitutionRevisions.$inferSelect,
  state: typeof ventureStateRevisions.$inferSelect,
) {
  const evidence = Object.values(state.content.engines).flatMap((engine) => engine.evidence);
  if (state.content.activeConstraint) evidence.push(...state.content.activeConstraint.evidence);
  return uniqueSourceRefs([
    {
      kind: "venture_constitution_revision",
      id: constitution.id,
      label: `Venture Constitution v${constitution.version}`,
      capturedAt: constitution.activatedAt?.toISOString() ?? constitution.createdAt.toISOString(),
    },
    ...constitution.sourceRefs,
    {
      kind: "venture_state_revision",
      id: state.id,
      label: `Canonical venture state v${state.version}`,
      capturedAt: state.createdAt.toISOString(),
    },
    ...state.sourceRefs,
    ...evidence,
  ]);
}

export function ventureOperatingStateService(db: Db) {
  return {
    currentState: (companyId: string) =>
      db
        .select()
        .from(ventureStateRevisions)
        .where(
          and(
            eq(ventureStateRevisions.companyId, companyId),
            eq(ventureStateRevisions.status, "current"),
          ),
        )
        .then((rows) => rows[0] ?? null),

    listStates: (companyId: string) =>
      db
        .select()
        .from(ventureStateRevisions)
        .where(eq(ventureStateRevisions.companyId, companyId))
        .orderBy(desc(ventureStateRevisions.version)),

    currentProjection: (companyId: string) =>
      db
        .select()
        .from(ventureContextProjections)
        .where(
          and(
            eq(ventureContextProjections.companyId, companyId),
            eq(ventureContextProjections.status, "current"),
          ),
        )
        .then((rows) => rows[0] ?? null),

    listProjections: (companyId: string) =>
      db
        .select()
        .from(ventureContextProjections)
        .where(eq(ventureContextProjections.companyId, companyId))
        .orderBy(desc(ventureContextProjections.version)),

    createState: (
      companyId: string,
      data: CreateVentureStateRevision,
      actor: VentureOperatingActor,
      options: { basedOnCycleId?: string | null } = {},
    ) =>
      db.transaction(async (tx) => {
        await lockCompany(tx, companyId);
        const constitution = await currentConstitution(tx, companyId);
        if (!constitution) {
          throw unprocessable("Activate a Venture Constitution before creating canonical venture state");
        }

        const now = new Date();
        await tx
          .update(ventureStateRevisions)
          .set({ status: "superseded", supersededAt: now })
          .where(
            and(
              eq(ventureStateRevisions.companyId, companyId),
              eq(ventureStateRevisions.status, "current"),
            ),
          );

        const version = await nextStateVersion(tx, companyId);
        return tx
          .insert(ventureStateRevisions)
          .values({
            companyId,
            version,
            status: "current",
            content: data.content,
            creationReason: data.creationReason,
            sourceRefs: data.sourceRefs,
            constitutionRevisionId: constitution.id,
            basedOnCycleId: options.basedOnCycleId ?? null,
            createdByAgentId: actor.agentId,
            createdByUserId: actor.userId,
          })
          .returning()
          .then((rows) => rows[0]!);
      }),

    createProjection: (
      companyId: string,
      data: CreateVentureContextProjection,
      actor: VentureOperatingActor,
    ) =>
      db.transaction(async (tx) => {
        await lockCompany(tx, companyId);
        const constitution = await currentConstitution(tx, companyId);
        if (!constitution) {
          throw unprocessable("Activate a Venture Constitution before projecting venture context");
        }

        const state = data.ventureStateRevisionId
          ? await tx
              .select()
              .from(ventureStateRevisions)
              .where(
                and(
                  eq(ventureStateRevisions.id, data.ventureStateRevisionId),
                  eq(ventureStateRevisions.companyId, companyId),
                ),
              )
              .then((rows) => rows[0] ?? null)
          : await tx
              .select()
              .from(ventureStateRevisions)
              .where(
                and(
                  eq(ventureStateRevisions.companyId, companyId),
                  eq(ventureStateRevisions.status, "current"),
                ),
              )
              .then((rows) => rows[0] ?? null);
        if (!state) throw notFound("Canonical venture state not found");

        const previous = await tx
          .select()
          .from(ventureContextProjections)
          .where(
            and(
              eq(ventureContextProjections.companyId, companyId),
              eq(ventureContextProjections.status, "current"),
            ),
          )
          .then((rows) => rows[0] ?? null);
        const now = new Date();
        if (previous) {
          await tx
            .update(ventureContextProjections)
            .set({ status: "superseded", supersededAt: now })
            .where(eq(ventureContextProjections.id, previous.id));
        }

        const version = await nextProjectionVersion(tx, companyId);
        return tx
          .insert(ventureContextProjections)
          .values({
            companyId,
            version,
            status: "current",
            constitutionRevisionId: constitution.id,
            ventureStateRevisionId: state.id,
            creationReason: data.creationReason,
            content: buildProjectionContent(constitution, state),
            sourceRefs: buildProjectionSourceRefs(constitution, state),
            supersedesProjectionId: previous?.id ?? null,
            createdByAgentId: actor.agentId,
            createdByUserId: actor.userId,
          })
          .returning()
          .then((rows) => rows[0]!);
      }),

    coach: async (companyId: string) => {
      const [states, projections, activeCycle, latestCycle] = await Promise.all([
        db
          .select()
          .from(ventureStateRevisions)
          .where(eq(ventureStateRevisions.companyId, companyId))
          .orderBy(desc(ventureStateRevisions.version)),
        db
          .select()
          .from(ventureContextProjections)
          .where(eq(ventureContextProjections.companyId, companyId))
          .orderBy(desc(ventureContextProjections.version)),
        db
          .select()
          .from(simCycles)
          .where(
            and(
              eq(simCycles.companyId, companyId),
              inArray(simCycles.status, ["active", "paused"]),
            ),
          )
          .orderBy(desc(simCycles.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(simCycles)
          .where(eq(simCycles.companyId, companyId))
          .orderBy(desc(simCycles.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);

      const state = states.find((revision) => revision.status === "current") ?? null;
      const projection = projections.find((revision) => revision.status === "current") ?? null;
      const memory = [
        ...states.map((revision) => ({
          id: revision.id,
          kind: "venture_state" as const,
          version: revision.version,
          status: revision.status as "current" | "superseded",
          summary: revision.content.ventureSummary,
          creationReason: revision.creationReason,
          sourceRefs: revision.sourceRefs,
          basedOnCycleId: revision.basedOnCycleId,
          createdAt: revision.createdAt,
          supersededAt: revision.supersededAt,
        })),
        ...projections.map((revision) => ({
          id: revision.id,
          kind: "context_projection" as const,
          version: revision.version,
          status: revision.status as "current" | "superseded",
          summary: revision.content.ventureSummary,
          creationReason: revision.creationReason,
          sourceRefs: revision.sourceRefs,
          basedOnCycleId: null,
          createdAt: revision.createdAt,
          supersededAt: revision.supersededAt,
        })),
      ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

      if (!state) {
        return {
          guidance: null,
          currentMemory: [],
          supersededMemory: memory.filter((entry) => entry.status === "superseded").slice(0, 20),
          activeCycle,
          latestCycle,
        };
      }

      const activeConstraint = projection?.content.activeConstraint ?? state.content.activeConstraint;
      const nextMove = projection?.content.nextMove ?? state.content.nextMove;
      const promotedLearning =
        latestCycle?.compoundOutput?.learning
        ?? state.content.learnings.at(-1)
        ?? null;
      const nextAction = activeCycle
        ? {
            title: `${activeCycle.status === "paused" ? "Resume" : "Continue"} ${activeCycle.phase.toUpperCase()} in the guided SIM Cycle`,
            href: "/cockpit" as const,
          }
        : {
            title: nextMove?.title ?? "Review the canonical venture state before assigning more work",
            href: "/cockpit" as const,
          };
      const explanation = activeCycle
        ? `The founder-triggered cycle is ${activeCycle.status} in ${activeCycle.phase.toUpperCase()}. Complete that bounded phase before opening another intervention.`
        : nextMove
          ? nextMove.rationale
          : "The venture has canonical state, but no bounded next move has been accepted yet.";

      return {
        guidance: {
          headline: activeConstraint?.hypothesis ?? state.content.ventureSummary,
          explanation,
          engine: activeCycle?.leverageOutput?.intervention.engine
            ?? nextMove?.engine
            ?? activeConstraint?.engine
            ?? null,
          approvalRequired: activeCycle
            ? activeCycle.phase === "diagnose" || activeCycle.phase === "leverage"
            : nextMove?.approvalRequired ?? true,
          nextAction,
          activeConstraint,
          promotedLearning,
          sourceRefs: projection?.sourceRefs ?? state.sourceRefs,
          stateVersion: state.version,
          projectionVersion: projection?.version ?? null,
        },
        currentMemory: memory.filter((entry) => entry.status === "current"),
        supersededMemory: memory.filter((entry) => entry.status === "superseded").slice(0, 20),
        activeCycle,
        latestCycle,
      };
    },

    cockpit: async (companyId: string) => {
      const [
        company,
        constitution,
        state,
        projection,
        approvalCount,
        issueCounts,
        activeCycle,
        latestCycle,
      ] = await Promise.all([
        db
          .select({ id: companies.id, name: companies.name, updatedAt: companies.updatedAt })
          .from(companies)
          .where(eq(companies.id, companyId))
          .then((rows) => rows[0] ?? null),
        currentConstitution(db, companyId),
        db
          .select()
          .from(ventureStateRevisions)
          .where(
            and(
              eq(ventureStateRevisions.companyId, companyId),
              eq(ventureStateRevisions.status, "current"),
            ),
          )
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(ventureContextProjections)
          .where(
            and(
              eq(ventureContextProjections.companyId, companyId),
              eq(ventureContextProjections.status, "current"),
            ),
          )
          .then((rows) => rows[0] ?? null),
        db
          .select({ value: count() })
          .from(approvals)
          .where(
            and(
              eq(approvals.companyId, companyId),
              inArray(approvals.status, ["pending", "revision_requested"]),
            ),
          )
          .then((rows) => rows[0]?.value ?? 0),
        db
          .select({ status: issues.status, value: count() })
          .from(issues)
          .where(and(eq(issues.companyId, companyId), isNull(issues.hiddenAt)))
          .groupBy(issues.status),
        db
          .select()
          .from(simCycles)
          .where(
            and(
              eq(simCycles.companyId, companyId),
              inArray(simCycles.status, ["active", "paused"]),
            ),
          )
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(simCycles)
          .where(eq(simCycles.companyId, companyId))
          .orderBy(desc(simCycles.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);
      if (!company) throw notFound("Company not found");

      const countByStatus = new Map(issueCounts.map((row) => [row.status, row.value]));
      const activeStatuses = ["backlog", "todo", "in_progress", "in_review"];
      const active = activeStatuses.reduce((sum, status) => sum + (countByStatus.get(status) ?? 0), 0);

      return {
        company,
        constitution,
        ventureState: state,
        contextProjection: projection,
        approvals: { pending: approvalCount },
        work: {
          active,
          blocked: countByStatus.get("blocked") ?? 0,
          completed: countByStatus.get("done") ?? 0,
        },
        freshness: {
          projectedAt: new Date().toISOString(),
          sources: projection?.sourceRefs ?? state?.sourceRefs ?? constitution?.sourceRefs ?? [],
        },
        activeCycle,
        latestCycle,
      };
    },
  };
}
