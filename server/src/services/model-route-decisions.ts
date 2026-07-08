import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, modelRouteDecisions } from "@paperclipai/db";
import type { CreateModelRouteDecision } from "@paperclipai/shared";
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

      return db
        .select()
        .from(modelRouteDecisions)
        .where(and(...conditions))
        .orderBy(desc(modelRouteDecisions.createdAt))
        .limit(options.limit);
    },
  };
}
