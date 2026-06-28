import { Router, type IRouter } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are supported"));
    }
  },
});

const CRF_MAP: Record<string, string> = {
  low: "35",
  balanced: "28",
  high: "20",
};

function ffmpegCompress(inputPath: string, outputPath: string, crf: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-c:v", "libx264",
      "-crf", crf,
      "-preset", "fast",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });

    proc.on("error", reject);
  });
}

router.post("/api/compress-video", upload.single("video"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No video file provided" });
    return;
  }

  const quality = (req.body?.quality as string) || "balanced";
  const crf = CRF_MAP[quality] ?? CRF_MAP.balanced;
  const tmpDir = os.tmpdir();
  const id = uuidv4();
  const ext = path.extname(req.file.originalname || "video.mp4") || ".mp4";
  const inputPath = path.join(tmpDir, `vcin_${id}${ext}`);
  const outputPath = path.join(tmpDir, `vcout_${id}.mp4`);

  try {
    fs.writeFileSync(inputPath, req.file.buffer);
    await ffmpegCompress(inputPath, outputPath, crf);

    const stat = fs.statSync(outputPath);
    const outputBuffer = fs.readFileSync(outputPath);

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="compressed_${req.file.originalname?.replace(/\.[^.]+$/, "") ?? "video"}.mp4"`);
    res.setHeader("X-Original-Size", String(req.file.size));
    res.setHeader("X-Compressed-Size", String(stat.size));
    res.send(outputBuffer);
  } catch (err) {
    console.error("Video compression error:", err);
    res.status(500).json({ error: "Video compression failed" });
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
});

export default router;
