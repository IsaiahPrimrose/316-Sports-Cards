import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// A single row (id "main") holds the whole store: settings plus the list of cards and packs.
export const storeState = pgTable("store_state", {
  id: text().primaryKey(),
  data: jsonb().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});
