import { useCallback, useEffect, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Video, Upload, Download, X, AlertCircle,
  CheckCircle2, Loader2, Film, Zap, Settings2,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

type Stage = "idle" | "loading-ffmpeg" | "ready" | "compressing" | "done" | "error";

const CORE_VERSION = "0.12.6";
const CDN = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

function formatBytes(b: number) {
  if (!b) return "—";
  const k = 1024;
  const s = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const QUALITY_PRESETS = [
  { label: "Low", crf: 35, description: "Smallest file, lower quality" },
  { label: "Balanced", crf: 28, description: "Good balance (recommended)" },
  { label: "High", crf: 20, description: "Best quality, larger file" },
];

export default function VideoCompressPage() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [loadProgress, setLoadProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [qualityIdx, setQualityIdx] = useState(1);
  const [compressProgress, setCompressProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return;
    setStage("loading-ffmpeg");
    setLoadProgress(10);
    try {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        setCompressProgress(Math.round(progress * 100));
      });
      setLoadProgress(30);
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CDN}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CDN}/ffmpeg-core.wasm`, "application/wasm"),
      });
      setLoadProgress(100);
      ffmpegRef.current = ffmpeg;
      setStage("ready");
    } catch (e) {
      console.error("FFmpeg load error:", e);
      setError("Failed to load video engine. Please check your connection and try again.");
      setStage("error");
    }
  }, []);

  const onFileSelect = useCallback((f: File) => {
    if (!f.type.startsWith("video/")) {
      setError("Please select a valid video file (MP4, MOV, AVI, etc.).");
      return;
    }
    setFile(f);
    setOutputUrl(null);
    setOutputSize(null);
    setError(null);
    setCompressProgress(0);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    if (stage === "idle") loadFFmpeg();
    else setStage("ready");
  }, [stage, loadFFmpeg]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  }, [onFileSelect]);

  const compress = useCallback(async () => {
    if (!ffmpegRef.current || !file) return;
    setStage("compressing");
    setCompressProgress(0);
    setError(null);
    const ffmpeg = ffmpegRef.current;
    const ext = file.name.split(".").pop() ?? "mp4";
    const inputName = `input.${ext}`;
    const outputName = "output.mp4";
    try {
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      const crf = String(QUALITY_PRESETS[qualityIdx].crf);
      await ffmpeg.exec([
        "-i", inputName,
        "-c:v", "libx264",
        "-crf", crf,
        "-preset", "fast",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        outputName,
      ]);
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: "video/mp4" });
      setOutputSize(blob.size);
      setOutputUrl(URL.createObjectURL(blob));
      setStage("done");
    } catch {
      setError("Compression failed. The video format may not be supported. Please try an MP4 file.");
      setStage("ready");
    }
  }, [file, qualityIdx]);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setOutputUrl(null);
    setOutputSize(null);
    setError(null);
    setCompressProgress(0);
    setVideoDuration(null);
    setStage(ffmpegRef.current ? "ready" : "idle");
  };

  const savedBytes = file && outputSize ? file.size - outputSize : 0;
  const savedPct = file && outputSize ? Math.round((savedBytes / file.size) * 100) : 0;

  return (
    <Layout>
      <div className="container max-w-3xl mx-auto py-12 px-4 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <Film className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Video Compressor</h1>
          </div>
          <p className="text-muted-foreground">
            Reduce your video file size directly in the browser — nothing is uploaded to any server.
          </p>
        </div>

        {/* Drop zone */}
        {!file ? (
          <div
            ref={dropRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 rounded-2xl p-16 text-center cursor-pointer transition-colors group bg-muted/10 hover:bg-primary/5"
          >
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
              <Video className="h-8 w-8 text-rose-500" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-1">Drop your video here</p>
            <p className="text-sm text-muted-foreground mb-4">or click to browse — MP4, MOV, AVI, MKV supported</p>
            <Button variant="outline" size="sm" className="pointer-events-none group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
              <Upload className="h-4 w-4 mr-2" /> Select Video
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Video preview card */}
            <div className="bg-card border rounded-2xl overflow-hidden">
              <div className="relative bg-black aspect-video">
                {previewUrl && (
                  <video
                    src={previewUrl}
                    className="w-full h-full object-contain"
                    controls
                    onLoadedMetadata={(e) => setVideoDuration((e.target as HTMLVideoElement).duration)}
                  />
                )}
                <button
                  onClick={reset}
                  className="absolute top-3 right-3 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
                <div>
                  <p className="font-semibold text-sm truncate max-w-[240px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatBytes(file.size)}
                    {videoDuration != null && ` · ${formatTime(videoDuration)}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Quality selector */}
            {stage !== "compressing" && stage !== "done" && (
              <div className="bg-card border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Compression Quality</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {QUALITY_PRESETS.map((p, i) => (
                    <button
                      key={p.label}
                      onClick={() => setQualityIdx(i)}
                      className={`border rounded-xl p-3 text-left transition-all ${
                        qualityIdx === i
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-muted-foreground/40 hover:bg-muted/30"
                      }`}
                    >
                      <p className="font-semibold text-sm">{p.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{p.description}</p>
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={compress}
                  disabled={stage === "loading-ffmpeg"}
                >
                  {stage === "loading-ffmpeg" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading engine… {loadProgress}%
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Compress Video
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Compressing progress */}
            {stage === "compressing" && (
              <div className="bg-card border rounded-2xl p-6 text-center">
                <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="h-6 w-6 text-rose-600 animate-spin" />
                </div>
                <p className="font-semibold mb-1">Compressing…</p>
                <p className="text-sm text-muted-foreground mb-4">This may take a moment for large files</p>
                <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${compressProgress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">{compressProgress}%</p>
              </div>
            )}

            {/* Done */}
            {stage === "done" && outputUrl && outputSize != null && (
              <div className="bg-card border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Compression complete</p>
                    <p className="text-sm text-muted-foreground">Your video is ready to download</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Original</p>
                    <p className="font-bold text-sm">{formatBytes(file!.size)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Compressed</p>
                    <p className="font-bold text-sm">{formatBytes(outputSize)}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-600 mb-0.5">Saved</p>
                    <p className="font-bold text-sm text-green-700">
                      {savedPct > 0 ? `-${savedPct}%` : "Similar size"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button asChild className="flex-1 gap-2">
                    <a
                      href={outputUrl}
                      download={`compressed_${file!.name.replace(/\.[^.]+$/, "")}.mp4`}
                    >
                      <Download className="h-4 w-4" />
                      Download MP4
                    </a>
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Compress another
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-3 bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Privacy note */}
        <p className="mt-6 text-xs text-center text-muted-foreground">
          🔒 100% in-browser — your video never leaves your device.
        </p>
      </div>
    </Layout>
  );
}
