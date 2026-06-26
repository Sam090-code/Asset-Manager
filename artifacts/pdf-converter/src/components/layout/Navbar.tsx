import { Link, useLocation } from "wouter";
import { FileUp, FileText, Info, ShieldCheck, LogIn, LogOut, User } from "lucide-react";
import { useClerk, useUser, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Navbar() {
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

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
