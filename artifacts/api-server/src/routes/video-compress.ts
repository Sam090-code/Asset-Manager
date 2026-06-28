import { Router, type IRouter } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";

const router: IRouter = Router();

// Use disk storage — avoids loading entire video into RAM
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, os.tmpdir());
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "video.mp4") || ".mp4";
    cb(null, `vcin_${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
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

router.post("/compress-video", upload.single("video"), async (req, res) => {
  const inputPath = req.file?.path;

  if (!req.file || !inputPath) {
    res.status(400).json({ error: "No video file provided" });
    return;
  }

  const quality = (req.body?.quality as string) || "balanced";
  const crf = CRF_MAP[quality] ?? CRF_MAP.balanced;
  const outputPath = path.join(os.tmpdir(), `vcout_${uuidv4()}.mp4`);

  try {
    await ffmpegCompress(inputPath, outputPath, crf);

    const stat = fs.statSync(outputPath);
    const baseName = req.file.originalname?.replace(/\.[^.]+$/, "") ?? "video";

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="compressed_${baseName}.mp4"`);
    res.setHeader("X-Original-Size", String(req.file.size));
    res.setHeader("X-Compressed-Size", String(stat.size));
    res.setHeader("Access-Control-Expose-Headers", "X-Original-Size, X-Compressed-Size");

    // Stream output directly instead of loading into RAM
    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on("end", () => {
      try { fs.unlinkSync(outputPath); } catch {}
    });
    stream.on("error", () => {
      try { fs.unlinkSync(outputPath); } catch {}
    });
  } catch (err) {
    console.error("Video compression error:", err);
    res.status(500).json({ error: "Video compression failed. Please try a different file or format." });
    try { fs.unlinkSync(outputPath); } catch {}
  } finally {
    // Always clean up the input temp file
    try { fs.unlinkSync(inputPath); } catch {}
  }
});

export default router;
