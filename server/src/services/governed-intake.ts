import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { governedIntakeAssessments, plugins } from "@paperclipai/db";
import type {
  CreateGovernedIntakeAssessment,
  GovernedIntakeAssessment,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";

const ACTIVATION_DECISIONS = ["adopt", "adapt"] as const;

export function governedIntakeService(db: Db) {
  return {
    list: (): Promise<GovernedIntakeAssessment[]> =>
      db
        .select()
        .from(governedIntakeAssessments)
        .orderBy(desc(governedIntakeAssessments.createdAt)),

    create: async (
      input: CreateGovernedIntakeAssessment,
      reviewedByUserId: string,
    ): Promise<GovernedIntakeAssessment> => {
      let capabilitySnapshot: GovernedIntakeAssessment["capabilitySnapshot"] = [];

      if (input.resourceKind === "plugin") {
        const plugin = await db
          .select()
          .from(plugins)
          .where(eq(plugins.id, input.pluginId!))
          .then((rows) => rows[0] ?? null);
        if (!plugin) throw notFound("Plugin not found");
        if (plugin.pluginKey !== input.resourceId || plugin.version !== input.resourceVersion) {
          throw unprocessable("Plugin intake must match the currently installed plugin key and exact version");
        }
        capabilitySnapshot = plugin.manifestJson.capabilities;
      }

      return db
        .insert(governedIntakeAssessments)
        .values({
          ...input,
          capabilitySnapshot,
          reviewedByUserId,
        })
        .returning()
        .then((rows) => rows[0]!);
    },

    approvedForPluginVersion: async (pluginId: string, version: string) => {
      const latest = await db
        .select()
        .from(governedIntakeAssessments)
        .where(
          and(
            eq(governedIntakeAssessments.resourceKind, "plugin"),
            eq(governedIntakeAssessments.pluginId, pluginId),
            eq(governedIntakeAssessments.resourceVersion, version),
          ),
        )
        .orderBy(desc(governedIntakeAssessments.createdAt))
        .then((rows) => rows[0] ?? null);
      return latest?.compatibility === "compatible"
        && ACTIVATION_DECISIONS.includes(latest.decision as (typeof ACTIVATION_DECISIONS)[number])
        ? latest
        : null;
    },
  };
}
