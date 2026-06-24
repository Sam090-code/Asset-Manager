import { useAdminGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FileDown, HardDrive, Zap, AlertCircle } from "lucide-react";
import { formatBytes } from "@/lib/utils";

function useAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

export default function AdminDashboard() {
  const token = useAdminToken();
  const { data, isLoading, error } = useAdminGetDashboard({
    request: { headers: { Authorization: `Bearer ${token}` } },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <AlertCircle className="h-10 w-10 mb-4" />
        <h2 className="text-xl font-semibold">Failed to load dashboard data</h2>
        <p className="text-muted-foreground mt-2">Check your connection or try logging in again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-500 font-medium">{data.activeUsers} active</span> / {data.suspendedUsers} suspended
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files Processed</CardTitle>
            <FileDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalFilesCompressed + data.totalPdfsGenerated}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.totalPdfsGenerated} PDFs / {data.totalFilesCompressed} Compressed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage Saved</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(data.totalBytesCompressed)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(data.storageUsedBytes)} currently in storage
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Compression Ratio</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.avgCompressionRatio.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.activeJobsCount} active jobs processing
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Original Size</TableHead>
                <TableHead>Compressed Size</TableHead>
                <TableHead>Saved %</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentActivity.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No recent activity found.
                  </TableCell>
                </TableRow>
              ) : (
                data.recentActivity.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.fileName}</TableCell>
                    <TableCell>
                      <Badge variant={item.type === 'pdf' ? "default" : "secondary"}>
                        {item.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatBytes(item.originalSize)}</TableCell>
                    <TableCell>{formatBytes(item.compressedSize)}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {item.compressionRatio}%
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{item.level}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
