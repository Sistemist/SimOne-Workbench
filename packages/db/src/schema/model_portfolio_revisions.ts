import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
  ModelPortfolioRevisionStatus,
  ModelPortfolioSourceRef,
  ModelRouteCandidate,
} from "@paperclipai/shared";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const modelPortfolioRevisions = pgTable(
  "model_portfolio_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").$type<ModelPortfolioRevisionStatus>().notNull().default("draft"),
    candidates: jsonb("candidates").$type<ModelRouteCandidate[]>().notNull().default([]),
    changeReason: text("change_reason").notNull(),
    sourceRefs: jsonb("source_refs").$type<ModelPortfolioSourceRef[]>().notNull().default([]),
    restoredFromRevisionId: uuid("restored_from_revision_id").references(
      (): AnyPgColumn => modelPortfolioRevisions.id,
      { onDelete: "set null" },
    ),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    activatedByUserId: text("activated_by_user_id"),
    approvalNote: text("approval_note"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyVersionUq: uniqueIndex("model_portfolio_revisions_company_version_uq").on(
      table.companyId,
      table.version,
    ),
    oneActivePerCompanyUq: uniqueIndex("model_portfolio_revisions_one_active_per_company_uq")
      .on(table.companyId)
      .where(sql`${table.status} = 'active'`),
    companyCreatedIdx: index("model_portfolio_revisions_company_created_idx").on(
      table.companyId,
      table.createdAt,
    ),
    statusCheck: check(
      "model_portfolio_revisions_status_check",
      sql`${table.status} in ('draft', 'active', 'superseded')`,
    ),
  }),
);
