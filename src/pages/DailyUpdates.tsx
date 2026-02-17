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
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, Clock, AlertTriangle, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type DailyUpdate = Database["public"]["Tables"]["daily_updates"]["Row"];

interface UpdateWithProject extends DailyUpdate {
  project_name?: string;
  engineer_name?: string;
}

export default function DailyUpdates() {
  const { user, role } = useAuth();
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

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from("daily_updates")
      .select("*")
      .order("update_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (!data?.length) { setUpdates([]); return; }

    // Fetch project names
    const projectIds = [...new Set(data.map((u) => u.project_id))];
    const { data: projectsData } = await supabase.from("projects").select("id, name").in("id", projectIds);
    const projectMap = new Map((projectsData ?? []).map((p) => [p.id, p.name]));

    // Fetch engineer names
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
    // Engineers only see assigned projects; admins see all
    if (role === "admin") {
      const { data } = await supabase.from("projects").select("id, name").neq("status", "completed");
      setProjects(data ?? []);
    } else if (user) {
      const { data: assignments } = await supabase
        .from("project_assignments")
        .select("project_id")
        .eq("engineer_id", user.id);
      if (!assignments?.length) { setProjects([]); return; }
      const ids = assignments.map((a) => a.project_id);
      const { data } = await supabase.from("projects").select("id, name").in("id", ids).neq("status", "completed");
      setProjects(data ?? []);
    }
  };

  useEffect(() => {
    fetchUpdates();
    fetchProjects();
  }, [role, user]);

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

    // Also update project progress
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

  const filtered = filterProject === "all" ? updates : updates.filter((u) => u.project_id === filterProject);

  // All unique projects from updates for filter
  const updateProjects = [...new Map(updates.map((u) => [u.project_id, u.project_name])).entries()];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Updates</h1>
          <p className="text-muted-foreground">
            {role === "admin" ? "View all engineer progress updates." : "Submit and track your daily progress."}
          </p>
        </div>
        {role === "engineer" && projects.length > 0 && (
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

      {/* Filter */}
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

      {/* Updates List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No updates found. {role === "engineer" && "Submit your first daily update!"}
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
                      {role === "admin" && (
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
