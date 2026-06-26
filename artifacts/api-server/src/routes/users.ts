import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";

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

router.post("/users/sync", requireAuth, async (req: any, res) => {
  try {
    const { name, email } = req.body as { name?: string; email?: string };

    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const displayName = name || email.split("@")[0];

    await db
      .insert(usersTable)
      .values({
        name: displayName,
        email,
        status: "active",
        role: "user",
        lastActiveAt: new Date(),
      })
      .onConflictDoUpdate({
        target: usersTable.email,
        set: {
          name: displayName,
          lastActiveAt: new Date(),
        },
      });

    res.json({ ok: true });
  } catch (err) {
    console.error("users sync error:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

export default router;
