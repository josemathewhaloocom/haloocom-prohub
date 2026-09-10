import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, AlertTriangle, CalendarClock, CheckCircle2, ClipboardList,
  Flame, HeartPulse, TicketIcon, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const label = (v: string) => (v ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const LIVE_STATUSES = [
  "open", "qc_completed", "kick_off_scheduled", "site_ready", "scheduled",
  "in_progress", "client_signing_pending", "client_signed", "pending_admin_approval", "on_hold",
];

function Kpi({
  icon: Icon, label: text, value, tone,
}: { icon: any; label: string; value: number | string; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("rounded-lg bg-muted p-2", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground">{text}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommandCenter() {
  const [projects, setProjects] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [checkups, setCheckups] = useState<any[]>([]);
  const [standupItems, setStandupItems] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [pr, tk, ts, hc, si, du, pf, st] = await Promise.all([
        supabase.from("projects").select("*").eq("is_active", true),
        supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("*"),
        supabase.from("health_checkups").select("*"),
        supabase.from("standup_items").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("daily_updates").select("project_id, update_date").order("update_date", { ascending: false }),
        supabase.from("profiles").select("id, first_name, last_name"),
        supabase.from("alert_settings").select("*").limit(1).maybeSingle(),
      ]);
      setProjects(pr.data ?? []);
      setTickets(tk.data ?? []);
      setTasks(ts.data ?? []);
      setCheckups(hc.data ?? []);
      setStandupItems(si.data ?? []);
      setUpdates(du.data ?? []);
      setPeople(pf.data ?? []);
      setSettings(st.data);
      setLoading(false);
    })();
  }, []);

  const personName = (id: string | null) => {
    const p = people.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "—";
  };

  const liveProjects = useMemo(
    () => projects.filter((p) => LIVE_STATUSES.includes(p.status)),
    [projects]
  );

  const openTickets = tickets.filter((t) => !["closed", "resolved"].includes((t.status ?? "").toLowerCase()));
  const escalated = tickets.filter(
    (t) => t.is_escalated || (t.sla_due_at && new Date(t.sla_due_at) < new Date() && !["closed", "resolved"].includes((t.status ?? "").toLowerCase()))
  );
  const overdueTasks = tasks.filter(
    (t) => t.due_date && !["done", "cancelled"].includes(t.status) && t.due_date < today()
  );
  const followUps = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  const overdueCheckups = checkups.filter((c) => c.status !== "completed" && c.scheduled_date < today());

  const lastUpdateFor = (projectId: string) =>
    updates.find((u) => u.project_id === projectId)?.update_date ?? null;

  const staleDays = settings?.inactivity_days ?? 3;

  const staleProjects = liveProjects.filter((p) => {
    const d = lastUpdateFor(p.id);
    if (!d) return true;
    return (Date.now() - new Date(d).getTime()) / 86400000 > staleDays;
  });

  const atRisk = standupItems.filter((i) =>
    ["at_risk", "delayed", "on_hold", "blocked"].includes((i.status_today ?? "").toLowerCase())
  );

  const inactiveMembers = people.filter((p) => {
    const recent = tasks.some(
      (t) => (t.created_by === p.id || t.assignee_id === p.id) && t.created_at > daysAgo(staleDays)
    );
    const recentTicket = tickets.some((t) => t.created_by === p.id && t.created_at > daysAgo(staleDays));
    return !recent && !recentTicket;
  });

  if (loading) {
    return <div className="animate-pulse text-muted-foreground">Loading command center...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Live projects, tickets, escalations, follow-ups and alerts in one view.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi icon={Activity} label="Live projects" value={liveProjects.length} />
        <Kpi icon={TicketIcon} label="Open tickets" value={openTickets.length} />
        <Kpi icon={Flame} label="Escalations" value={escalated.length} tone="text-destructive" />
        <Kpi icon={ClipboardList} label="Follow-ups pending" value={followUps.length} />
        <Kpi icon={AlertTriangle} label="Overdue tasks" value={overdueTasks.length} tone="text-destructive" />
        <Kpi icon={HeartPulse} label="Checkups overdue" value={overdueCheckups.length} />
      </div>

      <Tabs defaultValue="projects">
        <TabsList className="flex-wrap">
          <TabsTrigger value="projects">Live Projects</TabsTrigger>
          <TabsTrigger value="escalations">Escalations</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="highlights">Status Highlights</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live projects ({liveProjects.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Go-live</TableHead>
                    <TableHead>Last update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveProjects.map((p) => {
                    const last = lastUpdateFor(p.id);
                    const stale = staleProjects.some((s) => s.id === p.id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link to={`/projects/${p.id}`} className="font-medium hover:underline">
                            {p.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">{p.client_name}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{label(p.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{p.phase ?? "—"}</TableCell>
                        <TableCell className="w-40">
                          <Progress value={p.progress_percentage ?? 0} className="h-2" />
                          <span className="text-xs text-muted-foreground">{p.progress_percentage ?? 0}%</span>
                        </TableCell>
                        <TableCell className="text-sm">{p.actual_go_live_date ?? p.deadline ?? "—"}</TableCell>
                        <TableCell className={cn("text-sm", stale && "font-semibold text-destructive")}>
                          {last ?? "No updates"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Escalated / SLA breaching tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {escalated.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No escalations right now.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Age (h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {escalated.map((t) => (
                      <TableRow key={t.id} className="bg-destructive/5">
                        <TableCell>
                          <div className="font-medium">{t.ticket_id}</div>
                          <div className="text-xs text-muted-foreground">{t.subject}</div>
                        </TableCell>
                        <TableCell className="text-sm">{t.client_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{label(t.priority)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{personName(t.assigned_engineer_id)}</TableCell>
                        <TableCell className="text-sm">
                          {Math.round((Date.now() - new Date(t.created_at).getTime()) / 3600000)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(
                tickets.reduce<Record<string, number>>((a, t) => {
                  a[t.status] = (a[t.status] ?? 0) + 1;
                  return a;
                }, {})
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span>{label(k)}</span>
                  <span className="font-semibold">{v}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open ticket ageing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                ["< 1 day", 0, 1],
                ["1-3 days", 1, 3],
                ["3-7 days", 3, 7],
                ["> 7 days", 7, 9999],
              ].map(([name, lo, hi]) => {
                const count = openTickets.filter((t) => {
                  const d = (Date.now() - new Date(t.created_at).getTime()) / 86400000;
                  return d >= (lo as number) && d < (hi as number);
                }).length;
                return (
                  <div key={name as string} className="flex justify-between text-sm">
                    <span>{name as string}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending follow-ups ({followUps.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followUps.slice(0, 30).map((t) => (
                    <TableRow key={t.id} className={cn(t.due_date && t.due_date < today() && "bg-destructive/5")}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell className="text-sm">{personName(t.assignee_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{label(t.priority)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{t.due_date ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/tasks">Open all tasks</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highlights" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">At risk / delayed / blocked (from standups)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {atRisk.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nothing flagged.</p>
              ) : (
                atRisk.slice(0, 20).map((i) => {
                  const proj = projects.find((p) => p.id === i.project_id);
                  return (
                    <div key={i.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{proj?.name ?? "POC item"}</span>
                        <Badge variant="outline" className="text-destructive">
                          {label(i.status_today ?? "")}
                        </Badge>
                      </div>
                      {i.blockers && <p className="mt-1 text-sm text-muted-foreground">Blocker: {i.blockers}</p>}
                      {i.next_steps && <p className="text-sm text-muted-foreground">Next: {i.next_steps}</p>}
                      {i.eta_date && <p className="text-xs text-muted-foreground">ETA {i.eta_date}</p>}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4" /> No activity ({staleDays}+ days)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {inactiveMembers.length === 0 ? (
                <span className="text-muted-foreground">Everyone is active.</span>
              ) : (
                inactiveMembers.map((p) => (
                  <div key={p.id}>
                    {p.first_name} {p.last_name}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartPulse className="h-4 w-4" /> Health checkups overdue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {overdueCheckups.length === 0 ? (
                <span className="text-muted-foreground">All checkups on track.</span>
              ) : (
                overdueCheckups.map((c) => (
                  <div key={c.id}>
                    {projects.find((p) => p.id === c.project_id)?.name ?? "Project"} — due {c.scheduled_date}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" /> Projects with no recent update
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {staleProjects.length === 0 ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" /> All projects updated.
                </span>
              ) : (
                staleProjects.map((p) => <div key={p.id}>{p.name}</div>)
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
