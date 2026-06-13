import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  inspectionId: integer("inspection_id").notNull(),
  inspectionTitle: text("inspection_title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("status_change"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notificationsTable.$inferSelect;
