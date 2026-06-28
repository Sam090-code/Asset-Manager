import { Router, type IRouter } from "express";
import multer from "multer";
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

const CRF_MAP: Record<string, string> = {
  low: "35", balanced: "28", high: "20",
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

function runFFmpeg(inputPath: string, outputPath: string, crf: string): Promise<void> {
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

// POST — accept upload, kick off compression in background, return job ID immediately
router.post("/compress-video", upload.single("video"), (req, res) => {
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

  jobs.set(id, {
    status: "processing",
    originalSize: req.file.size,
    baseName,
    expires: Date.now() + 30 * 60 * 1000, // 30 min
  });

  // Run in background — don't await
  runFFmpeg(inputPath, outputPath, crf)
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

export default router;
