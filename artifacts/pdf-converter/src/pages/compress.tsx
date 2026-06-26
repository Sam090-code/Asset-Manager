import { useState, useRef, useEffect, useCallback } from "react";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout/Layout";
import { compressFileApi } from "@/lib/compress-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UploadCloud, FileArchive, CheckCircle2, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CompressResult } from "@workspace/api-client-react";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const STAGES = [
  { until: 8,  label: "Uploading file…" },
  { until: 22, label: "Analyzing document…" },
  { until: 60, label: "Compressing content…" },
  { until: 82, label: "Optimizing structure…" },
  { until: 93, label: "Finalizing…" },
];

function stageLabel(pct: number) {
  return STAGES.find((s) => pct < s.until)?.label ?? "Finalizing…";
}

function progressRate(pct: number) {
  if (pct < 8)  return 2.5;
  if (pct < 22) return 1.2;
  if (pct < 60) return 0.55;
  if (pct < 82) return 0.2;
  if (pct < 93) return 0.06;
  return 0;
}

function useElapsedTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      const tick = () => {
        setElapsed(Math.floor((Date.now() - startRef.current!) / 1000));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setElapsed(0);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  return elapsed;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Compress() {
  const [file, setFile] = useState<File | null>(null);
  const { isSignedIn, user } = useUser();
  const [level, setLevel] = useState<"low" | "balanced" | "maximum">("balanced");
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ meta: CompressResult; blob: Blob } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const elapsed = useElapsedTimer(isCompressing);

  const stopProgress = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    setProgress(0);
    setDone(false);
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const rate = progressRate(prev);
        if (rate === 0) return prev;
        return Math.min(prev + rate, 93);
      });
    }, 120);
  }, []);

  const handleFileSelect = (f: File) => {
    if (f.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 50MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleCompress = async () => {
    if (!file) return;
    setIsCompressing(true);
    startProgress();
    try {
      const data = await compressFileApi(file, level);
      stopProgress();
      setProgress(100);
      setDone(true);
      setTimeout(() => {
        setResult({ meta: data.result, blob: data.blob });
        setIsCompressing(false);
        setProgress(0);
        setDone(false);
      }, 600);
      toast({ title: "Success", description: "File compressed successfully." });

      if (isSignedIn) {
        fetch(`${BASE}/api/history`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "compression",
            fileName: data.result.fileName,
            originalSize: data.result.originalSize,
            compressedSize: data.result.compressedSize,
            compressionRatio: data.result.compressionRatio,
            mimeType: file.type,
            level,
            userEmail: user?.primaryEmailAddress?.emailAddress,
          }),
        }).catch(() => {});
      }
    } catch (err) {
      console.error(err);
      stopProgress();
      setIsCompressing(false);
      setProgress(0);
      toast({ title: "Error", description: "Failed to compress file.", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compressed_${file?.name || "file"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto py-12 px-4 md:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight">Smart File Compressor</h1>
          <p className="text-muted-foreground mt-2">Reduce file size while maintaining quality. Supports PDF, JPG, PNG.</p>
        </div>

        <div className="grid md:grid-cols-[1fr_300px] gap-8">
          <div className="space-y-6">
            {isCompressing ? (
              <div className="border rounded-xl p-10 bg-card space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  </div>
                  <p className="font-semibold text-lg text-foreground">
                    {done ? "Done!" : stageLabel(progress)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {file?.name} · {formatBytes(file?.size ?? 0)}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">
                      {done ? "Complete" : `${Math.round(progress)}%`}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {elapsed}s elapsed
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${done ? "bg-green-500" : "bg-primary"}`}
                      style={{
                        width: `${progress}%`,
                        transition: done ? "width 0.4s ease-out" : "width 0.12s linear",
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-center gap-2">
                  {STAGES.map((s, i) => {
                    const prevUntil = i === 0 ? 0 : STAGES[i - 1].until;
                    const isActive = progress >= prevUntil && progress < s.until;
                    const isPast = progress >= s.until;
                    return (
                      <div
                        key={s.label}
                        className={`flex flex-col items-center gap-1 text-xs transition-colors ${
                          isPast ? "text-primary" : isActive ? "text-foreground font-medium" : "text-muted-foreground/40"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full transition-colors ${
                            isPast ? "bg-primary" : isActive ? "bg-foreground" : "bg-muted-foreground/30"
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Large PDFs may take up to a minute — please keep this tab open.
                </p>
              </div>
            ) : !result ? (
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                  file ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
                }}
              >
                {file ? (
                  <>
                    <FileArchive className="h-12 w-12 text-primary mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{formatBytes(file.size)}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    >
                      Change File
                    </Button>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground">Click or drag a file here</p>
                    <p className="text-sm text-muted-foreground mt-1">Up to 50MB — PDF, JPG, PNG, WEBP</p>
                  </>
                )}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            ) : (
              <div className="bg-card border rounded-xl p-8 text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold">Compression Complete</h3>

                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Original Size</p>
                    <p className="font-semibold text-lg">{formatBytes(result.meta.originalSize)}</p>
                  </div>
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm text-primary mb-1">Compressed Size</p>
                    <p className="font-bold text-lg text-primary">{formatBytes(result.meta.compressedSize)}</p>
                  </div>
                </div>

                <div className="space-y-2 max-w-sm mx-auto">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span className="font-medium text-green-600">{result.meta.compressionRatio}% saved</span>
                    <span>{formatBytes(result.meta.originalSize)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(result.meta.compressionRatio, 2)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4 justify-center">
                  <Button variant="outline" onClick={() => { setFile(null); setResult(null); }}>
                    Compress Another
                  </Button>
                  <Button onClick={handleDownload} size="lg">
                    <Download className="mr-2 h-4 w-4" /> Download Result
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Choose compression level</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup value={level} onValueChange={(v: any) => setLevel(v)} className="space-y-4">
                  {[
                    { value: "low", label: "Low Compression", desc: "Best visual quality, larger file size." },
                    { value: "balanced", label: "Balanced", desc: "Recommended. Good quality, smaller size." },
                    { value: "maximum", label: "Maximum", desc: "Smallest file size, noticeable quality reduction." },
                  ].map((opt) => (
                    <div
                      key={opt.value}
                      className={`flex items-start space-x-3 border p-4 rounded-lg cursor-pointer transition-colors ${
                        level === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted"
                      } ${isCompressing ? "opacity-50 pointer-events-none" : ""}`}
                      onClick={() => !isCompressing && setLevel(opt.value as any)}
                    >
                      <RadioGroupItem value={opt.value} id={`r-${opt.value}`} className="mt-1" disabled={isCompressing} />
                      <div>
                        <Label htmlFor={`r-${opt.value}`} className="font-semibold text-base cursor-pointer">{opt.label}</Label>
                        <p className="text-sm text-muted-foreground leading-snug mt-1">{opt.desc}</p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={!file || isCompressing || !!result}
                  onClick={handleCompress}
                >
                  {isCompressing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {Math.round(progress)}%
                    </>
                  ) : (
                    "Compress File"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
