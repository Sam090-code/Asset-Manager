import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, BarChart3, LogOut, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token && location !== "/admin") {
      setLocation("/admin");
    }
  }, [location, setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setLocation("/admin");
  };

  const navItems = [
    { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-muted/20">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-background border-r flex flex-col">
        <div className="p-6 border-b">
          <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold text-xl">
            <FileText className="h-6 w-6" />
            DocuFlow Admin
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
