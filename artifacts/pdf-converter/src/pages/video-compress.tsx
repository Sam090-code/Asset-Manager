import { useCallback, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  Video, Upload, Download, X, AlertCircle,
  CheckCircle2, Loader2, Film, Zap, Settings2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Stage = "idle" | "compressing" | "done" | "error";

function formatBytes(b: number | null | undefined) {
  if (!b) return "—";
  const k = 1024;
  const s = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const QUALITY_PRESETS = [
  { label: "Low", value: "low", description: "Smallest file, reduced quality" },
  { label: "Balanced", value: "balanced", description: "Best of both (recommended)" },
  { label: "High", value: "high", description: "Best quality, larger file" },
];

export default function VideoCompressPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState("balanced");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFileSelect = useCallback((f: File) => {
    if (!f.type.startsWith("video/")) {
      setError("Please select a valid video file (MP4, MOV, AVI, etc.).");
      return;
    }
    setFile(f);
    setOriginalSize(f.size);
    setOutputUrl(null);
    setCompressedSize(null);
    setError(null);
    setPreviewUrl(URL.createObjectURL(f));
    setStage("idle");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFileSelect(f);
  }, [onFileSelect]);

  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("compressed.mp4");

  const compress = useCallback(async () => {
    if (!file) return;
    setStage("compressing");
    setError(null);
    setDownloadId(null);

    try {
      const form = new FormData();
      form.append("video", file);
      form.append("quality", quality);

      // Step 1 — upload + compress; response is tiny JSON, not the video
      const res = await fetch(`${BASE}/api/compress-video`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Compression failed");
      }

      const { id, originalSize: orig, compressedSize: comp } = await res.json();
      setOriginalSize(orig);
      setCompressedSize(comp);
      setDownloadId(id);
      setDownloadName(`compressed_${file.name.replace(/\.[^.]+$/, "")}.mp4`);
      setStage("done");
    } catch (err: any) {
      setError(err.message ?? "Compression failed. Please try again.");
      setStage("idle");
    }
  }, [file, quality]);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setOutputUrl(null);
    setOriginalSize(null);
    setCompressedSize(null);
    setDownloadId(null);
    setError(null);
    setVideoDuration(null);
    setStage("idle");
  };

  const savedBytes = originalSize && compressedSize ? originalSize - compressedSize : 0;
  const savedPct = originalSize && compressedSize ? Math.round((savedBytes / originalSize) * 100) : 0;
  const outputName = file ? `compressed_${file.name.replace(/\.[^.]+$/, "")}.mp4` : "compressed.mp4";

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
            Upload a video and we'll compress it server-side using FFmpeg — fast and reliable.
          </p>
        </div>

        {/* Drop zone */}
        {!file ? (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-muted-foreground/25 hover:border-rose-400/60 rounded-2xl p-16 text-center cursor-pointer transition-colors group bg-muted/10 hover:bg-rose-50/30"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                <Video className="h-8 w-8 text-rose-500" />
              </div>
              <p className="text-lg font-semibold text-foreground mb-1">Drop your video here</p>
              <p className="text-sm text-muted-foreground mb-4">MP4, MOV, AVI, MKV — up to 500 MB</p>
              <Button variant="outline" size="sm" className="pointer-events-none group-hover:bg-rose-600 group-hover:text-white group-hover:border-rose-600 transition-colors">
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

            {/* Sample videos */}
            <div className="bg-muted/30 border rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Try a sample video
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "720p · 15 sec · 15 MB", file: "sample-720p-15s.mp4" },
                  { label: "720p · 30 sec · 18 MB", file: "sample-30s-720p.mp4" },
                  { label: "1080p · 60 sec · 20 MB", file: "sample-60s-1080p.mp4" },
                ].map((s) => (
                  <a
                    key={s.file}
                    href={`${BASE}/samples/${s.file}`}
                    download={s.file}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-sm"
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-xs">{s.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Video preview */}
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
              <div className="px-5 py-4">
                <p className="font-semibold text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatBytes(originalSize)}
                  {videoDuration != null && ` · ${formatTime(videoDuration)}`}
                </p>
              </div>
            </div>

            {/* Quality + compress button */}
            {stage !== "compressing" && stage !== "done" && (
              <div className="bg-card border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Compression Quality</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {QUALITY_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setQuality(p.value)}
                      className={`border rounded-xl p-3 text-left transition-all ${
                        quality === p.value
                          ? "border-rose-500 bg-rose-50/60 ring-1 ring-rose-400"
                          : "hover:border-muted-foreground/40 hover:bg-muted/30"
                      }`}
                    >
                      <p className="font-semibold text-sm">{p.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{p.description}</p>
                    </button>
                  ))}
                </div>
                <Button className="w-full gap-2 bg-rose-600 hover:bg-rose-700" size="lg" onClick={compress}>
                  <Zap className="h-4 w-4" /> Compress Video
                </Button>
              </div>
            )}

            {/* Compressing state */}
            {stage === "compressing" && (
              <div className="bg-card border rounded-2xl p-8 text-center">
                <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="h-7 w-7 text-rose-600 animate-spin" />
                </div>
                <p className="font-semibold text-lg mb-1">Compressing your video…</p>
                <p className="text-sm text-muted-foreground">
                  This may take a minute for large files. Please keep this tab open.
                </p>
              </div>
            )}

            {/* Done */}
            {stage === "done" && outputUrl && (
              <div className="bg-card border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Done! Your video is ready</p>
                    <p className="text-sm text-muted-foreground">Compressed server-side with FFmpeg</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Original</p>
                    <p className="font-bold text-sm">{formatBytes(originalSize)}</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-0.5">Compressed</p>
                    <p className="font-bold text-sm">{formatBytes(compressedSize)}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-green-600 mb-0.5">Saved</p>
                    <p className="font-bold text-sm text-green-700">
                      {savedPct > 0 ? `-${savedPct}%` : "Similar size"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button asChild className="flex-1 gap-2 bg-rose-600 hover:bg-rose-700">
                    <a href={`${BASE}/api/compress-video/${downloadId}/download`} download={downloadName}>
                      <Download className="h-4 w-4" /> Download MP4
                    </a>
                  </Button>
                  <Button variant="outline" onClick={reset}>Compress another</Button>
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

        <p className="mt-6 text-xs text-center text-muted-foreground">
          Videos are processed on the server and never stored permanently.
        </p>
      </div>
    </Layout>
  );
}
