import { Link, useLocation } from "wouter";
import { FileUp, FileText, Info, ShieldCheck, LogIn, LogOut, User, History, Sparkles, Film, Zap, FileArchive, ArrowRight, Merge } from "lucide-react";
import { useClerk, useUser, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const OTHER_FEATURES = [
  {
    href: "/video-compress",
    label: "Video Compressor",
    description: "Shrink any video right in your browser — no upload needed.",
    icon: Film,
    badge: "New",
    color: "bg-rose-50 text-rose-600",
  },
  {
    href: "/pdf-merge",
    label: "PDF Merger",
    description: "Combine multiple PDFs into one file — drag to reorder pages.",
    icon: Merge,
    badge: undefined,
    color: "bg-violet-50 text-violet-600",
  },
];

function ExploreMenu() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0 shadow-sm"
          aria-label="Explore other features"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Explore</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 rounded-2xl shadow-xl border overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <p className="font-bold text-sm">Explore our other features</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            More tools from DocuFlow, just a click away.
          </p>
        </div>

        {/* Feature cards */}
        <div className="p-3 space-y-2">
          {OTHER_FEATURES.map((f) => (
            <button
              key={f.href}
              onClick={() => {
                setOpen(false);
                setLocation(f.href);
              }}
              className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors text-left group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}`}>
                <f.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{f.label}</p>
                  {f.badge && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded-full">
                      {f.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{f.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground mt-0.5 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t bg-muted/20 text-center">
          <p className="text-[11px] text-muted-foreground">More tools coming soon</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const navItems = [
    { href: "/convert", label: "Image to PDF", icon: FileText },
    { href: "/compress", label: "Compressor", icon: FileUp },
    { href: "/about", label: "About", icon: Info },
  ];

  const isSignedIn = !!user;

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

        <Show when="signed-in">
          <Link
            href="/history"
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ml-2 ${
              location === "/history"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <History className="h-4 w-4" />
            <span className="hidden md:inline-block">History</span>
          </Link>
        </Show>

        <div className="ml-auto flex items-center gap-2">
            <Show when="signed-out">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setLocation("/sign-in")}
            >
              <LogIn className="h-4 w-4 mr-1.5" />
              <span className="hidden md:inline">Sign In</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setLocation("/sign-up")}
            >
              <span>Get Started</span>
            </Button>
          </Show>

          <Show when="signed-in">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 px-2">
                  {user?.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={user.fullName ?? "User"}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <span className="hidden md:inline text-sm font-medium max-w-[120px] truncate">
                    {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold truncate">{user?.fullName ?? "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.emailAddresses?.[0]?.emailAddress}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => signOut({ redirectUrl: `${basePath}/` })}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Show>

          {/* Explore dots menu — always visible */}
          <ExploreMenu />
        </div>
      </div>
    </header>
  );
}
