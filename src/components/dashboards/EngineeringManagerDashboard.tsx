import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wrench, AlertTriangle, CheckCircle2, Clock, TrendingUp, Users, PauseCircle,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useNavigate } from "react-router-dom";

const STATUS_COLORS: Record<string, string> = {
  Open: "hsl(200, 80%, 50%)", "In-progress": "hsl(38, 80%, 55%)",
  Hold: "hsl(25, 90%, 55%)", "Awaiting Client Confirmation": "hsl(280, 60%, 50%)",
  Closed: "hsl(152, 70%, 35%)",
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "hsl(0, 72%, 51%)", High: "hsl(25, 90%, 55%)",
  Moderate: "hsl(38, 80%, 55%)", Low: "hsl(200, 60%, 60%)",
};

const COLORS_PALETTE = ["hsl(200, 70%, 50%)", "hsl(152, 60%, 40%)", "hsl(38, 80%, 55%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)", "hsl(330, 60%, 50%)"];

export default function EngineeringManagerDashboard() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [engineerIds, setEngineerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: tix }, { data: profs }, { data: roles }] = await Promise.all([
        supabase.from("support_tickets").select("*"),
        supabase.from("profiles").select("id, first_name, last_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const all = tix ?? [];
      setAllTickets(all);
      // Filter to engineering team tickets or tickets assigned to engineering team
      const engIds = new Set(
        ((roles as any[]) ?? []).filter(r => r.role === "engineering" || r.role === "engineering_manager").map(r => r.user_id)
      );
      setEngineerIds(engIds);
      setTickets(all.filter((t: any) =>
        t.team === "engineering"
      ));
      const m: Record<string, any> = {};
      (profs ?? []).forEach(p => { m[p.id] = p; });
      setProfiles(m);
      setLoading(false);
    };
    fetch();
  }, []);

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t => t.status === "Open").length;
    const inProgress = tickets.filter(t => t.status === "In-progress").length;
    const onHold = tickets.filter(t => t.status === "Hold").length;
    const closed = tickets.filter(t => t.status === "Closed").length;
    const critical = tickets.filter(t => t.priority === "Critical" && t.status !== "Closed").length;
    return { total, open, inProgress, onHold, closed, critical };
  }, [tickets]);

  const statusPie = useMemo(() => {
    const m: Record<string, number> = {};
    tickets.forEach(t => { m[t.status] = (m[t.status] || 0) + 1; });
    return Object.entries(m).filter(([, v]) => v > 0).map(([k, v]) => ({
      name: k, value: v, color: STATUS_COLORS[k] || "hsl(200, 50%, 50%)",
    }));
  }, [tickets]);

  const priorityPie = useMemo(() => {
    const m: Record<string, number> = {};
    tickets.forEach(t => { m[t.priority] = (m[t.priority] || 0) + 1; });
    return Object.entries(m).filter(([, v]) => v > 0).map(([k, v]) => ({
      name: k, value: v, color: PRIORITY_COLORS[k] || "hsl(200, 50%, 50%)",
    }));
  }, [tickets]);

  const engineerPerf = useMemo(() => {
    const m: Record<string, { total: number; closed: number; totalTatMs: number; closedCount: number }> = {};
    tickets.forEach(t => {
      const eid = t.assigned_engineer_id;
      if (!eid || !engineerIds.has(eid)) return;
      if (!m[eid]) m[eid] = { total: 0, closed: 0, totalTatMs: 0, closedCount: 0 };
      m[eid].total++;
      if (t.status === "Closed" && t.closed_at) {
        m[eid].closed++;
        m[eid].closedCount++;
        m[eid].totalTatMs += new Date(t.closed_at).getTime() - new Date(t.created_at).getTime();
      }
    });
    return Object.entries(m).map(([id, d]) => {
      const p = profiles[id];
      const name = p ? `${p.first_name} ${p.last_name}`.trim() : id.slice(0, 8);
      const avgTatHrs = d.closedCount > 0 ? Math.round(d.totalTatMs / d.closedCount / 3600000) : 0;
      return { name, total: d.total, closed: d.closed, open: d.total - d.closed, avgTatHrs };
    }).sort((a, b) => b.total - a.total);
  }, [tickets, profiles, engineerIds]);

  const clientVolume = useMemo(() => {
    const m: Record<string, number> = {};
    tickets.forEach(t => { m[t.client_name] = (m[t.client_name] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  const recentOpen = useMemo(() => {
    return tickets
      .filter(t => t.status !== "Closed")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);
  }, [tickets]);

  const kpis = [
    { label: "Engineering Tickets", value: stats.total, icon: Wrench, color: "text-primary" },
    { label: "Open", value: stats.open, icon: TrendingUp, color: "text-info" },
    { label: "In Progress", value: stats.inProgress, icon: Clock, color: "text-warning" },
    { label: "On Hold", value: stats.onHold, icon: PauseCircle, color: "text-muted-foreground" },
    { label: "Closed", value: stats.closed, icon: CheckCircle2, color: "text-success" },
    { label: "Critical (Open)", value: stats.critical, icon: AlertTriangle, color: "text-destructive" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engineering Manager Dashboard</h1>
        <p className="text-muted-foreground">Engineering team ticket analytics, performance, and cross-team overview.</p>
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

      {/* Cross-team summary */}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Engineering Tickets by Status</CardTitle></CardHeader>
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
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} /> {d.name} ({d.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Engineering Tickets by Priority</CardTitle></CardHeader>
          <CardContent>
            {priorityPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={priorityPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {priorityPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[250px] items-center justify-center text-muted-foreground">No data</div>}
            <div className="flex flex-wrap gap-3 mt-2">
              {priorityPie.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} /> {d.name} ({d.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Engineer Performance</CardTitle></CardHeader>
        <CardContent>
          {engineerPerf.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Engineer</th>
                    <th className="py-2 pr-4 text-center">Total</th>
                    <th className="py-2 pr-4 text-center">Open</th>
                    <th className="py-2 pr-4 text-center">Closed</th>
                    <th className="py-2 text-center">Avg TAT (hrs)</th>
                  </tr>
                </thead>
                <tbody>
                  {engineerPerf.map(e => (
                    <tr key={e.name} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{e.name}</td>
                      <td className="py-2 pr-4 text-center">{e.total}</td>
                      <td className="py-2 pr-4 text-center">{e.open}</td>
                      <td className="py-2 pr-4 text-center">{e.closed}</td>
                      <td className="py-2 text-center">{e.avgTatHrs || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="py-8 text-center text-muted-foreground">No engineering ticket data yet</div>}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top Clients by Ticket Volume</CardTitle></CardHeader>
          <CardContent>
            {clientVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={clientVolume} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {clientVolume.map((_, i) => <Cell key={i} fill={COLORS_PALETTE[i % COLORS_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[250px] items-center justify-center text-muted-foreground">No data</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent Open Engineering Tickets</CardTitle></CardHeader>
          <CardContent>
            {recentOpen.length > 0 ? (
              <div className="space-y-2">
                {recentOpen.map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/tickets")}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.ticket_id} — {t.subject}</p>
                      <p className="text-xs text-muted-foreground">{t.client_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">{t.priority}</Badge>
                      <Badge variant="secondary" className="text-xs">{t.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="py-8 text-center text-muted-foreground">No open tickets</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
