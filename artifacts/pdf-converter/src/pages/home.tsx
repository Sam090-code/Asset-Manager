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
import {
  Trash2, RotateCcw, RotateCw, UploadCloud, FileDown, GripVertical,
  FlipHorizontal2, FlipVertical2, Loader2, Sun, Contrast, Droplets,
  Type, Stamp, Hash, Maximize2,
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

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function SortableImageRow({
  item, index, selected, onSelect, onRemove, onRotate, onFlip,
}: {
  item: ImageItem;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onRotate: (dir: "left" | "right") => void;
  onFlip: (axis: "h" | "v") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all ${
        selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-transparent hover:border-border hover:bg-muted/40"
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div className="relative flex-shrink-0 w-12 h-12 rounded overflow-hidden border bg-muted/30">
        <img
          src={item.dataUrl}
          alt={`Page ${index + 1}`}
          className="w-full h-full object-contain"
          style={{
            transform: `rotate(${item.rotation}deg) scaleX(${item.flipH ? -1 : 1}) scaleY(${item.flipV ? -1 : 1})`,
            filter: `brightness(${item.brightness / 100}) contrast(${item.contrast / 100}) saturate(${item.saturation / 100})`,
          }}
          draggable={false}
        />
        <div className="absolute bottom-0.5 left-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded px-1 leading-tight">
          {index + 1}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">Page {index + 1}</p>
        {(item.brightness !== 100 || item.contrast !== 100 || item.saturation !== 100 || item.flipH || item.flipV) && (
          <p className="text-[10px] text-primary">Edited</p>
        )}
      </div>

      <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRotate("left")} title="Rotate left">
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onRotate("right")} title="Rotate right">
          <RotateCw className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onRemove} title="Remove">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function ImageEditPanel({
  item,
  onChange,
}: {
  item: ImageItem;
  onChange: (updates: Partial<ImageItem>) => void;
}) {
  return (
    <div className="px-2 pb-3 space-y-3 border-t pt-3">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wide px-1">Image Adjustments</p>

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant={item.flipH ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => onChange({ flipH: !item.flipH })}
        >
          <FlipHorizontal2 className="h-3 w-3" /> Flip H
        </Button>
        <Button
          variant={item.flipV ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => onChange({ flipV: !item.flipV })}
        >
          <FlipVertical2 className="h-3 w-3" /> Flip V
        </Button>
      </div>

      <div className="space-y-2.5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <Label className="text-xs flex items-center gap-1"><Sun className="h-3 w-3" /> Brightness</Label>
            <span className="text-xs text-muted-foreground tabular-nums">{item.brightness}%</span>
          </div>
          <Slider
            min={10} max={200} step={5}
            value={[item.brightness]}
            onValueChange={([v]) => onChange({ brightness: v })}
            className="h-4"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <Label className="text-xs flex items-center gap-1"><Contrast className="h-3 w-3" /> Contrast</Label>
            <span className="text-xs text-muted-foreground tabular-nums">{item.contrast}%</span>
          </div>
          <Slider
            min={10} max={200} step={5}
            value={[item.contrast]}
            onValueChange={([v]) => onChange({ contrast: v })}
            className="h-4"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <Label className="text-xs flex items-center gap-1"><Droplets className="h-3 w-3" /> Saturation</Label>
            <span className="text-xs text-muted-foreground tabular-nums">{item.saturation}%</span>
          </div>
          <Slider
            min={0} max={200} step={5}
            value={[item.saturation]}
            onValueChange={([v]) => onChange({ saturation: v })}
            className="h-4"
          />
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs text-muted-foreground"
        onClick={() => onChange({ brightness: 100, contrast: 100, saturation: 100, flipH: false, flipV: false, rotation: 0 })}
      >
        Reset to original
      </Button>
    </div>
  );
}

function LivePreview({ images, settings, generating }: { images: ImageItem[]; settings: DocSettings; generating: boolean }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const prevUrl = useRef<string | null>(null);

  const debouncedImages = useDebounce(images, 600);
  const debouncedSettings = useDebounce(settings, 600);

  useEffect(() => {
    if (debouncedImages.length === 0) {
      if (prevUrl.current) { URL.revokeObjectURL(prevUrl.current); prevUrl.current = null; }
      setPreviewUrl(null);
      setError(false);
      return;
    }

    let cancelled = false;
    setError(false);

    (async () => {
      try {
        const processed = await Promise.all(
          debouncedImages.map((img) =>
            processImageItem({
              dataUrl: img.dataUrl,
              rotation: img.rotation,
              flipH: img.flipH,
              flipV: img.flipV,
              brightness: img.brightness,
              contrast: img.contrast,
              saturation: img.saturation,
            }).then((processedDataUrl) => ({ processedDataUrl }))
          )
        );
        if (cancelled) return;
        const bytes = await generatePdf(processed, debouncedSettings);
        if (cancelled) return;
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
        prevUrl.current = url;
        setPreviewUrl(url);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [debouncedImages, debouncedSettings]);

  useEffect(() => {
    return () => { if (prevUrl.current) URL.revokeObjectURL(prevUrl.current); };
  }, []);

  if (images.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground p-8">
        <div className="w-16 h-20 border-2 border-dashed rounded-lg flex items-center justify-center">
          <Maximize2 className="h-6 w-6 opacity-40" />
        </div>
        <div>
          <p className="text-sm font-medium">No images yet</p>
          <p className="text-xs mt-1 opacity-70">Add images in the left panel to see a live preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden">
      {(generating) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Rendering preview…</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-sm text-destructive">Preview failed. Check your settings.</p>
        </div>
      )}
      {previewUrl && (
        <iframe
          key={previewUrl}
          src={previewUrl}
          className="w-full h-full border-0"
          title="PDF Preview"
        />
      )}
      {!previewUrl && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Generating preview…</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsSidebar({
  settings,
  onChange,
}: {
  settings: DocSettings;
  onChange: (updates: Partial<DocSettings>) => void;
}) {
  const m = settings.margins;

  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <Accordion type="multiple" defaultValue={["page", "layout"]} className="space-y-1">

          <AccordionItem value="page" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2"><Maximize2 className="h-3.5 w-3.5" /> Page</span>
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
                  <div className="space-y-1">
                    <Label className="text-xs">Width (pt)</Label>
                    <Input
                      type="number" className="h-8 text-xs"
                      value={settings.customWidth}
                      onChange={(e) => onChange({ customWidth: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Height (pt)</Label>
                    <Input
                      type="number" className="h-8 text-xs"
                      value={settings.customHeight}
                      onChange={(e) => onChange({ customHeight: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Orientation</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["portrait", "landscape"] as const).map((o) => (
                    <Button
                      key={o}
                      variant={settings.orientation === o ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs capitalize"
                      onClick={() => onChange({ orientation: o })}
                    >
                      {o}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Image Alignment</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["left", "center", "right"] as const).map((a) => (
                    <Button
                      key={a}
                      variant={settings.alignment === a ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs capitalize"
                      onClick={() => onChange({ alignment: a })}
                    >
                      {a}
                    </Button>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="layout" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" /> Layout</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Margins (pt)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["Top", "top"], ["Right", "right"], ["Bottom", "bottom"], ["Left", "left"],
                  ] as const).map(([label, key]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{label}</Label>
                      <Input
                        type="number" min={0} max={200} className="h-7 text-xs"
                        value={m[key]}
                        onChange={(e) => onChange({ margins: { ...m, [key]: Number(e.target.value) } })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Page Spacing (pt)</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{settings.spacing}</span>
                </div>
                <Slider
                  min={0} max={100} step={2}
                  value={[settings.spacing]}
                  onValueChange={([v]) => onChange({ spacing: v })}
                />
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
                  <input
                    type="color"
                    value={settings.backgroundColor}
                    onChange={(e) => onChange({ backgroundColor: e.target.value })}
                    className="h-8 w-10 rounded border cursor-pointer p-0.5 bg-transparent"
                  />
                  <Input
                    className="h-8 text-xs font-mono flex-1"
                    value={settings.backgroundColor}
                    onChange={(e) => onChange({ backgroundColor: e.target.value })}
                    maxLength={7}
                  />
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
                    <input
                      type="color"
                      value={settings.borderColor}
                      onChange={(e) => onChange({ borderColor: e.target.value })}
                      className="h-8 w-10 rounded border cursor-pointer p-0.5 bg-transparent"
                    />
                    <Input
                      className="h-8 text-xs font-mono flex-1"
                      value={settings.borderColor}
                      onChange={(e) => onChange({ borderColor: e.target.value })}
                      maxLength={7}
                    />
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="header" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2"><Type className="h-3.5 w-3.5" /> Header</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Enable Header</Label>
                <Switch
                  checked={settings.headerEnabled}
                  onCheckedChange={(v) => onChange({ headerEnabled: v })}
                />
              </div>
              {settings.headerEnabled && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Header Text</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="e.g. My Document"
                      value={settings.headerText}
                      onChange={(e) => onChange({ headerText: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Date</Label>
                    <Switch
                      checked={settings.headerShowDate}
                      onCheckedChange={(v) => onChange({ headerShowDate: v })}
                    />
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="footer" className="border rounded-lg px-3">
            <AccordionTrigger className="text-sm font-semibold py-2.5 hover:no-underline">
              <span className="flex items-center gap-2"><Type className="h-3.5 w-3.5 rotate-180" /> Footer & Page Numbers</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Enable Footer</Label>
                <Switch
                  checked={settings.footerEnabled}
                  onCheckedChange={(v) => onChange({ footerEnabled: v })}
                />
              </div>
              {settings.footerEnabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Footer Text</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="e.g. Confidential"
                    value={settings.footerText}
                    onChange={(e) => onChange({ footerText: e.target.value })}
                  />
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
              <span className="flex items-center gap-2"><Stamp className="h-3.5 w-3.5" /> Watermark</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Enable Watermark</Label>
                <Switch
                  checked={settings.watermarkEnabled}
                  onCheckedChange={(v) => onChange({ watermarkEnabled: v })}
                />
              </div>

              {settings.watermarkEnabled && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Watermark Text</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="e.g. CONFIDENTIAL"
                      value={settings.watermarkText}
                      onChange={(e) => onChange({ watermarkText: e.target.value })}
                    />
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

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Font Size</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{settings.watermarkFontSize}pt</span>
                    </div>
                    <Slider
                      min={12} max={120} step={2}
                      value={[settings.watermarkFontSize]}
                      onValueChange={([v]) => onChange({ watermarkFontSize: v })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Rotation</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{settings.watermarkRotation}°</span>
                    </div>
                    <Slider
                      min={-90} max={90} step={5}
                      value={[settings.watermarkRotation]}
                      onValueChange={([v]) => onChange({ watermarkRotation: v })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Opacity</Label>
                      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(settings.watermarkOpacity * 100)}%</span>
                    </div>
                    <Slider
                      min={0.05} max={0.8} step={0.05}
                      value={[settings.watermarkOpacity]}
                      onValueChange={([v]) => onChange({ watermarkOpacity: v })}
                    />
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </ScrollArea>
  );
}

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<DocSettings>({ ...DEFAULT_SETTINGS });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn, user } = useUser();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedImage = images.find((i) => i.id === selectedId) ?? null;

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
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
      newImages.push({
        id: Math.random().toString(36).substring(7),
        dataUrl,
        rotation: 0,
        flipH: false,
        flipV: false,
        brightness: 100,
        contrast: 100,
        saturation: 100,
      });
    }
    if (newImages.length > 0) {
      setImages((prev) => {
        const updated = [...prev, ...newImages];
        if (!selectedId) setSelectedId(newImages[0].id);
        return updated;
      });
    }
  }, [selectedId]);

  const updateImage = useCallback((id: string, updates: Partial<ImageItem>) => {
    setImages((prev) => prev.map((img) => img.id === id ? { ...img, ...updates } : img));
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((i) => i.id !== id);
      if (selectedId === id) {
        setSelectedId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  }, [selectedId]);

  const handleDownload = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    try {
      const processed = await Promise.all(
        images.map((img) =>
          processImageItem({
            dataUrl: img.dataUrl,
            rotation: img.rotation,
            flipH: img.flipH,
            flipV: img.flipV,
            brightness: img.brightness,
            contrast: img.contrast,
            saturation: img.saturation,
          }).then((processedDataUrl) => ({ processedDataUrl }))
        )
      );
      const bytes = await generatePdf(processed, settings);
      const fileName = `DocuFlow_${Date.now()}.pdf`;
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF Downloaded", description: `${fileName} saved to your device.` });

      fetch(`${BASE}/api/stats/record-pdf`, { method: "POST" })
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
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Layout>
      <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">

        {/* LEFT PANEL — Image List */}
        <div className="w-[260px] flex flex-col border-r bg-background flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div>
              <p className="text-xs font-semibold text-foreground">Images</p>
              <p className="text-[10px] text-muted-foreground">{images.length} page{images.length !== 1 ? "s" : ""}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-3 w-3" /> Add
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          <ScrollArea className="flex-1">
            {images.length === 0 ? (
              <div
                className="m-3 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) processFiles(e.dataTransfer.files); }}
              >
                <UploadCloud className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs font-medium">Click or drop images</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">JPG, PNG, WEBP</p>
              </div>
            ) : (
              <div
                className="p-2 space-y-0.5"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files) processFiles(e.dataTransfer.files); }}
              >
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={images.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {images.map((item, index) => (
                      <SortableImageRow
                        key={item.id}
                        item={item}
                        index={index}
                        selected={selectedId === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        onRemove={() => removeImage(item.id)}
                        onRotate={(dir) => updateImage(item.id, { rotation: item.rotation + (dir === "left" ? -90 : 90) })}
                        onFlip={(axis) => updateImage(item.id, axis === "h" ? { flipH: !item.flipH } : { flipV: !item.flipV })}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </ScrollArea>

          {selectedImage && (
            <div className="border-t">
              <ImageEditPanel
                item={selectedImage}
                onChange={(updates) => updateImage(selectedImage.id, updates)}
              />
            </div>
          )}

          <div className="border-t p-2">
            <Button
              className="w-full gap-2"
              disabled={images.length === 0 || isGenerating}
              onClick={handleDownload}
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              ) : (
                <><FileDown className="h-4 w-4" /> Download PDF</>
              )}
            </Button>
          </div>
        </div>

        {/* CENTER PANEL — Live Preview */}
        <div className="flex-1 flex flex-col bg-muted/20 min-w-0">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
            <p className="text-xs font-semibold text-foreground">Live Preview</p>
            {images.length > 0 && (
              <p className="text-[10px] text-muted-foreground">Updates automatically · {images.length} page{images.length !== 1 ? "s" : ""}</p>
            )}
          </div>
          <LivePreview
            images={images}
            settings={settings}
            generating={isPreviewGenerating}
          />
        </div>

        {/* RIGHT PANEL — Settings */}
        <div className="w-[300px] flex flex-col border-l bg-background flex-shrink-0">
          <div className="px-3 py-2 border-b">
            <p className="text-xs font-semibold text-foreground">Document Settings</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <SettingsSidebar
              settings={settings}
              onChange={(updates) => setSettings((prev) => ({ ...prev, ...updates }))}
            />
          </div>
          <div className="border-t p-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setSettings({ ...DEFAULT_SETTINGS })}
            >
              Reset all settings
            </Button>
          </div>
        </div>

      </div>
    </Layout>
  );
}
