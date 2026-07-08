import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, costEvents, modelRouteDecisions } from "@paperclipai/db";
import type { CreateModelRouteDecision, UpdateModelRouteDecisionReview } from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";

export interface ModelRouteDecisionActor {
  createdByAgentId?: string | null;
  createdByUserId?: string | null;
}

export function modelRouteDecisionService(db: Db) {
  return {
    create: async (
      companyId: string,
      data: CreateModelRouteDecision,
      actor: ModelRouteDecisionActor = {},
    ) => {
      const agent = await db
        .select({
          id: agents.id,
          companyId: agents.companyId,
        })
        .from(agents)
        .where(eq(agents.id, data.agentId))
        .then((rows) => rows[0] ?? null);

      if (!agent) throw notFound("Agent not found");
      if (agent.companyId !== companyId) {
        throw unprocessable("Agent does not belong to company");
      }

      const { contextPayload: _contextPayload, ...insertData } = data as CreateModelRouteDecision & {
        contextPayload?: unknown;
      };

      return db
        .insert(modelRouteDecisions)
        .values({
          ...insertData,
          companyId,
          metadata: insertData.metadata ?? {},
          createdByAgentId: actor.createdByAgentId ?? null,
          createdByUserId: actor.createdByUserId ?? null,
          createdByRunId: insertData.createdByRunId ?? insertData.heartbeatRunId ?? null,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    list: async (companyId: string, options: { limit: number; agentId?: string | null } = { limit: 100 }) => {
      const conditions = [eq(modelRouteDecisions.companyId, companyId)];
      if (options.agentId) conditions.push(eq(modelRouteDecisions.agentId, options.agentId));

      const decisions = await db
        .select()
        .from(modelRouteDecisions)
        .where(and(...conditions))
        .orderBy(desc(modelRouteDecisions.createdAt))
        .limit(options.limit);

      if (decisions.length === 0) return decisions;

      const costRows = await db
        .select({
          modelRouteDecisionId: costEvents.modelRouteDecisionId,
          costEventCount: sql<number>`count(${costEvents.id})::int`,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            inArray(costEvents.modelRouteDecisionId, decisions.map((decision) => decision.id)),
          ),
        )
        .groupBy(costEvents.modelRouteDecisionId);

      const costByDecision = new Map(
        costRows
          .filter((row): row is typeof row & { modelRouteDecisionId: string } => row.modelRouteDecisionId != null)
          .map((row) => [row.modelRouteDecisionId, row]),
      );

      return decisions.map((decision) => {
        const cost = costByDecision.get(decision.id);
        return {
          ...decision,
          costEventCount: cost?.costEventCount ?? 0,
          costCents: cost?.costCents ?? 0,
        };
      });
    },

    updateReview: async (
      companyId: string,
      id: string,
      data: UpdateModelRouteDecisionReview,
      options: { agentId?: string | null } = {},
    ) => {
      const conditions = [eq(modelRouteDecisions.companyId, companyId), eq(modelRouteDecisions.id, id)];
      if (options.agentId) conditions.push(eq(modelRouteDecisions.agentId, options.agentId));

      const updated = await db
        .update(modelRouteDecisions)
        .set({
          outputSummary: data.outputSummary ?? null,
          outputConfidence: data.outputConfidence,
          reviewStatus: data.reviewStatus,
          reviewNote: data.reviewNote ?? null,
          ...(data.outputArtifacts === undefined
            ? {}
            : {
                metadata: sql`${modelRouteDecisions.metadata} || ${JSON.stringify({
                  outputArtifacts: data.outputArtifacts,
                })}::jsonb`,
              }),
        })
        .where(and(...conditions))
        .returning()
        .then((rows) => rows[0] ?? null);

      if (!updated) throw notFound("Model route decision not found");
      return updated;
    },
  };
}
