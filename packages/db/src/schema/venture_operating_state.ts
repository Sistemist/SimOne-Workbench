import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  VentureContextProjectionContent,
  VentureContextProjectionStatus,
  VentureSourceRef,
  VentureStateContent,
  VentureStateStatus,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { ventureConstitutionRevisions } from "./venture_constitution_revisions.js";

export const ventureStateRevisions = pgTable(
  "venture_state_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").$type<VentureStateStatus>().notNull().default("current"),
    content: jsonb("content").$type<VentureStateContent>().notNull(),
    creationReason: text("creation_reason").notNull(),
    sourceRefs: jsonb("source_refs").$type<VentureSourceRef[]>().notNull().default([]),
    constitutionRevisionId: uuid("constitution_revision_id")
      .notNull()
      .references(() => ventureConstitutionRevisions.id, { onDelete: "restrict" }),
    basedOnCycleId: uuid("based_on_cycle_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  (table) => ({
    companyVersionUq: uniqueIndex("venture_state_revisions_company_version_uq").on(
      table.companyId,
      table.version,
    ),
    oneCurrentPerCompanyUq: uniqueIndex("venture_state_revisions_one_current_per_company_uq")
      .on(table.companyId)
      .where(sql`${table.status} = 'current'`),
    companyCreatedIdx: index("venture_state_revisions_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
    statusCheck: check(
      "venture_state_revisions_status_check",
      sql`${table.status} in ('current', 'superseded')`,
    ),
  }),
);

export const ventureContextProjections = pgTable(
  "venture_context_projections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").$type<VentureContextProjectionStatus>().notNull().default("current"),
    constitutionRevisionId: uuid("constitution_revision_id")
      .notNull()
      .references(() => ventureConstitutionRevisions.id, { onDelete: "restrict" }),
    ventureStateRevisionId: uuid("venture_state_revision_id")
      .notNull()
      .references(() => ventureStateRevisions.id, { onDelete: "restrict" }),
    creationReason: text("creation_reason").notNull(),
    content: jsonb("content").$type<VentureContextProjectionContent>().notNull(),
    sourceRefs: jsonb("source_refs").$type<VentureSourceRef[]>().notNull().default([]),
    supersedesProjectionId: uuid("supersedes_projection_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  (table) => ({
    companyVersionUq: uniqueIndex("venture_context_projections_company_version_uq").on(
      table.companyId,
      table.version,
    ),
    oneCurrentPerCompanyUq: uniqueIndex("venture_context_projections_one_current_per_company_uq")
      .on(table.companyId)
      .where(sql`${table.status} = 'current'`),
    companyCreatedIdx: index("venture_context_projections_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
    stateIdx: index("venture_context_projections_state_idx").on(table.ventureStateRevisionId),
    statusCheck: check(
      "venture_context_projections_status_check",
      sql`${table.status} in ('current', 'superseded')`,
    ),
  }),
);
