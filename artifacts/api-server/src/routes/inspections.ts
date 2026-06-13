import { Router } from "express";
import { db, inspectionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
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
      })
      .returning();
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
        }))
      )
      .returning();
    res.status(201).json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to batch create inspections");
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
