import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { VentureShareSnapshot } from "@paperclipai/shared";
import { companies } from "./companies.js";

export const companyVentureShares = pgTable(
  "company_venture_shares",
  {
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id"),
    snapshot: jsonb("snapshot").$type<VentureShareSnapshot>().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("company_venture_shares_company_created_idx").on(table.companyId, table.createdAt),
    publicActiveIdx: index("company_venture_shares_public_active_idx").on(table.id, table.revokedAt),
  }),
);
