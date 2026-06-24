import { useState, useRef, useCallback } from "react";
import { Layout } from "@/components/layout/Layout";
import { imagesToPdf } from "@/lib/pdf-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, RotateCcw, RotateCw, UploadCloud, FileDown, GripVertical } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";

type ImageItem = {
  id: string;
  dataUrl: string;
  rotation: number;
};

function SortableImage({ 
  item, 
  onRemove, 
  onRotate 
}: { 
  item: ImageItem; 
  onRemove: (id: string) => void;
  onRotate: (id: string, direction: 'left' | 'right') => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group bg-card border rounded-lg overflow-hidden shadow-sm aspect-square flex items-center justify-center">
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1.5 bg-background/80 backdrop-blur rounded text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur" onClick={() => onRotate(item.id, 'left')}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur" onClick={() => onRotate(item.id, 'right')}>
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="icon" className="h-8 w-8 backdrop-blur" onClick={() => onRemove(item.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <img 
        src={item.dataUrl} 
        alt="Upload preview" 
        className="max-h-full max-w-full object-contain p-2"
        style={{ transform: `rotate(${item.rotation}deg)`, transition: 'transform 0.2s' }}
      />
    </div>
  );
}

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'Letter' | 'Legal'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState<number>(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
      if (!file.type.match('image/.*')) continue;
      
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      
      newImages.push({
        id: Math.random().toString(36).substring(7),
        dataUrl,
        rotation: 0,
      });
    }
    
    if (newImages.length > 0) {
      setImages((prev) => [...prev, ...newImages]);
    }
  }, []);

  const handleGeneratePdf = async () => {
    if (images.length === 0) return;
    
    setIsGenerating(true);
    try {
      const pdfBytes = await imagesToPdf(images, { pageSize, orientation, margin });
      const blob = new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DocuFlow_${new Date().getTime()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "PDF generated and downloaded successfully.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to generate PDF.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 md:px-8 grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Image to PDF</h1>
            <p className="text-muted-foreground mt-2">Convert your images into a perfectly formatted PDF document.</p>
          </div>

          <div 
            className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
            }}
          >
            <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Click to upload or drag and drop</p>
            <p className="text-sm text-muted-foreground mt-1">Supports JPG, PNG, WEBP</p>
            <input 
              type="file" 
              multiple 
              accept="image/jpeg,image/png,image/webp" 
              className="hidden" 
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files) processFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>

          {images.length > 0 && (
            <div className="bg-card border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center justify-between">
                <span>Selected Images ({images.length})</span>
                <Button variant="ghost" size="sm" onClick={() => setImages([])}>Clear All</Button>
              </h3>
              
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={images.map(i => i.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {images.map(item => (
                      <SortableImage 
                        key={item.id} 
                        item={item} 
                        onRemove={(id) => setImages(images.filter(i => i.id !== id))}
                        onRotate={(id, dir) => setImages(images.map(i => 
                          i.id === id ? { ...i, rotation: i.rotation + (dir === 'left' ? -90 : 90) } : i
                        ))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>

        <div className="space-y-6">
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
                disabled={images.length === 0 || isGenerating}
                onClick={handleGeneratePdf}
              >
                {isGenerating ? "Generating PDF..." : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" /> Convert to PDF
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
