import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  SimCycleCompoundOutput,
  SimCycleDiagnoseOutput,
  SimCycleLeverageOutput,
  SimCycleMapOutput,
  SimCyclePhase,
  SimCycleStatus,
} from "@paperclipai/shared";
import { companies } from "./companies.js";
import { ventureConstitutionRevisions } from "./venture_constitution_revisions.js";
import { ventureContextProjections, ventureStateRevisions } from "./venture_operating_state.js";

export const simCycles = pgTable(
  "sim_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    status: text("status").$type<SimCycleStatus>().notNull().default("active"),
    phase: text("phase").$type<SimCyclePhase>().notNull().default("map"),
    constitutionRevisionId: uuid("constitution_revision_id")
      .notNull()
      .references(() => ventureConstitutionRevisions.id, { onDelete: "restrict" }),
    startingStateRevisionId: uuid("starting_state_revision_id")
      .references(() => ventureStateRevisions.id, { onDelete: "set null" }),
    currentStateRevisionId: uuid("current_state_revision_id")
      .references(() => ventureStateRevisions.id, { onDelete: "set null" }),
    contextProjectionId: uuid("context_projection_id")
      .references(() => ventureContextProjections.id, { onDelete: "set null" }),
    startReason: text("start_reason").notNull(),
    mapOutput: jsonb("map_output").$type<SimCycleMapOutput>(),
    diagnoseOutput: jsonb("diagnose_output").$type<SimCycleDiagnoseOutput>(),
    leverageOutput: jsonb("leverage_output").$type<SimCycleLeverageOutput>(),
    compoundOutput: jsonb("compound_output").$type<SimCycleCompoundOutput>(),
    startedByUserId: text("started_by_user_id").notNull(),
    pausedReason: text("paused_reason"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    oneOpenPerCompanyUq: uniqueIndex("sim_cycles_one_open_per_company_uq")
      .on(table.companyId)
      .where(sql`${table.status} in ('active', 'paused')`),
    companyCreatedIdx: index("sim_cycles_company_created_idx").on(table.companyId, table.createdAt),
    statusCheck: check("sim_cycles_status_check", sql`${table.status} in ('active', 'paused', 'completed')`),
    phaseCheck: check(
      "sim_cycles_phase_check",
      sql`${table.phase} in ('map', 'diagnose', 'leverage', 'compound', 'complete')`,
    ),
  }),
);

export const simCycleEvents = pgTable(
  "sim_cycle_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    cycleId: uuid("cycle_id").notNull().references(() => simCycles.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    phase: text("phase").$type<SimCyclePhase>().notNull(),
    actorUserId: text("actor_user_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cycleCreatedIdx: index("sim_cycle_events_cycle_created_idx").on(table.cycleId, table.createdAt),
    companyCreatedIdx: index("sim_cycle_events_company_created_idx").on(table.companyId, table.createdAt),
    phaseCheck: check(
      "sim_cycle_events_phase_check",
      sql`${table.phase} in ('map', 'diagnose', 'leverage', 'compound', 'complete')`,
    ),
  }),
);
