import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(), // "inspection_created" | "status_changed"
  userId: text("user_id"),
  userDisplayName: text("user_display_name"),
  inspectionId: integer("inspection_id").notNull(),
  inspectionTitle: text("inspection_title").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActivityEvent = typeof activityLogTable.$inferSelect;
