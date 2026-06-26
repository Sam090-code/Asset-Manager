import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout/Layout";
import { imagesToPdf } from "@/lib/pdf-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trash2, RotateCcw, RotateCw, UploadCloud, FileDown, GripVertical,
  CheckCircle2, Loader2, FileText, Image as ImageIcon, Layers, Download,
  RefreshCcw,
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";

type ImageItem = {
  id: string;
  dataUrl: string;
  rotation: number;
};

type ConversionStage = "idle" | "reading" | "building" | "finalizing" | "complete" | "error";

interface ConversionState {
  stage: ConversionStage;
  processedImages: number;
  totalImages: number;
  fileName: string;
}

function SortableImage({
  item, index, onRemove, onRotate,
}: {
  item: ImageItem;
  index: number;
  onRemove: (id: string) => void;
  onRotate: (id: string, direction: "left" | "right") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-card border rounded-lg overflow-hidden shadow-sm aspect-square flex items-center justify-center ${isDragging ? "ring-2 ring-primary shadow-lg" : ""}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1.5 bg-background/90 backdrop-blur rounded-md text-muted-foreground hover:text-foreground hover:bg-background cursor-grab active:cursor-grabbing shadow-sm transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-md shadow-sm select-none">
        {index + 1}
      </div>
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/90 backdrop-blur shadow-sm" onClick={() => onRotate(item.id, "left")}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="secondary" size="icon" className="h-7 w-7 bg-background/90 backdrop-blur shadow-sm" onClick={() => onRotate(item.id, "right")}>
          <RotateCw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="destructive" size="icon" className="h-7 w-7 shadow-sm" onClick={() => onRemove(item.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <img
        src={item.dataUrl}
        alt={`Page ${index + 1}`}
        className="max-h-full max-w-full object-contain p-2"
        style={{ transform: `rotate(${item.rotation}deg)`, transition: "transform 0.2s" }}
        draggable={false}
      />
    </div>
  );
}

const STEPS = [
  { id: "reading",    icon: ImageIcon, label: "Reading images",       desc: "Loading and processing each image" },
  { id: "building",   icon: Layers,    label: "Building PDF pages",   desc: "Laying out pages with your settings" },
  { id: "finalizing", icon: FileText,  label: "Finalizing document",  desc: "Compressing and writing PDF bytes" },
  { id: "complete",   icon: Download,  label: "Ready to download",    desc: "Your PDF has been saved to your device" },
];

function stepIndex(stage: ConversionStage): number {
  const map: Record<ConversionStage, number> = {
    idle: -1, reading: 0, building: 1, finalizing: 2, complete: 3, error: -1,
  };
  return map[stage];
}

function ConversionPanel({ state, onConvertAnother }: { state: ConversionState; onConvertAnother: () => void }) {
  const active = stepIndex(state.stage);
  const isComplete = state.stage === "complete";

  return (
    <Card className={`transition-all duration-300 ${isComplete ? "border-green-200 bg-green-50/40" : "border-primary/20 bg-primary/[0.02]"}`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-base transition-colors ${isComplete ? "text-green-700" : "text-foreground"}`}>
          {isComplete ? "Conversion complete!" : "Converting…"}
        </CardTitle>
        <CardDescription>
          {isComplete
            ? `${state.fileName} downloaded to your device`
            : `Processing ${state.totalImages} image${state.totalImages !== 1 ? "s" : ""}…`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-1 pt-0">
        {STEPS.map((step, i) => {
          const done = i < active || isComplete;
          const current = i === active && !isComplete;
          const pending = i > active && !isComplete;

          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-300 ${
                current ? "bg-primary/8 ring-1 ring-primary/20" : done ? "opacity-80" : "opacity-40"
              }`}
            >
              <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                done || (i === 3 && isComplete)
                  ? "bg-green-100 text-green-600"
                  : current
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {done || (i === 3 && isComplete) ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : current ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <step.icon className="h-3.5 w-3.5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-tight ${done ? "text-green-700" : current ? "text-primary" : "text-muted-foreground"}`}>
                  {step.label}
                  {step.id === "reading" && current && state.totalImages > 1 && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      ({state.processedImages}/{state.totalImages})
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>

                {step.id === "reading" && current && state.totalImages > 0 && (
                  <div className="mt-1.5 h-1 rounded-full bg-primary/10 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((state.processedImages / state.totalImages) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isComplete && (
          <div className="pt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-green-200 text-green-700 hover:bg-green-50"
              onClick={onConvertAnother}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Convert another
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<"A4" | "Letter" | "Legal">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margin, setMargin] = useState<number>(20);
  const [conversion, setConversion] = useState<ConversionState>({
    stage: "idle",
    processedImages: 0,
    totalImages: 0,
    fileName: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn, user } = useUser();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const newImages: ImageItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.match("image/.*")) continue;
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push({ id: Math.random().toString(36).substring(7), dataUrl, rotation: 0 });
    }
    if (newImages.length > 0) setImages((prev) => [...prev, ...newImages]);
  }, []);

  const handleGeneratePdf = async () => {
    if (images.length === 0) return;

    const total = images.length;
    const fileName = `DocuFlow_${Date.now()}.pdf`;

    setConversion({ stage: "reading", processedImages: 0, totalImages: total, fileName });

    try {
      const perImageMs = Math.min(300, 1200 / total);
      for (let i = 1; i <= total; i++) {
        await new Promise((r) => setTimeout(r, perImageMs));
        setConversion((prev) => ({ ...prev, processedImages: i }));
      }

      setConversion((prev) => ({ ...prev, stage: "building" }));
      const [pdfBytes] = await Promise.all([
        imagesToPdf(images, { pageSize, orientation, margin }),
        new Promise((r) => setTimeout(r, 600)),
      ]);

      setConversion((prev) => ({ ...prev, stage: "finalizing" }));
      await new Promise((r) => setTimeout(r, 400));

      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setConversion((prev) => ({ ...prev, stage: "complete" }));

      fetch(`${BASE}api/stats/record-pdf`, { method: "POST" })
        .then(() => queryClient.invalidateQueries({ queryKey: ["/stats"] }))
        .catch(() => {});

      if (isSignedIn) {
        fetch(`${BASE}/api/history`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "pdf",
            fileName,
            pageCount: images.length,
            userEmail: user?.primaryEmailAddress?.emailAddress,
          }),
        }).catch(() => {});
      }
    } catch (err) {
      console.error(err);
      setConversion((prev) => ({ ...prev, stage: "error" }));
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
      setTimeout(() => setConversion((prev) => ({ ...prev, stage: "idle" })), 2000);
    }
  };

  const handleConvertAnother = () => {
    setImages([]);
    setConversion({ stage: "idle", processedImages: 0, totalImages: 0, fileName: "" });
  };

  const isConverting = conversion.stage !== "idle" && conversion.stage !== "error";
  const isComplete = conversion.stage === "complete";

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 md:px-8 grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Image to PDF</h1>
            <p className="text-muted-foreground mt-2">Convert your images into a perfectly formatted PDF document.</p>
          </div>

          {!isComplete ? (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isConverting
                  ? "border-primary/30 bg-primary/[0.02] cursor-not-allowed"
                  : "border-border hover:bg-muted/50 cursor-pointer"
              }`}
              onClick={() => !isConverting && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!isConverting && e.dataTransfer.files) processFiles(e.dataTransfer.files);
              }}
            >
              <UploadCloud className={`h-10 w-10 mx-auto mb-4 ${isConverting ? "text-primary/40" : "text-muted-foreground"}`} />
              <p className="text-lg font-medium text-foreground">
                {isConverting ? "Conversion in progress…" : "Click to upload or drag and drop"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Supports JPG, PNG, WEBP</p>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files) processFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="border-2 border-green-200 bg-green-50/50 rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xl font-bold text-green-800">PDF Downloaded!</p>
              <p className="text-sm text-green-600 mt-1">{conversion.fileName} saved to your device</p>
            </div>
          )}

          {images.length > 0 && !isComplete && (
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center justify-between">
                <span>Selected Images ({images.length})</span>
                {!isConverting && (
                  <Button variant="ghost" size="sm" onClick={() => setImages([])}>Clear All</Button>
                )}
              </h3>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {images.map((item, index) => (
                      <SortableImage
                        key={item.id}
                        item={item}
                        index={index}
                        onRemove={(id) => !isConverting && setImages(images.filter((i) => i.id !== id))}
                        onRotate={(id, dir) =>
                          !isConverting && setImages(images.map((i) =>
                            i.id === id ? { ...i, rotation: i.rotation + (dir === "left" ? -90 : 90) } : i
                          ))
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                <GripVertical className="h-3.5 w-3.5" />
                Drag the handle on each image to reorder pages. Numbers show the final PDF page order.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {isConverting || isComplete ? (
            <ConversionPanel state={conversion} onConvertAnother={handleConvertAnother} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Document Settings</CardTitle>
                <CardDescription>Customize your output PDF</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Page Size</Label>
                  <Select value={pageSize} onValueChange={(v: any) => setPageSize(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="Letter">US Letter</SelectItem>
                      <SelectItem value="Legal">Legal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Orientation</Label>
                  <RadioGroup value={orientation} onValueChange={(v: any) => setOrientation(v)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="portrait" id="r-portrait" />
                      <Label htmlFor="r-portrait">Portrait</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="landscape" id="r-landscape" />
                      <Label htmlFor="r-landscape">Landscape</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <Label>Margins</Label>
                  <Select value={margin.toString()} onValueChange={(v) => setMargin(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      <SelectItem value="10">Small</SelectItem>
                      <SelectItem value="20">Normal</SelectItem>
                      <SelectItem value="40">Wide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={images.length === 0}
                  onClick={handleGeneratePdf}
                >
                  <FileDown className="mr-2 h-4 w-4" /> Convert to PDF
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
