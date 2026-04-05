import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FolderKanban, CheckCircle2, Clock, TrendingUp, Headset, PauseCircle, ChevronRight,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", open: "Open", in_progress: "In Progress", on_hold: "On Hold",
  closed: "Completed", completed: "Completed", scheduled: "Scheduled",
  site_ready: "Site Ready", qc_completed: "QC Completed",
};

export default function EngineerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Get assigned projects
      const { data: assignments } = await supabase
        .from("project_assignments")
        .select("project_id")
        .eq("engineer_id", user.id);
      const pids = (assignments ?? []).map(a => a.project_id);
      let projs: any[] = [];
      if (pids.length > 0) {
        const { data } = await supabase.from("projects").select("*").in("id", pids);
        projs = data ?? [];
      }
      setProjects(projs);

      // Get tickets assigned/created by me
      const { data: tix } = await supabase
        .from("support_tickets")
        .select("*")
        .or(`assigned_engineer_id.eq.${user.id},created_by.eq.${user.id}`);
      setTickets(tix ?? []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const projectStats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter(p => p.status === "in_progress").length;
    const completed = projects.filter(p => p.status === "closed" || p.status === "completed").length;
    const onHold = projects.filter(p => p.status === "on_hold").length;
    const avgProgress = total > 0 ? Math.round(projects.reduce((s, p) => s + (p.progress_percentage || 0), 0) / total) : 0;
    return { total, inProgress, completed, onHold, avgProgress };
  }, [projects]);

  const ticketStats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status !== "Closed").length;
    const closed = tickets.filter(t => t.status === "Closed").length;
    return { total, open, closed };
  }, [tickets]);

  // Project status pie
  const statusPie = useMemo(() => {
    const m: Record<string, number> = {};
    projects.forEach(p => { m[p.status] = (m[p.status] || 0) + 1; });
    const colors = ["hsl(200, 70%, 50%)", "hsl(38, 80%, 55%)", "hsl(152, 60%, 40%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)"];
    return Object.entries(m).filter(([, v]) => v > 0).map(([k, v], i) => ({
      name: STATUS_LABELS[k] || k, value: v, color: colors[i % colors.length],
    }));
  }, [projects]);

  const kpis = [
    { label: "My Projects", value: projectStats.total, icon: FolderKanban, color: "text-primary" },
    { label: "In Progress", value: projectStats.inProgress, icon: TrendingUp, color: "text-warning" },
    { label: "Completed", value: projectStats.completed, icon: CheckCircle2, color: "text-success" },
    { label: "On Hold", value: projectStats.onHold, icon: PauseCircle, color: "text-destructive" },
    { label: "My Tickets", value: ticketStats.total, icon: Headset, color: "text-info" },
    { label: "Open Tickets", value: ticketStats.open, icon: Clock, color: "text-warning" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engineer Dashboard</h1>
        <p className="text-muted-foreground">Your assigned projects and support ticket overview.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${color}`}><Icon className="h-5 w-5" /></div>
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Avg Progress */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Average Project Progress</p>
            <span className="text-lg font-bold">{projectStats.avgProgress}%</span>
          </div>
          <Progress value={projectStats.avgProgress} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">My Projects by Status</CardTitle></CardHeader>
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
            ) : <div className="flex h-[250px] items-center justify-center text-muted-foreground">No projects</div>}
            <div className="flex flex-wrap gap-3 mt-2">
              {statusPie.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} /> {d.name} ({d.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* My projects list */}
        <Card>
          <CardHeader><CardTitle className="text-base">My Projects</CardTitle></CardHeader>
          <CardContent>
            {projects.length > 0 ? (
              <div className="space-y-2">
                {projects.slice(0, 8).map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/projects/${p.id}`)}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.client_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{p.progress_percentage}%</span>
                      <Badge variant="outline" className="text-xs capitalize">{STATUS_LABELS[p.status] || p.status}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="py-8 text-center text-muted-foreground">No assigned projects</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
