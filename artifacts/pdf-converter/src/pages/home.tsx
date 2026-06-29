import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout/Layout";
import { generatePdf, processImageItem, DEFAULT_SETTINGS, type DocSettings } from "@/lib/pdf-generator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trash2, RotateCcw, RotateCw, UploadCloud, FileDown, GripVertical,
  FlipHorizontal2, FlipVertical2, Loader2, Sun, Contrast, Droplets,
  Type, Stamp, Hash, Maximize2, ChevronLeft, ChevronRight, RefreshCw,
  FileText,
} from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";

type ImageItem = {
  id: string;
  dataUrl: string;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PAGE_DIMS: Record<string, [number, number]> = {
  A4: [595, 842], Letter: [612, 792], Legal: [612, 1008], A3: [842, 1190],
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Sortable image row ──────────────────────────────────────────────────────

function SortableImageRow({
  item, index, selected, onSelect, onRemove, onRotate,
}: {
  item: ImageItem; index: number; selected: boolean;
  onSelect: () => void; onRemove: () => void; onRotate: (dir: "left" | "right") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef} style={style} onClick={onSelect}
      className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${
        selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-transparent hover:border-border hover:bg-muted/40"
      }`}
    >
      <div {...attributes} {...listeners}
        className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div className="relative flex-shrink-0 w-12 h-12 rounded overflow-hidden border bg-muted/30">
        <img src={item.dataUrl} alt={`Page ${index + 1}`} draggable={false}
          className="w-full h-full object-contain"
          style={{
            transform: `rotate(${item.rotation}deg) scaleX(${item.flipH ? -1 : 1}) scaleY(${item.flipV ? -1 : 1})`,
            filter: `brightness(${item.brightness / 100}) contrast(${item.contrast / 100}) saturate(${item.saturation / 100})`,
          }}
        />
        <div className="absolute bottom-0.5 left-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded px-1 leading-tight">
          {index + 1}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">Page {index + 1}</p>
        {(item.brightness !== 100 || item.contrast !== 100 || item.saturation !== 100 || item.flipH || item.flipV || item.rotation !== 0) && (
          <p className="text-[10px] text-primary">Edited</p>
        )}
      </div>

      <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRotate("left")} title="Rotate left"><RotateCcw className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRotate("right")} title="Rotate right"><RotateCw className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onRemove} title="Remove"><Trash2 className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

// ─── Per-image editing panel ─────────────────────────────────────────────────

function ImageEditPanel({ item, onChange }: { item: ImageItem; onChange: (u: Partial<ImageItem>) => void }) {
  return (
    <div className="px-2 pb-3 space-y-3 border-t pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide px-1">Adjustments — Page {}</p>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant={item.flipH ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1"
          onClick={() => onChange({ flipH: !item.flipH })}>
          <FlipHorizontal2 className="h-3 w-3" /> Flip H
        </Button>
        <Button variant={item.flipV ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1"
          onClick={() => onChange({ flipV: !item.flipV })}>
          <FlipVertical2 className="h-3 w-3" /> Flip V
        </Button>
      </div>

      {[
        { label: "Brightness", icon: Sun, key: "brightness" as const, min: 10, max: 200 },
        { label: "Contrast",   icon: Contrast, key: "contrast" as const, min: 10, max: 200 },
        { label: "Saturation", icon: Droplets, key: "saturation" as const, min: 0, max: 200 },
      ].map(({ label, icon: Icon, key, min, max }) => (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <Label className="text-xs flex items-center gap-1"><Icon className="h-3 w-3" />{label}</Label>
            <span className="text-xs text-muted-foreground tabular-nums">{item[key]}%</span>
          </div>
          <Slider min={min} max={max} step={5} value={[item[key]]}
            onValueChange={([v]) => onChange({ [key]: v })} className="h-4" />
        </div>
      ))}

      <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground"
        onClick={() => onChange({ brightness: 100, contrast: 100, saturation: 100, flipH: false, flipV: false, rotation: 0 })}>
        Reset to original
      </Button>
    </div>
  );
}

// ─── Instant HTML preview (zero latency) ────────────────────────────────────

function InstantPreview({
  image, settings, pageIndex, total, onPrev, onNext,
}: {
  image: ImageItem | null; settings: DocSettings;
  pageIndex: number; total: number;
  onPrev: () => void; onNext: () => void;
}) {
  const [rawW, rawH] = settings.pageSize === "Custom"
    ? [settings.customWidth, settings.customHeight]
    : (PAGE_DIMS[settings.pageSize] ?? PAGE_DIMS.A4);
  const [pw, ph] = settings.orientation === "landscape" ? [rawH, rawW] : [rawW, rawH];
  const aspectRatio = pw / ph;

  const HEADER_ZONE = settings.headerEnabled ? 28 : 0;
  const FOOTER_ZONE = (settings.footerEnabled || settings.pageNumberPos !== "none") ? 24 : 0;
  const { top: mt, right: mr, bottom: mb, left: ml } = settings.margins;

  const borderWidths: Record<string, string> = { none: "0px", thin: "1px", medium: "3px", thick: "5px" };

  const pageNumStr = (() => {
    if (settings.pageNumberPos === "none" || total === 0) return "";
    const n = pageIndex + 1;
    if (settings.pageNumberFmt === "number") return `${n}`;
    if (settings.pageNumberFmt === "page-n") return `Page ${n}`;
    return `Page ${n} of ${total}`;
  })();

  const dateStr = new Date().toLocaleDateString();
  const headerText = [settings.headerText, settings.headerShowDate ? dateStr : ""].filter(Boolean).join("   ");

  return (
    <div className="flex-1 flex flex-col items-center justify-center overflow-auto p-6 bg-muted/20 min-h-0">
      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground text-center">
          <div className="w-16 h-20 border-2 border-dashed rounded flex items-center justify-center opacity-40">
            <Maximize2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">No images yet</p>
          <p className="text-xs opacity-70">Add images in the left panel</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 w-full max-h-full">
          {/* Paper */}
          <div className="relative shadow-xl rounded-sm overflow-hidden flex-shrink-0"
            style={{
              aspectRatio: String(aspectRatio),
              maxHeight: "calc(100% - 48px)",
              maxWidth: "100%",
              width: aspectRatio >= 1 ? "100%" : `calc((100vh - 200px) * ${aspectRatio})`,
              backgroundColor: settings.backgroundColor,
              border: `${borderWidths[settings.borderStyle] ?? "0px"} solid ${settings.borderColor}`,
            }}
          >
            {/* Header */}
            {settings.headerEnabled && (
              <div className="absolute left-0 right-0 flex flex-col"
                style={{ top: `${(mt / ph) * 100}%`, paddingLeft: `${(ml / pw) * 100}%`, paddingRight: `${(mr / pw) * 100}%` }}>
                {headerText && (
                  <p className="text-[9px] leading-tight truncate" style={{ color: "#595959" }}>{headerText}</p>
                )}
                <div className="mt-1" style={{ height: "0.4px", backgroundColor: "#ccc" }} />
              </div>
            )}

            {/* Image area */}
            {image && (
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{
                  top: `${((mt + HEADER_ZONE) / ph) * 100}%`,
                  bottom: `${((mb + FOOTER_ZONE) / ph) * 100}%`,
                  left: `${(ml / pw) * 100}%`,
                  right: `${(mr / pw) * 100}%`,
                }}
              >
                <img
                  src={image.dataUrl}
                  alt="Preview"
                  draggable={false}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    transform: `rotate(${image.rotation}deg) scaleX(${image.flipH ? -1 : 1}) scaleY(${image.flipV ? -1 : 1})`,
                    filter: `brightness(${image.brightness / 100}) contrast(${image.contrast / 100}) saturate(${image.saturation / 100})`,
                    alignSelf: "center",
                    marginLeft: settings.alignment === "left" ? 0 : settings.alignment === "right" ? "auto" : "auto",
                    marginRight: settings.alignment === "right" ? 0 : settings.alignment === "left" ? "auto" : "auto",
                  }}
                />
              </div>
            )}

            {/* Watermark */}
            {settings.watermarkEnabled && settings.watermarkText && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <span
                  className="font-bold whitespace-nowrap select-none"
                  style={{
                    fontSize: `${(settings.watermarkFontSize / ph) * 100}cqh`,
                    opacity: settings.watermarkOpacity,
                    transform: `rotate(${settings.watermarkRotation}deg)`,
                    color: "#666",
                    position: settings.watermarkPos !== "center" ? "absolute" : undefined,
                    top: settings.watermarkPos.startsWith("top") ? `${((mt + 24) / ph) * 100}%` : undefined,
                    bottom: settings.watermarkPos.startsWith("bottom") ? `${((mb + 24) / ph) * 100}%` : undefined,
                    left: settings.watermarkPos.endsWith("left") ? `${((ml + 24) / pw) * 100}%` : undefined,
                    right: settings.watermarkPos.endsWith("right") ? `${((mr + 24) / pw) * 100}%` : undefined,
                    containerType: "size",
                  } as React.CSSProperties}
                >
                  {settings.watermarkText}
                </span>
              </div>
            )}

            {/* Footer */}
            {(settings.footerEnabled || settings.pageNumberPos !== "none") && (
              <div className="absolute left-0 right-0 flex items-end"
                style={{
                  bottom: `${(mb / ph) * 100}%`,
                  paddingLeft: `${(ml / pw) * 100}%`,
                  paddingRight: `${(mr / pw) * 100}%`,
                  height: `${(FOOTER_ZONE / ph) * 100}%`,
                }}
              >
                <div className="w-full flex items-center justify-between">
                  {settings.footerEnabled && settings.footerText ? (
                    <p className="text-[9px] truncate" style={{ color: "#595959", maxWidth: "60%" }}>{settings.footerText}</p>
                  ) : <span />}
                  {pageNumStr && (
                    <p className="text-[9px]" style={{ color: "#666",
                      marginLeft: settings.pageNumberPos === "bottom-center" ? "auto" : undefined,
                      marginRight: settings.pageNumberPos === "bottom-left" ? "auto" : undefined,
                    }}>{pageNumStr}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Page navigation */}
          {total > 1 && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={onPrev} disabled={pageIndex === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums min-w-[80px] text-center">
                Page {pageIndex + 1} of {total}
              </span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={onNext} disabled={pageIndex === total - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PDF output — canvas-rendered page viewer (no iframe/blob needed) ────────

function PdfOutput({ images, settings }: { images: ImageItem[]; settings: DocSettings }) {
  const [processedUrls, setProcessedUrls] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const debouncedImages = useDebounce(images, 700);

  // Mark pending immediately when raw images change
  useEffect(() => {
    if (images.length === 0) { setProcessedUrls([]); return; }
    setIsPending(true);
  }, [images]); // eslint-disable-line react-hooks/exhaustive-deps

  // Process images after debounce settles
  useEffect(() => {
    setIsPending(false);
    if (debouncedImages.length === 0) { setProcessedUrls([]); return; }
    let cancelled = false;
    setIsProcessing(true);
    (async () => {
      try {
        const urls = await Promise.all(
          debouncedImages.map((img) =>
            processImageItem({
              dataUrl: img.dataUrl, rotation: img.rotation,
              flipH: img.flipH, flipV: img.flipV,
              brightness: img.brightness, contrast: img.contrast, saturation: img.saturation,
            })
          )
        );
        if (!cancelled) setProcessedUrls(urls);
      } finally {
        if (!cancelled) setIsProcessing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedImages]);

  const [rawW, rawH] = settings.pageSize === "Custom"
    ? [settings.customWidth, settings.customHeight]
    : (PAGE_DIMS[settings.pageSize] ?? PAGE_DIMS.A4);
  const [pw, ph] = settings.orientation === "landscape" ? [rawH, rawW] : [rawW, rawH];
  const aspectRatio = pw / ph;

  const HEADER_ZONE = settings.headerEnabled ? 28 : 0;
  const FOOTER_ZONE = (settings.footerEnabled || settings.pageNumberPos !== "none") ? 24 : 0;
  const { top: mt, right: mr, bottom: mb, left: ml } = settings.margins;
  const borderWidths: Record<string, string> = { none: "0px", thin: "1px", medium: "3px", thick: "5px" };
  const dateStr = new Date().toLocaleDateString();
  const headerText = [settings.headerText, settings.headerShowDate ? dateStr : ""].filter(Boolean).join("   ");
  const total = images.length;

  if (images.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground p-8">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">Add images to see the processed PDF pages</p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      {/* Top status bar */}
      {(isPending || isProcessing) && (
        <>
          <div className="absolute top-0 left-0 right-0 h-0.5 z-20">
            <div className="h-full bg-primary/70 animate-pulse w-full" />
          </div>
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm border rounded-full px-2.5 py-1 shadow-sm">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-[11px] text-muted-foreground">{isPending ? "Waiting…" : "Processing…"}</span>
          </div>
        </>
      )}

      {/* Scrollable page viewer */}
      <div className="flex-1 overflow-y-auto bg-muted/20 py-6 px-4 space-y-6">
        {(processedUrls.length > 0 ? processedUrls : new Array(images.length).fill(null)).map((url, i) => {
          const pageNumStr = (() => {
            if (settings.pageNumberPos === "none") return "";
            const n = i + 1;
            if (settings.pageNumberFmt === "number") return `${n}`;
            if (settings.pageNumberFmt === "page-n") return `Page ${n}`;
            return `Page ${n} of ${total}`;
          })();

          return (
            <div key={i} className="mx-auto flex flex-col items-center gap-1.5" style={{ maxWidth: "480px" }}>
              {/* Page label */}
              <p className="text-[10px] text-muted-foreground">Page {i + 1}</p>

              {/* Paper */}
              <div
                className="relative w-full shadow-xl rounded-sm overflow-hidden flex-shrink-0"
                style={{
                  aspectRatio: String(aspectRatio),
                  backgroundColor: settings.backgroundColor,
                  border: `${borderWidths[settings.borderStyle] ?? "0px"} solid ${settings.borderColor}`,
                }}
              >
                {/* Header */}
                {settings.headerEnabled && (
                  <div className="absolute left-0 right-0 flex flex-col"
                    style={{ top: `${(mt / ph) * 100}%`, paddingLeft: `${(ml / pw) * 100}%`, paddingRight: `${(mr / pw) * 100}%` }}>
                    {headerText && <p className="text-[8px] leading-tight truncate" style={{ color: "#595959" }}>{headerText}</p>}
                    <div className="mt-0.5" style={{ height: "0.4px", backgroundColor: "#ccc" }} />
                  </div>
                )}

                {/* Image / loading skeleton */}
                <div className="absolute flex items-center justify-center overflow-hidden"
                  style={{
                    top: `${((mt + HEADER_ZONE) / ph) * 100}%`,
                    bottom: `${((mb + FOOTER_ZONE) / ph) * 100}%`,
                    left: `${(ml / pw) * 100}%`,
                    right: `${(mr / pw) * 100}%`,
                  }}
                >
                  {url ? (
                    <img src={url} alt={`Page ${i + 1}`} draggable={false}
                      className="max-w-full max-h-full object-contain"
                      style={{
                        marginLeft: settings.alignment === "left" ? 0 : settings.alignment === "right" ? "auto" : "auto",
                        marginRight: settings.alignment === "right" ? 0 : settings.alignment === "left" ? "auto" : "auto",
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-muted/40 animate-pulse rounded" />
                  )}
                </div>

                {/* Watermark */}
                {settings.watermarkEnabled && settings.watermarkText && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                    <span className="font-bold whitespace-nowrap select-none"
                      style={{
                        fontSize: `${(settings.watermarkFontSize / ph) * 100}cqh`,
                        opacity: settings.watermarkOpacity,
                        transform: `rotate(${settings.watermarkRotation}deg)`,
                        color: "#666",
                        position: settings.watermarkPos !== "center" ? "absolute" : undefined,
                        top: settings.watermarkPos.startsWith("top") ? `${((mt + 24) / ph) * 100}%` : undefined,
                        bottom: settings.watermarkPos.startsWith("bottom") ? `${((mb + 24) / ph) * 100}%` : undefined,
                        left: settings.watermarkPos.endsWith("left") ? `${((ml + 24) / pw) * 100}%` : undefined,
                        right: settings.watermarkPos.endsWith("right") ? `${((mr + 24) / pw) * 100}%` : undefined,
                      } as React.CSSProperties}
                    >
                      {settings.watermarkText}
                    </span>
                  </div>
                )}

                {/* Footer */}
                {(settings.footerEnabled || settings.pageNumberPos !== "none") && (
                  <div className="absolute left-0 right-0 flex items-end"
                    style={{
                      bottom: `${(mb / ph) * 100}%`,
                      paddingLeft: `${(ml / pw) * 100}%`,
                      paddingRight: `${(mr / pw) * 100}%`,
                      height: `${(FOOTER_ZONE / ph) * 100}%`,
                    }}
                  >
                    <div className="w-full flex items-center justify-between">
                      {settings.footerEnabled && settings.footerText
                        ? <p className="text-[8px] truncate" style={{ color: "#595959", maxWidth: "60%" }}>{settings.footerText}</p>
                        : <span />}
                      {pageNumStr && (
                        <p className="text-[8px]" style={{ color: "#666",
                          marginLeft: settings.pageNumberPos === "bottom-center" ? "auto" : undefined,
                          marginRight: settings.pageNumberPos === "bottom-left" ? "auto" : undefined,
                        }}>{pageNumStr}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Settings sidebar ────────────────────────────────────────────────────────

function SettingsSidebar({ settings, onChange }: { settings: DocSettings; onChange: (u: Partial<DocSettings>) => void }) {
  const m = settings.margins;
  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <Accordion type="multiple" defaultValue={["page", "layout"]} className="space-y-1">

          <AccordionItem value="page" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2"><Maximize2 className="h-3.5 w-3.5" />Page</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Page Size</Label>
                <Select value={settings.pageSize} onValueChange={(v: any) => onChange({ pageSize: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                    <SelectItem value="Letter">US Letter (8.5 × 11 in)</SelectItem>
                    <SelectItem value="Legal">Legal (8.5 × 14 in)</SelectItem>
                    <SelectItem value="A3">A3 (297 × 420 mm)</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.pageSize === "Custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Width (pt)</Label>
                    <Input type="number" className="h-8 text-xs" value={settings.customWidth}
                      onChange={(e) => onChange({ customWidth: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Height (pt)</Label>
                    <Input type="number" className="h-8 text-xs" value={settings.customHeight}
                      onChange={(e) => onChange({ customHeight: Number(e.target.value) })} /></div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Orientation</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["portrait", "landscape"] as const).map((o) => (
                    <Button key={o} variant={settings.orientation === o ? "default" : "outline"} size="sm"
                      className="h-8 text-xs capitalize" onClick={() => onChange({ orientation: o })}>{o}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Image Alignment</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["left", "center", "right"] as const).map((a) => (
                    <Button key={a} variant={settings.alignment === a ? "default" : "outline"} size="sm"
                      className="h-7 text-xs capitalize" onClick={() => onChange({ alignment: a })}>{a}</Button>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="layout" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" />Layout</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Margins (pt)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["top", "right", "bottom", "left"] as const).map((k) => (
                    <div key={k} className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground capitalize">{k}</Label>
                      <Input type="number" min={0} max={200} className="h-7 text-xs" value={m[k]}
                        onChange={(e) => onChange({ margins: { ...m, [k]: Number(e.target.value) } })} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Page Spacing (pt)</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{settings.spacing}</span>
                </div>
                <Slider min={0} max={100} step={2} value={[settings.spacing]}
                  onValueChange={([v]) => onChange({ spacing: v })} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="appearance" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-current inline-block" />
                Appearance
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Background Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.backgroundColor}
                    onChange={(e) => onChange({ backgroundColor: e.target.value })}
                    className="h-8 w-10 rounded border cursor-pointer p-0.5 bg-transparent" />
                  <Input className="h-8 text-xs font-mono flex-1" value={settings.backgroundColor} maxLength={7}
                    onChange={(e) => onChange({ backgroundColor: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Border Style</Label>
                <Select value={settings.borderStyle} onValueChange={(v: any) => onChange({ borderStyle: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="thin">Thin</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="thick">Thick</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.borderStyle !== "none" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Border Color</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.borderColor}
                      onChange={(e) => onChange({ borderColor: e.target.value })}
                      className="h-8 w-10 rounded border cursor-pointer p-0.5 bg-transparent" />
                    <Input className="h-8 text-xs font-mono flex-1" value={settings.borderColor} maxLength={7}
                      onChange={(e) => onChange({ borderColor: e.target.value })} />
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="header" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2"><Type className="h-3.5 w-3.5" />Header</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Enable Header</Label>
                <Switch checked={settings.headerEnabled} onCheckedChange={(v) => onChange({ headerEnabled: v })} />
              </div>
              {settings.headerEnabled && (<>
                <div className="space-y-1.5">
                  <Label className="text-xs">Header Text</Label>
                  <Input className="h-8 text-xs" placeholder="e.g. My Document" value={settings.headerText}
                    onChange={(e) => onChange({ headerText: e.target.value })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Show Date</Label>
                  <Switch checked={settings.headerShowDate} onCheckedChange={(v) => onChange({ headerShowDate: v })} />
                </div>
              </>)}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="footer" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2"><Type className="h-3.5 w-3.5 rotate-180" />Footer & Page Numbers</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Enable Footer</Label>
                <Switch checked={settings.footerEnabled} onCheckedChange={(v) => onChange({ footerEnabled: v })} />
              </div>
              {settings.footerEnabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Footer Text</Label>
                  <Input className="h-8 text-xs" placeholder="e.g. Confidential" value={settings.footerText}
                    onChange={(e) => onChange({ footerText: e.target.value })} />
                </div>
              )}
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs">Page Numbers</Label>
                <Select value={settings.pageNumberPos} onValueChange={(v: any) => onChange({ pageNumberPos: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-center">Bottom Center</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.pageNumberPos !== "none" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Number Format</Label>
                  <Select value={settings.pageNumberFmt} onValueChange={(v: any) => onChange({ pageNumberFmt: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">1, 2, 3</SelectItem>
                      <SelectItem value="page-n">Page 1, Page 2</SelectItem>
                      <SelectItem value="page-n-of-total">Page 1 of 5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="watermark" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2"><Stamp className="h-3.5 w-3.5" />Watermark</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Enable Watermark</Label>
                <Switch checked={settings.watermarkEnabled} onCheckedChange={(v) => onChange({ watermarkEnabled: v })} />
              </div>
              {settings.watermarkEnabled && (<>
                <div className="space-y-1.5">
                  <Label className="text-xs">Watermark Text</Label>
                  <Input className="h-8 text-xs" placeholder="e.g. CONFIDENTIAL" value={settings.watermarkText}
                    onChange={(e) => onChange({ watermarkText: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Position</Label>
                  <Select value={settings.watermarkPos} onValueChange={(v: any) => onChange({ watermarkPos: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {[
                  { label: "Font Size", key: "watermarkFontSize" as const, min: 12, max: 120, unit: "pt" },
                  { label: "Rotation",  key: "watermarkRotation" as const, min: -90, max: 90, unit: "°" },
                ].map(({ label, key, min, max, unit }) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">{label}</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{settings[key]}{unit}</span>
                    </div>
                    <Slider min={min} max={max} step={unit === "pt" ? 2 : 5} value={[settings[key]]}
                      onValueChange={([v]) => onChange({ [key]: v })} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Opacity</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">{Math.round(settings.watermarkOpacity * 100)}%</span>
                  </div>
                  <Slider min={0.05} max={0.8} step={0.05} value={[settings.watermarkOpacity]}
                    onValueChange={([v]) => onChange({ watermarkOpacity: v })} />
                </div>
              </>)}
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </ScrollArea>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [settings, setSettings] = useState<DocSettings>({ ...DEFAULT_SETTINGS });
  const [isDownloading, setIsDownloading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn, user } = useUser();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedImage = images.find((i) => i.id === selectedId) ?? null;
  const previewImage = images[previewPageIndex] ?? null;

  // Sync selectedId → preview page
  useEffect(() => {
    const idx = images.findIndex((i) => i.id === selectedId);
    if (idx !== -1) setPreviewPageIndex(idx);
  }, [selectedId, images]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oi = items.findIndex((i) => i.id === active.id);
        const ni = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oi, ni);
      });
    }
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const newImages: ImageItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.match("image/.*")) continue;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push({ id: Math.random().toString(36).substring(7), dataUrl, rotation: 0, flipH: false, flipV: false, brightness: 100, contrast: 100, saturation: 100 });
    }
    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
      setSelectedId((prev) => prev ?? newImages[0].id);
    }
  }, []);

  const updateImage = useCallback((id: string, updates: Partial<ImageItem>) => {
    setImages((prev) => prev.map((img) => img.id === id ? { ...img, ...updates } : img));
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((i) => i.id !== id);
      setSelectedId((sel) => sel === id ? (filtered[0]?.id ?? null) : sel);
      return filtered;
    });
  }, []);

  const handleDownload = async () => {
    if (images.length === 0) return;
    setIsDownloading(true);
    try {
      const processed = await Promise.all(
        images.map((img) =>
          processImageItem({ dataUrl: img.dataUrl, rotation: img.rotation, flipH: img.flipH, flipV: img.flipV, brightness: img.brightness, contrast: img.contrast, saturation: img.saturation })
            .then((processedDataUrl) => ({ processedDataUrl }))
        )
      );
      const bytes = await generatePdf(processed, settings);
      const fileName = `DocuFlow_${Date.now()}.pdf`;
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF Downloaded", description: `${images.length} page${images.length !== 1 ? "s" : ""} saved.` });
      fetch(`${BASE}/api/stats/record-pdf`, { method: "POST" })
        .then(() => queryClient.invalidateQueries({ queryKey: ["/stats"] })).catch(() => {});
      if (isSignedIn) {
        fetch(`${BASE}/api/history`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "pdf", fileName, pageCount: images.length, userEmail: user?.primaryEmailAddress?.emailAddress }),
        }).catch(() => {});
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Layout>
      <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">

        {/* ── LEFT: Image list ─────────────────────────────────────────────── */}
        <div className="w-[260px] flex flex-col border-r bg-background flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div>
              <p className="text-xs font-semibold">Images</p>
              <p className="text-[10px] text-muted-foreground">{images.length} page{images.length !== 1 ? "s" : ""}</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="h-3 w-3" /> Add
            </Button>
            <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }} />
          </div>

          <ScrollArea className="flex-1">
            {images.length === 0 ? (
              <div className="m-3 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) processFiles(e.dataTransfer.files); }}>
                <UploadCloud className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs font-medium">Click or drop images</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">JPG · PNG · WEBP</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) processFiles(e.dataTransfer.files); }}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={images.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {images.map((item, index) => (
                      <SortableImageRow key={item.id} item={item} index={index} selected={selectedId === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        onRemove={() => removeImage(item.id)}
                        onRotate={(dir) => updateImage(item.id, { rotation: item.rotation + (dir === "left" ? -90 : 90) })}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </ScrollArea>

          {selectedImage && (
            <div className="border-t">
              <ImageEditPanel item={selectedImage} onChange={(u) => updateImage(selectedImage.id, u)} />
            </div>
          )}

          <div className="border-t p-2">
            <Button className="w-full gap-2" disabled={images.length === 0 || isDownloading} onClick={handleDownload}>
              {isDownloading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><FileDown className="h-4 w-4" />Download PDF</>}
            </Button>
          </div>
        </div>

        {/* ── CENTER: Preview tabs ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          <Tabs defaultValue="instant" className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between border-b bg-background px-3 flex-shrink-0">
              <TabsList className="h-9 bg-transparent gap-0 p-0">
                <TabsTrigger value="instant"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 h-9 text-xs font-medium">
                  Live Preview
                </TabsTrigger>
                <TabsTrigger value="pdf"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 h-9 text-xs font-medium gap-1.5">
                  PDF Output
                  {images.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </TabsTrigger>
              </TabsList>
              {images.length > 0 && (
                <p className="text-[10px] text-muted-foreground">{images.length} page{images.length !== 1 ? "s" : ""}</p>
              )}
            </div>

            <TabsContent value="instant" className="flex-1 overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <InstantPreview
                image={previewImage}
                settings={settings}
                pageIndex={previewPageIndex}
                total={images.length}
                onPrev={() => {
                  const idx = Math.max(0, previewPageIndex - 1);
                  setPreviewPageIndex(idx);
                  setSelectedId(images[idx]?.id ?? null);
                }}
                onNext={() => {
                  const idx = Math.min(images.length - 1, previewPageIndex + 1);
                  setPreviewPageIndex(idx);
                  setSelectedId(images[idx]?.id ?? null);
                }}
              />
            </TabsContent>

            <TabsContent value="pdf" className="flex-1 overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
              <PdfOutput images={images} settings={settings} />
            </TabsContent>
          </Tabs>
        </div>

        {/* ── RIGHT: Settings ──────────────────────────────────────────────── */}
        <div className="w-[300px] flex flex-col border-l bg-background flex-shrink-0">
          <div className="px-3 py-2 border-b">
            <p className="text-xs font-semibold">Document Settings</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <SettingsSidebar settings={settings} onChange={(u) => setSettings((p) => ({ ...p, ...u }))} />
          </div>
          <div className="border-t p-2">
            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setSettings({ ...DEFAULT_SETTINGS })}>
              Reset all settings
            </Button>
          </div>
        </div>

      </div>
    </Layout>
  );
}
