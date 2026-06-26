import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileText, Lock } from "lucide-react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const authMutation = useAdminAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    authMutation.mutate(
      { data: { password } },
      {
        onSuccess: (data) => {
          localStorage.setItem("admin_token", data.token);
          setLocation("/admin/dashboard");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Authentication Failed",
            description: "Incorrect password. Please try again.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-muted">
        <CardHeader className="space-y-3 items-center text-center">
          <div className="bg-primary/10 p-3 rounded-full text-primary mb-2">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <CardDescription>
            Enter your credentials to access the DocuFlow back-office
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-md"
              disabled={authMutation.isPending}
            >
              {authMutation.isPending ? "Authenticating..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
