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
import { Plus, Calendar, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STATUS_OPTIONS = ["On Track", "In Progress", "At Risk", "Delayed", "On Hold", "Completed"];
const PRIORITY_OPTIONS = ["Critical", "High", "Medium", "Low"];

const STATUS_STYLES: Record<string, string> = {
  "On Track": "bg-success/10 text-success border-success/20",
  "In Progress": "bg-info/10 text-info border-info/20",
  "At Risk": "bg-warning/10 text-warning border-warning/20",
  Delayed: "bg-destructive/10 text-destructive border-destructive/20",
  "On Hold": "bg-muted text-muted-foreground border-border",
  Completed: "bg-success/10 text-success border-success/20",
};

const today = () => new Date().toISOString().slice(0, 10);

export default function Standups() {
  const { user } = useAuth();
  const [meetingDate, setMeetingDate] = useState(today());
  const [meeting, setMeeting] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [pocs, setPocs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [openItem, setOpenItem] = useState(false);
  const [itemForm, setItemForm] = useState<any>({ status_today: "In Progress", target: "", alsoUpdate: false });
  const [openAction, setOpenAction] = useState(false);
  const [actionForm, setActionForm] = useState<any>({ priority: "Medium", status: "Open", target: "", source_standup_item_id: null });
  const [users, setUsers] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);

  const fetchMeta = async () => {
    const [{ data: pr }, { data: po }, { data: profs }] = await Promise.all([
      supabase.from("projects").select("id, name, client_name, phase, progress_percentage, status").eq("is_active", true).order("name"),
      supabase.from("pocs" as any).select("id, name, client_name, phase, progress_percentage, status").eq("is_archived", false).order("name"),
      supabase.from("profiles").select("id, first_name, last_name, email"),
    ]);
    setProjects(pr ?? []);
    setPocs((po as any) ?? []);
    setUsers(profs ?? []);
    const map: Record<string, any> = {};
    (profs ?? []).forEach((p: any) => (map[p.id] = p));
    setProfiles(map);
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
      const { data: ai } = await supabase
        .from("standup_action_items" as any)
        .select("*")
        .in("source_standup_item_id", ((it as any) ?? []).map((x: any) => x.id).concat("00000000-0000-0000-0000-000000000000"));
      setActionItems((ai as any) ?? []);
    } else {
      setItems([]);
      setActionItems([]);
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

  const addAction = async (e: React.FormEvent) => {
    e.preventDefault();
    const [kind, id] = actionForm.target.split(":");
    if (!kind || !id) { toast.error("Pick a project or POC"); return; }
    const { error } = await supabase.from("standup_action_items" as any).insert({
      project_id: kind === "project" ? id : null,
      poc_id: kind === "poc" ? id : null,
      source_standup_item_id: actionForm.source_standup_item_id,
      description: actionForm.description,
      assigned_to: actionForm.assigned_to || null,
      priority: actionForm.priority,
      status: actionForm.status,
      due_date: actionForm.due_date || null,
      comments: actionForm.comments || null,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Action item added");
    setOpenAction(false);
    setActionForm({ priority: "Medium", status: "Open", target: "", source_standup_item_id: null });
    fetchMeeting();
  };

  const itemTarget = (it: any) => {
    if (it.project_id) {
      const p = projects.find((x) => x.id === it.project_id);
      return p ? `${p.name} — ${p.client_name}` : "Project";
    }
    const p = pocs.find((x) => x.id === it.poc_id);
    return p ? `[POC] ${p.name} — ${p.client_name}` : "POC";
  };

  const itemActions = (itemId: string) => actionItems.filter((a) => a.source_standup_item_id === itemId);

  const userName = (id?: string) => {
    if (!id) return "—";
    const u = profiles[id];
    return u ? `${u.first_name} ${u.last_name}`.trim() || u.email : "User";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Daily Standup</h1>
          <p className="text-sm text-muted-foreground">Track project & POC discussions and action items</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/action-items">
            <Button variant="outline" size="sm"><ListChecks className="mr-2 h-4 w-4" />All Action Items</Button>
          </Link>
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpenAction(true)}><Plus className="mr-2 h-4 w-4" />Action Item</Button>
              <Button size="sm" onClick={() => setOpenItem(true)}><Plus className="mr-2 h-4 w-4" />Discussion Item</Button>
            </div>
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
                  <TableHead>Project / POC</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Blockers</TableHead>
                  <TableHead>Next Steps</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{itemTarget(it)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[it.status_today] ?? ""}>{it.status_today}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{it.progress}</TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-destructive">{it.blockers}</TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap text-sm">{it.next_steps}</TableCell>
                    <TableCell>{it.eta_date ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const target = it.project_id ? `project:${it.project_id}` : `poc:${it.poc_id}`;
                          setActionForm({ priority: "Medium", status: "Open", target, source_standup_item_id: it.id });
                          setOpenAction(true);
                        }}
                      >
                        + Action ({itemActions(it.id).length})
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={openItem} onOpenChange={setOpenItem}>
        <DialogContent className="max-w-2xl">
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

      {/* Add Action Dialog */}
      <Dialog open={openAction} onOpenChange={setOpenAction}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Add Action Item</DialogTitle></DialogHeader>
          <form onSubmit={addAction} className="space-y-3">
            <div>
              <Label>Project / POC *</Label>
              <select required value={actionForm.target} onChange={(e) => setActionForm({ ...actionForm, target: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select…</option>
                <optgroup label="Projects">
                  {projects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name} — {p.client_name}</option>)}
                </optgroup>
                <optgroup label="POCs">
                  {pocs.map((p) => <option key={p.id} value={`poc:${p.id}`}>{p.name} — {p.client_name}</option>)}
                </optgroup>
              </select>
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea required rows={2} value={actionForm.description ?? ""} onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Assigned To</Label>
                <select value={actionForm.assigned_to ?? ""} onChange={(e) => setActionForm({ ...actionForm, assigned_to: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{`${u.first_name} ${u.last_name}`.trim() || u.email}</option>)}
                </select>
              </div>
              <div>
                <Label>Priority</Label>
                <select value={actionForm.priority} onChange={(e) => setActionForm({ ...actionForm, priority: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select value={actionForm.status} onChange={(e) => setActionForm({ ...actionForm, status: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {["Open", "In Progress", "Completed", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={actionForm.due_date ?? ""} onChange={(e) => setActionForm({ ...actionForm, due_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Comments</Label>
              <Textarea rows={2} value={actionForm.comments ?? ""} onChange={(e) => setActionForm({ ...actionForm, comments: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenAction(false)}>Cancel</Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
