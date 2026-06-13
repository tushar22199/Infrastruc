import { Router } from "express";
import { db, inspectionsTable, notificationsTable, activityLogTable } from "@workspace/db";
import { eq, desc, sql, inArray } from "drizzle-orm";
import {
  CreateInspectionBody,
  BatchCreateInspectionsBody,
  GetInspectionParams,
  UpdateInspectionParams,
  UpdateInspectionBody,
  DeleteInspectionParams,
} from "@workspace/api-zod";

const router = Router();

// GET /inspections
router.get("/inspections", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(inspectionsTable)
      .orderBy(desc(inspectionsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list inspections");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /inspections
router.post("/inspections", async (req, res) => {
  const parsed = CreateInspectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const userId = req.isAuthenticated() ? req.user.id : null;
    const userDisplayName = req.isAuthenticated()
      ? `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() || "Engineer"
      : "Engineer";

    const [row] = await db
      .insert(inspectionsTable)
      .values({
        title: parsed.data.title,
        issueType: parsed.data.issueType,
        severity: parsed.data.severity,
        description: parsed.data.description,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        status: parsed.data.status ?? "Active",
        userId,
      })
      .returning();

    // Log activity event (fire-and-forget)
    db.insert(activityLogTable)
      .values({
        eventType: "inspection_created",
        userId,
        userDisplayName,
        inspectionId: row.id,
        inspectionTitle: row.title,
        detail: `${userDisplayName} logged a new ${row.severity.toLowerCase()} severity ${row.issueType} inspection.`,
      })
      .execute()
      .catch((err: unknown) => req.log.error({ err }, "Failed to log activity"));

    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create inspection");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /inspections/batch
router.post("/inspections/batch", async (req, res) => {
  const parsed = BatchCreateInspectionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const rows = await db
      .insert(inspectionsTable)
      .values(
        parsed.data.inspections.map((i) => ({
          title: i.title,
          issueType: i.issueType,
          severity: i.severity,
          description: i.description,
          latitude: i.latitude,
          longitude: i.longitude,
          status: i.status ?? "Active",
          userId: req.isAuthenticated() ? req.user.id : null,
        }))
      )
      .returning();
    res.status(201).json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to batch create inspections");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /inspections/bulk-status  (must be registered BEFORE /:id to avoid route conflict)
router.patch("/inspections/bulk-status", async (req, res) => {
  const { ids, status } = req.body as { ids?: unknown; status?: unknown };

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id) => typeof id === "number" && Number.isInteger(id)) ||
    !["Active", "Under Review", "Resolved"].includes(status as string)
  ) {
    res.status(400).json({ error: "ids must be a non-empty array of integers and status must be a valid value" });
    return;
  }

  const validIds = ids as number[];
  const newStatus = status as string;

  try {
    const updaterName = req.isAuthenticated()
      ? `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() || "A team member"
      : "A team member";
    const updaterId = req.isAuthenticated() ? req.user.id : null;

    // Fetch existing records to detect status changes per item
    const existing = await db
      .select()
      .from(inspectionsTable)
      .where(inArray(inspectionsTable.id, validIds));

    // Perform the bulk update
    const updated = await db
      .update(inspectionsTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(inArray(inspectionsTable.id, validIds))
      .returning();

    // Fire notifications + activity for items whose status actually changed
    const changed = existing.filter((e) => e.status !== newStatus);
    for (const row of changed) {
      const message = `Status changed from "${row.status}" to "${newStatus}" by ${updaterName} (bulk update).`;

      if (row.userId) {
        db.insert(notificationsTable)
          .values({
            userId: row.userId,
            inspectionId: row.id,
            inspectionTitle: row.title,
            message,
            type: "status_change",
          })
          .execute()
          .catch((err: unknown) => req.log.error({ err }, "Failed to create bulk notification"));
      }

      db.insert(activityLogTable)
        .values({
          eventType: "status_changed",
          userId: updaterId,
          userDisplayName: updaterName,
          inspectionId: row.id,
          inspectionTitle: row.title,
          detail: message,
        })
        .execute()
        .catch((err: unknown) => req.log.error({ err }, "Failed to log bulk activity"));
    }

    res.json({ updatedCount: updated.length });
  } catch (err) {
    req.log.error({ err }, "Failed to bulk update status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /inspections/:id
router.get("/inspections/:id", async (req, res) => {
  const parsed = GetInspectionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(inspectionsTable)
      .where(eq(inspectionsTable.id, parsed.data.id));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get inspection");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /inspections/:id
router.patch("/inspections/:id", async (req, res) => {
  const paramsParsed = UpdateInspectionParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateInspectionBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  try {
    // Fetch existing record to detect status change
    const [existing] = await db
      .select()
      .from(inspectionsTable)
      .where(eq(inspectionsTable.id, paramsParsed.data.id));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [row] = await db
      .update(inspectionsTable)
      .set({
        ...bodyParsed.data,
        updatedAt: new Date(),
      })
      .where(eq(inspectionsTable.id, paramsParsed.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const newStatus = bodyParsed.data.status;
    if (newStatus && newStatus !== existing.status) {
      const updaterName = req.isAuthenticated()
        ? `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() || "A team member"
        : "A team member";
      const updaterId = req.isAuthenticated() ? req.user.id : null;
      const message = `Status changed from "${existing.status}" to "${newStatus}" by ${updaterName}.`;

      // Notify the inspection owner
      if (existing.userId) {
        db.insert(notificationsTable)
          .values({
            userId: existing.userId,
            inspectionId: row.id,
            inspectionTitle: row.title,
            message,
            type: "status_change",
          })
          .execute()
          .catch((err: unknown) => req.log.error({ err }, "Failed to create notification"));
      }

      // Log team-wide activity event
      db.insert(activityLogTable)
        .values({
          eventType: "status_changed",
          userId: updaterId,
          userDisplayName: updaterName,
          inspectionId: row.id,
          inspectionTitle: row.title,
          detail: message,
        })
        .execute()
        .catch((err: unknown) => req.log.error({ err }, "Failed to log activity"));
    }

    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update inspection");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /inspections/:id
router.delete("/inspections/:id", async (req, res) => {
  const parsed = DeleteInspectionParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(inspectionsTable).where(eq(inspectionsTable.id, parsed.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete inspection");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
