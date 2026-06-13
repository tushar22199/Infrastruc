import { Router } from "express";
import { db, inspectionsTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";

const router = Router();

function computeHealthScore(
  criticalCount: number,
  mediumCount: number,
  lowCount: number
): number {
  const deduction = criticalCount * 15 + mediumCount * 5 + lowCount * 2;
  return Math.max(0, 100 - deduction);
}

// GET /dashboard/summary
router.get("/dashboard/summary", async (req, res) => {
  try {
    const all = await db.select().from(inspectionsTable);
    const totalLogs = all.length;
    const active = all.filter((i) => i.status === "Active");
    const resolved = all.filter((i) => i.status === "Resolved");
    const critical = active.filter((i) => i.severity === "Critical").length;
    const medium = active.filter((i) => i.severity === "Medium").length;
    const low = active.filter((i) => i.severity === "Low").length;

    res.json({
      totalLogs,
      activeIssues: active.length,
      resolvedIssues: resolved.length,
      regionalHealthScore: computeHealthScore(critical, medium, low),
      criticalCount: critical,
      mediumCount: medium,
      lowCount: low,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/by-type
router.get("/dashboard/by-type", async (req, res) => {
  try {
    const all = await db.select().from(inspectionsTable);
    const map = new Map<string, number>();
    for (const row of all) {
      map.set(row.issueType, (map.get(row.issueType) ?? 0) + 1);
    }
    const result = Array.from(map.entries()).map(([issueType, count]) => ({
      issueType,
      count,
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get by-type breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/by-severity
router.get("/dashboard/by-severity", async (req, res) => {
  try {
    const all = await db.select().from(inspectionsTable);
    const map = new Map<string, number>();
    for (const row of all) {
      map.set(row.severity, (map.get(row.severity) ?? 0) + 1);
    }
    const result = Array.from(map.entries()).map(([severity, count]) => ({
      severity,
      count,
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get by-severity breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/recent
router.get("/dashboard/recent", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(inspectionsTable)
      .orderBy(desc(inspectionsTable.createdAt))
      .limit(10);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent inspections");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
