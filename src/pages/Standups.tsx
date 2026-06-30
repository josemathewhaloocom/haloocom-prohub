import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Calendar, Pencil, ChevronDown, ChevronRight, AlertTriangle, Activity, CheckCircle2, Clock, Filter } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = ["On Track", "In Progress", "At Risk", "Delayed", "On Hold", "Completed"];
const CLOSED_STATUSES = new Set(["Completed"]);

const STATUS_STYLES: Record<string, string> = {
  "On Track": "bg-success/10 text-success border-success/20",
  "In Progress": "bg-info/10 text-info border-info/20",
  "At Risk": "bg-warning/10 text-warning border-warning/20",
  Delayed: "bg-destructive/10 text-destructive border-destructive/20",
  "On Hold": "bg-muted text-muted-foreground border-border",
  Completed: "bg-success/10 text-success border-success/20",
};

const TRACKER_FIELDS = "id, name, client_name, phase, tech_stack, progress_percentage, status, ai_rep_id, tech_rep_id, sales_rep_id, client_poc_name, client_poc_email, product_id, product_version, num_users, num_channels, trunk, location, received_date, uat_date, actual_go_live_date";

const todayStr = () => new Date().toISOString().slice(0, 10);

type Item = any;

export default function Standups() {
  const { user } = useAuth();
  const [tab, setTab] = useState("active");
  const [meetingDate, setMeetingDate] = useState(todayStr());
  const [meeting, setMeeting] = useState<any>(null);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [allMeetings, setAllMeetings] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [pocs, setPocs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [products, setProducts] = useState<Record<string, string>>({});

  const [openAdd, setOpenAdd] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<any>({ status_today: "In Progress", target: "", alsoUpdate: false });

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTarget, setFilterTarget] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchMeta = async () => {
    const [{ data: pr }, { data: po }, { data: profs }, { data: prods }] = await Promise.all([
      supabase.from("projects").select(TRACKER_FIELDS).eq("is_active", true).order("name"),
      supabase.from("pocs" as any).select(TRACKER_FIELDS).eq("is_archived", false).order("name"),
      supabase.from("profiles").select("id, first_name, last_name, email"),
      supabase.from("product_catalog").select("id, name"),
    ]);
    setProjects(pr ?? []);
    setPocs((po as any) ?? []);
    const map: Record<string, any> = {};
    (profs ?? []).forEach((p: any) => (map[p.id] = p));
    setProfiles(map);
    const pm: Record<string, string> = {};
    (prods ?? []).forEach((p: any) => (pm[p.id] = p.name));
    setProducts(pm);
  };

  const fetchAll = async () => {
    const { data: m } = await supabase
      .from("standup_meetings" as any)
      .select("*")
      .order("meeting_date", { ascending: false });
    setAllMeetings((m as any) ?? []);
    const { data: it } = await supabase
      .from("standup_items" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setAllItems((it as any) ?? []);
    const today = (m as any)?.find((x: any) => x.meeting_date === meetingDate);
    setMeeting(today ?? null);
  };

  useEffect(() => { fetchMeta(); fetchAll(); }, []);
  useEffect(() => {
    const today = allMeetings.find((x: any) => x.meeting_date === meetingDate);
    setMeeting(today ?? null);
  }, [meetingDate, allMeetings]);

  const meetingsById = useMemo(() => {
    const r: Record<string, any> = {};
    allMeetings.forEach((m) => (r[m.id] = m));
    return r;
  }, [allMeetings]);

  const getRecord = (it: Item) =>
    it.project_id ? projects.find((x) => x.id === it.project_id) : pocs.find((x) => x.id === it.poc_id);
  const targetKey = (it: Item) => it.project_id ? `project:${it.project_id}` : `poc:${it.poc_id}`;

  const userName = (id?: string) => {
    if (!id) return "—";
    const u = profiles[id];
    return u ? `${u.first_name} ${u.last_name}`.trim() || u.email : "User";
  };

  // Group items by project/POC, keep history sorted desc by meeting date
  const grouped = useMemo(() => {
    const g: Record<string, { key: string; record: any; history: Item[] }> = {};
    allItems.forEach((it) => {
      const key = targetKey(it);
      if (!g[key]) g[key] = { key, record: getRecord(it), history: [] };
      g[key].history.push(it);
    });
    Object.values(g).forEach((grp) => {
      grp.history.sort((a, b) => {
        const da = meetingsById[a.meeting_id]?.meeting_date ?? "";
        const db = meetingsById[b.meeting_id]?.meeting_date ?? "";
        return db.localeCompare(da);
      });
    });
    return g;
  }, [allItems, meetingsById, projects, pocs]);

  // Active dashboard rows = one row per project/POC with latest item, excluding Completed
  const activeRows = useMemo(() => {
    return Object.values(grouped)
      .map((g) => ({ ...g, latest: g.history[0] }))
      .filter((g) => g.latest && !CLOSED_STATUSES.has(g.latest.status_today))
      .filter((g) => filterStatus === "all" || g.latest.status_today === filterStatus)
      .filter((g) => filterTarget === "all" || g.key === filterTarget)
      .sort((a, b) => {
        const order = ["Delayed", "At Risk", "On Hold", "In Progress", "On Track"];
        return order.indexOf(a.latest.status_today) - order.indexOf(b.latest.status_today);
      });
  }, [grouped, filterStatus, filterTarget]);

  const kpi = useMemo(() => {
    const rows = Object.values(grouped).map((g) => g.history[0]).filter(Boolean);
    return {
      open: rows.filter((r) => !CLOSED_STATUSES.has(r.status_today)).length,
      inProgress: rows.filter((r) => r.status_today === "In Progress").length,
      atRisk: rows.filter((r) => r.status_today === "At Risk").length,
      delayed: rows.filter((r) => r.status_today === "Delayed").length,
      onHold: rows.filter((r) => r.status_today === "On Hold").length,
      completed: rows.filter((r) => r.status_today === "Completed").length,
    };
  }, [grouped]);

  const todayItems = useMemo(() => {
    if (!meeting) return [];
    return allItems.filter((it) => it.meeting_id === meeting.id);
  }, [allItems, meeting]);

  const createMeeting = async () => {
    const { data, error } = await supabase
      .from("standup_meetings" as any)
      .insert({ meeting_date: meetingDate, conducted_by: user?.id })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setMeeting(data);
    setAllMeetings((m) => [data, ...m]);
    toast.success("Standup created");
  };

  const openAddDialog = (preset?: string) => {
    setEditItem(null);
    setForm({ status_today: "In Progress", target: preset ?? "", alsoUpdate: false });
    setOpenAdd(true);
  };

  const openEditDialog = (it: Item) => {
    setEditItem(it);
    setForm({
      status_today: it.status_today,
      progress: it.progress ?? "",
      blockers: it.blockers ?? "",
      next_steps: it.next_steps ?? "",
      eta_date: it.eta_date ?? "",
      target: targetKey(it),
      alsoUpdate: false,
    });
    setOpenAdd(true);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editItem) {
      const { error } = await supabase
        .from("standup_items" as any)
        .update({
          status_today: form.status_today,
          progress: form.progress || null,
          blockers: form.blockers || null,
          next_steps: form.next_steps || null,
          eta_date: form.eta_date || null,
        })
        .eq("id", editItem.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Updated");
      setOpenAdd(false);
      fetchAll();
      return;
    }

    // Create — ensure meeting exists for selected date
    let m = meeting;
    if (!m) {
      const { data, error } = await supabase
        .from("standup_meetings" as any)
        .insert({ meeting_date: meetingDate, conducted_by: user?.id })
        .select()
        .single();
      if (error) { toast.error(error.message); return; }
      m = data;
      setMeeting(data);
      setAllMeetings((arr) => [data, ...arr]);
    }
    const [kind, id] = form.target.split(":");
    if (!kind || !id) { toast.error("Pick a project or POC"); return; }
    const payload: any = {
      meeting_id: m.id,
      project_id: kind === "project" ? id : null,
      poc_id: kind === "poc" ? id : null,
      status_today: form.status_today,
      progress: form.progress || null,
      blockers: form.blockers || null,
      next_steps: form.next_steps || null,
      eta_date: form.eta_date || null,
      created_by: user?.id,
    };
    const { error } = await supabase.from("standup_items" as any).insert(payload);
    if (error) { toast.error(error.message); return; }

    if (form.alsoUpdate && form.progress) {
      if (kind === "project") {
        await supabase.from("daily_updates").insert({
          project_id: id, engineer_id: user!.id, summary: form.progress,
          blockers: form.blockers || null, update_date: meetingDate,
        });
      } else {
        await supabase.from("poc_daily_updates" as any).insert({
          poc_id: id, engineer_id: user!.id, summary: form.progress,
          blockers: form.blockers || null, update_date: meetingDate,
        });
      }
    }
    toast.success("Item added");
    setOpenAdd(false);
    fetchAll();
  };

  const previewRecord: any = form.target
    ? (() => {
        const [k, id] = form.target.split(":");
        return k === "project" ? projects.find((p) => p.id === id) : pocs.find((p) => p.id === id);
      })()
    : null;

  const allTargets = useMemo(() => {
    return Object.values(grouped).map((g) => ({ key: g.key, label: g.record ? `${g.record.name} — ${g.record.client_name}` : g.key }));
  }, [grouped]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Standup Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live tracker of all active projects & POCs across daily meetings</p>
        </div>
        <Button onClick={() => openAddDialog()}><Plus className="mr-2 h-4 w-4" />Add Update</Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <KpiCard label="Open" value={kpi.open} icon={<Activity className="h-4 w-4" />} tone="info" />
        <KpiCard label="In Progress" value={kpi.inProgress} icon={<Clock className="h-4 w-4" />} tone="info" />
        <KpiCard label="At Risk" value={kpi.atRisk} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" />
        <KpiCard label="Delayed" value={kpi.delayed} icon={<AlertTriangle className="h-4 w-4" />} tone="destructive" />
        <KpiCard label="On Hold" value={kpi.onHold} icon={<Clock className="h-4 w-4" />} tone="muted" />
        <KpiCard label="Completed" value={kpi.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Active Tracker</TabsTrigger>
          <TabsTrigger value="today">Today's Standup</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ACTIVE TRACKER */}
        <TabsContent value="active" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="all">All statuses (open)</option>
                  {STATUS_OPTIONS.filter((s) => !CLOSED_STATUSES.has(s)).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterTarget} onChange={(e) => setFilterTarget(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="all">All projects & POCs</option>
                  {allTargets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="text-xs text-muted-foreground">Showing {activeRows.length} open items · Closed items hidden</div>
            </CardHeader>
            <CardContent className="p-0">
              {activeRows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No open items match your filters.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead className="w-[240px]">Project / POC</TableHead>
                      <TableHead>Stakeholders & Stack</TableHead>
                      <TableHead>Latest Status</TableHead>
                      <TableHead>Latest Progress</TableHead>
                      <TableHead>Blockers</TableHead>
                      <TableHead>Next Steps</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead className="w-20 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRows.map((g) => {
                      const rec: any = g.record || {};
                      const it = g.latest;
                      const mDate = meetingsById[it.meeting_id]?.meeting_date;
                      const isOpen = expanded[g.key];
                      return (
                        <>
                          <TableRow key={g.key} className="align-top">
                            <TableCell className="pt-3">
                              <button onClick={() => setExpanded({ ...expanded, [g.key]: !isOpen })} className="text-muted-foreground hover:text-foreground">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{rec.name ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{rec.client_name}{it.poc_id ? " · POC" : ""}</div>
                              {rec.phase && <Badge variant="outline" className="mt-1 text-[10px]">{rec.phase}</Badge>}
                              {typeof rec.progress_percentage === "number" && (
                                <div className="mt-1 text-[10px] text-muted-foreground">{rec.progress_percentage}% complete</div>
                              )}
                            </TableCell>
                            <TableCell className="text-xs space-y-0.5">
                              {rec.tech_stack && <div><span className="text-muted-foreground">Stack:</span> {rec.tech_stack}</div>}
                              {rec.product_id && <div><span className="text-muted-foreground">Product:</span> {products[rec.product_id]}{rec.product_version ? ` ${rec.product_version}` : ""}</div>}
                              <div><span className="text-muted-foreground">AI:</span> {userName(rec.ai_rep_id)}</div>
                              <div><span className="text-muted-foreground">Tech:</span> {userName(rec.tech_rep_id)}</div>
                              <div><span className="text-muted-foreground">Sales:</span> {userName(rec.sales_rep_id)}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className={STATUS_STYLES[it.status_today] ?? ""}>{it.status_today}</Badge></TableCell>
                            <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{it.progress}</TableCell>
                            <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-destructive">{it.blockers}</TableCell>
                            <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{it.next_steps}</TableCell>
                            <TableCell className="text-sm">{it.eta_date ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{mDate}<div>{g.history.length} updates</div></TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" onClick={() => openEditDialog(it)}><Pencil className="h-3.5 w-3.5" /></Button>
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow key={g.key + "-h"}>
                              <TableCell />
                              <TableCell colSpan={9} className="bg-muted/30">
                                <div className="space-y-2 py-2">
                                  <div className="text-xs font-semibold text-muted-foreground">Update history ({g.history.length})</div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="h-7 w-28 text-xs">Date</TableHead>
                                        <TableHead className="h-7 w-32 text-xs">Status</TableHead>
                                        <TableHead className="h-7 text-xs">Progress</TableHead>
                                        <TableHead className="h-7 text-xs">Blockers</TableHead>
                                        <TableHead className="h-7 text-xs">Next Steps</TableHead>
                                        <TableHead className="h-7 w-24 text-xs">ETA</TableHead>
                                        <TableHead className="h-7 w-28 text-xs">By</TableHead>
                                        <TableHead className="h-7 w-12" />
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {g.history.map((h) => (
                                        <TableRow key={h.id}>
                                          <TableCell className="py-1 text-xs">{meetingsById[h.meeting_id]?.meeting_date ?? "—"}</TableCell>
                                          <TableCell className="py-1"><Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[h.status_today] ?? ""}`}>{h.status_today}</Badge></TableCell>
                                          <TableCell className="py-1 text-xs whitespace-pre-wrap">{h.progress}</TableCell>
                                          <TableCell className="py-1 text-xs text-destructive whitespace-pre-wrap">{h.blockers}</TableCell>
                                          <TableCell className="py-1 text-xs whitespace-pre-wrap">{h.next_steps}</TableCell>
                                          <TableCell className="py-1 text-xs">{h.eta_date ?? "—"}</TableCell>
                                          <TableCell className="py-1 text-xs">{userName(h.created_by)}</TableCell>
                                          <TableCell className="py-1 text-right">
                                            <Button size="sm" variant="ghost" onClick={() => openEditDialog(h)}><Pencil className="h-3 w-3" /></Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TODAY'S STANDUP */}
        <TabsContent value="today" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="w-44" />
                {meeting && <Badge variant="outline">Conducted by {userName(meeting.conducted_by)}</Badge>}
              </div>
              {!meeting ? (
                <Button size="sm" onClick={createMeeting}><Plus className="mr-2 h-4 w-4" />Start Standup</Button>
              ) : (
                <Button size="sm" onClick={() => openAddDialog()}><Plus className="mr-2 h-4 w-4" />Discussion Item</Button>
              )}
            </CardHeader>
            <CardContent>
              {!meeting ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No standup recorded for this date.</p>
              ) : todayItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No discussion items yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project / POC</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Blockers</TableHead>
                      <TableHead>Next Steps</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead className="w-16 text-right">Edit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayItems.map((it) => {
                      const rec: any = getRecord(it) || {};
                      return (
                        <TableRow key={it.id} className="align-top">
                          <TableCell>
                            <div className="font-medium text-sm">{rec.name}</div>
                            <div className="text-xs text-muted-foreground">{rec.client_name}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className={STATUS_STYLES[it.status_today] ?? ""}>{it.status_today}</Badge></TableCell>
                          <TableCell className="text-sm whitespace-pre-wrap max-w-xs">{it.progress}</TableCell>
                          <TableCell className="text-sm text-destructive whitespace-pre-wrap max-w-xs">{it.blockers}</TableCell>
                          <TableCell className="text-sm whitespace-pre-wrap max-w-xs">{it.next_steps}</TableCell>
                          <TableCell className="text-sm">{it.eta_date ?? "—"}</TableCell>
                          <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openEditDialog(it)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-4 space-y-3">
          {allMeetings.length === 0 && (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No standups recorded yet.</CardContent></Card>
          )}
          {allMeetings.map((m) => {
            const its = allItems.filter((it) => it.meeting_id === m.id);
            return (
              <Collapsible key={m.id} defaultOpen={m.meeting_date === todayStr()}>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4" />{m.meeting_date}
                        <Badge variant="outline" className="ml-2">{its.length} items</Badge>
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">Conducted by {userName(m.conducted_by)}</span>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      {its.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Project / POC</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Progress</TableHead>
                              <TableHead>Blockers</TableHead>
                              <TableHead>Next Steps</TableHead>
                              <TableHead>ETA</TableHead>
                              <TableHead className="w-16 text-right">Edit</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {its.map((it) => {
                              const rec: any = getRecord(it) || {};
                              return (
                                <TableRow key={it.id} className="align-top">
                                  <TableCell><div className="font-medium text-sm">{rec.name}</div><div className="text-xs text-muted-foreground">{rec.client_name}</div></TableCell>
                                  <TableCell><Badge variant="outline" className={STATUS_STYLES[it.status_today] ?? ""}>{it.status_today}</Badge></TableCell>
                                  <TableCell className="text-sm whitespace-pre-wrap max-w-xs">{it.progress}</TableCell>
                                  <TableCell className="text-sm text-destructive whitespace-pre-wrap max-w-xs">{it.blockers}</TableCell>
                                  <TableCell className="text-sm whitespace-pre-wrap max-w-xs">{it.next_steps}</TableCell>
                                  <TableCell className="text-sm">{it.eta_date ?? "—"}</TableCell>
                                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openEditDialog(it)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Add / Edit Dialog */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? "Edit Update" : "Add Update"}</DialogTitle></DialogHeader>
          <form onSubmit={saveItem} className="space-y-3">
            {!editItem && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Meeting Date *</Label>
                  <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                </div>
                <div>
                  <Label>Project / POC *</Label>
                  <select required value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select…</option>
                    <optgroup label="Projects">
                      {projects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name} — {p.client_name}</option>)}
                    </optgroup>
                    <optgroup label="POCs">
                      {pocs.map((p) => <option key={p.id} value={`poc:${p.id}`}>{p.name} — {p.client_name}</option>)}
                    </optgroup>
                  </select>
                </div>
              </div>
            )}

            {previewRecord && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-semibold text-sm">{previewRecord.name}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <div><span className="text-muted-foreground">Client:</span> {previewRecord.client_name}</div>
                  <div><span className="text-muted-foreground">Phase:</span> {previewRecord.phase || "—"}</div>
                  <div><span className="text-muted-foreground">Tech Stack:</span> {previewRecord.tech_stack || "—"}</div>
                  <div><span className="text-muted-foreground">Product:</span> {previewRecord.product_id ? `${products[previewRecord.product_id] || ""}${previewRecord.product_version ? " " + previewRecord.product_version : ""}` : "—"}</div>
                  <div><span className="text-muted-foreground">AI Rep:</span> {userName(previewRecord.ai_rep_id)}</div>
                  <div><span className="text-muted-foreground">Tech Rep:</span> {userName(previewRecord.tech_rep_id)}</div>
                  <div><span className="text-muted-foreground">Sales Rep:</span> {userName(previewRecord.sales_rep_id)}</div>
                  <div><span className="text-muted-foreground">Client Contact:</span> {previewRecord.client_poc_name || "—"}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <select value={form.status_today} onChange={(e) => setForm({ ...form, status_today: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label>ETA</Label>
                <Input type="date" value={form.eta_date ?? ""} onChange={(e) => setForm({ ...form, eta_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Progress / Activities</Label>
              <Textarea rows={2} value={form.progress ?? ""} onChange={(e) => setForm({ ...form, progress: e.target.value })} />
            </div>
            <div>
              <Label>Blockers</Label>
              <Textarea rows={2} value={form.blockers ?? ""} onChange={(e) => setForm({ ...form, blockers: e.target.value })} />
            </div>
            <div>
              <Label>Next Steps</Label>
              <Textarea rows={2} value={form.next_steps ?? ""} onChange={(e) => setForm({ ...form, next_steps: e.target.value })} />
            </div>
            {!editItem && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.alsoUpdate} onChange={(e) => setForm({ ...form, alsoUpdate: e.target.checked })} />
                Also save Progress to project/POC Daily Updates
              </label>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenAdd(false)}>Cancel</Button>
              <Button type="submit">{editItem ? "Save Changes" : "Add"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  const toneCls: Record<string, string> = {
    info: "text-info",
    warning: "text-warning",
    destructive: "text-destructive",
    success: "text-success",
    muted: "text-muted-foreground",
  };
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={toneCls[tone]}>{icon}</span>
        </div>
        <div className={`mt-1 text-2xl font-bold ${toneCls[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
