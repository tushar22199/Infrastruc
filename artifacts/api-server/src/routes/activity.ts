import { requireAuth } from "../middlewares/authMiddleware";
import { Router } from "express";
import { db, activityLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

// GET /activity
router.get(
  "/activity",
  requireAuth,
  async (req, res) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;

  try {
    const events = await db
      .select()
      .from(activityLogTable)
      .orderBy(desc(activityLogTable.createdAt))
      .limit(limit);

    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Failed to list activity events");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as activityRouter };
