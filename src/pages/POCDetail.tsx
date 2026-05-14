import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Save, Rocket, Lightbulb, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "in_progress", label: "In Progress" },
  { value: "evaluation", label: "Evaluation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "on_hold", label: "On Hold" },
  { value: "converted", label: "Converted" },
];

export default function POCDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isProjectManager } = useAuth();
  const [poc, setPoc] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [stakeholders, setStakeholders] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>({});
  const [updateForm, setUpdateForm] = useState<any>({ percentage_complete: 0, hours_worked: 0, summary: "" });
  const [stakeholderForm, setStakeholderForm] = useState<any>({});
  const [convertOpen, setConvertOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignEngineerId, setAssignEngineerId] = useState("");

  const isOwner = poc?.created_by === user?.id;
  const canEdit = isOwner || isProjectManager;
  const canConvert = canEdit && poc && !poc.converted_project_id;

  const fetchAll = async () => {
    if (!id) return;
    const [{ data: p }, { data: u }, { data: s }, { data: a }, { data: prod }, { data: roles }] = await Promise.all([
      supabase.from("pocs" as any).select("*").eq("id", id).maybeSingle(),
      supabase.from("poc_daily_updates" as any).select("*").eq("poc_id", id).order("update_date", { ascending: false }),
      supabase.from("poc_stakeholders" as any).select("*").eq("poc_id", id).order("created_at"),
      supabase.from("poc_assignments" as any).select("*").eq("poc_id", id),
      supabase.from("product_catalog").select("*").eq("is_active", true).order("name"),
      supabase.from("user_roles").select("user_id, role").in("role", ["support_engineer", "engineering"] as any),
    ]);
    setPoc(p);
    setEditing(p || {});
    setUpdates((u as any) ?? []);
    setStakeholders((s as any) ?? []);
    setAssignments((a as any) ?? []);
    setProducts(prod ?? []);
    const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", ids);
      setEngineers(profs ?? []);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleSave = async () => {
    const { error } = await supabase.from("pocs" as any).update({
      name: editing.name,
      client_name: editing.client_name,
      client_email: editing.client_email,
      client_company: editing.client_company,
      description: editing.description,
      success_criteria: editing.success_criteria,
      status: editing.status,
      priority: editing.priority,
      start_date: editing.start_date,
      evaluation_date: editing.evaluation_date,
      outcome: editing.outcome,
      outcome_reason: editing.outcome_reason,
      product_id: editing.product_id || null,
      product_version: editing.product_version || null,
      num_users: editing.num_users ? Number(editing.num_users) : null,
      num_channels: editing.num_channels ? Number(editing.num_channels) : null,
      trunk: editing.trunk || null,
      location: editing.location || null,
    }).eq("id", id!);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    fetchAll();
  };

  const handleAssign = async () => {
    if (!assignEngineerId) return;
    const { error } = await supabase.from("poc_assignments" as any).insert({ poc_id: id, engineer_id: assignEngineerId } as any);
    if (error) { toast.error(error.message); return; }
    setAssignEngineerId("");
    toast.success("Engineer assigned");
    fetchAll();
  };

  const handleUnassign = async (aid: string) => {
    await supabase.from("poc_assignments" as any).delete().eq("id", aid);
    fetchAll();
  };

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("poc_daily_updates" as any).insert({
      poc_id: id,
      engineer_id: user!.id,
      summary: updateForm.summary,
      blockers: updateForm.blockers || null,
      hours_worked: Number(updateForm.hours_worked) || 0,
      percentage_complete: Number(updateForm.percentage_complete) || 0,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Update added");
    setUpdateForm({ percentage_complete: 0, hours_worked: 0, summary: "" });
    fetchAll();
  };

  const handleAddStakeholder = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("poc_stakeholders" as any).insert({
      poc_id: id, name: stakeholderForm.name, email: stakeholderForm.email, role: stakeholderForm.role || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    setStakeholderForm({});
    fetchAll();
  };

  const handleRemoveStakeholder = async (sid: string) => {
    await supabase.from("poc_stakeholders" as any).delete().eq("id", sid);
    fetchAll();
  };

  const handleConvert = async () => {
    if (!poc) return;
    const { data: newProject, error } = await supabase.from("projects").insert({
      name: poc.name,
      client_name: poc.client_name,
      client_email: poc.client_email,
      client_company: poc.client_company,
      description: poc.description ? `${poc.description}\n\n[Converted from POC]` : "[Converted from POC]",
      status: "draft" as any,
      priority: poc.priority as any,
      start_date: poc.start_date,
      product_id: poc.product_id,
      product_version: poc.product_version,
      num_users: poc.num_users,
      num_channels: poc.num_channels,
      trunk: poc.trunk,
      location: poc.location,
      custom_fields: poc.custom_fields || {},
      created_by: user!.id,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("pocs" as any).update({
      status: "converted",
      converted_project_id: newProject.id,
      converted_at: new Date().toISOString(),
      is_archived: true,
    }).eq("id", id!);
    toast.success("POC converted to project");
    setConvertOpen(false);
    navigate(`/projects/${newProject.id}`);
  };

  if (!poc) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/pocs")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Lightbulb className="h-5 w-5" /> {poc.name}</h1>
            <p className="text-sm text-muted-foreground">{poc.client_name} {poc.client_company && `• ${poc.client_company}`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{STATUS_OPTIONS.find(s => s.value === poc.status)?.label || poc.status}</Badge>
          {canConvert && (
            <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
              <AlertDialogTrigger asChild><Button><Rocket className="h-4 w-4 mr-1" /> Convert to Project</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Convert POC to Project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a new project with the POC details copied over. The POC will be marked as Converted and archived (read-only) for historical reference.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConvert}>Convert</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {poc.converted_project_id && (
            <Button variant="outline" onClick={() => navigate(`/projects/${poc.converted_project_id}`)}>View Converted Project</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Progress</div><div className="text-2xl font-bold">{poc.progress_percentage}%</div><Progress value={poc.progress_percentage} className="mt-2" /></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Daily Updates</div><div className="text-2xl font-bold">{updates.length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Evaluation Date</div><div className="text-lg font-semibold">{poc.evaluation_date || "Not set"}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="updates">Daily Updates</TabsTrigger>
          <TabsTrigger value="stakeholders">Stakeholders</TabsTrigger>
          <TabsTrigger value="engineers">Engineers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card><CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>POC Name</Label><Input disabled={!canEdit} value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Client Name</Label><Input disabled={!canEdit} value={editing.client_name || ""} onChange={(e) => setEditing({ ...editing, client_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Client Email</Label><Input disabled={!canEdit} value={editing.client_email || ""} onChange={(e) => setEditing({ ...editing, client_email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Client Company</Label><Input disabled={!canEdit} value={editing.client_company || ""} onChange={(e) => setEditing({ ...editing, client_company: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select disabled={!canEdit} value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select disabled={!canEdit} value={editing.priority} onValueChange={(v) => setEditing({ ...editing, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low","medium","high","critical"].map(v => <SelectItem key={v} value={v}>{v[0].toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" disabled={!canEdit} value={editing.start_date || ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Evaluation Date</Label><Input type="date" disabled={!canEdit} value={editing.evaluation_date || ""} onChange={(e) => setEditing({ ...editing, evaluation_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={3} disabled={!canEdit} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Success Criteria</Label><Textarea rows={3} disabled={!canEdit} value={editing.success_criteria || ""} onChange={(e) => setEditing({ ...editing, success_criteria: e.target.value })} /></div>
            <Separator />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product & Deployment</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <select disabled={!canEdit} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" value={editing.product_id || ""} onChange={(e) => setEditing({ ...editing, product_id: e.target.value })}>
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Product Version</Label><Input disabled={!canEdit} value={editing.product_version || ""} onChange={(e) => setEditing({ ...editing, product_version: e.target.value })} /></div>
              <div className="space-y-2"><Label>No. of Users</Label><Input type="number" min={0} disabled={!canEdit} value={editing.num_users || ""} onChange={(e) => setEditing({ ...editing, num_users: e.target.value })} /></div>
              <div className="space-y-2"><Label>No. of Channels</Label><Input type="number" min={0} disabled={!canEdit} value={editing.num_channels || ""} onChange={(e) => setEditing({ ...editing, num_channels: e.target.value })} /></div>
              <div className="space-y-2"><Label>Trunk</Label><Input disabled={!canEdit} value={editing.trunk || ""} onChange={(e) => setEditing({ ...editing, trunk: e.target.value })} /></div>
              <div className="space-y-2"><Label>Location</Label><Input disabled={!canEdit} value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></div>
            </div>
            <Separator />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outcome</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Outcome</Label>
                <Select disabled={!canEdit} value={editing.outcome || ""} onValueChange={(v) => setEditing({ ...editing, outcome: v })}>
                  <SelectTrigger><SelectValue placeholder="Pending" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Reason / Notes</Label><Input disabled={!canEdit} value={editing.outcome_reason || ""} onChange={(e) => setEditing({ ...editing, outcome_reason: e.target.value })} /></div>
            </div>
            {canEdit && <Button onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Save Changes</Button>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="updates">
          <Card>
            <CardHeader><CardTitle>Daily Updates</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canEdit && (
                <form onSubmit={handleAddUpdate} className="space-y-3 border-b pb-4">
                  <Textarea required placeholder="Today's progress summary..." value={updateForm.summary} onChange={(e) => setUpdateForm({ ...updateForm, summary: e.target.value })} />
                  <Textarea placeholder="Blockers (optional)" value={updateForm.blockers || ""} onChange={(e) => setUpdateForm({ ...updateForm, blockers: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Hours Worked</Label><Input type="number" step="0.5" value={updateForm.hours_worked} onChange={(e) => setUpdateForm({ ...updateForm, hours_worked: e.target.value })} /></div>
                    <div className="space-y-1"><Label>% Complete</Label><Input type="number" min={0} max={100} value={updateForm.percentage_complete} onChange={(e) => setUpdateForm({ ...updateForm, percentage_complete: e.target.value })} /></div>
                  </div>
                  <Button type="submit"><Plus className="h-4 w-4 mr-1" /> Add Update</Button>
                </form>
              )}
              {updates.length === 0 ? <p className="text-sm text-muted-foreground">No updates yet.</p> : updates.map((u) => (
                <div key={u.id} className="border rounded p-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{u.update_date}</span><span>{u.hours_worked}h • {u.percentage_complete}%</span></div>
                  <p className="text-sm">{u.summary}</p>
                  {u.blockers && <p className="text-sm text-destructive">Blockers: {u.blockers}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stakeholders">
          <Card>
            <CardHeader><CardTitle>Stakeholders</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {canEdit && (
                <form onSubmit={handleAddStakeholder} className="grid grid-cols-4 gap-2">
                  <Input required placeholder="Name" value={stakeholderForm.name || ""} onChange={(e) => setStakeholderForm({ ...stakeholderForm, name: e.target.value })} />
                  <Input required type="email" placeholder="Email" value={stakeholderForm.email || ""} onChange={(e) => setStakeholderForm({ ...stakeholderForm, email: e.target.value })} />
                  <Input placeholder="Role" value={stakeholderForm.role || ""} onChange={(e) => setStakeholderForm({ ...stakeholderForm, role: e.target.value })} />
                  <Button type="submit" size="sm"><Plus className="h-4 w-4" /></Button>
                </form>
              )}
              {stakeholders.map((s) => (
                <div key={s.id} className="flex justify-between items-center border rounded p-2 text-sm">
                  <div><span className="font-medium">{s.name}</span> <span className="text-muted-foreground">({s.email})</span> {s.role && <Badge variant="outline" className="ml-2">{s.role}</Badge>}</div>
                  {canEdit && <Button variant="ghost" size="sm" onClick={() => handleRemoveStakeholder(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engineers">
          <Card>
            <CardHeader><CardTitle>Assigned Engineers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {canEdit && (
                <div className="flex gap-2">
                  <select className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" value={assignEngineerId} onChange={(e) => setAssignEngineerId(e.target.value)}>
                    <option value="">Select engineer to assign...</option>
                    {engineers.filter(en => !assignments.some(a => a.engineer_id === en.id)).map(en => (
                      <option key={en.id} value={en.id}>{en.first_name} {en.last_name} ({en.email})</option>
                    ))}
                  </select>
                  <Button onClick={handleAssign} disabled={!assignEngineerId}><Plus className="h-4 w-4 mr-1" /> Assign</Button>
                </div>
              )}
              {assignments.length === 0 ? <p className="text-sm text-muted-foreground">No engineers assigned yet.</p> : assignments.map((a) => {
                const en = engineers.find(x => x.id === a.engineer_id);
                return (
                  <div key={a.id} className="flex justify-between items-center border rounded p-2 text-sm">
                    <div>{en ? `${en.first_name} ${en.last_name} (${en.email})` : a.engineer_id}</div>
                    {canEdit && <Button variant="ghost" size="sm" onClick={() => handleUnassign(a.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
