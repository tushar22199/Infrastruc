import { pgTable, serial, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const issueTypeEnum = [
  "Pavement Distress",
  "Drainage",
  "Structural Damage",
  "Signage",
  "Erosion",
  "Bridge Deterioration",
  "Utility Failure",
  "Other",
] as const;

export const severityEnum = ["Critical", "Medium", "Low"] as const;
export const statusEnum = ["Active", "Resolved", "Under Review"] as const;

export const inspectionsTable = pgTable("inspections", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  issueType: text("issue_type").notNull(),
  severity: text("severity").notNull(),
  description: text("description").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  status: text("status").notNull().default("Active"),
  userId: text("user_id"),
  assignedTo: text("assigned_to"),
  assignedToName: text("assigned_to_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertInspectionSchema = createInsertSchema(inspectionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspectionsTable.$inferSelect;
