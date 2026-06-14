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

/** Compute the next reinspection timestamp from now */
function computeNextDate(interval: string): Date {
  const now = new Date();
  if (interval === "weekly") return new Date(now.getTime() + 7 * 86_400_000);
  if (interval === "monthly") return new Date(now.getTime() + 30 * 86_400_000);
  if (interval === "quarterly") return new Date(now.getTime() + 90 * 86_400_000);
  return now;
}

type GeoJsonGeometry = { type: string; coordinates: unknown[] };

/** Extract the representative [latitude, longitude] from a GeoJSON geometry.
 *  GeoJSON stores coordinates as [lng, lat]; we return [lat, lng] for DB. */
function representativePoint(geom: GeoJsonGeometry): { lat: number; lng: number } {
  if (geom.type === "Point") {
    const [lng, lat] = geom.coordinates as [number, number];
    return { lat, lng };
  }
  if (geom.type === "LineString") {
    const [lng, lat] = (geom.coordinates as [number, number][])[0];
    return { lat, lng };
  }
  if (geom.type === "Polygon") {
    const ring = (geom.coordinates as [number, number][][])[0];
    const [lng, lat] = ring[0];
    return { lat, lng };
  }
  throw new Error(`Unknown geometry type: ${geom.type}`);
}

/** Ensure every returned inspection always has a geometry field.
 *  Old records in the DB have geometry=null — synthesize a Point from lat/lng. */
function withGeometry<T extends { geometry: unknown; latitude: number; longitude: number }>(row: T) {
  return {
    ...row,
    geometry: (row.geometry as GeoJsonGeometry | null) ?? {
      type: "Point",
      coordinates: [row.longitude, row.latitude],
    },
  };
}

// GET /inspections
router.get("/inspections", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(inspectionsTable)
      .orderBy(desc(inspectionsTable.createdAt));
    res.json(rows.map(withGeometry));
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

    const anyData = parsed.data as any;
    const geom = anyData.geometry as GeoJsonGeometry | undefined;
    const interval = anyData.reinspectionInterval as string | undefined;
    const imageData = anyData.imageData as string | undefined;

    // Derive representative point from geometry; fall back to legacy lat/lng fields
    const point = geom
      ? representativePoint(geom)
      : { lat: (anyData.latitude as number) ?? 0, lng: (anyData.longitude as number) ?? 0 };

    const [row] = await db
      .insert(inspectionsTable)
      .values({
        title: parsed.data.title,
        issueType: parsed.data.issueType,
        severity: parsed.data.severity,
        description: parsed.data.description,
        latitude: point.lat,
        longitude: point.lng,
        geometry: geom ?? null,
        status: parsed.data.status ?? "Active",
        userId,
        reinspectionInterval: interval ?? null,
        nextReinspectionDate: interval ? computeNextDate(interval) : null,
        imageData: imageData ?? null,
      } as any)
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

    res.status(201).json(withGeometry(row));
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
    const uid = req.isAuthenticated() ? req.user.id : null;
    const rows = await db
      .insert(inspectionsTable)
      .values(
        parsed.data.inspections.map((i) => {
          const anyI = i as any;
          const geom = anyI.geometry as GeoJsonGeometry | undefined;
          const interval = anyI.reinspectionInterval as string | undefined;
          const point = geom
            ? representativePoint(geom)
            : { lat: (anyI.latitude as number) ?? 0, lng: (anyI.longitude as number) ?? 0 };
          return {
            title: i.title,
            issueType: i.issueType,
            severity: i.severity,
            description: i.description,
            latitude: point.lat,
            longitude: point.lng,
            geometry: geom ?? null,
            status: i.status ?? "Active",
            userId: uid,
            reinspectionInterval: interval ?? null,
            nextReinspectionDate: interval ? computeNextDate(interval) : null,
            imageData: (anyI.imageData as string | undefined) ?? null,
          };
        }) as any
      )
      .returning();
    res.status(201).json(rows.map(withGeometry));
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
    res.json(withGeometry(row));
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

    // If geometry is being updated, derive a new representative lat/lng
    const anyBody = bodyParsed.data as any;
    const geomUpdate = anyBody.geometry as GeoJsonGeometry | undefined;
    const extraFields: Record<string, unknown> = {};
    if (geomUpdate) {
      const point = representativePoint(geomUpdate);
      extraFields.latitude = point.lat;
      extraFields.longitude = point.lng;
    }

    const [row] = await db
      .update(inspectionsTable)
      .set({
        ...bodyParsed.data,
        ...extraFields,
        updatedAt: new Date(),
      } as any)
      .where(eq(inspectionsTable.id, paramsParsed.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Bump nextReinspectionDate when a scheduled inspection transitions to Resolved
    const newStatus = bodyParsed.data.status;
    if (newStatus === "Resolved" && existing.reinspectionInterval) {
      await db
        .update(inspectionsTable)
        .set({ nextReinspectionDate: computeNextDate(existing.reinspectionInterval) })
        .where(eq(inspectionsTable.id, paramsParsed.data.id));
    }

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

    res.json(withGeometry(row));
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
