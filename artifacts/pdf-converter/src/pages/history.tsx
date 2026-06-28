import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Show } from "@clerk/react";
import { Link } from "wouter";
import {
  FileText, FileArchive, Clock, ArrowRight, History as HistoryIcon,
  LogIn, Filter, TrendingDown, Files, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type HistoryEntry = {
  id: number;
  type: "pdf" | "compression";
  fileName: string;
  originalSize: number | null;
  compressedSize: number | null;
  compressionRatio: number | null;
  pageCount: number | null;
  mimeType: string | null;
  level: string | null;
  createdAt: string;
};

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

type FilterType = "all" | "pdf" | "compression";

function StatCard({ icon: Icon, value, label, color }: {
  icon: React.ElementType;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-card border rounded-xl p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-extrabold leading-tight">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function EntryRow({ e }: { e: HistoryEntry }) {
  const isPdf = e.type === "pdf";
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors border-b last:border-0">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isPdf ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"
      }`}>
        {isPdf ? <FileText className="h-5 w-5" /> : <FileArchive className="h-5 w-5" />}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate text-sm">{e.fileName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <Badge variant={isPdf ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
            {isPdf ? "PDF" : "Compressed"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {isPdf
              ? `${e.pageCount ?? "?"} image${(e.pageCount ?? 0) !== 1 ? "s" : ""} merged`
              : `${e.level ?? "balanced"} compression`}
          </span>
        </div>
      </div>

      {/* Size info — compression only */}
      {!isPdf && (
        <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            {formatBytes(e.originalSize)} → <span className="font-semibold text-foreground">{formatBytes(e.compressedSize)}</span>
          </p>
          {e.compressionRatio != null && e.compressionRatio > 0 && (
            <span className="text-[11px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
              -{e.compressionRatio}%
            </span>
          )}
        </div>
      )}

      {/* Timestamp */}
      <div className="flex-shrink-0 text-right ml-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 justify-end">
          <Clock className="h-3 w-3" />
          {timeAgo(e.createdAt)}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{formatDate(e.createdAt)}</p>
      </div>
    </div>
  );
}

function EmptyFilter({ filter, onClear }: { filter: FilterType; onClear: () => void }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <HistoryIcon className="h-10 w-10 mx-auto mb-3 opacity-25" />
      <p className="font-medium">No {filter === "pdf" ? "PDF conversions" : "compressed files"} yet</p>
      <Button variant="ghost" size="sm" className="mt-3 text-primary" onClick={onClear}>
        Show all history
      </Button>
    </div>
  );
}

function HistoryContent() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    fetch(`${BASE}/api/history`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); })
      .then(setEntries)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const pdfCount = entries.filter((e) => e.type === "pdf").length;
  const compCount = entries.filter((e) => e.type === "compression").length;
  const totalSaved = entries
    .filter((e) => e.type === "compression" && e.originalSize && e.compressedSize)
    .reduce((acc, e) => acc + ((e.originalSize ?? 0) - (e.compressedSize ?? 0)), 0);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.type === filter);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b last:border-0">
              <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-24 border rounded-xl bg-card">
        <p className="text-destructive font-semibold">Could not load history</p>
        <p className="text-sm text-muted-foreground mt-1">Please refresh the page and try again.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-24 border rounded-xl bg-card">
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <HistoryIcon className="h-7 w-7 text-muted-foreground opacity-50" />
        </div>
        <h2 className="text-lg font-bold">No conversions yet</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Your PDF conversions and compressed files will all appear here once you start using the tools.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <Link href="/convert">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Image to PDF
            </Button>
          </Link>
          <Link href="/compress">
            <Button size="sm" className="gap-1.5">
              <FileArchive className="h-3.5 w-3.5" /> Compress Files
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard
          icon={Layers}
          value={String(pdfCount)}
          label="PDFs Created"
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={Files}
          value={String(compCount)}
          label="Files Compressed"
          color="bg-violet-50 text-violet-600"
        />
        <StatCard
          icon={TrendingDown}
          value={formatBytes(totalSaved)}
          label="Space Saved"
          color="bg-green-50 text-green-600"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        {(["all", "pdf", "compression"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {f === "all" ? `All (${entries.length})` : f === "pdf" ? `PDF (${pdfCount})` : `Compressed (${compCount})`}
          </button>
        ))}
      </div>

      {/* Entry list */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyFilter filter={filter} onClear={() => setFilter("all")} />
        ) : (
          filtered.map((e) => <EntryRow key={e.id} e={e} />)
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Showing {filtered.length} of {entries.length} entries
      </p>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Layout>
      <div className="container max-w-3xl mx-auto py-12 px-4 md:px-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">My History</h1>
            <p className="text-muted-foreground mt-1.5">
              All your PDF conversions and file compressions in one place.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 mt-1">
            <Link href="/convert">
              <Button variant="outline" size="sm" className="gap-1.5 hidden sm:flex">
                <FileText className="h-3.5 w-3.5" /> New PDF
              </Button>
            </Link>
            <Link href="/compress">
              <Button size="sm" className="gap-1.5 hidden sm:flex">
                <FileArchive className="h-3.5 w-3.5" /> Compress
              </Button>
            </Link>
          </div>
        </div>

        <Show when="signed-in">
          <HistoryContent />
        </Show>

        <Show when="signed-out">
          <div className="text-center py-24 border rounded-xl bg-card">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Sign in to see your history</h2>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              Create a free account to track every PDF you convert and every file you compress.
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <Link href="/sign-in">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button>Get Started <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
              </Link>
            </div>
          </div>
        </Show>
      </div>
    </Layout>
  );
}
