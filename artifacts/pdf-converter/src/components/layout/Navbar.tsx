import { Link, useLocation } from "wouter";
import { FileUp, FileText, Info, ShieldCheck } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Image to PDF", icon: FileText },
    { href: "/compress", label: "Compressor", icon: FileUp },
    { href: "/about", label: "About", icon: Info },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center mx-auto px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <FileText className="h-5 w-5" />
          </div>
          <span className="font-bold tracking-tight text-lg">DocuFlow</span>
        </Link>
        <nav className="flex items-center gap-1 md:gap-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline-block">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <Link
            href="/admin"
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location.startsWith("/admin")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden md:inline-block">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
