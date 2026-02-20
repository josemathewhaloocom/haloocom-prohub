import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FolderKanban, Clock, CheckCircle2, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  open: "hsl(200, 80%, 50%)", qc_completed: "hsl(200, 70%, 55%)",
  kick_off_scheduled: "hsl(180, 60%, 45%)", site_ready: "hsl(160, 60%, 45%)",
  on_hold: "hsl(0, 72%, 51%)", scheduled: "hsl(38, 92%, 50%)",
  in_progress: "hsl(38, 80%, 55%)", client_signing_pending: "hsl(30, 80%, 55%)",
  client_signed: "hsl(152, 60%, 40%)", pending_admin_approval: "hsl(50, 80%, 50%)",
  closed: "hsl(152, 70%, 35%)",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open", qc_completed: "QC Completed", kick_off_scheduled: "Kick-Off Scheduled",
  site_ready: "Site Ready", on_hold: "On Hold", scheduled: "Scheduled",
  in_progress: "In Progress", client_signing_pending: "Client Signing Pending",
  client_signed: "Client Signed", pending_admin_approval: "Pending Approval", closed: "Closed",
};

export default function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState({ total: 0, in_progress: 0, closed: 0, overdue: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [engineerCount, setEngineerCount] = useState(0);
  const [allProjects, setAllProjects] = useState<any[]>([]);

  // Date filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data: projects } = await supabase.from("projects").select("*");
      setAllProjects(projects ?? []);

      if (role === "admin") {
        const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "engineer");
        setEngineerCount(count ?? 0);
      }
    };
    fetchData();
  }, [role]);

  useEffect(() => {
    let filtered = allProjects;
    if (dateFrom) filtered = filtered.filter(p => (p.start_date && p.start_date >= dateFrom) || (p.deadline && p.deadline >= dateFrom));
    if (dateTo) filtered = filtered.filter(p => (p.start_date && p.start_date <= dateTo) || (p.deadline && p.deadline <= dateTo));

    const now = new Date().toISOString().split("T")[0];
    setStats({
      total: filtered.length,
      in_progress: filtered.filter(p => p.status === "in_progress").length,
      closed: filtered.filter(p => p.status === "closed").length,
      overdue: filtered.filter(p => p.deadline && p.deadline < now && p.status !== "closed").length,
    });
    setRecentProjects(filtered.slice(0, 5));
  }, [allProjects, dateFrom, dateTo]);

  // Build pie data from all statuses
  const statusCounts: Record<string, number> = {};
  const filtered = dateFrom || dateTo
    ? allProjects.filter(p => {
        let ok = true;
        if (dateFrom) ok = ok && ((p.start_date && p.start_date >= dateFrom) || (p.deadline && p.deadline >= dateFrom));
        if (dateTo) ok = ok && ((p.start_date && p.start_date <= dateTo) || (p.deadline && p.deadline <= dateTo));
        return ok;
      })
    : allProjects;
  filtered.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });
  const pieData = Object.entries(statusCounts).filter(([, v]) => v > 0).map(([k, v]) => ({
    name: STATUS_LABELS[k] || k, value: v, color: STATUS_COLORS[k] || "hsl(200, 50%, 50%)",
  }));

  const kpiCards = [
    { label: "Total Projects", value: stats.total, icon: FolderKanban, color: "text-primary" },
    { label: "In Progress", value: stats.in_progress, icon: TrendingUp, color: "text-warning" },
    { label: "Closed", value: stats.closed, icon: CheckCircle2, color: "text-success" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
  ];
  if (role === "admin") kpiCards.push({ label: "Engineers", value: engineerCount, icon: Users, color: "text-info" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of all projects and activity.</p>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" placeholder="To" />
        {(dateFrom || dateTo) && <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${color}`}><Icon className="h-5 w-5" /></div>
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Projects</CardTitle></CardHeader>
          <CardContent>
            {recentProjects.length > 0 ? (
              <div className="space-y-3">
                {recentProjects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.client_company || p.client_name}</p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{STATUS_LABELS[p.status] || p.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">No projects yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
