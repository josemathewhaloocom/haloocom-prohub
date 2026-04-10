import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, Clock, AlertTriangle, Calendar, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type DailyUpdate = Database["public"]["Tables"]["daily_updates"]["Row"];

interface UpdateWithProject extends DailyUpdate {
  project_name?: string;
  engineer_name?: string;
}

export default function DailyUpdates() {
  const { user, isProjectManager, isSupportEngineer, isEngineering } = useAuth();
  const isAnyEngineer = isSupportEngineer || isEngineering;
  const [updates, setUpdates] = useState<UpdateWithProject[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterProject, setFilterProject] = useState("all");

  const [form, setForm] = useState({
    project_id: "",
    summary: "",
    percentage_complete: 0,
    hours_worked: 0,
    blockers: "",
    update_date: new Date().toISOString().split("T")[0],
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<UpdateWithProject | null>(null);
  const [editForm, setEditForm] = useState({
    summary: "",
    percentage_complete: 0,
    hours_worked: 0,
    blockers: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from("daily_updates")
      .select("*")
      .order("update_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (!data?.length) { setUpdates([]); return; }

    const projectIds = [...new Set(data.map((u) => u.project_id))];
    const { data: projectsData } = await supabase.from("projects").select("id, name").in("id", projectIds);
    const projectMap = new Map((projectsData ?? []).map((p) => [p.id, p.name]));

    const engineerIds = [...new Set(data.map((u) => u.engineer_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", engineerIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));

    setUpdates(
      data.map((u) => ({
        ...u,
        project_name: projectMap.get(u.project_id) ?? "Unknown",
        engineer_name: profileMap.get(u.engineer_id) ?? "Unknown",
      }))
    );
  };

  const fetchProjects = async () => {
    if (isProjectManager) {
      const { data } = await supabase.from("projects").select("id, name").neq("status", "closed" as any);
      setProjects(data ?? []);
    } else if (user) {
      const { data: assignments } = await supabase
        .from("project_assignments")
        .select("project_id")
        .eq("engineer_id", user.id);
      if (!assignments?.length) { setProjects([]); return; }
      const ids = assignments.map((a) => a.project_id);
      const { data } = await supabase.from("projects").select("id, name").in("id", ids).neq("status", "closed" as any);
      setProjects(data ?? []);
    }
  };

  useEffect(() => {
    fetchUpdates();
    fetchProjects();
  }, [isProjectManager, isEngineer, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const { error } = await supabase.from("daily_updates").insert({
      project_id: form.project_id,
      engineer_id: user.id,
      summary: form.summary,
      percentage_complete: form.percentage_complete,
      hours_worked: form.hours_worked,
      blockers: form.blockers || null,
      update_date: form.update_date,
    });

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }

    await supabase.from("projects").update({ progress_percentage: form.percentage_complete }).eq("id", form.project_id);

    toast.success("Daily update submitted!");
    setDialogOpen(false);
    setForm({
      project_id: "",
      summary: "",
      percentage_complete: 0,
      hours_worked: 0,
      blockers: "",
      update_date: new Date().toISOString().split("T")[0],
    });
    fetchUpdates();
  };

  const handleEditUpdate = (update: UpdateWithProject) => {
    setEditingUpdate(update);
    setEditForm({
      summary: update.summary,
      percentage_complete: update.percentage_complete,
      hours_worked: update.hours_worked,
      blockers: update.blockers || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUpdate) return;
    setSavingEdit(true);
    const { error } = await supabase.from("daily_updates").update({
      summary: editForm.summary,
      percentage_complete: editForm.percentage_complete,
      hours_worked: editForm.hours_worked,
      blockers: editForm.blockers || null,
    }).eq("id", editingUpdate.id);
    setSavingEdit(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Update edited!");
    setEditDialogOpen(false);
    setEditingUpdate(null);
    fetchUpdates();
  };

  const handleDeleteUpdate = async (updateId: string) => {
    const { error } = await supabase.from("daily_updates").delete().eq("id", updateId);
    if (error) { toast.error(error.message); return; }
    toast.success("Update deleted!");
    fetchUpdates();
  };

  const filtered = filterProject === "all" ? updates : updates.filter((u) => u.project_id === filterProject);
  const updateProjects = [...new Map(updates.map((u) => [u.project_id, u.project_name])).entries()];

  // Engineers (including PM with engineer role) can submit updates
  const canSubmit = isEngineer && projects.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Updates</h1>
          <p className="text-muted-foreground">
            {isProjectManager && !isEngineer ? "View all engineer progress updates." : "Submit and track your daily progress."}
          </p>
        </div>
        {canSubmit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Submit Update</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Submit Daily Update</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Project *</Label>
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.update_date} onChange={(e) => setForm({ ...form, update_date: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label>Summary *</Label>
                  <Textarea
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    placeholder="What did you work on today?"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Progress: {form.percentage_complete}%</Label>
                  <Slider
                    value={[form.percentage_complete]}
                    onValueChange={([v]) => setForm({ ...form, percentage_complete: v })}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hours Worked</Label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={form.hours_worked}
                    onChange={(e) => setForm({ ...form, hours_worked: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Blockers</Label>
                  <Textarea
                    value={form.blockers}
                    onChange={(e) => setForm({ ...form, blockers: e.target.value })}
                    placeholder="Any blockers or issues?"
                    rows={2}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={!form.project_id || !form.summary || submitting}>
                  {submitting ? "Submitting..." : "Submit Update"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {updateProjects.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No updates found. {isEngineer && "Submit your first daily update!"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((update) => (
            <Card key={update.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                        {update.project_name}
                      </Badge>
                      {isProjectManager && (
                        <span className="text-xs text-muted-foreground">by {update.engineer_name}</span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {update.update_date}
                      </div>
                    </div>

                    <p className="text-sm">{update.summary}</p>

                    {update.blockers && (
                      <div className="flex items-start gap-2 rounded-md bg-destructive/5 p-2 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        {update.blockers}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${update.percentage_complete}%` }} />
                      </div>
                      <span className="text-xs font-medium">{update.percentage_complete}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {update.hours_worked}h
                    </div>
                    {isProjectManager && (
                      <div className="flex items-center gap-1 mt-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditUpdate(update)} title="Edit"><Edit className="h-3 w-3" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" title="Delete"><Trash2 className="h-3 w-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Update</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete this daily update. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteUpdate(update.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Daily Update</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea value={editForm.summary} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Progress: {editForm.percentage_complete}%</Label>
              <Slider value={[editForm.percentage_complete]} onValueChange={([v]) => setEditForm({ ...editForm, percentage_complete: v })} max={100} step={5} />
            </div>
            <div className="space-y-2">
              <Label>Hours Worked</Label>
              <Input type="number" min={0} max={24} step={0.5} value={editForm.hours_worked} onChange={(e) => setEditForm({ ...editForm, hours_worked: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Blockers</Label>
              <Textarea value={editForm.blockers} onChange={(e) => setEditForm({ ...editForm, blockers: e.target.value })} rows={2} />
            </div>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="w-full">{savingEdit ? "Saving..." : "Save Changes"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
