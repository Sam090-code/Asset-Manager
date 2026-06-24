import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Compress from "@/pages/compress";
import About from "@/pages/about";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminAnalytics from "@/pages/admin/analytics";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Layout } from "@/components/layout/Layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Admin Routes */}
      <Route path="/admin" component={AdminLogin} />
      
      <Route path="/admin/dashboard">
        <AdminLayout>
          <AdminDashboard />
        </AdminLayout>
      </Route>
      <Route path="/admin/users">
        <AdminLayout>
          <AdminUsers />
        </AdminLayout>
      </Route>
      <Route path="/admin/analytics">
        <AdminLayout>
          <AdminAnalytics />
        </AdminLayout>
      </Route>

      {/* Public Routes */}
      <Route path="/">
        <Layout><Home /></Layout>
      </Route>
      <Route path="/compress">
        <Layout><Compress /></Layout>
      </Route>
      <Route path="/about">
        <Layout><About /></Layout>
      </Route>

      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
