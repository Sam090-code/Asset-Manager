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

// Bitrate reduction factors per quality preset
const BITRATE_FACTOR: Record<string, number> = {
  low: 0.35,       // keep 35% of original bitrate
  balanced: 0.55,  // keep 55%
  high: 0.75,      // keep 75%
};

// Fixed audio bitrates per quality preset — independent of video bitrate
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
  error?: string;
  expires: number;
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

function getVideoBitrate(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=bit_rate",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);
    let out = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.on("close", () => {
      const parsed = parseInt(out.trim(), 10);
      // Fall back to a sensible default (2 Mbps) if ffprobe can't read it
      resolve(isNaN(parsed) || parsed <= 0 ? 2_000_000 : parsed);
    });
    proc.on("error", () => resolve(2_000_000));
  });
}

function runFFmpeg(inputPath: string, outputPath: string, targetBitrate: number, quality: string): Promise<void> {
  // Enforce a minimum video bitrate so ffmpeg never gets "0k"
  const videoBitrateK = Math.max(50, Math.floor(targetBitrate / 1000));
  const audioBitrate = AUDIO_BITRATE[quality] ?? AUDIO_BITRATE.balanced;
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y", "-i", inputPath,
      "-c:v", "libx264",
      "-b:v", `${videoBitrateK}k`,
      "-maxrate", `${Math.floor(videoBitrateK * 1.5)}k`,
      "-bufsize", `${Math.floor(videoBitrateK * 3)}k`,
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
  const factor = BITRATE_FACTOR[quality] ?? BITRATE_FACTOR.balanced;
  const id = uuidv4();
  const outputPath = path.join(os.tmpdir(), `vcout_${id}.mp4`);
  const baseName = req.file.originalname?.replace(/\.[^.]+$/, "") ?? "video";

  jobs.set(id, {
    status: "processing",
    originalSize: req.file.size,
    baseName,
    expires: Date.now() + 30 * 60 * 1000,
  });

  // Run in background — probe bitrate first, then compress
  getVideoBitrate(inputPath)
    .then((srcBitrate) => runFFmpeg(inputPath, outputPath, Math.floor(srcBitrate * factor), quality))
    .then(() => {
      const job = jobs.get(id);
      if (job) {
        job.status = "done";
        job.outputPath = outputPath;
        job.compressedSize = fs.statSync(outputPath).size;
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

  // Respond immediately with the job ID
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
  });
});

// GET download — streams the file once done
router.get("/compress-video/:id/download", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.status !== "done" || !job.outputPath) {
    res.status(404).json({ error: "File not ready or not found" });
    return;
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", `attachment; filename="compressed_${job.baseName}.mp4"`);
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
