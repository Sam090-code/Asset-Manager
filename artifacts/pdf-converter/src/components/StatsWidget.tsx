import { useGetStats } from "@workspace/api-client-react";

export function StatsWidget() {
  const { data: stats } = useGetStats();

  if (!stats) return null;

  const savedMb = (stats.totalBytesCompressed / (1024 * 1024)).toFixed(1);

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-6 py-6 px-4 bg-muted/30 border-y text-sm text-muted-foreground">
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-foreground">{stats.pdfsGenerated.toLocaleString()}</span>
        <span>PDFs Generated</span>
      </div>
      <div className="hidden md:block w-px h-8 bg-border" />
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-foreground">{stats.filesCompressed.toLocaleString()}</span>
        <span>Files Compressed</span>
      </div>
      <div className="hidden md:block w-px h-8 bg-border" />
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-foreground">{savedMb} MB</span>
        <span>Total Data Saved</span>
      </div>
    </div>
  );
}
