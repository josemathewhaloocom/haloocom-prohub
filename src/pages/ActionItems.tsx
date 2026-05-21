import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";

const PRIORITY_STYLES: Record<string, string> = {
  Critical: "bg-destructive/10 text-destructive border-destructive/20",
  High: "bg-warning/10 text-warning border-warning/20",
  Medium: "bg-info/10 text-info border-info/20",
  Low: "bg-muted text-muted-foreground border-border",
};

const STATUS_STYLES: Record<string, string> = {
  Open: "bg-warning/10 text-warning border-warning/20",
  "In Progress": "bg-info/10 text-info border-info/20",
  Completed: "bg-success/10 text-success border-success/20",
  Cancelled: "bg-muted text-muted-foreground border-border",
};

export default function ActionItems() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [projects, setProjects] = useState<Record<string, any>>({});
  const [pocs, setPocs] = useState<Record<string, any>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [statusFilter, setStatusFilter] = useState("Open");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchAll = async () => {
    const [{ data: ai }, { data: pr }, { data: po }, { data: profs }] = await Promise.all([
      supabase.from("standup_action_items" as any).select("*").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("projects").select("id, name, client_name"),
      supabase.from("pocs" as any).select("id, name, client_name"),
      supabase.from("profiles").select("id, first_name, last_name, email"),
    ]);
    setRows((ai as any) ?? []);
    const pm: Record<string, any> = {}; (pr ?? []).forEach((p: any) => (pm[p.id] = p)); setProjects(pm);
    const om: Record<string, any> = {}; ((po as any) ?? []).forEach((p: any) => (om[p.id] = p)); setPocs(om);
    const um: Record<string, any> = {}; (profs ?? []).forEach((u: any) => (um[u.id] = u)); setProfiles(um);
  };

  useEffect(() => { fetchAll(); }, []);

  const targetLabel = (r: any) => {
    if (r.project_id) { const p = projects[r.project_id]; return p ? `${p.name} — ${p.client_name}` : "Project"; }
    const p = pocs[r.poc_id]; return p ? `[POC] ${p.name} — ${p.client_name}` : "POC";
  };

  const userName = (id?: string) => {
    if (!id) return "—";
    const u = profiles[id];
    return u ? `${u.first_name} ${u.last_name}`.trim() || u.email : "User";
  };

  const isOverdue = (r: any) => r.status !== "Completed" && r.status !== "Cancelled" && r.due_date && r.due_date < new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
    if (assigneeFilter !== "all" && r.assigned_to !== assigneeFilter) return false;
    if (search && !(`${r.description ?? ""} ${targetLabel(r)}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  }), [rows, statusFilter, priorityFilter, assigneeFilter, search, projects, pocs]);

  const markComplete = async (id: string) => {
    const { error } = await supabase.from("standup_action_items" as any).update({ status: "Completed", closed_date: new Date().toISOString().slice(0, 10) }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked complete");
    fetchAll();
  };

  const stats = useMemo(() => ({
    open: rows.filter((r) => r.status === "Open").length,
    inProgress: rows.filter((r) => r.status === "In Progress").length,
    overdue: rows.filter(isOverdue).length,
    critical: rows.filter((r) => r.priority === "Critical" && r.status !== "Completed").length,
  }), [rows]);

  const assignees = useMemo(() => {
    const ids = new Set(rows.map((r) => r.assigned_to).filter(Boolean));
    return Array.from(ids);
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/standups"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Back</Button></Link>
          <div>
            <h1 className="text-2xl font-bold">Action Items</h1>
            <p className="text-sm text-muted-foreground">All open and closed action items across standups</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Open", value: stats.open, color: "text-warning" },
          { label: "In Progress", value: stats.inProgress, color: "text-info" },
          { label: "Overdue", value: stats.overdue, color: "text-destructive" },
          { label: "Critical Open", value: stats.critical, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">All Statuses</option>
              {["Open", "In Progress", "Completed", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">All Priorities</option>
              {["Critical", "High", "Medium", "Low"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">All Assignees</option>
              {assignees.map((id) => <option key={id} value={id}>{userName(id)}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project / POC</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className={isOverdue(r) ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">{targetLabel(r)}</TableCell>
                  <TableCell className="max-w-md whitespace-pre-wrap text-sm">{r.description}</TableCell>
                  <TableCell>{userName(r.assigned_to)}</TableCell>
                  <TableCell><Badge variant="outline" className={PRIORITY_STYLES[r.priority] ?? ""}>{r.priority}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_STYLES[r.status] ?? ""}>{r.status}</Badge></TableCell>
                  <TableCell className={isOverdue(r) ? "font-medium text-destructive" : ""}>{r.due_date ?? "—"}</TableCell>
                  <TableCell>
                    {r.status !== "Completed" && r.status !== "Cancelled" && (
                      <Button size="sm" variant="ghost" onClick={() => markComplete(r.id)}><Check className="mr-1 h-3 w-3" />Close</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No action items match the filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
