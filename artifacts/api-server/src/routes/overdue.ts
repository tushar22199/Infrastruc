import { requireAuth } from "../middlewares/authMiddleware";
import { Router } from "express";
import { db, inspectionsTable } from "@workspace/db";
import { isNotNull, lte, sql } from "drizzle-orm";

const router = Router();

// GET /dashboard/overdue-reinspections
router.get(
  "/dashboard/overdue-reinspections",
  requireAuth,
  async (req, res) => {
  try {
    const now = new Date();

    const rows = await db
      .select()
      .from(inspectionsTable)
      .where(
        sql`${inspectionsTable.reinspectionInterval} IS NOT NULL
            AND ${inspectionsTable.nextReinspectionDate} IS NOT NULL
            AND ${inspectionsTable.nextReinspectionDate} <= ${now}`
      );

    const result = rows.map((row) => {
      const due = new Date(row.nextReinspectionDate!);
      const diffMs = now.getTime() - due.getTime();
      const daysOverdue = Math.max(0, Math.floor(diffMs / 86_400_000));
      return {
        id: row.id,
        title: row.title,
        severity: row.severity,
        reinspectionInterval: row.reinspectionInterval,
        nextReinspectionDate: row.nextReinspectionDate,
        daysOverdue,
      };
    });

    // Sort most overdue first
    result.sort((a, b) => b.daysOverdue - a.daysOverdue);

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch overdue re-inspections");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as overdueRouter };
