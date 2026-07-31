import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  GovernedIntakeCompatibility,
  GovernedIntakeDecision,
  GovernedIntakeResourceKind,
  PluginCapability,
  VentureSourceRef,
} from "@paperclipai/shared";
import { plugins } from "./plugins.js";

export const governedIntakeAssessments = pgTable(
  "governed_intake_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceKind: text("resource_kind").$type<GovernedIntakeResourceKind>().notNull(),
    resourceId: text("resource_id").notNull(),
    resourceVersion: text("resource_version").notNull(),
    displayName: text("display_name").notNull(),
    pluginId: uuid("plugin_id").references(() => plugins.id, { onDelete: "cascade" }),
    decision: text("decision").$type<GovernedIntakeDecision>().notNull(),
    compatibility: text("compatibility").$type<GovernedIntakeCompatibility>().notNull(),
    capabilitySnapshot: jsonb("capability_snapshot").$type<PluginCapability[]>().notNull().default([]),
    permissionBoundary: text("permission_boundary").notNull(),
    costBoundary: text("cost_boundary").notNull(),
    productBoundary: text("product_boundary").notNull(),
    reviewNote: text("review_note").notNull(),
    sourceRefs: jsonb("source_refs").$type<VentureSourceRef[]>().notNull().default([]),
    reviewedByUserId: text("reviewed_by_user_id").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    resourceVersionIdx: index("governed_intake_resource_version_idx").on(
      table.resourceKind,
      table.resourceId,
      table.resourceVersion,
      table.createdAt,
    ),
    pluginVersionIdx: index("governed_intake_plugin_version_idx").on(
      table.pluginId,
      table.resourceVersion,
      table.createdAt,
    ),
    resourceKindCheck: check(
      "governed_intake_resource_kind_check",
      sql`${table.resourceKind} in ('plugin', 'paperclip_upstream')`,
    ),
    decisionCheck: check(
      "governed_intake_decision_check",
      sql`${table.decision} in ('adopt', 'adapt', 'defer', 'reject')`,
    ),
    compatibilityCheck: check(
      "governed_intake_compatibility_check",
      sql`${table.compatibility} in ('compatible', 'needs_review', 'incompatible')`,
    ),
    pluginLinkCheck: check(
      "governed_intake_plugin_link_check",
      sql`(${table.resourceKind} = 'plugin' and ${table.pluginId} is not null)
        or (${table.resourceKind} = 'paperclip_upstream' and ${table.pluginId} is null)`,
    ),
  }),
);
