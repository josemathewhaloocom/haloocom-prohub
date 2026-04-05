import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, ShieldCheck, ShieldOff, Clock, AlertTriangle, TrendingUp, FileText, ChevronRight,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useNavigate } from "react-router-dom";

const SLA_COLORS = {
  active: "hsl(152, 70%, 35%)",
  expiring: "hsl(38, 92%, 50%)",
  expired: "hsl(0, 72%, 51%)",
  none: "hsl(220, 14%, 60%)",
};

export default function SalesDashboard() {
  const { user, isSalesManager } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Sales sees own projects, Sales Manager sees all
      let q = supabase.from("projects").select("*");
      if (!isSalesManager) q = q.eq("created_by", user?.id ?? "");
      const { data } = await q;
      setProjects(data ?? []);
      setLoading(false);
    };
    fetch();
  }, [user, isSalesManager]);

  const now = new Date().toISOString().split("T")[0];
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.is_active).length;
    const inactive = projects.filter(p => !p.is_active).length;
    const slaActive = projects.filter(p => p.sla_end_date && p.sla_end_date >= now).length;
    const slaExpiring = projects.filter(p => p.sla_end_date && p.sla_end_date >= now && p.sla_end_date <= thirtyDays).length;
    const slaExpired = projects.filter(p => p.sla_end_date && p.sla_end_date < now).length;
    const amcActive = projects.filter(p => p.amc_end_date && p.amc_end_date >= now).length;
    const amcExpiring = projects.filter(p => p.amc_end_date && p.amc_end_date >= now && p.amc_end_date <= thirtyDays).length;
    const amcExpired = projects.filter(p => p.amc_end_date && p.amc_end_date < now).length;
    const drafts = projects.filter(p => p.status === "draft").length;
    return { total, active, inactive, slaActive, slaExpiring, slaExpired, amcActive, amcExpiring, amcExpired, drafts };
  }, [projects, now, thirtyDays]);

  // Purchase type distribution
  const purchaseTypeDist = useMemo(() => {
    const map: Record<string, number> = {};
    projects.forEach(p => {
      const t = p.purchase_type || "Not Set";
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [projects]);

  // SLA status pie
  const slaPie = useMemo(() => {
    const active = projects.filter(p => p.sla_end_date && p.sla_end_date >= now && p.sla_end_date > thirtyDays).length;
    const expiring = stats.slaExpiring;
    const expired = stats.slaExpired;
    const none = projects.filter(p => !p.sla_end_date).length;
    return [
      { name: "Active", value: active, color: SLA_COLORS.active },
      { name: "Expiring Soon", value: expiring, color: SLA_COLORS.expiring },
      { name: "Expired", value: expired, color: SLA_COLORS.expired },
      { name: "No SLA", value: none, color: SLA_COLORS.none },
    ].filter(d => d.value > 0);
  }, [projects, now, thirtyDays, stats]);

  // Expiring soon list
  const expiringSoon = useMemo(() => {
    return projects
      .filter(p => (p.sla_end_date && p.sla_end_date >= now && p.sla_end_date <= thirtyDays) ||
                   (p.amc_end_date && p.amc_end_date >= now && p.amc_end_date <= thirtyDays))
      .sort((a, b) => (a.sla_end_date || a.amc_end_date || "").localeCompare(b.sla_end_date || b.amc_end_date || ""))
      .slice(0, 10);
  }, [projects, now, thirtyDays]);

  const COLORS_PALETTE = ["hsl(200, 70%, 50%)", "hsl(152, 60%, 40%)", "hsl(38, 80%, 55%)", "hsl(0, 72%, 51%)", "hsl(280, 60%, 50%)"];

  const kpis = [
    { label: "Total Customers", value: stats.total, icon: Users, color: "text-primary" },
    { label: "Active Customers", value: stats.active, icon: ShieldCheck, color: "text-success" },
    { label: "Inactive Customers", value: stats.inactive, icon: ShieldOff, color: "text-muted-foreground" },
    { label: "SLA Active", value: stats.slaActive, icon: TrendingUp, color: "text-success" },
    { label: "SLA Expiring (30d)", value: stats.slaExpiring, icon: Clock, color: "text-warning" },
    { label: "SLA Expired", value: stats.slaExpired, icon: AlertTriangle, color: "text-destructive" },
    { label: "AMC Active", value: stats.amcActive, icon: ShieldCheck, color: "text-info" },
    { label: "AMC Expiring (30d)", value: stats.amcExpiring, icon: Clock, color: "text-warning" },
    { label: "Pending Drafts", value: stats.drafts, icon: FileText, color: "text-muted-foreground" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{isSalesManager ? "Sales Manager" : "Sales"} Dashboard</h1>
        <p className="text-muted-foreground">Customer SLA, AMC status and sales pipeline overview.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-lg bg-muted p-2.5 ${color}`}><Icon className="h-5 w-5" /></div>
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* SLA Status Pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">SLA Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {slaPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={slaPie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {slaPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[250px] items-center justify-center text-muted-foreground">No data</div>}
            <div className="flex flex-wrap gap-3 mt-2">
              {slaPie.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Purchase Type Bar Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Purchase Type Distribution</CardTitle></CardHeader>
          <CardContent>
            {purchaseTypeDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={purchaseTypeDist}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {purchaseTypeDist.map((_, i) => <Cell key={i} fill={COLORS_PALETTE[i % COLORS_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[250px] items-center justify-center text-muted-foreground">No data</div>}
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> SLA / AMC Expiring Soon (30 days)</CardTitle></CardHeader>
        <CardContent>
          {expiringSoon.length > 0 ? (
            <div className="space-y-3">
              {expiringSoon.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/projects/${p.id}`)}>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.client_company || p.client_name}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {p.sla_end_date && <Badge variant="outline" className="text-xs">SLA: {p.sla_end_date}</Badge>}
                    {p.amc_end_date && <Badge variant="outline" className="text-xs">AMC: {p.amc_end_date}</Badge>}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="py-8 text-center text-muted-foreground">No SLA/AMC expiring in the next 30 days</div>}
        </CardContent>
      </Card>
    </div>
  );
}
