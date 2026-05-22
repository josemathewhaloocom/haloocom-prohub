import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = ["On Track", "In Progress", "At Risk", "Delayed", "On Hold", "Completed"];

const STATUS_STYLES: Record<string, string> = {
  "On Track": "bg-success/10 text-success border-success/20",
  "In Progress": "bg-info/10 text-info border-info/20",
  "At Risk": "bg-warning/10 text-warning border-warning/20",
  Delayed: "bg-destructive/10 text-destructive border-destructive/20",
  "On Hold": "bg-muted text-muted-foreground border-border",
  Completed: "bg-success/10 text-success border-success/20",
};

const TRACKER_FIELDS = "id, name, client_name, phase, tech_stack, progress_percentage, status, ai_rep_id, tech_rep_id, sales_rep_id, client_poc_name, client_poc_email, product_id, product_version, num_users, num_channels, trunk, location, received_date, uat_date, actual_go_live_date";

const today = () => new Date().toISOString().slice(0, 10);

export default function Standups() {
  const { user } = useAuth();
  const [meetingDate, setMeetingDate] = useState(today());
  const [meeting, setMeeting] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [pocs, setPocs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [products, setProducts] = useState<Record<string, string>>({});
  const [openItem, setOpenItem] = useState(false);
  const [itemForm, setItemForm] = useState<any>({ status_today: "In Progress", target: "", alsoUpdate: false });

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

  const fetchMeeting = async () => {
    const { data: m } = await supabase
      .from("standup_meetings" as any)
      .select("*")
      .eq("meeting_date", meetingDate)
      .maybeSingle();
    setMeeting(m);
    if (m) {
      const { data: it } = await supabase
        .from("standup_items" as any)
        .select("*")
        .eq("meeting_id", (m as any).id)
        .order("created_at");
      setItems((it as any) ?? []);
    } else {
      setItems([]);
    }
  };

  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => { fetchMeeting(); }, [meetingDate]);

  const createMeeting = async () => {
    const { data, error } = await supabase
      .from("standup_meetings" as any)
      .insert({ meeting_date: meetingDate, conducted_by: user?.id })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setMeeting(data);
    toast.success("Standup created");
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meeting) return;
    const [kind, id] = itemForm.target.split(":");
    if (!kind || !id) { toast.error("Pick a project or POC"); return; }
    const payload: any = {
      meeting_id: meeting.id,
      project_id: kind === "project" ? id : null,
      poc_id: kind === "poc" ? id : null,
      status_today: itemForm.status_today,
      progress: itemForm.progress || null,
      blockers: itemForm.blockers || null,
      next_steps: itemForm.next_steps || null,
      eta_date: itemForm.eta_date || null,
      created_by: user?.id,
    };
    const { error } = await supabase.from("standup_items" as any).insert(payload);
    if (error) { toast.error(error.message); return; }

    if (itemForm.alsoUpdate && kind === "project" && itemForm.progress) {
      await supabase.from("daily_updates").insert({
        project_id: id,
        engineer_id: user!.id,
        summary: itemForm.progress,
        blockers: itemForm.blockers || null,
        update_date: meetingDate,
      });
    }
    if (itemForm.alsoUpdate && kind === "poc" && itemForm.progress) {
      await supabase.from("poc_daily_updates" as any).insert({
        poc_id: id,
        engineer_id: user!.id,
        summary: itemForm.progress,
        blockers: itemForm.blockers || null,
        update_date: meetingDate,
      });
    }

    toast.success("Item added");
    setOpenItem(false);
    setItemForm({ status_today: "In Progress", target: "", alsoUpdate: false });
    fetchMeeting();
  };

  const getRecord = (it: any) =>
    it.project_id ? projects.find((x) => x.id === it.project_id) : pocs.find((x) => x.id === it.poc_id);

  const userName = (id?: string) => {
    if (!id) return "—";
    const u = profiles[id];
    return u ? `${u.first_name} ${u.last_name}`.trim() || u.email : "User";
  };

  const previewRecord: any = itemForm.target
    ? (() => {
        const [k, id] = itemForm.target.split(":");
        return k === "project" ? projects.find((p) => p.id === id) : pocs.find((p) => p.id === id);
      })()
    : null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Standup</h1>
          <p className="text-sm text-muted-foreground">Track project & POC discussions in your daily meeting</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="w-44" />
            {meeting && <Badge variant="outline">Conducted by {userName(meeting.conducted_by)}</Badge>}
          </div>
          {!meeting ? (
            <Button onClick={createMeeting} size="sm"><Plus className="mr-2 h-4 w-4" />Start Standup</Button>
          ) : (
            <Button size="sm" onClick={() => setOpenItem(true)}><Plus className="mr-2 h-4 w-4" />Discussion Item</Button>
          )}
        </CardHeader>
        <CardContent>
          {!meeting ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No standup recorded for this date.</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No discussion items yet. Add the first one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[260px]">Project / POC</TableHead>
                  <TableHead>Stakeholders & Stack</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Blockers</TableHead>
                  <TableHead>Next Steps</TableHead>
                  <TableHead>ETA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const rec: any = getRecord(it) || {};
                  return (
                    <TableRow key={it.id} className="align-top">
                      <TableCell>
                        <div className="font-medium">{rec.name ?? (it.project_id ? "Project" : "POC")}</div>
                        <div className="text-xs text-muted-foreground">{rec.client_name}{it.poc_id ? " · POC" : ""}</div>
                        {rec.phase && <Badge variant="outline" className="mt-1 text-[10px]">{rec.phase}</Badge>}
                      </TableCell>
                      <TableCell className="text-xs space-y-0.5">
                        {rec.tech_stack && <div><span className="text-muted-foreground">Stack:</span> {rec.tech_stack}</div>}
                        {rec.product_id && <div><span className="text-muted-foreground">Product:</span> {products[rec.product_id]}{rec.product_version ? ` ${rec.product_version}` : ""}</div>}
                        {(rec.num_users || rec.num_channels || rec.trunk) && (
                          <div className="text-muted-foreground">
                            {rec.num_users ? `${rec.num_users} users` : ""}{rec.num_channels ? ` · ${rec.num_channels} ch` : ""}{rec.trunk ? ` · ${rec.trunk}` : ""}
                          </div>
                        )}
                        <div><span className="text-muted-foreground">AI:</span> {userName(rec.ai_rep_id)}</div>
                        <div><span className="text-muted-foreground">Tech:</span> {userName(rec.tech_rep_id)}</div>
                        <div><span className="text-muted-foreground">Sales:</span> {userName(rec.sales_rep_id)}</div>
                        {rec.client_poc_name && <div><span className="text-muted-foreground">Client:</span> {rec.client_poc_name}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLES[it.status_today] ?? ""}>{it.status_today}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{it.progress}</TableCell>
                      <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-destructive">{it.blockers}</TableCell>
                      <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{it.next_steps}</TableCell>
                      <TableCell className="text-sm">{it.eta_date ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={openItem} onOpenChange={setOpenItem}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Discussion Item</DialogTitle></DialogHeader>
          <form onSubmit={addItem} className="space-y-3">
            <div>
              <Label>Project / POC *</Label>
              <select required value={itemForm.target} onChange={(e) => setItemForm({ ...itemForm, target: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select…</option>
                <optgroup label="Projects">
                  {projects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name} — {p.client_name}</option>)}
                </optgroup>
                <optgroup label="POCs">
                  {pocs.map((p) => <option key={p.id} value={`poc:${p.id}`}>{p.name} — {p.client_name}</option>)}
                </optgroup>
              </select>
            </div>

            {previewRecord && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-semibold text-sm">{previewRecord.name}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <div><span className="text-muted-foreground">Client:</span> {previewRecord.client_name}</div>
                  <div><span className="text-muted-foreground">Phase:</span> {previewRecord.phase || "—"}</div>
                  <div><span className="text-muted-foreground">Tech Stack:</span> {previewRecord.tech_stack || "—"}</div>
                  <div><span className="text-muted-foreground">Product:</span> {previewRecord.product_id ? `${products[previewRecord.product_id] || ""}${previewRecord.product_version ? " " + previewRecord.product_version : ""}` : "—"}</div>
                  <div><span className="text-muted-foreground">Users / Ch / Trunk:</span> {[previewRecord.num_users, previewRecord.num_channels, previewRecord.trunk].filter(Boolean).join(" · ") || "—"}</div>
                  <div><span className="text-muted-foreground">Location:</span> {previewRecord.location || "—"}</div>
                  <div><span className="text-muted-foreground">AI Rep:</span> {userName(previewRecord.ai_rep_id)}</div>
                  <div><span className="text-muted-foreground">Tech Rep:</span> {userName(previewRecord.tech_rep_id)}</div>
                  <div><span className="text-muted-foreground">Sales Rep:</span> {userName(previewRecord.sales_rep_id)}</div>
                  <div><span className="text-muted-foreground">Client Contact:</span> {previewRecord.client_poc_name || "—"}</div>
                  <div><span className="text-muted-foreground">Received:</span> {previewRecord.received_date || "—"}</div>
                  <div><span className="text-muted-foreground">UAT:</span> {previewRecord.uat_date || "—"}</div>
                  <div><span className="text-muted-foreground">Go-Live (actual):</span> {previewRecord.actual_go_live_date || "—"}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status Today</Label>
                <select value={itemForm.status_today} onChange={(e) => setItemForm({ ...itemForm, status_today: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label>ETA for Next Milestone</Label>
                <Input type="date" value={itemForm.eta_date ?? ""} onChange={(e) => setItemForm({ ...itemForm, eta_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Progress / Activities Done</Label>
              <Textarea rows={2} value={itemForm.progress ?? ""} onChange={(e) => setItemForm({ ...itemForm, progress: e.target.value })} />
            </div>
            <div>
              <Label>Blockers / Issues</Label>
              <Textarea rows={2} value={itemForm.blockers ?? ""} onChange={(e) => setItemForm({ ...itemForm, blockers: e.target.value })} />
            </div>
            <div>
              <Label>Next Steps</Label>
              <Textarea rows={2} value={itemForm.next_steps ?? ""} onChange={(e) => setItemForm({ ...itemForm, next_steps: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={itemForm.alsoUpdate} onChange={(e) => setItemForm({ ...itemForm, alsoUpdate: e.target.checked })} />
              Also save Progress to project/POC Daily Updates
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenItem(false)}>Cancel</Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
