import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FolderKanban, CheckCircle2, TrendingUp, Users, Headset, AlertTriangle, DollarSign,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(220, 60%, 60%)", open: "hsl(200, 80%, 50%)", in_progress: "hsl(38, 80%, 55%)",
  on_hold: "hsl(0, 72%, 51%)", closed: "hsl(152, 70%, 35%)", completed: "hsl(152, 70%, 35%)",
};

export default function CEODashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [engineerCount, setEngineerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: p }, { data: t }, { count }] = await Promise.all([
        supabase.from("projects").select("*"),
        supabase.from("support_tickets").select("id, status, priority, created_at, closed_at"),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "engineer"),
      ]);
      setProjects(p ?? []);
      setTickets(t ?? []);
      setEngineerCount(count ?? 0);
      setLoading(false);
    };
    fetch();
  }, []);

  const now = new Date().toISOString().split("T")[0];

  const stats = useMemo(() => ({
    totalProjects: projects.length,
    activeProjects: projects.filter(p => !["closed", "completed", "draft"].includes(p.status)).length,
    completedProjects: projects.filter(p => p.status === "closed" || p.status === "completed").length,
    overdueProjects: projects.filter(p => p.deadline && p.deadline < now && !["closed", "completed"].includes(p.status)).length,
    totalTickets: tickets.length,
    openTickets: tickets.filter(t => t.status !== "Closed").length,
    avgProgress: projects.length > 0 ? Math.round(projects.reduce((s, p) => s + (p.progress_percentage || 0), 0) / projects.length) : 0,
    totalBudget: projects.reduce((s, p) => s + (p.budget || 0), 0),
    slaExpiring: projects.filter(p => p.sla_end_date && p.sla_end_date >= now && p.sla_end_date <= new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]).length,
  }), [projects, tickets, now]);

  const statusPie = useMemo(() => {
    const m: Record<string, number> = {};
    projects.forEach(p => { m[p.status] = (m[p.status] || 0) + 1; });
    const colors = ["hsl(200, 70%, 50%)", "hsl(38, 80%, 55%)", "hsl(152, 60%, 40%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)", "hsl(330, 60%, 50%)"];
    return Object.entries(m).filter(([, v]) => v > 0).map(([k, v], i) => ({
      name: k.replace(/_/g, " "), value: v, color: STATUS_COLORS[k] || colors[i % colors.length],
    }));
  }, [projects]);

  const kpis = [
    { label: "Total Projects", value: stats.totalProjects, icon: FolderKanban, color: "text-primary" },
    { label: "Active Projects", value: stats.activeProjects, icon: TrendingUp, color: "text-warning" },
    { label: "Completed", value: stats.completedProjects, icon: CheckCircle2, color: "text-success" },
    { label: "Overdue", value: stats.overdueProjects, icon: AlertTriangle, color: "text-destructive" },
    { label: "Engineers", value: engineerCount, icon: Users, color: "text-info" },
    { label: "Open Tickets", value: stats.openTickets, icon: Headset, color: "text-warning" },
    { label: "SLA Expiring", value: stats.slaExpiring, icon: AlertTriangle, color: "text-destructive" },
    { label: "Total Budget", value: `₹${(stats.totalBudget / 100000).toFixed(1)}L`, icon: DollarSign, color: "text-primary" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CEO Dashboard</h1>
        <p className="text-muted-foreground">Organization-wide overview of projects, tickets, and resources.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${color}`}><Icon className="h-5 w-5" /></div>
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{typeof value === "number" ? value : value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Organization Average Progress</p>
            <span className="text-lg font-bold">{stats.avgProgress}%</span>
          </div>
          <Progress value={stats.avgProgress} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Projects by Status</CardTitle></CardHeader>
          <CardContent>
            {statusPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[250px] items-center justify-center text-muted-foreground">No data</div>}
            <div className="flex flex-wrap gap-3 mt-2">
              {statusPie.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs capitalize">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} /> {d.name} ({d.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Ticket Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-3xl font-bold">{stats.totalTickets}</p><p className="text-sm text-muted-foreground">Total</p></div>
              <div><p className="text-3xl font-bold text-warning">{stats.openTickets}</p><p className="text-sm text-muted-foreground">Open</p></div>
              <div><p className="text-3xl font-bold text-success">{stats.totalTickets - stats.openTickets}</p><p className="text-sm text-muted-foreground">Closed</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
