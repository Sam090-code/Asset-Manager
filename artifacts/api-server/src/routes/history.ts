import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { conversionHistoryTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}

router.post("/history", requireAuth, async (req: any, res) => {
  try {
    const {
      type,
      fileName,
      originalSize,
      compressedSize,
      compressionRatio,
      pageCount,
      mimeType,
      level,
    } = req.body;

    if (!type || !fileName) {
      res.status(400).json({ error: "type and fileName are required" });
      return;
    }

    await db.insert(conversionHistoryTable).values({
      clerkUserId: req.userId,
      type,
      fileName,
      originalSize: originalSize ?? null,
      compressedSize: compressedSize ?? null,
      compressionRatio: compressionRatio ?? null,
      pageCount: pageCount ?? null,
      mimeType: mimeType ?? null,
      level: level ?? null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("history record error:", err);
    res.status(500).json({ error: "Failed to record history" });
  }
});

router.get("/history", requireAuth, async (req: any, res) => {
  try {
    const rows = await db
      .select()
      .from(conversionHistoryTable)
      .where(eq(conversionHistoryTable.clerkUserId, req.userId))
      .orderBy(desc(conversionHistoryTable.createdAt))
      .limit(100);

    res.json(rows);
  } catch (err) {
    console.error("history fetch error:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
