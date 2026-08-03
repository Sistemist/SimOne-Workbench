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
import { authUsers } from "./auth.js";
import { companies } from "./companies.js";

export const earlyAccessRequests = pgTable(
  "early_access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestKey: uuid("request_key").notNull(),
    founderName: text("founder_name").notNull(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    useCase: text("use_case"),
    source: text("source"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    requestKeyUniqueIdx: uniqueIndex("early_access_requests_request_key_uq").on(table.requestKey),
    statusCreatedIdx: index("early_access_requests_status_created_idx").on(table.status, table.createdAt),
    emailCreatedIdx: index("early_access_requests_email_created_idx").on(
      table.emailNormalized,
      table.createdAt,
    ),
    statusCheck: check(
      "early_access_requests_status_check",
      sql`${table.status} in ('pending', 'invited', 'activated', 'closed')`,
    ),
  }),
);

export const earlyAccessGrants = pgTable(
  "early_access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id").references(() => earlyAccessRequests.id, { onDelete: "set null" }),
    founderName: text("founder_name").notNull(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    source: text("source"),
    tokenHash: text("token_hash").notNull(),
    maxVentures: integer("max_ventures").notNull().default(3),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    activatedByUserId: text("activated_by_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    createdByUserId: text("created_by_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex("early_access_grants_token_hash_uq").on(table.tokenHash),
    userIdx: index("early_access_grants_user_idx").on(table.activatedByUserId, table.revokedAt),
    requestIdx: index("early_access_grants_request_idx").on(table.requestId, table.createdAt),
    maxVenturesCheck: check(
      "early_access_grants_max_ventures_check",
      sql`${table.maxVentures} between 1 and 10`,
    ),
  }),
);

export const scannerRuns = pgTable(
  "scanner_runs",
  {
    id: uuid("id").primaryKey(),
    accessRequestId: uuid("access_request_id").references(() => earlyAccessRequests.id, {
      onDelete: "set null",
    }),
    ownerUserId: text("owner_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    algorithmVersion: text("algorithm_version").notNull(),
    inputPayload: jsonb("input_payload").$type<{
      startupUrl: string;
      founderNote: string;
    }>().notNull(),
    resultPayload: jsonb("result_payload").$type<Record<string, unknown>>().notNull(),
    clientSavedAt: timestamp("client_saved_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerCreatedIdx: index("scanner_runs_owner_created_idx").on(table.ownerUserId, table.createdAt),
    companyCreatedIdx: index("scanner_runs_company_created_idx").on(table.companyId, table.createdAt),
    requestIdx: index("scanner_runs_request_idx").on(table.accessRequestId),
  }),
);
