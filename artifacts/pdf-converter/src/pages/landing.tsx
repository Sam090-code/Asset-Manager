import { Link, useLocation } from "wouter";
import { FileText, FileUp, Info, ArrowRight, ShieldCheck, Zap, Download, RotateCcw } from "lucide-react";
import { Show, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { StatsWidget } from "@/components/StatsWidget";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Landing() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();

  const features = [
    {
      href: "/convert",
      icon: FileText,
      label: "Image to PDF",
      description: "Upload JPG, PNG, or WEBP images, reorder them with drag & drop, and export a perfectly formatted PDF in seconds.",
      color: "bg-blue-50 text-blue-600",
      accent: "border-blue-100 hover:border-blue-300",
      badge: "Most Popular",
    },
    {
      href: "/compress",
      icon: FileUp,
      label: "Smart Compressor",
      description: "Shrink PDFs and images without noticeable quality loss. Choose from Low, Balanced, or Maximum compression levels.",
      color: "bg-violet-50 text-violet-600",
      accent: "border-violet-100 hover:border-violet-300",
      badge: "Save Space",
    },
    {
      href: "/about",
      icon: Info,
      label: "About DocuFlow",
      description: "Learn how DocuFlow works, what makes it fast, and why thousands of people trust it with their documents every day.",
      color: "bg-emerald-50 text-emerald-600",
      accent: "border-emerald-100 hover:border-emerald-300",
      badge: null,
    },
  ];

  const perks = [
    { icon: Zap, label: "Lightning fast", desc: "PDFs generated entirely in your browser — no upload wait." },
    { icon: ShieldCheck, label: "Private by default", desc: "Your files never leave your device unless you compress them server-side." },
    { icon: Download, label: "Instant download", desc: "Click once and your file downloads immediately, no email needed." },
    { icon: RotateCcw, label: "Full control", desc: "Rotate images, reorder pages, pick margins — your PDF, your rules." },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between mx-auto px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <FileText className="h-5 w-5" />
            </div>
            <span className="font-bold tracking-tight text-lg">DocuFlow</span>
          </Link>

          <div className="flex items-center gap-2">
            <Show when="signed-out">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/sign-in")}>
                Sign In
              </Button>
              <Button size="sm" onClick={() => setLocation("/sign-up")}>
                Get Started
              </Button>
            </Show>
            <Show when="signed-in">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/history")}>
                History
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ redirectUrl: `${basePath}/` })}
              >
                Sign Out
              </Button>
            </Show>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 bg-gradient-to-b from-blue-50/60 via-background to-background">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide uppercase">
            <Zap className="h-3 w-3" />
            Free · No signup required
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.08] max-w-3xl">
            Your files.
            <br />
            <span className="text-primary">Your workflow.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
            DocuFlow lets you convert images to PDF and compress documents —
            fast, private, and right in your browser.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="gap-2 px-7 text-base" onClick={() => setLocation("/convert")}>
              <FileText className="h-4 w-4" />
              Image to PDF
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2 px-7 text-base" onClick={() => setLocation("/compress")}>
              <FileUp className="h-4 w-4" />
              Compress Files
            </Button>
          </div>
        </section>

        {/* Feature cards */}
        <section className="container mx-auto px-4 md:px-8 pb-20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <Link key={f.href} href={f.href}>
                <div className={`group relative h-full rounded-2xl border-2 bg-card p-7 flex flex-col gap-4 transition-all duration-200 cursor-pointer hover:shadow-md ${f.accent}`}>
                  {f.badge && (
                    <span className="absolute top-4 right-4 text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {f.badge}
                    </span>
                  )}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${f.color}`}>
                    <f.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">{f.label}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open tool <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Perks */}
        <section className="bg-muted/30 border-t border-b py-16">
          <div className="container mx-auto px-4 md:px-8">
            <h3 className="text-2xl font-bold text-center mb-10 text-foreground">
              Why DocuFlow?
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {perks.map((p) => (
                <div key={p.label} className="flex flex-col items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <p.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{p.label}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section className="container mx-auto px-4 md:px-8 py-20 text-center">
          <h3 className="text-3xl font-extrabold tracking-tight mb-3">Ready to start?</h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Create a free account to track your conversion history, or jump straight in — no login needed.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Show when="signed-out">
              <Button size="lg" className="gap-2 px-8" onClick={() => setLocation("/sign-up")}>
                Create free account
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-8" onClick={() => setLocation("/convert")}>
                Try without signing up
              </Button>
            </Show>
            <Show when="signed-in">
              <Button size="lg" className="gap-2 px-8" onClick={() => setLocation("/convert")}>
                <FileText className="h-4 w-4" />
                Go to Image to PDF
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-8" onClick={() => setLocation("/compress")}>
                <FileUp className="h-4 w-4" />
                Compress a file
              </Button>
            </Show>
          </div>
        </section>
      </main>

      {/* Stats + footer */}
      <div>
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
