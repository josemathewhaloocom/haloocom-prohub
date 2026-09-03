import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ChevronRight, ChevronDown, CircleAlert, Edit } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const TASK_STATUSES = ["open", "in_progress", "blocked", "done", "cancelled"] as const;
export const TASK_PRIORITIES = ["critical", "high", "medium", "low"] as const;

export const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

export const STATUS_STYLES: Record<string, string> = {
  open: "bg-primary/10 text-primary border-primary/30",
  in_progress: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  blocked: "bg-destructive/15 text-destructive border-destructive/30",
  done: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export const label = (v: string) =>
  v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  parent_task_id: string | null;
  project_id: string | null;
  poc_id: string | null;
  assignee_id: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  reminder_days_before: number;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
};

type Person = { id: string; first_name: string; last_name: string };

const selectCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const emptyForm = {
  title: "",
  description: "",
  assignee_id: "",
  priority: "medium",
  status: "open",
  due_date: "",
  reminder_days_before: 1,
  project_id: "",
  poc_id: "",
};

export function isOverdue(t: TaskRow) {
  return (
    !!t.due_date &&
    t.status !== "done" &&
    t.status !== "cancelled" &&
    new Date(t.due_date) < new Date(new Date().toDateString())
  );
}

interface Props {
  projectId?: string;
  pocId?: string;
  embedded?: boolean;
}

