import { Router } from "express";
import { db, inspectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Cluster {
  centerLat: number;
  centerLng: number;
  inspectionIds: number[];
  titles: string[];
}

/** Greedy single-pass clustering */
function clusterInspections(
  inspections: { id: number; title: string; latitude: number; longitude: number }[],
  radiusKm: number
): Cluster[] {
  const clusters: Cluster[] = [];

  for (const insp of inspections) {
    let assigned = false;
    for (const cluster of clusters) {
      if (haversineKm(insp.latitude, insp.longitude, cluster.centerLat, cluster.centerLng) <= radiusKm) {
        // Update rolling centroid
        const n = cluster.inspectionIds.length;
        cluster.centerLat = (cluster.centerLat * n + insp.latitude) / (n + 1);
        cluster.centerLng = (cluster.centerLng * n + insp.longitude) / (n + 1);
        cluster.inspectionIds.push(insp.id);
        cluster.titles.push(insp.title);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      clusters.push({
        centerLat: insp.latitude,
        centerLng: insp.longitude,
        inspectionIds: [insp.id],
        titles: [insp.title],
      });
    }
  }

  return clusters.filter((c) => c.inspectionIds.length >= 2);
}

// GET /dashboard/hotspots
router.get("/dashboard/hotspots", async (req, res) => {
  const rawRadius = Number(req.query.radiusKm);
  const radiusKm = Number.isFinite(rawRadius) && rawRadius > 0 ? Math.min(rawRadius, 500) : 10;

  try {
    const criticalActive = await db
      .select({
        id: inspectionsTable.id,
        title: inspectionsTable.title,
        latitude: inspectionsTable.latitude,
        longitude: inspectionsTable.longitude,
      })
      .from(inspectionsTable)
      .where(
        and(
          eq(inspectionsTable.severity, "Critical"),
          eq(inspectionsTable.status, "Active")
        )
      );

    const clusters = clusterInspections(criticalActive, radiusKm);

    res.json(
      clusters.map((c, idx) => ({
        id: idx + 1,
        centerLat: c.centerLat,
        centerLng: c.centerLng,
        count: c.inspectionIds.length,
        radiusKm,
        inspectionIds: c.inspectionIds,
        titles: c.titles,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to compute hotspots");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as hotspotsRouter };
