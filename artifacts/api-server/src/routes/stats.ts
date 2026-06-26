import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { platformStatsTable } from "@workspace/db";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res) => {
  const rows = await db.select().from(platformStatsTable).limit(1);

  let stats;
  if (rows.length === 0) {
    stats = {
      pdfsGenerated: 0,
      filesCompressed: 0,
      totalBytesCompressed: 0,
      avgCompressionRatio: 0,
    };
  } else {
    const row = rows[0];
    const total = row.filesCompressed;
    const avgRatio = total > 0
      ? Math.round(row.totalBytesCompressed / total)
      : 0;
    stats = {
      pdfsGenerated: row.pdfsGenerated,
      filesCompressed: row.filesCompressed,
      totalBytesCompressed: row.totalBytesCompressed,
      avgCompressionRatio: avgRatio,
    };
  }

  const response = GetStatsResponse.parse(stats);
  res.json(response);
});

router.post("/stats/record-pdf", async (_req, res) => {
  try {
    const existing = await db.select().from(platformStatsTable).limit(1);
    if (existing.length === 0) {
      await db.insert(platformStatsTable).values({
        pdfsGenerated: 1,
        filesCompressed: 0,
        totalBytesCompressed: 0,
      });
    } else {
      await db
        .update(platformStatsTable)
        .set({ pdfsGenerated: existing[0].pdfsGenerated + 1 })
        .where(eq(platformStatsTable.id, existing[0].id));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("record-pdf error:", err);
    res.status(500).json({ error: "Failed to record PDF stat" });
  }
});

export default router;
