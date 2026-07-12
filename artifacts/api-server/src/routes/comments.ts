import { requireAuth } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/authorize";
import { Router } from "express";
import { db, commentsTable, inspectionsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

// GET /inspections/:id/comments
router.get("/inspections/:id/comments", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [inspection] = await db
      .select({ id: inspectionsTable.id })
      .from(inspectionsTable)
      .where(eq(inspectionsTable.id, id));
    if (!inspection) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rows = await db
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.inspectionId, id))
      .orderBy(asc(commentsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list comments");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /inspections/:id/comments
router.post(
  "/inspections/:id/comments",
  requireAuth,
  authorize(["ADMIN", "INSPECTOR"]),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { body } = req.body as { body?: unknown };
    if (typeof body !== "string" || body.trim().length === 0) {
      res.status(400).json({ error: "body is required" });
      return;
    }
    try {
      const [inspection] = await db
        .select({ id: inspectionsTable.id })
        .from(inspectionsTable)
        .where(eq(inspectionsTable.id, id));
      if (!inspection) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const userId = req.user!.id;

      const userDisplayName =
        `${req.user!.firstName ?? ""} ${req.user!.lastName ?? ""}`.trim() ||
        "Engineer";

      const [row] = await db
        .insert(commentsTable)
        .values({
          inspectionId: id,
          userId,
          userDisplayName,
          body: body.trim(),
        })
        .returning();
      res.status(201).json(row);
    } catch (err) {
      req.log.error({ err }, "Failed to add comment");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export { router as commentsRouter };
