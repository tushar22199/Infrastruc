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
import type { Tool } from "../tool-types";

const inspectionAgent: Tool = {
  name: "inspection",

  description:
    "Retrieve inspections, critical issues, active inspections and recent inspections.",

  canHandle(question: string) {
    const q = question.toLowerCase();

    return (
      q.includes("inspection") ||
      q.includes("critical") ||
      q.includes("active") ||
      q.includes("latest") ||
      q.includes("report")
    );
  },

  async execute(question: string) {
    const q = question.toLowerCase();

    if (q.includes("critical")) {
      return {
        tool: "inspection",
        data: await getCriticalInspections(),
      };
    }

    if (q.includes("active")) {
      return {
        tool: "inspection",
        data: await getActiveInspections(),
      };
    }
    if (q.includes("report")) {
      return {
        tool: "inspection",
        data: await getAllInspections(),
      };
    }

    return {
      tool: "inspection",
      data: await getLatestInspections(),
    };
    
  },
};
export async function getAllInspections() {
  return db
    .select()
    .from(inspectionsTable)
    .orderBy(desc(inspectionsTable.createdAt));
}

export default inspectionAgent;