import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Lightbulb } from "lucide-react";
import { toast } from "sonner";

type POC = any;

const STATUS_OPTIONS = [
  { value: "in_progress", label: "In Progress" },
  { value: "evaluation", label: "Evaluation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "on_hold", label: "On Hold" },
  { value: "converted", label: "Converted" },
];

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-warning/10 text-warning border-warning/20",
  evaluation: "bg-info/10 text-info border-info/20",
  won: "bg-success/10 text-success border-success/20",
  lost: "bg-destructive/10 text-destructive border-destructive/20",
  on_hold: "bg-muted text-muted-foreground border-border",
  converted: "bg-primary/10 text-primary border-primary/20",
};

export default function POCs() {
  const { user, isProjectManager, isSales, isSalesManager, isAdminManager, isCEO } = useAuth();
  const navigate = useNavigate();
  const [pocs, setPocs] = useState<POC[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({ status: "in_progress", priority: "medium" });
  const [products, setProducts] = useState<any[]>([]);
  const [engineers, setEngineers] = useState<any[]>([]);
  const [aiReps, setAiReps] = useState<any[]>([]);
  const [techReps, setTechReps] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const PHASE_OPTIONS = ["Kickoff", "Requirements", "Design", "Development", "UAT", "Go-Live", "Closed"];

  const canCreate = isProjectManager || isSales || isSalesManager || isAdminManager || isCEO;

  const fetchPocs = async () => {
    const { data, error } = await supabase.from("pocs" as any).select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setPocs((data as any) ?? []);
  };

  const fetchMeta = async () => {
    const [{ data: prod }, { data: roles }] = await Promise.all([
      supabase.from("product_catalog").select("*").eq("is_active", true).order("name"),
      supabase.from("user_roles").select("user_id, role").in("role", ["support_engineer", "engineering"] as any),
    ]);
    setProducts(prod ?? []);
    const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", ids);
      setEngineers(profs ?? []);
    }
  };

  useEffect(() => { fetchPocs(); fetchMeta(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: created, error } = await supabase.from("pocs" as any).insert({
      name: form.name,
      client_name: form.client_name,
      client_email: form.client_email || null,
      client_company: form.client_company || null,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      start_date: form.start_date || null,
      evaluation_date: form.evaluation_date || null,
      success_criteria: form.success_criteria || null,
      product_id: form.product_id || null,
      product_version: form.product_version || null,
      num_users: form.num_users ? Number(form.num_users) : null,
      num_channels: form.num_channels ? Number(form.num_channels) : null,
      trunk: form.trunk || null,
      location: form.location || null,
      created_by: user!.id,
    } as any).select().single();
    if (error) { toast.error(error.message); return; }
    if (form.engineer_id && created) {
      await supabase.from("poc_assignments" as any).insert({ poc_id: (created as any).id, engineer_id: form.engineer_id } as any);
    }
    toast.success("POC created!");
    setDialogOpen(false);
    setForm({ status: "in_progress", priority: "medium" });
    fetchPocs();
  };

  const filtered = pocs.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.client_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Lightbulb className="h-6 w-6" /> POCs</h1>
          <p className="text-muted-foreground">Track Proof of Concepts and convert successful ones into projects.</p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New POC</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create POC</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2"><Label>POC Name *</Label><Input required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Client Name *</Label><Input required value={form.client_name || ""} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Client Email</Label><Input type="email" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Client Company</Label><Input value={form.client_company || ""} onChange={(e) => setForm({ ...form, client_company: e.target.value })} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="space-y-2">
                  <Label>Success Criteria</Label>
                  <Textarea rows={3} placeholder="What needs to be achieved for this POC to be considered successful?" value={form.success_criteria || ""} onChange={(e) => setForm({ ...form, success_criteria: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["low","medium","high","critical"].map(v => <SelectItem key={v} value={v}>{v[0].toUpperCase()+v.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_OPTIONS.filter(s => s.value !== "converted").map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Evaluation Date</Label><Input type="date" value={form.evaluation_date || ""} onChange={(e) => setForm({ ...form, evaluation_date: e.target.value })} /></div>
                </div>
                <div className="border-t pt-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Product & Deployment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Product Name</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.product_id || ""} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                        <option value="">Select product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2"><Label>Product Version</Label><Input value={form.product_version || ""} onChange={(e) => setForm({ ...form, product_version: e.target.value })} /></div>
                    <div className="space-y-2"><Label>No. of Users</Label><Input type="number" min={0} value={form.num_users || ""} onChange={(e) => setForm({ ...form, num_users: e.target.value })} /></div>
                    <div className="space-y-2"><Label>No. of Channels</Label><Input type="number" min={0} value={form.num_channels || ""} onChange={(e) => setForm({ ...form, num_channels: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Trunk</Label><Input value={form.trunk || ""} onChange={(e) => setForm({ ...form, trunk: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Location</Label><Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Assign Engineer</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.engineer_id || ""} onChange={(e) => setForm({ ...form, engineer_id: e.target.value })}>
                      <option value="">Select engineer (optional)</option>
                      {engineers.map(en => <option key={en.id} value={en.id}>{en.first_name} {en.last_name} ({en.email})</option>)}
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full">Create POC</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search POCs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Evaluation</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No POCs yet.</TableCell></TableRow>
              ) : filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(`/pocs/${p.id}`)}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.client_name}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_STYLES[p.status]}>{STATUS_OPTIONS.find(s => s.value === p.status)?.label || p.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{p.priority}</Badge></TableCell>
                  <TableCell>{p.evaluation_date || "—"}</TableCell>
                  <TableCell>{p.progress_percentage}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
