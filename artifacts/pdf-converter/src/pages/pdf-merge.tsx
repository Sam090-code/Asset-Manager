import { useCallback, useRef, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UploadCloud, FileDown, Trash2, GripVertical, Loader2,
  FilePlus2, FileText, MergeIcon, CheckCircle2, X,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";

type PdfEntry = {
  id: string;
  file: File;
  pageCount: number;
  sizeKb: number;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function getPageCount(file: File): Promise<number> {
  try {
    const buf = await file.arrayBuffer();
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return 0;
  }
}

function SortableRow({
  entry, index, onRemove,
}: {
  entry: PdfEntry; index: number; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef} style={style}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-background hover:bg-muted/30 transition-colors"
    >
      <div
        {...attributes} {...listeners}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-0.5"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <FileText className="h-4.5 w-4.5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {entry.pageCount > 0 ? `${entry.pageCount} page${entry.pageCount !== 1 ? "s" : ""}` : "?"}
          {" · "}{formatSize(entry.file.size)}
        </p>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
          #{index + 1}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function PdfMergePage() {
  const [entries, setEntries] = useState<PdfEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const processFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (pdfs.length === 0) {
      toast({ title: "PDF files only", description: "Please select one or more PDF files.", variant: "destructive" });
      return;
    }
    const newEntries: PdfEntry[] = await Promise.all(
      pdfs.map(async (file) => ({
        id: Math.random().toString(36).slice(2),
        file,
        pageCount: await getPageCount(file),
        sizeKb: file.size / 1024,
      }))
    );
    setEntries((prev) => [...prev, ...newEntries]);
    setDone(false);
  }, [toast]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setEntries((items) => {
        const oi = items.findIndex((i) => i.id === active.id);
        const ni = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oi, ni);
      });
    }
  };

  const handleMerge = async () => {
    if (entries.length < 2) return;
    setLoading(true);
    setDone(false);
    try {
      const merged = await PDFDocument.create();
      let pages = 0;
      for (const entry of entries) {
        const buf = await entry.file.arrayBuffer();
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const copied = await merged.copyPages(doc, doc.getPageIndices());
        copied.forEach((p) => merged.addPage(p));
        pages += copied.length;
      }
      const bytes = await merged.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `merged_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTotalPages(pages);
      setDone(true);
      toast({ title: "PDFs merged!", description: `${entries.length} files · ${pages} pages combined.` });
    } catch (err: any) {
      toast({ title: "Merge failed", description: err?.message ?? "Could not merge the selected PDFs.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalFileSize = entries.reduce((s, e) => s + e.file.size, 0);
  const totalPageCount = entries.reduce((s, e) => s + e.pageCount, 0);

  return (
    <Layout>
      <div className="min-h-[calc(100dvh-3.5rem)] bg-muted/20">
        <div className="max-w-2xl mx-auto px-4 py-10">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 mb-4">
              <MergeIcon className="h-7 w-7 text-violet-600" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">PDF Merger</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Combine multiple PDF files into one — drag to reorder, then merge.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer hover:bg-muted/30 hover:border-primary/40 transition-all mb-4"
          >
            <UploadCloud className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Click or drag PDF files here</p>
            <p className="text-xs text-muted-foreground mt-1">Multiple files supported · Reorder freely</p>
          </div>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={handleFilePick} />

          {/* File list */}
          {entries.length > 0 && (
            <div className="bg-background border rounded-2xl overflow-hidden mb-4 shadow-sm">
              {/* List header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{entries.length} file{entries.length !== 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{totalPageCount} pages total</span>
                  <span>·</span>
                  <span>{formatSize(totalFileSize)}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive/70 hover:text-destructive"
                  onClick={() => { setEntries([]); setDone(false); }}>
                  Clear all
                </Button>
              </div>

              <ScrollArea className="max-h-80">
                <div className="p-3 space-y-2">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                      {entries.map((entry, i) => (
                        <SortableRow key={entry.id} entry={entry} index={i}
                          onRemove={() => { setEntries((p) => p.filter((e) => e.id !== entry.id)); setDone(false); }}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </ScrollArea>

              {/* Add more */}
              <div className="border-t px-3 py-2">
                <Button variant="ghost" size="sm" className="w-full h-8 text-xs gap-1.5 text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}>
                  <FilePlus2 className="h-3.5 w-3.5" /> Add more PDFs
                </Button>
              </div>
            </div>
          )}

          {/* Success banner */}
          {done && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 mb-4 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Download started!</p>
                <p className="text-green-700 text-xs mt-0.5">{entries.length} files merged into {totalPages} pages.</p>
              </div>
            </div>
          )}

          {/* Merge button */}
          <Button
            size="lg"
            className="w-full gap-2 text-base h-12"
            disabled={entries.length < 2 || loading}
            onClick={handleMerge}
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Merging…</>
            ) : (
              <><FileDown className="h-5 w-5" /> Merge & Download</>
            )}
          </Button>

          {entries.length === 1 && (
            <p className="text-center text-xs text-muted-foreground mt-2">Add at least one more PDF to merge</p>
          )}

          {/* Info strip */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "100% Private", sub: "All processing happens in your browser" },
              { label: "No Limits", sub: "Merge as many PDFs as you need" },
              { label: "Preserves Quality", sub: "Original content is never re-compressed" },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl border bg-background">
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.sub}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </Layout>
  );
}
