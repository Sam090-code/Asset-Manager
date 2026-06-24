import { Router, type IRouter } from "express";
import multer from "multer";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import os from "os";
import { db } from "@workspace/db";
import { compressionJobsTable, platformStatsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CompressFileResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Allowed: JPG, PNG, PDF"));
    }
  },
});

const QUALITY_MAP: Record<string, { jpeg: number; png: number; pdfGhostQuality: string }> = {
  low: { jpeg: 90, png: 9, pdfGhostQuality: "screen" },
  balanced: { jpeg: 70, png: 6, pdfGhostQuality: "ebook" },
  maximum: { jpeg: 40, png: 3, pdfGhostQuality: "printer" },
};

async function compressImage(
  buffer: Buffer,
  mimetype: string,
  level: string,
): Promise<Buffer> {
  const quality = QUALITY_MAP[level] ?? QUALITY_MAP.balanced;
  const isJpeg = mimetype === "image/jpeg" || mimetype === "image/jpg";

  if (isJpeg) {
    return sharp(buffer).jpeg({ quality: quality.jpeg, mozjpeg: true }).toBuffer();
  } else {
    return sharp(buffer).png({ compressionLevel: quality.png, effort: 10 }).toBuffer();
  }
}

async function compressPdf(buffer: Buffer, level: string): Promise<Buffer> {
  const quality = QUALITY_MAP[level] ?? QUALITY_MAP.balanced;
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input-${uuidv4()}.pdf`);
  const outputPath = path.join(tmpDir, `output-${uuidv4()}.pdf`);

  fs.writeFileSync(inputPath, buffer);

  try {
    const { execSync } = await import("child_process");
    execSync(
      `gs -dBATCH -dNOPAUSE -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/${quality.pdfGhostQuality} -sOutputFile="${outputPath}" "${inputPath}"`,
      { timeout: 30000 },
    );
    const result = fs.readFileSync(outputPath);
    return result;
  } catch {
    return buffer;
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}

router.post("/compress", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const level = (req.body.level as string) || "balanced";
  if (!["low", "balanced", "maximum"].includes(level)) {
    res.status(400).json({ error: "Invalid compression level. Use: low, balanced, maximum" });
    return;
  }

  const { originalname, mimetype, buffer, size } = req.file;
  const fileId = uuidv4();

  let compressedBuffer: Buffer;
  if (mimetype === "application/pdf") {
    compressedBuffer = await compressPdf(buffer, level);
  } else {
    compressedBuffer = await compressImage(buffer, mimetype, level);
  }

  const compressedSize = compressedBuffer.length;
  const compressionRatio = Math.max(0, Math.round(((size - compressedSize) / size) * 100));

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await db.insert(compressionJobsTable).values({
    fileId,
    fileName: originalname,
    mimeType: mimetype,
    originalSize: size,
    compressedSize,
    compressionRatio,
    level,
    expiresAt,
  });

  const tmpPath = path.join(os.tmpdir(), `compressed-${fileId}`);
  fs.writeFileSync(tmpPath, compressedBuffer);

  const existingStats = await db.select().from(platformStatsTable).limit(1);
  if (existingStats.length === 0) {
    await db.insert(platformStatsTable).values({
      pdfsGenerated: 0,
      filesCompressed: 1,
      totalBytesCompressed: Math.max(0, size - compressedSize),
    });
  } else {
    await db
      .update(platformStatsTable)
      .set({
        filesCompressed: existingStats[0].filesCompressed + 1,
        totalBytesCompressed:
          existingStats[0].totalBytesCompressed + Math.max(0, size - compressedSize),
      })
      .where(eq(platformStatsTable.id, existingStats[0].id));
  }

  const response = CompressFileResponse.parse({
    fileId,
    fileName: originalname,
    mimeType: mimetype,
    originalSize: size,
    compressedSize,
    compressionRatio,
  });

  res.json(response);
});

router.get("/files/:fileId/download", async (req, res) => {
  const { fileId } = req.params;

  const job = await db
    .select()
    .from(compressionJobsTable)
    .where(eq(compressionJobsTable.fileId, fileId))
    .limit(1);

  if (job.length === 0) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const tmpPath = path.join(os.tmpdir(), `compressed-${fileId}`);
  if (!fs.existsSync(tmpPath)) {
    res.status(404).json({ error: "File expired or not found" });
    return;
  }

  const ext = path.extname(job[0].fileName) || ".bin";
  const downloadName = `compressed-${job[0].fileName}`;

  res.setHeader("Content-Type", job[0].mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  res.sendFile(tmpPath);
});

export default router;
