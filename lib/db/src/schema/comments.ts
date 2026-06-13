import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id").notNull(),
  userId: text("user_id"),
  userDisplayName: text("user_display_name"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Comment = typeof commentsTable.$inferSelect;
