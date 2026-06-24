import { useState } from "react";
import { 
  useAdminListUsers, 
  getAdminListUsersQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Trash2, ShieldCheck, UserPlus } from "lucide-react";

function useAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

export default function AdminUsers() {
  const token = useAdminToken();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: users, isLoading } = useAdminListUsers({
    request: { headers: { Authorization: `Bearer ${token}` } },
  });

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newUserName, email: newUserEmail, role: "user" }),
      });
      
      if (!res.ok) throw new Error("Failed to create user");
      
      toast({ title: "User created successfully" });
      setIsAddUserOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to create user" });
    }
  };

  const handleUpdateStatus = async (userId: number, status: "active" | "suspended") => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      
      if (!res.ok) throw new Error("Failed to update status");
      
      toast({ title: `User ${status} successfully` });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to update user status" });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error("Failed to delete user");
      
      toast({ title: "User deleted successfully" });
      queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to delete user" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Users Management</h1>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account manually.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    required 
                    value={newUserName} 
                    onChange={(e) => setNewUserName(e.target.value)} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    value={newUserEmail} 
                    onChange={(e) => setNewUserEmail(e.target.value)} 
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
                <Button type="submit">Create User</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">PDFs</TableHead>
              <TableHead className="text-right">Compressed</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : !users || users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'secondary' : 'destructive'} className={user.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{user.pdfsGenerated}</TableCell>
                  <TableCell className="text-right">{user.filesCompressed}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {user.status === 'active' ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={() => handleUpdateStatus(user.id, "suspended")}
                        >
                          <ShieldAlert className="h-3 w-3 mr-1" />
                          Suspend
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                          onClick={() => handleUpdateStatus(user.id, "active")}
                        >
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          Activate
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
