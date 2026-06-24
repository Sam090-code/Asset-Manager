import { useState } from "react";
import { useAdminGetReports } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatBytes } from "@/lib/utils";

function useAdminToken() {
  return localStorage.getItem("admin_token") ?? "";
}

export default function AdminAnalytics() {
  const token = useAdminToken();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  
  const { data, isLoading } = useAdminGetReports(
    { period },
    { request: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const totalCompressions = data?.data.reduce((acc, curr) => acc + curr.filesCompressed, 0) || 0;
  const totalBytesSaved = data?.data.reduce((acc, curr) => acc + curr.bytesSaved, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
        
        <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Last 7 Days</SelectItem>
            <SelectItem value="weekly">Last 4 Weeks</SelectItem>
            <SelectItem value="monthly">Last 6 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Files Processed</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {isLoading ? <Skeleton className="h-9 w-24" /> : totalCompressions.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Bytes Saved</CardDescription>
            <CardTitle className="text-3xl font-bold">
              {isLoading ? <Skeleton className="h-9 w-32" /> : formatBytes(totalBytesSaved)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Files Compressed</CardTitle>
            <CardDescription>Number of images processed over time</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {isLoading || !data ? (
              <Skeleton className="h-[300px] w-full ml-4" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar 
                      dataKey="filesCompressed" 
                      name="Files"
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Bytes Saved</CardTitle>
            <CardDescription>Storage reduction over time</CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {isLoading || !data ? (
              <Skeleton className="h-[300px] w-full ml-4" />
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.data} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      tickFormatter={(value) => formatBytes(value).replace(/\.\d+/, '')}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [formatBytes(value), 'Saved']}
                    />
                    <Bar 
                      dataKey="bytesSaved" 
                      name="Saved"
                      fill="#10b981" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
