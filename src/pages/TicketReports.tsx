import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TicketIcon, Users, Clock, BarChart3 } from "lucide-react";

interface Ticket {
  id: string; ticket_id: string; project_id: string;
  client_name: string; status: string; priority: string;
  assigned_engineer_id: string | null; created_by: string;
  created_at: string; updated_at: string; closed_at: string | null;
  department: string; category: string;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#8884d8", "#82ca9d", "#ffc658"];

export default function TicketReports() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [projectMap, setProjectMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [tRes, pRes, projRes] = await Promise.all([
        supabase.from("support_tickets" as any).select("*"),
        supabase.from("profiles").select("id, first_name, last_name"),
        supabase.from("projects").select("id, name"),
      ]);
      setTickets((tRes.data as any) ?? []);
      const pm: Record<string, string> = {};
      ((pRes.data ?? []) as any[]).forEach(p => { pm[p.id] = `${p.first_name} ${p.last_name}`.trim(); });
      setProfileMap(pm);
      const prm: Record<string, string> = {};
      ((projRes.data ?? []) as any[]).forEach(p => { prm[p.id] = p.name; });
      setProjectMap(prm);
      setLoading(false);
    })();
  }, []);

  // Client-wise summary
  const clientSummary = useMemo(() => {
    const map: Record<string, { total: number; open: number; closed: number; critical: number }> = {};
    tickets.forEach(t => {
      if (!map[t.client_name]) map[t.client_name] = { total: 0, open: 0, closed: 0, critical: 0 };
      map[t.client_name].total++;
      if (t.status !== "Closed") map[t.client_name].open++;
      if (t.status === "Closed") map[t.client_name].closed++;
      if (t.priority === "Critical") map[t.client_name].critical++;
    });
    return Object.entries(map).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total);
  }, [tickets]);

  // Engineer performance
  const engineerPerf = useMemo(() => {
    const map: Record<string, { assigned: number; resolved: number; totalTAT: number; resolvedCount: number }> = {};
    tickets.forEach(t => {
      const engId = t.assigned_engineer_id || t.created_by;
      const engName = profileMap[engId] || "Unknown";
      if (!map[engName]) map[engName] = { assigned: 0, resolved: 0, totalTAT: 0, resolvedCount: 0 };
      map[engName].assigned++;
      if (t.status === "Closed" && t.closed_at) {
        map[engName].resolved++;
        const tat = (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        map[engName].totalTAT += tat;
        map[engName].resolvedCount++;
      }
    });
    return Object.entries(map).map(([name, d]) => ({
      name, assigned: d.assigned, resolved: d.resolved,
      avgTAT: d.resolvedCount ? (d.totalTAT / d.resolvedCount).toFixed(1) : "—",
    })).sort((a, b) => b.assigned - a.assigned);
  }, [tickets, profileMap]);

  // Status distribution for pie chart
  const statusDist = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => { map[t.status] = (map[t.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  // Priority distribution
  const priorityDist = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach(t => { map[t.priority] = (map[t.priority] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const totalOpen = tickets.filter(t => t.status !== "Closed").length;
  const totalClosed = tickets.filter(t => t.status === "Closed").length;
  const totalCritical = tickets.filter(t => t.priority === "Critical" && t.status !== "Closed").length;

  const chartConfig = {
    assigned: { label: "Assigned", color: "hsl(var(--primary))" },
    resolved: { label: "Resolved", color: "hsl(var(--chart-2))" },
    total: { label: "Total", color: "hsl(var(--primary))" },
    open: { label: "Open", color: "hsl(var(--chart-3))" },
    closed: { label: "Closed", color: "hsl(var(--chart-2))" },
  };

  if (loading) return <p className="text-center py-8 text-muted-foreground">Loading reports...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ticket Reports</h1>
        <p className="text-muted-foreground">Insights and analytics for support tickets.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold">{tickets.length}</p>
          <p className="text-xs text-muted-foreground">Total Tickets</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{totalOpen}</p>
          <p className="text-xs text-muted-foreground">Open</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totalClosed}</p>
          <p className="text-xs text-muted-foreground">Closed</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-destructive">{totalCritical}</p>
          <p className="text-xs text-muted-foreground">Critical (Open)</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="client">
        <TabsList>
          <TabsTrigger value="client">Client Summary</TabsTrigger>
          <TabsTrigger value="engineer">Engineer Performance</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="client">
          <Card>
            <CardHeader><CardTitle className="text-base">Client-Wise Ticket Summary</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Open</TableHead>
                    <TableHead className="text-center">Closed</TableHead>
                    <TableHead className="text-center">Critical</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientSummary.map(c => (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-center">{c.total}</TableCell>
                      <TableCell className="text-center">{c.open}</TableCell>
                      <TableCell className="text-center">{c.closed}</TableCell>
                      <TableCell className="text-center">
                        {c.critical > 0 ? <Badge variant="destructive">{c.critical}</Badge> : "0"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {clientSummary.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engineer">
          <Card>
            <CardHeader><CardTitle className="text-base">Engineer Performance & TAT</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Engineer</TableHead>
                    <TableHead className="text-center">Assigned</TableHead>
                    <TableHead className="text-center">Resolved</TableHead>
                    <TableHead className="text-center">Avg TAT (hrs)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {engineerPerf.map(e => (
                    <TableRow key={e.name}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-center">{e.assigned}</TableCell>
                      <TableCell className="text-center">{e.resolved}</TableCell>
                      <TableCell className="text-center">{e.avgTAT}</TableCell>
                    </TableRow>
                  ))}
                  {engineerPerf.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No data.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {engineerPerf.length > 0 && (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <BarChart data={engineerPerf}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="assigned" fill="var(--color-assigned)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resolved" fill="var(--color-resolved)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Status Distribution</CardTitle></CardHeader>
              <CardContent>
                {statusDist.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <PieChart>
                      <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}`}>
                        {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                ) : <p className="text-center py-8 text-muted-foreground">No data.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Priority Distribution</CardTitle></CardHeader>
              <CardContent>
                {priorityDist.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart data={priorityDist}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                        {priorityDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : <p className="text-center py-8 text-muted-foreground">No data.</p>}
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Client-Wise Ticket Volume</CardTitle></CardHeader>
              <CardContent>
                {clientSummary.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <BarChart data={clientSummary.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="open" stackId="a" fill="var(--color-open)" />
                      <Bar dataKey="closed" stackId="a" fill="var(--color-closed)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : <p className="text-center py-8 text-muted-foreground">No data.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
