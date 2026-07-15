import { db, inspectionsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

export async function getLatestInspections(limit = 20) {
  return db
    .select()
    .from(inspectionsTable)
    .orderBy(desc(inspectionsTable.createdAt))
    .limit(limit);
}

export async function getCriticalInspections() {
  return db
    .select()
    .from(inspectionsTable)
    .where(eq(inspectionsTable.severity, "Critical"))
    .orderBy(desc(inspectionsTable.createdAt));
}

export async function getActiveInspections() {
  return db
    .select()
    .from(inspectionsTable)
    .where(eq(inspectionsTable.status, "Active"))
    .orderBy(desc(inspectionsTable.createdAt));
}