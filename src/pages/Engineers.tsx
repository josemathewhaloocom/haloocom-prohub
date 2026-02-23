import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, FolderKanban, UserPlus, CheckCircle2, Clock, PauseCircle } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

interface EngineerProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  completed: number;
  in_progress: number;
  on_hold: number;
  total: number;
}

export default function Engineers() {
  const { role } = useAuth();
  const [engineers, setEngineers] = useState<EngineerProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchEngineers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "engineer");
    if (!roles?.length) { setEngineers([]); return; }

    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
    const { data: assignments } = await supabase.from("project_assignments").select("engineer_id, project_id");
    const { data: projects } = await supabase.from("projects").select("id, status, start_date, deadline");
    const projectMap = new Map((projects ?? []).map(p => [p.id, p]));

    setEngineers(
      (profiles ?? []).map((p) => {
        const engAssignments = (assignments ?? []).filter(a => a.engineer_id === p.id);
        let completed = 0, in_progress = 0, on_hold = 0, total = 0;

        engAssignments.forEach(a => {
          const proj = projectMap.get(a.project_id);
          if (!proj) return;
          if (dateFrom && proj.start_date && proj.start_date < dateFrom) return;
          if (dateTo && proj.deadline && proj.deadline > dateTo) return;

          total++;
          const s = proj.status as string;
          if (s === "closed") completed++;
          else if (s === "in_progress") in_progress++;
          else if (s === "on_hold") on_hold++;
        });

        return { id: p.id, first_name: p.first_name, last_name: p.last_name, email: p.email, completed, in_progress, on_hold, total };
      })
    );
  };

  useEffect(() => { fetchEngineers(); }, [dateFrom, dateTo]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("invite-engineer", { body: form });
    setSubmitting(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Failed to create engineer"); return; }
    toast.success(`Engineer ${form.first_name} created successfully!`);
    setDialogOpen(false);
    setForm({ email: "", password: "", first_name: "", last_name: "" });
    fetchEngineers();
  };

  if (role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Engineers</h1>
          <p className="text-muted-foreground">Manage team members and workload.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Add Engineer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Engineer</DialogTitle></DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>First Name *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Last Name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Creating..." : "Create Engineer Account"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" placeholder="To" />
        {(dateFrom || dateTo) && <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Users className="h-5 w-5" /></div>
            <div><p className="text-sm text-muted-foreground">Total Engineers</p><p className="text-2xl font-bold">{engineers.length}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Engineer Directory</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>In Progress</TableHead>
                <TableHead>On Hold</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {engineers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No engineers registered yet.</TableCell></TableRow>
              ) : engineers.map((eng) => (
                <TableRow key={eng.id}>
                  <TableCell className="font-medium">{eng.first_name} {eng.last_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{eng.email}</TableCell>
                  <TableCell><Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3" /> {eng.completed}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="gap-1 bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3" /> {eng.in_progress}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/20"><PauseCircle className="h-3 w-3" /> {eng.on_hold}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="gap-1"><FolderKanban className="h-3 w-3" /> {eng.total}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
