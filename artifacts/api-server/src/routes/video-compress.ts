import { Router, type IRouter } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";

const router: IRouter = Router();

// Write directly to disk — never load video into RAM
const storage = multer.diskStorage({
  destination(_req, _file, cb) { cb(null, os.tmpdir()); },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "video.mp4") || ".mp4";
    cb(null, `vcin_${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only video files are supported"));
  },
});

const CRF_MAP: Record<string, string> = {
  low: "35", balanced: "28", high: "20",
};

// In-memory registry of ready files; cleaned up on download or after 15 min
const readyFiles = new Map<string, { outputPath: string; originalSize: number; compressedSize: number; baseName: string; expires: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of readyFiles) {
    if (now > entry.expires) {
      try { fs.unlinkSync(entry.outputPath); } catch {}
      readyFiles.delete(id);
    }
  }
}, 60_000);

function ffmpegCompress(inputPath: string, outputPath: string, crf: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y", "-i", inputPath,
      "-c:v", "libx264", "-crf", crf, "-preset", "fast",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath,
    ]);
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg error (code ${code}): ${stderr.slice(-300)}`));
    });
    proc.on("error", reject);
  });
}

// STEP 1 — Upload + compress → returns { id, originalSize, compressedSize }
router.post("/compress-video", upload.single("video"), async (req, res) => {
  const inputPath = req.file?.path;
  if (!req.file || !inputPath) {
    res.status(400).json({ error: "No video file provided" });
    return;
  }

  const quality = (req.body?.quality as string) || "balanced";
  const crf = CRF_MAP[quality] ?? CRF_MAP.balanced;
  const id = uuidv4();
  const outputPath = path.join(os.tmpdir(), `vcout_${id}.mp4`);
  const baseName = req.file.originalname?.replace(/\.[^.]+$/, "") ?? "video";

  try {
    await ffmpegCompress(inputPath, outputPath, crf);
    const compressedSize = fs.statSync(outputPath).size;

    readyFiles.set(id, {
      outputPath,
      originalSize: req.file.size,
      compressedSize,
      baseName,
      expires: Date.now() + 15 * 60 * 1000,
    });

    res.json({ id, originalSize: req.file.size, compressedSize });
  } catch (err) {
    console.error("Video compression error:", err);
    try { fs.unlinkSync(outputPath); } catch {}
    res.status(500).json({ error: "Compression failed. Please try a different file or format." });
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
  }
});

// STEP 2 — Fetch the compressed file by ID
router.get("/compress-video/:id/download", (req, res) => {
  const entry = readyFiles.get(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "File not found or expired. Please compress again." });
    return;
  }

  const filename = `compressed_${entry.baseName}.mp4`;
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(entry.compressedSize));

  const stream = fs.createReadStream(entry.outputPath);
  stream.pipe(res);
  stream.on("close", () => {
    readyFiles.delete(req.params.id);
    try { fs.unlinkSync(entry.outputPath); } catch {}
  });
  stream.on("error", () => {
    readyFiles.delete(req.params.id);
    try { fs.unlinkSync(entry.outputPath); } catch {}
  });
});

export default router;
