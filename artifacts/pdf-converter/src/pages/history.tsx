import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Show } from "@clerk/react";
import { Link } from "wouter";
import { FileText, FileArchive, Clock, ArrowRight, History as HistoryIcon, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function formatBytes(bytes: number) {
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

function HistoryTable({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <HistoryIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">No conversions yet</p>
        <p className="text-sm mt-1">Your PDF and compression history will appear here.</p>
        <div className="flex gap-3 justify-center mt-6">
          <Link href="/">
            <Button variant="outline" size="sm">Convert Images to PDF</Button>
          </Link>
          <Link href="/compress">
            <Button size="sm">Compress a File</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-5 py-3.5 text-left font-semibold text-muted-foreground w-10">Type</th>
            <th className="px-5 py-3.5 text-left font-semibold text-muted-foreground">File</th>
            <th className="px-5 py-3.5 text-left font-semibold text-muted-foreground hidden sm:table-cell">Original</th>
            <th className="px-5 py-3.5 text-left font-semibold text-muted-foreground hidden sm:table-cell">Result</th>
            <th className="px-5 py-3.5 text-left font-semibold text-muted-foreground hidden md:table-cell">Saved</th>
            <th className="px-5 py-3.5 text-right font-semibold text-muted-foreground">When</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((e) => (
            <tr key={e.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-5 py-4">
                {e.type === "pdf" ? (
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center" title="PDF Conversion">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center" title="File Compression">
                    <FileArchive className="h-4 w-4 text-violet-600" />
                  </div>
                )}
              </td>
              <td className="px-5 py-4">
                <p className="font-medium text-foreground truncate max-w-[180px]">{e.fileName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {e.type === "pdf"
                    ? `${e.pageCount ?? "?"} image${(e.pageCount ?? 0) !== 1 ? "s" : ""} → PDF`
                    : `${e.level ?? "balanced"} compression`}
                </p>
              </td>
              <td className="px-5 py-4 hidden sm:table-cell text-muted-foreground">
                {e.type === "compression" ? formatBytes(e.originalSize ?? 0) : "—"}
              </td>
              <td className="px-5 py-4 hidden sm:table-cell">
                {e.type === "compression" ? (
                  <span className="font-medium text-foreground">{formatBytes(e.compressedSize ?? 0)}</span>
                ) : (
                  <span className="text-muted-foreground">PDF</span>
                )}
              </td>
              <td className="px-5 py-4 hidden md:table-cell">
                {e.type === "compression" && e.compressionRatio != null ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    e.compressionRatio > 0
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {e.compressionRatio > 0 ? `-${e.compressionRatio}%` : "0%"}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
              <td className="px-5 py-4 text-right text-muted-foreground whitespace-nowrap">
                <span className="flex items-center justify-end gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {timeAgo(e.createdAt)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryContent() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/history`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then(setEntries)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const pdfCount = entries.filter((e) => e.type === "pdf").length;
  const compCount = entries.filter((e) => e.type === "compression").length;
  const totalSaved = entries
    .filter((e) => e.type === "compression" && e.originalSize && e.compressedSize)
    .reduce((acc, e) => acc + ((e.originalSize ?? 0) - (e.compressedSize ?? 0)), 0);

  return (
    <div className="space-y-8">
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border rounded-xl p-5 text-center">
            <p className="text-3xl font-extrabold text-primary">{pdfCount}</p>
            <p className="text-sm text-muted-foreground mt-1">PDFs Created</p>
          </div>
          <div className="bg-card border rounded-xl p-5 text-center">
            <p className="text-3xl font-extrabold text-violet-600">{compCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Files Compressed</p>
          </div>
          <div className="bg-card border rounded-xl p-5 text-center">
            <p className="text-3xl font-extrabold text-green-600">{formatBytes(totalSaved)}</p>
            <p className="text-sm text-muted-foreground mt-1">Space Saved</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Loading your history…</p>
        </div>
      ) : error ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-destructive font-medium">Could not load history.</p>
          <p className="text-sm mt-1">Please try refreshing the page.</p>
        </div>
      ) : (
        <HistoryTable entries={entries} />
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Layout>
      <div className="container max-w-5xl mx-auto py-12 px-4 md:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">My History</h1>
          <p className="text-muted-foreground mt-2">All your PDF conversions and file compressions in one place.</p>
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
                <Button>
                  Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </Show>
      </div>
    </Layout>
  );
}
