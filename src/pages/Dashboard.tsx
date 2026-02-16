import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderKanban, Clock, CheckCircle2, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "hsl(200, 80%, 50%)",
  in_progress: "hsl(38, 92%, 50%)",
  on_hold: "hsl(0, 72%, 51%)",
  completed: "hsl(152, 60%, 40%)",
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
};

export default function Dashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState({ total: 0, upcoming: 0, in_progress: 0, on_hold: 0, completed: 0, overdue: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [engineerCount, setEngineerCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const { data: projects } = await supabase.from("projects").select("*");
      if (projects) {
        const now = new Date().toISOString().split("T")[0];
        setStats({
          total: projects.length,
          upcoming: projects.filter((p) => p.status === "upcoming").length,
          in_progress: projects.filter((p) => p.status === "in_progress").length,
          on_hold: projects.filter((p) => p.status === "on_hold").length,
          completed: projects.filter((p) => p.status === "completed").length,
          overdue: projects.filter((p) => p.deadline && p.deadline < now && p.status !== "completed").length,
        });
        setRecentProjects(projects.slice(0, 5));
      }

      if (role === "admin") {
        const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "engineer");
        setEngineerCount(count ?? 0);
      }
    };
    fetchData();
  }, [role]);

  const pieData = [
    { name: "Upcoming", value: stats.upcoming, color: STATUS_COLORS.upcoming },
    { name: "In Progress", value: stats.in_progress, color: STATUS_COLORS.in_progress },
    { name: "On Hold", value: stats.on_hold, color: STATUS_COLORS.on_hold },
    { name: "Completed", value: stats.completed, color: STATUS_COLORS.completed },
  ].filter((d) => d.value > 0);

  const kpiCards = [
    { label: "Total Projects", value: stats.total, icon: FolderKanban, color: "text-primary" },
    { label: "In Progress", value: stats.in_progress, icon: TrendingUp, color: "text-warning" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-success" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  if (role === "admin") {
    kpiCards.push({ label: "Engineers", value: engineerCount, icon: Users, color: "text-info" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of all projects and activity.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
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
          <CardHeader>
            <CardTitle className="text-base">Recent Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {recentProjects.length > 0 ? (
              <div className="space-y-3">
                {recentProjects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.client_company || p.client_name}</p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {STATUS_LABELS[p.status] || p.status}
                    </Badge>
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
