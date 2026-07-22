import { db, inspectionsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { parseQuery } from "./query-parser";

export async function retrieveRelevantInspections(question: string) {
  const filters = parseQuery(question);

  // Report requests intentionally retrieve all inspections
  if (filters.report) {
    return db
      .select()
      .from(inspectionsTable)
      .orderBy(desc(inspectionsTable.createdAt));
  }

  const conditions = [];

  if (filters.issueType) {
    conditions.push(eq(inspectionsTable.issueType, filters.issueType));
  }

  if (filters.status) {
    conditions.push(eq(inspectionsTable.status, filters.status));
  }

  if (filters.severity) {
    conditions.push(eq(inspectionsTable.severity, filters.severity));
  }

  const baseQuery = db
    .select()
    .from(inspectionsTable)
    .orderBy(desc(inspectionsTable.createdAt));

  if (conditions.length > 0) {
    if (filters.latest) {
      return baseQuery
        .where(and(...conditions))
        .limit(20);
    }

    return baseQuery.where(and(...conditions));
  }

  if (filters.latest) {
    return baseQuery.limit(20);
  }

  return baseQuery;
}