import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer, { MulterError } from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";

const router: IRouter = Router();

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

/**
 * CRF (Constant Rate Factor) values per quality preset.
 * Lower = better quality / larger file. Range for libx264: 0–51.
 *   high (23)     — near-transparent; ~40–60% smaller than a typical camera file
 *   balanced (28) — good trade-off; ~50–70% smaller
 *   low (32)      — smallest file, noticeable quality loss on complex content
 */
const CRF: Record<string, number> = {
  low: 32,
  balanced: 28,
  high: 23,
};

/** Audio bitrates per quality preset */
const AUDIO_BITRATE: Record<string, string> = {
  low: "64k",
  balanced: "96k",
  high: "128k",
};

type Job = {
  status: "processing" | "done" | "error";
  originalSize: number;
  compressedSize?: number;
  outputPath?: string;
  baseName: string;
  /** Original file MIME type — used when serving the unchanged original */
  originalMimeType: string;
  /** Original file extension including dot, e.g. ".webm" */
  originalExt: string;
  error?: string;
  expires: number;
  /** True when re-encoding would increase the file size — original is returned unchanged */
  alreadyOptimal?: boolean;
};

const jobs = new Map<string, Job>();

// Clean up expired jobs every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now > job.expires) {
      if (job.outputPath) try { fs.unlinkSync(job.outputPath); } catch {}
      jobs.delete(id);
    }
  }
}, 60_000);

/**
 * Compress using CRF encoding — no bitrate probing needed.
 * CRF lets the codec choose the bitrate automatically to hit the target quality.
 * This consistently reduces file size for typical camera/screen content while
 * avoiding the over-estimation problem of fixed-bitrate targeting.
 */
function runFFmpeg(inputPath: string, outputPath: string, quality: string): Promise<void> {
  const crf = CRF[quality] ?? CRF.balanced;
  const audioBitrate = AUDIO_BITRATE[quality] ?? AUDIO_BITRATE.balanced;

  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y", "-i", inputPath,
      "-c:v", "libx264",
      "-crf", String(crf),
      "-preset", "fast",
      "-c:a", "aac", "-b:a", audioBitrate,
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

// POST — accept upload, kick off compression in background, return job ID immediately
router.post("/compress-video", upload.single("video"), (req, res) => {
  const inputPath = req.file?.path;
  if (!req.file || !inputPath) {
    res.status(400).json({ error: "No video file provided" });
    return;
  }

  const quality = (req.body?.quality as string) || "balanced";
  const id = uuidv4();
  const outputPath = path.join(os.tmpdir(), `vcout_${id}.mp4`);
  const originalExt = path.extname(req.file.originalname || "video.mp4") || ".mp4";
  const baseName = req.file.originalname?.replace(/\.[^.]+$/, "") ?? "video";

  jobs.set(id, {
    status: "processing",
    originalSize: req.file.size,
    baseName,
    originalMimeType: req.file.mimetype,
    originalExt,
    expires: Date.now() + 30 * 60 * 1000,
  });

  // Run compression in background — respond immediately with the job ID
  runFFmpeg(inputPath, outputPath, quality)
    .then(() => {
      const job = jobs.get(id);
      // Job may have expired while FFmpeg was running — clean up and bail
      if (!job) {
        try { fs.unlinkSync(outputPath); } catch {}
        return;
      }

      const compressedSize = fs.statSync(outputPath).size;

      // Hard guarantee: if FFmpeg produced a larger file, serve the original instead.
      // This happens when the source is already efficiently compressed (VP9/WebM,
      // screen recordings, or files already at a low CRF).
      if (compressedSize >= req.file!.size) {
        try { fs.unlinkSync(outputPath); } catch {}
        // Preserve original extension so the download has the right container
        const originalOutputPath = path.join(os.tmpdir(), `vcout_${id}${job.originalExt}`);
        fs.copyFileSync(inputPath, originalOutputPath);
        job.status = "done";
        job.outputPath = originalOutputPath;
        job.compressedSize = req.file!.size; // report original size — no inflation
        job.alreadyOptimal = true;
      } else {
        job.status = "done";
        job.outputPath = outputPath;
        job.compressedSize = compressedSize;
      }
    })
    .catch((err) => {
      const job = jobs.get(id);
      if (job) { job.status = "error"; job.error = String(err); }
      try { fs.unlinkSync(outputPath); } catch {}
    })
    .finally(() => {
      try { fs.unlinkSync(inputPath); } catch {}
    });

  res.json({ id, originalSize: req.file.size });
});

// GET status — client polls this every 2s
router.get("/compress-video/:id/status", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found or expired" });
    return;
  }
  res.json({
    status: job.status,
    originalSize: job.originalSize,
    compressedSize: job.compressedSize,
    error: job.error,
    alreadyOptimal: job.alreadyOptimal ?? false,
  });
});

// GET download — streams the file once done
router.get("/compress-video/:id/download", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== "done" || !job.outputPath) {
    res.status(404).json({ error: "File not ready or not found" });
    return;
  }

  // When serving the original unchanged, use its real MIME type and extension
  const contentType = job.alreadyOptimal ? job.originalMimeType : "video/mp4";
  const ext = job.alreadyOptimal ? job.originalExt : ".mp4";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${job.baseName}${ext}"`);
  if (job.compressedSize) res.setHeader("Content-Length", String(job.compressedSize));

  const stream = fs.createReadStream(job.outputPath);
  stream.pipe(res);
  stream.on("close", () => {
    if (job.outputPath) try { fs.unlinkSync(job.outputPath); } catch {}
    jobs.delete(req.params.id);
  });
  stream.on("error", () => {
    if (job.outputPath) try { fs.unlinkSync(job.outputPath); } catch {}
    jobs.delete(req.params.id);
  });
});

// Multer error handler — must have 4 params to be recognised as an error handler by Express
// eslint-disable-next-line @typescript-eslint/no-unused-vars
router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE"
      ? "File too large — maximum size is 500 MB"
      : `Upload error: ${err.message}`;
    res.status(400).json({ error: msg });
  } else if (err?.message === "Only video files are supported") {
    res.status(400).json({ error: err.message });
  } else {
    res.status(500).json({ error: "Internal server error during upload" });
  }
});

export default router;