export default function TaskManager({ projectId, pocId, embedded }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [pocs, setPocs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [parentFor, setParentFor] = useState<TaskRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState({ status: "active", priority: "all", assignee: "all", project: "all", q: "" });

  const load = async () => {
    setLoading(true);
    let q = supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
    if (projectId) q = q.eq("project_id", projectId);
    if (pocId) q = q.eq("poc_id", pocId);
    const [{ data: t }, { data: p }, { data: pr }, { data: pc }] = await Promise.all([
      q,
      supabase.from("profiles").select("id, first_name, last_name").order("first_name"),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("pocs").select("id, name").eq("is_archived", false).order("name"),
    ]);
    setTasks((t ?? []) as TaskRow[]);
    setPeople((p ?? []) as Person[]);
    setProjects(pr ?? []);
    setPocs(pc ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, pocId]);

  const personName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = people.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const entityName = (t: TaskRow) => {
    if (t.project_id) return projects.find((p) => p.id === t.project_id)?.name ?? "Project";
    if (t.poc_id) return pocs.find((p) => p.id === t.poc_id)?.name ?? "POC";
    return "—";
  };

  const openCreate = (parent?: TaskRow) => {
    setEditing(null);
    setParentFor(parent ?? null);
    setForm({
      ...emptyForm,
      project_id: parent?.project_id ?? projectId ?? "",
      poc_id: parent?.poc_id ?? pocId ?? "",
    });
    setOpen(true);
  };

  const openEdit = (t: TaskRow) => {
    setEditing(t);
    setParentFor(null);
    setForm({
      title: t.title,
      description: t.description ?? "",
      assignee_id: t.assignee_id ?? "",
      priority: t.priority,
      status: t.status,
      due_date: t.due_date ?? "",
      reminder_days_before: t.reminder_days_before,
      project_id: t.project_id ?? "",
      poc_id: t.poc_id ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description || null,
      assignee_id: form.assignee_id || null,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date || null,
      reminder_days_before: Number(form.reminder_days_before) || 0,
      project_id: form.project_id || null,
      poc_id: form.project_id ? null : form.poc_id || null,
      completed_at: form.status === "done" ? new Date().toISOString() : null,
    };

    if (editing) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Task updated");
    } else {
      const { error } = await supabase.from("tasks").insert({
        ...payload,
        parent_task_id: parentFor?.id ?? null,
        created_by: user?.id,
      } as never);
      if (error) return toast.error(error.message);
      toast.success(parentFor ? "Sub-task added" : "Task created");
    }
    setOpen(false);
    load();
  };

  const quickStatus = async (t: TaskRow, status: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (t: TaskRow) => {
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Task deleted");
    load();
  };

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filters.status === "active" && (t.status === "done" || t.status === "cancelled")) return false;
      if (filters.status === "overdue" && !isOverdue(t)) return false;
      if (!["all", "active", "overdue"].includes(filters.status) && t.status !== filters.status) return false;
      if (filters.priority !== "all" && t.priority !== filters.priority) return false;
      if (filters.assignee !== "all" && t.assignee_id !== filters.assignee) return false;
      if (filters.project !== "all" && t.project_id !== filters.project) return false;
      if (filters.q && !t.title.toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filters]);

  const parents = filtered.filter((t) => !t.parent_task_id);
  const childrenOf = (id: string) => tasks.filter((t) => t.parent_task_id === id);
  const orphanChildren = filtered.filter(
    (t) => t.parent_task_id && !parents.some((p) => p.id === t.parent_task_id)
  );

  const rows = [...parents, ...orphanChildren];

  const renderRow = (t: TaskRow, depth = 0) => {
    const kids = childrenOf(t.id);
    const isOpenRow = expanded[t.id];
    const overdue = isOverdue(t);
    const dueToday = t.due_date === new Date().toISOString().slice(0, 10);
    return (
      <>
        <TableRow
          key={t.id}
          className={cn(overdue && "bg-destructive/5", !overdue && dueToday && "bg-amber-500/5")}
        >
          <TableCell style={{ paddingLeft: 12 + depth * 24 }}>
            <div className="flex items-center gap-2">
              {kids.length > 0 ? (
                <button onClick={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))}>
                  {isOpenRow ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="w-4" />
              )}
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {t.title}
                  {overdue && <CircleAlert className="h-4 w-4 text-destructive" />}
                </div>
                {t.description && (
                  <div className="line-clamp-1 text-xs text-muted-foreground">{t.description}</div>
                )}
                {kids.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {kids.filter((k) => k.status === "done").length}/{kids.length} sub-tasks done
                  </div>
                )}
              </div>
            </div>
          </TableCell>
          {!projectId && !pocId && <TableCell className="text-sm">{entityName(t)}</TableCell>}
          <TableCell className="text-sm">{personName(t.assignee_id)}</TableCell>
          <TableCell>
            <Badge variant="outline" className={PRIORITY_STYLES[t.priority]}>
              {label(t.priority)}
            </Badge>
          </TableCell>
          <TableCell>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={t.status}
              onChange={(e) => quickStatus(t, e.target.value)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </TableCell>
          <TableCell className={cn("text-sm", overdue && "font-semibold text-destructive")}>
            {t.due_date ?? "—"}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              {!t.parent_task_id && (
                <Button size="sm" variant="ghost" onClick={() => openCreate(t)} title="Add sub-task">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {isOpenRow && kids.map((k) => renderRow(k, depth + 1))}
      </>
    );
  };

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search tasks..."
          className="h-9 w-48"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
          <option value="all">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
        >
          <option value="all">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {label(p)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={filters.assignee}
          onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
        >
          <option value="all">All assignees</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.first_name} {p.last_name}
            </option>
          ))}
        </select>
        {!projectId && !pocId && (
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filters.project}
            onChange={(e) => setFilters({ ...filters, project: e.target.value })}
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" className="ml-auto" onClick={() => openCreate()}>
          <Plus className="mr-1 h-4 w-4" /> Create Task
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              {!projectId && !pocId && <TableHead>Project / POC</TableHead>}
              <TableHead>Assignee</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No tasks match these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t) => renderRow(t))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Task" : parentFor ? `Sub-task of "${parentFor.title}"` : "Create Task"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {!projectId && !pocId && !parentFor && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Project</Label>
                  <select
                    className={selectCls}
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value, poc_id: "" })}
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>POC</Label>
                  <select
                    className={selectCls}
                    value={form.poc_id}
                    disabled={!!form.project_id}
                    onChange={(e) => setForm({ ...form, poc_id: e.target.value })}
                  >
                    <option value="">None</option>
                    {pocs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Assignee</Label>
                <select
                  className={selectCls}
                  value={form.assignee_id}
                  onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Priority</Label>
                <select
                  className={selectCls}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {label(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className={selectCls}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Alert (days before due)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.reminder_days_before}
                  onChange={(e) => setForm({ ...form, reminder_days_before: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
