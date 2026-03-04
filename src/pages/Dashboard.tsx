import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FolderKanban, Clock, CheckCircle2, AlertTriangle, TrendingUp, Users,
  PauseCircle, FileCheck, ChevronRight, BarChart3
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useNavigate } from "react-router-dom";

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(220, 60%, 60%)", sales_approved: "hsl(210, 70%, 55%)",
  accounts_approved: "hsl(200, 70%, 55%)", admin_reviewed: "hsl(190, 60%, 50%)",
  open: "hsl(200, 80%, 50%)", qc_completed: "hsl(200, 70%, 55%)",
  kick_off_scheduled: "hsl(180, 60%, 45%)", site_ready: "hsl(160, 60%, 45%)",
  on_hold: "hsl(0, 72%, 51%)", scheduled: "hsl(38, 92%, 50%)",
  in_progress: "hsl(38, 80%, 55%)", client_signing_pending: "hsl(30, 80%, 55%)",
  client_signed: "hsl(152, 60%, 40%)",
  closed: "hsl(152, 70%, 35%)", completed: "hsl(152, 70%, 35%)",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sales_approved: "Sales Approved", accounts_approved: "Accounts Approved",
  admin_reviewed: "Admin Reviewed",
  open: "Open", qc_completed: "QC Completed", kick_off_scheduled: "Kick-Off Scheduled",
  site_ready: "Site Ready", on_hold: "On Hold", scheduled: "Scheduled",
  in_progress: "In Progress", client_signing_pending: "Client Signing Pending",
  client_signed: "Client Signed Pending Approval",
  closed: "Completed", completed: "Completed",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "hsl(200, 60%, 60%)", medium: "hsl(38, 80%, 55%)",
  high: "hsl(25, 90%, 55%)", critical: "hsl(0, 72%, 51%)",
};

const LIFECYCLE_STAGES = [
  "draft", "sales_approved", "accounts_approved", "admin_reviewed",
  "open", "qc_completed", "kick_off_scheduled", "site_ready",
  "scheduled", "in_progress", "client_signing_pending",
  "client_signed", "closed"
];

export default function Dashboard() {
  const { isProjectManager } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, in_progress: 0, closed: 0, overdue: 0, on_hold: 0, qc_pending: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [engineerCount, setEngineerCount] = useState(0);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data: projects } = await supabase.from("projects").select("*");
      setAllProjects(projects ?? []);
      if (isProjectManager) {
        const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "engineer");
        setEngineerCount(count ?? 0);
      }
    };
    fetchData();
  }, [isProjectManager]);

  useEffect(() => {
    let filtered = allProjects;
    if (dateFrom) filtered = filtered.filter(p => (p.start_date && p.start_date >= dateFrom) || (p.deadline && p.deadline >= dateFrom));
    if (dateTo) filtered = filtered.filter(p => (p.start_date && p.start_date <= dateTo) || (p.deadline && p.deadline <= dateTo));

    const now = new Date().toISOString().split("T")[0];
    setStats({
      total: filtered.length,
      in_progress: filtered.filter(p => p.status === "in_progress").length,
      closed: filtered.filter(p => p.status === "closed" || p.status === "completed").length,
      overdue: filtered.filter(p => p.deadline && p.deadline < now && p.status !== "closed" && p.status !== "completed").length,
      on_hold: filtered.filter(p => p.status === "on_hold").length,
      qc_pending: filtered.filter(p => p.status === "open").length,
    });
    setRecentProjects(filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5));
  }, [allProjects, dateFrom, dateTo]);

  // Pie data
  const filtered = dateFrom || dateTo
    ? allProjects.filter(p => {
        let ok = true;
        if (dateFrom) ok = ok && ((p.start_date && p.start_date >= dateFrom) || (p.deadline && p.deadline >= dateFrom));
        if (dateTo) ok = ok && ((p.start_date && p.start_date <= dateTo) || (p.deadline && p.deadline <= dateTo));
        return ok;
      })
    : allProjects;

  const statusCounts: Record<string, number> = {};
  filtered.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });
  const pieData = Object.entries(statusCounts).filter(([, v]) => v > 0).map(([k, v]) => ({
    name: STATUS_LABELS[k] || k, value: v, color: STATUS_COLORS[k] || "hsl(200, 50%, 50%)",
  }));

  // Priority data
  const priorityCounts: Record<string, number> = {};
  filtered.forEach(p => { priorityCounts[p.priority] = (priorityCounts[p.priority] || 0) + 1; });
  const priorityData = Object.entries(priorityCounts).map(([k, v]) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1), value: v, fill: PRIORITY_COLORS[k] || "hsl(200, 50%, 50%)",
  }));

  // Lifecycle pipeline counts
  const pipelineData = LIFECYCLE_STAGES.map(s => ({
    stage: STATUS_LABELS[s] || s,
    count: statusCounts[s] || 0,
    color: STATUS_COLORS[s],
  }));

  // Average progress
  const avgProgress = filtered.length > 0 ? Math.round(filtered.reduce((sum, p) => sum + (p.progress_percentage || 0), 0) / filtered.length) : 0;

  const kpiCards = [
    { label: "Total Projects", value: stats.total, icon: FolderKanban, color: "text-primary" },
    { label: "In Progress", value: stats.in_progress, icon: TrendingUp, color: "text-warning" },
    { label: "Completed", value: stats.closed, icon: CheckCircle2, color: "text-success" },
    { label: "On Hold", value: stats.on_hold, icon: PauseCircle, color: "text-destructive" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
  ];
  if (isProjectManager) kpiCards.push({ label: "Engineers", value: engineerCount, icon: Users, color: "text-info" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of all projects and activity.</p>
      </div>

      <div className="flex items-center gap-3">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" placeholder="To" />
        {(dateFrom || dateTo) && <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${color}`}><Icon className="h-5 w-5" /></div>
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lifecycle Pipeline */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Project Lifecycle Pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1">
            {pipelineData.map((stage, i) => (
              <div key={stage.stage} className="flex items-center gap-1">
                <div className="flex flex-col items-center gap-1 min-w-[80px]">
                  <div className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: stage.color }}>
                    {stage.count}
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{stage.stage}</span>
                </div>
                {i < pipelineData.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Average Progress */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Average Project Progress</p>
            <span className="text-lg font-bold">{avgProgress}%</span>
          </div>
          <Progress value={avgProgress} className="h-3" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status Pie Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Projects by Status</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">No projects yet</div>
            )}
            <div className="flex flex-wrap gap-3 mt-2">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Priority Bar Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Projects by Priority</CardTitle></CardHeader>
          <CardContent>
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">No projects yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Projects</CardTitle></CardHeader>
        <CardContent>
          {recentProjects.length > 0 ? (
            <div className="space-y-3">
              {recentProjects.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/projects/${p.id}`)}>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.client_company || p.client_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <div className="h-1.5 w-16 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${p.progress_percentage}%` }} /></div>
                      <span>{p.progress_percentage}%</span>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{STATUS_LABELS[p.status] || p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">No projects yet</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
