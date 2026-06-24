import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import {
  compressionJobsTable,
  platformStatsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, gte, sql } from "drizzle-orm";
import fs from "fs";
import os from "os";
import path from "path";
import {
  AdminAuthResponse,
  AdminGetDashboardResponse,
  AdminListUsersResponseItem,
  AdminUpdateUserResponse,
  AdminDeleteUserResponse,
  AdminGetReportsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const JWT_SECRET = process.env.SESSION_SECRET ?? "dev-admin-secret-change-me";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

function signToken(): string {
  return jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "8h" });
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { role: string };
    if (payload.role !== "admin") throw new Error("Not admin");
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// POST /admin/auth
router.post("/admin/auth", async (req, res) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password || password !== ADMIN_PASSWORD) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    const result = AdminAuthResponse.parse({ token: signToken() });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth failed";
    res.status(500).json({ error: message });
  }
});

// GET /admin/dashboard
router.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  try {
    const [stats] = await db.select().from(platformStatsTable).limit(1);
    const users = await db.select().from(usersTable);
    const recentJobs = await db
      .select()
      .from(compressionJobsTable)
      .orderBy(desc(compressionJobsTable.createdAt))
      .limit(10);

    const activeUsers = users.filter((u) => u.status === "active").length;
    const suspendedUsers = users.filter((u) => u.status === "suspended").length;

    const avgRatio =
      recentJobs.length > 0
        ? Math.round(
            recentJobs.reduce((s, j) => s + j.compressionRatio, 0) /
              recentJobs.length,
          )
        : 0;

    const now = new Date();
    const activeJobs = await db
      .select()
      .from(compressionJobsTable)
      .where(gte(compressionJobsTable.expiresAt, now));

    let storageUsedBytes = 0;
    for (const job of activeJobs) {
      const tmpPath = path.join(os.tmpdir(), `compressed-${job.fileId}`);
      if (fs.existsSync(tmpPath)) {
        storageUsedBytes += job.compressedSize;
      }
    }

    const result = AdminGetDashboardResponse.parse({
      totalUsers: users.length,
      activeUsers,
      suspendedUsers,
      totalPdfsGenerated: stats?.pdfsGenerated ?? 0,
      totalFilesCompressed: stats?.filesCompressed ?? 0,
      totalBytesCompressed: stats?.totalBytesCompressed ?? 0,
      avgCompressionRatio: avgRatio,
      storageUsedBytes,
      activeJobsCount: activeJobs.length,
      recentActivity: recentJobs.map((j) => ({
        id: j.id,
        type: j.mimeType === "application/pdf" ? "pdf" : "image",
        fileName: j.fileName,
        originalSize: j.originalSize,
        compressedSize: j.compressedSize,
        compressionRatio: j.compressionRatio,
        level: j.level,
        createdAt: j.createdAt.toISOString(),
      })),
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard";
    res.status(500).json({ error: message });
  }
});

// GET /admin/users
router.get("/admin/users", requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    const result = users.map((u) =>
      AdminListUsersResponseItem.parse({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        role: u.role,
        pdfsGenerated: u.pdfsGenerated,
        filesCompressed: u.filesCompressed,
        createdAt: u.createdAt.toISOString(),
        lastActiveAt: u.lastActiveAt.toISOString(),
      }),
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list users";
    res.status(500).json({ error: message });
  }
});

// POST /admin/users
router.post("/admin/users", requireAdmin, async (req, res) => {
  try {
    const { name, email, role = "user" } = req.body as {
      name?: string;
      email?: string;
      role?: string;
    };
    if (!name || !email) {
      res.status(400).json({ error: "name and email are required" });
      return;
    }
    const [created] = await db
      .insert(usersTable)
      .values({ name, email, role })
      .returning();
    const result = AdminListUsersResponseItem.parse({
      id: created.id,
      name: created.name,
      email: created.email,
      status: created.status,
      role: created.role,
      pdfsGenerated: created.pdfsGenerated,
      filesCompressed: created.filesCompressed,
      createdAt: created.createdAt.toISOString(),
      lastActiveAt: created.lastActiveAt.toISOString(),
    });
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create user";
    res.status(500).json({ error: message });
  }
});

// PATCH /admin/users/:userId
router.patch("/admin/users/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    const { status, role, name } = req.body as {
      status?: string;
      role?: string;
      name?: string;
    };

    const updates: Partial<{ status: string; role: string; name: string }> = {};
    if (status) updates.status = status;
    if (role) updates.role = role;
    if (name) updates.name = name;

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const result = AdminUpdateUserResponse.parse({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      status: updated.status,
      role: updated.role,
      pdfsGenerated: updated.pdfsGenerated,
      filesCompressed: updated.filesCompressed,
      createdAt: updated.createdAt.toISOString(),
      lastActiveAt: updated.lastActiveAt.toISOString(),
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    res.status(500).json({ error: message });
  }
});

// DELETE /admin/users/:userId
router.delete("/admin/users/:userId", requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    const deleted = await db
      .delete(usersTable)
      .where(eq(usersTable.id, userId))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const result = AdminDeleteUserResponse.parse({ success: true });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete user";
    res.status(500).json({ error: message });
  }
});

// GET /admin/reports?period=daily|weekly|monthly
router.get("/admin/reports", requireAdmin, async (req, res) => {
  try {
    const period = (req.query.period as string) || "daily";
    const now = new Date();

    const points: { label: string; from: Date; to: Date }[] = [];

    if (period === "daily") {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const from = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const to = new Date(from.getTime() + 86400000);
        const label = from.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        points.push({ label, from, to });
      }
    } else if (period === "weekly") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        const dow = d.getDay();
        const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
        const to = new Date(from.getTime() + 7 * 86400000);
        const label = `Week of ${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        points.push({ label, from, to });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const from = d;
        const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        points.push({ label, from, to });
      }
    }

    const data = await Promise.all(
      points.map(async ({ label, from, to }) => {
        const [row] = await db
          .select({
            count: sql<number>`count(*)::int`,
            bytesSaved: sql<number>`coalesce(sum(${compressionJobsTable.originalSize} - ${compressionJobsTable.compressedSize}), 0)::int`,
          })
          .from(compressionJobsTable)
          .where(
            sql`${compressionJobsTable.createdAt} >= ${from} AND ${compressionJobsTable.createdAt} < ${to}`,
          );

        return {
          label,
          pdfsGenerated: 0,
          filesCompressed: row?.count ?? 0,
          bytesSaved: row?.bytesSaved ?? 0,
        };
      }),
    );

    const result = AdminGetReportsResponse.parse({ period, data });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load reports";
    res.status(500).json({ error: message });
  }
});

export default router;
