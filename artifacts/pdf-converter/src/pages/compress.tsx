import { useState, useRef } from "react";
import { Layout } from "@/components/layout/Layout";
import { compressFileApi } from "@/lib/compress-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UploadCloud, FileArchive, CheckCircle2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { CompressResult } from "@workspace/api-client-react";

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function Compress() {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<'low' | 'balanced' | 'maximum'>('balanced');
  const [isCompressing, setIsCompressing] = useState(false);
  const [result, setResult] = useState<{ meta: CompressResult, blob: Blob } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
    try {
      const data = await compressFileApi(file, level);
      setResult({ meta: data.result, blob: data.blob });
      toast({ title: "Success", description: "File compressed successfully." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to compress file.", variant: "destructive" });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compressed_${file?.name || 'file'}`;
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
            {!result ? (
              <div 
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${file ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
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
                    <Button variant="outline" size="sm" className="mt-4" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      Change File
                    </Button>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground">Click or drag a file here</p>
                    <p className="text-sm text-muted-foreground mt-1">Up to 50MB</p>
                  </>
                )}
                <input 
                  type="file" 
                  accept="application/pdf,image/jpeg,image/png,image/webp" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </div>
            ) : (
              <div className="bg-card border rounded-xl p-8 text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mb-4">
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

                <div className="inline-flex items-center justify-center px-4 py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full font-medium text-sm">
                  Saved {result.meta.compressionRatio.toFixed(1)}% space
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
                  <div className={`flex items-start space-x-3 border p-4 rounded-lg cursor-pointer transition-colors ${level === 'low' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`} onClick={() => setLevel('low')}>
                    <RadioGroupItem value="low" id="r-low" className="mt-1" />
                    <div>
                      <Label htmlFor="r-low" className="font-semibold text-base cursor-pointer">Low Compression</Label>
                      <p className="text-sm text-muted-foreground leading-snug mt-1">Best visual quality, larger file size.</p>
                    </div>
                  </div>
                  <div className={`flex items-start space-x-3 border p-4 rounded-lg cursor-pointer transition-colors ${level === 'balanced' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`} onClick={() => setLevel('balanced')}>
                    <RadioGroupItem value="balanced" id="r-balanced" className="mt-1" />
                    <div>
                      <Label htmlFor="r-balanced" className="font-semibold text-base cursor-pointer">Balanced</Label>
                      <p className="text-sm text-muted-foreground leading-snug mt-1">Recommended. Good quality, smaller size.</p>
                    </div>
                  </div>
                  <div className={`flex items-start space-x-3 border p-4 rounded-lg cursor-pointer transition-colors ${level === 'maximum' ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`} onClick={() => setLevel('maximum')}>
                    <RadioGroupItem value="maximum" id="r-maximum" className="mt-1" />
                    <div>
                      <Label htmlFor="r-maximum" className="font-semibold text-base cursor-pointer">Maximum</Label>
                      <p className="text-sm text-muted-foreground leading-snug mt-1">Smallest file size, noticeable quality reduction.</p>
                    </div>
                  </div>
                </RadioGroup>

                <Button 
                  className="w-full" 
                  size="lg" 
                  disabled={!file || isCompressing || !!result}
                  onClick={handleCompress}
                >
                  {isCompressing ? "Compressing..." : "Compress File"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
