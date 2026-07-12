import { requireAuth } from "../middlewares/authMiddleware";
import { authorize } from "../middlewares/authorize";
import { Router } from "express";
import {
  db,
  inspectionsTable,
  notificationsTable,
  activityLogTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// POST /inspections/:id/assign
router.post(
  "/inspections/:id/assign",
  requireAuth,
  authorize(["ADMIN"]),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const { userId: assigneeId, displayName: assigneeName } = req.body as {
      userId?: unknown;
      displayName?: unknown;
    };
    if (typeof assigneeId !== "string" || typeof assigneeName !== "string") {
      res
        .status(400)
        .json({ error: "userId and displayName are required strings" });
      return;
    }

    try {
      const [existing] = await db
        .select()
        .from(inspectionsTable)
        .where(eq(inspectionsTable.id, id));

      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const assignerName =
        `${req.user!.firstName ?? ""} ${req.user!.lastName ?? ""}`.trim() ||
        "A project lead";

      const assignerId = req.user!.id;

      const [row] = await db
        .update(inspectionsTable)
        .set({
          assignedTo: assigneeId || null,
          assignedToName: assigneeName || null,
          updatedAt: new Date(),
        })
        .where(eq(inspectionsTable.id, id))
        .returning();

      const detail = `${assignerName} assigned this inspection to ${assigneeName}.`;

      // Notify the assignee
      notificationsTable &&
        db
          .insert(notificationsTable)
          .values({
            userId: assigneeId,
            inspectionId: row.id,
            inspectionTitle: row.title,
            message: detail,
            type: "assignment",
          })
          .execute()
          .catch((err: unknown) =>
            req.log.error({ err }, "Failed to create assignment notification"),
          );

      // Log activity
      db.insert(activityLogTable)
        .values({
          eventType: "status_changed",
          userId: assignerId,
          userDisplayName: assignerName,
          inspectionId: row.id,
          inspectionTitle: row.title,
          detail,
        })
        .execute()
        .catch((err: unknown) =>
          req.log.error({ err }, "Failed to log assignment activity"),
        );

      res.json(row);
    } catch (err) {
      req.log.error({ err }, "Failed to assign inspection");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export { router as assignRouter };
