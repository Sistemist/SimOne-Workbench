import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const publicFunnelEvents = pgTable(
  "public_funnel_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventKey: text("event_key").notNull(),
    visitorId: uuid("visitor_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    eventName: text("event_name").notNull(),
    path: text("path").notNull(),
    source: text("source"),
    medium: text("medium"),
    campaign: text("campaign"),
    referrerHost: text("referrer_host"),
    resultCategory: text("result_category"),
    isTest: boolean("is_test").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventKeyUnique: uniqueIndex("public_funnel_events_event_key_unique").on(table.eventKey),
    createdAtIdx: index("public_funnel_events_created_at_idx").on(table.createdAt),
    eventCreatedIdx: index("public_funnel_events_name_created_idx").on(table.eventName, table.createdAt),
    visitorCreatedIdx: index("public_funnel_events_visitor_created_idx").on(table.visitorId, table.createdAt),
  }),
);
