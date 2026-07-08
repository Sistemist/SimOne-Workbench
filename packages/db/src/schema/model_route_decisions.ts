import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { goals } from "./goals.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";

export const modelRouteDecisions = pgTable(
  "model_route_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    lane: text("lane").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    reason: text("reason").notNull(),
    riskLevel: text("risk_level").notNull().default("unknown"),
    taskIntent: text("task_intent"),
    contextSummary: text("context_summary"),
    approvalGate: text("approval_gate"),
    outputSummary: text("output_summary"),
    outputConfidence: text("output_confidence").notNull().default("unknown"),
    reviewStatus: text("review_status").notNull().default("pending"),
    reviewNote: text("review_note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdByRunId: uuid("created_by_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("model_route_decisions_company_created_idx").on(table.companyId, table.createdAt),
    companyLaneCreatedIdx: index("model_route_decisions_company_lane_created_idx").on(
      table.companyId,
      table.lane,
      table.createdAt,
    ),
    companyAgentCreatedIdx: index("model_route_decisions_company_agent_created_idx").on(
      table.companyId,
      table.agentId,
      table.createdAt,
    ),
    companyRunIdx: index("model_route_decisions_company_run_idx").on(table.companyId, table.heartbeatRunId),
  }),
);
