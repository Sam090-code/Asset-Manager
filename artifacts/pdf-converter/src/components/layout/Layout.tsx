import { Link } from "wouter";
import { Navbar } from "./Navbar";
import { StatsWidget } from "../StatsWidget";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <div className="mt-auto">
        <StatsWidget />
        <footer className="py-6 text-center text-sm text-muted-foreground border-t bg-muted/10">
          <p>DocuFlow Productivity Suite &copy; {new Date().getFullYear()}</p>
          <Link href="/admin" className="mt-1 inline-block text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            Admin
          </Link>
        </footer>
      </div>
    </div>
  );
}
