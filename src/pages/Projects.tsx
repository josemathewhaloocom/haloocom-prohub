import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];

interface Product { id: string; name: string; }
interface ProjectForm extends Partial<ProjectInsert> {
  product_id?: string; product_version?: string; num_users?: number;
  num_channels?: number; trunk?: string; location?: string;
}

const PROJECT_STATUSES = [
  { value: "open", label: "Open" },
  { value: "qc_completed", label: "QC Completed" },
  { value: "kick_off_scheduled", label: "Kick-Off Scheduled" },
  { value: "site_ready", label: "Site Ready" },
  { value: "on_hold", label: "On Hold" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "client_signing_pending", label: "Client Signing Pending" },
  { value: "client_signed", label: "Client Signed" },
  { value: "pending_admin_approval", label: "Pending Admin Approval" },
  { value: "closed", label: "Closed" },
];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-info/10 text-info border-info/20",
  qc_completed: "bg-info/10 text-info border-info/20",
  kick_off_scheduled: "bg-info/10 text-info border-info/20",
  site_ready: "bg-info/10 text-info border-info/20",
  on_hold: "bg-destructive/10 text-destructive border-destructive/20",
  scheduled: "bg-warning/10 text-warning border-warning/20",
  in_progress: "bg-warning/10 text-warning border-warning/20",
  client_signing_pending: "bg-warning/10 text-warning border-warning/20",
  client_signed: "bg-success/10 text-success border-success/20",
  pending_admin_approval: "bg-warning/10 text-warning border-warning/20",
  closed: "bg-success/10 text-success border-success/20",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground", medium: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning", critical: "bg-destructive/10 text-destructive",
};

export default function Projects() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>({ status: "open" as any, priority: "medium" });
  const [products, setProducts] = useState<Product[]>([]);

  // Date filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Extra data for columns
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [engineerMap, setEngineerMap] = useState<Record<string, string>>({});

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects(data ?? []);

    // Fetch product names
    const { data: prods } = await supabase.from("product_catalog" as any).select("id, name");
    const pm: Record<string, string> = {};
    ((prods as any[]) ?? []).forEach((p: any) => { pm[p.id] = p.name; });
    setProductMap(pm);

    // Fetch assignments + profiles for engineer names
    const { data: assignments } = await supabase.from("project_assignments").select("project_id, engineer_id");
    if (assignments?.length) {
      const engIds = [...new Set(assignments.map(a => a.engineer_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", engIds);
      const profMap = new Map((profiles ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`]));
      const em: Record<string, string> = {};
      assignments.forEach(a => { em[a.project_id] = profMap.get(a.engineer_id) ?? ""; });
      setEngineerMap(em);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("product_catalog" as any).select("id, name").eq("is_active", true).order("name");
    setProducts((data as unknown as Product[]) ?? []);
  };

  useEffect(() => { fetchProjects(); }, []);
  useEffect(() => { if (dialogOpen) fetchProducts(); }, [dialogOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("projects").insert({
      name: form.name!, client_name: form.client_name!, client_email: form.client_email,
      client_company: form.client_company, description: form.description, status: form.status,
      priority: form.priority, start_date: form.start_date, deadline: form.deadline,
      budget: form.budget, created_by: user!.id,
      ...(form.product_id ? { product_id: form.product_id } : {}),
      ...(form.product_version ? { product_version: form.product_version } : {}),
      ...(form.num_users != null ? { num_users: form.num_users } : {}),
      ...(form.num_channels != null ? { num_channels: form.num_channels } : {}),
      ...(form.trunk ? { trunk: form.trunk } : {}),
      ...(form.location ? { location: form.location } : {}),
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Project created!");
    setDialogOpen(false);
    setForm({ status: "open" as any, priority: "medium" });
    fetchProjects();
  };

  const filtered = projects.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.client_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    let matchDate = true;
    if (dateFrom) matchDate = matchDate && (!!(p.start_date && p.start_date >= dateFrom) || !!(p.deadline && p.deadline >= dateFrom));
    if (dateTo) matchDate = matchDate && (!!(p.start_date && p.start_date <= dateTo) || !!(p.deadline && p.deadline <= dateTo));
    return matchSearch && matchStatus && matchDate;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage all engineering projects.</p>
        </div>
        {role === "admin" && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Project</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2"><Label>Project Name *</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Client Name *</Label><Input value={form.client_name || ""} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required /></div>
                  <div className="space-y-2"><Label>Client Email</Label><Input type="email" value={form.client_email || ""} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Client Company</Label><Input value={form.client_company || ""} onChange={(e) => setForm({ ...form, client_company: e.target.value })} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={(form.status as string) || "open"} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={form.priority || "medium"} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Go Live Date</Label><Input type="date" value={form.deadline || ""} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Budget</Label><Input type="number" value={form.budget ?? ""} onChange={(e) => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : undefined })} /></div>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Product Name</Label>
                    <Select value={form.product_id || ""} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Version</Label><Input placeholder="e.g. v2.1" value={form.product_version || ""} onChange={(e) => setForm({ ...form, product_version: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>No. of Users</Label><Input type="number" min={0} value={form.num_users ?? ""} onChange={(e) => setForm({ ...form, num_users: e.target.value ? Number(e.target.value) : undefined })} /></div>
                  <div className="space-y-2"><Label>No. of Channels</Label><Input type="number" min={0} value={form.num_channels ?? ""} onChange={(e) => setForm({ ...form, num_channels: e.target.value ? Number(e.target.value) : undefined })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Trunk</Label><Input placeholder="e.g. SIP" value={form.trunk || ""} onChange={(e) => setForm({ ...form, trunk: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Location</Label><Input placeholder="e.g. Dubai HQ" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                </div>
                <Button type="submit" className="w-full">Create Project</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PROJECT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" placeholder="To" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Engineer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Go Live Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No projects found.</TableCell></TableRow>
              ) : filtered.map((p) => {
                const statusLabel = PROJECT_STATUSES.find(s => s.value === p.status)?.label || p.status.replace(/_/g, " ");
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/projects/${p.id}`)}>
                    <TableCell>
                      <div className="text-sm font-medium">{p.client_name}</div>
                      <div className="text-xs text-muted-foreground">{p.name}</div>
                    </TableCell>
                    <TableCell className="text-sm">{p.product_id ? productMap[p.product_id] || "—" : "—"}</TableCell>
                    <TableCell className="text-sm">{engineerMap[p.id] || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${STATUS_STYLES[p.status] || ""}`}>{statusLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${p.progress_percentage}%` }} /></div>
                        <span className="text-xs text-muted-foreground">{p.progress_percentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.start_date || "—"}</TableCell>
                    <TableCell className="text-sm">{p.deadline || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
