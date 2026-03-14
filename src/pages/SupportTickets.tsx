import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, Trash2, Pencil, Eye, Upload, Clock, FileText,
  AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TicketConfig {
  id: string; field_name: string; field_value: string;
  parent_value: string | null; sort_order: number; is_active: boolean;
}

interface Ticket {
  id: string; ticket_id: string; project_id: string;
  client_name: string; client_email: string | null;
  product_name: string | null; admin_email: string | null;
  status: string; priority: string; department: string;
  subject: string; description: string | null; resolution: string | null;
  issue_reported_via: string; case_type: string;
  category: string; sub_category: string | null;
  assigned_engineer_id: string | null; created_by: string;
  report_file_url: string | null;
  created_at: string; updated_at: string; closed_at: string | null;
}

interface TicketLog {
  id: string; ticket_id: string; field_name: string;
  old_value: string | null; new_value: string | null;
  changed_by: string; changed_at: string;
}

interface ProjectOption {
  id: string; name: string; client_name: string;
  client_email: string | null; product_name: string | null;
  admin_email: string | null;
}

interface EngineerOption { id: string; first_name: string; last_name: string; email: string; }

const PRIORITY_STYLES: Record<string, string> = {
  Critical: "bg-destructive/10 text-destructive border-destructive/30",
  High: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  Moderate: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  Low: "bg-muted text-muted-foreground border-muted",
};

const STATUS_STYLES: Record<string, string> = {
  Open: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  "In-progress": "bg-primary/10 text-primary border-primary/30",
  Hold: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  "Awaiting Client Confirmation": "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  Closed: "bg-muted text-muted-foreground border-muted",
};

const emptyForm = {
  project_id: "", client_name: "", client_email: "", product_name: "",
  admin_email: "", status: "Open", priority: "High", department: "",
  subject: "", description: "", resolution: "", issue_reported_via: "",
  case_type: "", category: "", sub_category: "",
  assigned_engineer_id: "",
};

export default function SupportTickets() {
  const { user, isProjectManager, isEngineer } = useAuth();
  const canCreate = isProjectManager || isEngineer;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [configs, setConfigs] = useState<TicketConfig[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [engineers, setEngineers] = useState<EngineerOption[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [ticketLogs, setTicketLogs] = useState<TicketLog[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [projectSearch, setProjectSearch] = useState("");

  const getOptions = (fieldName: string) =>
    configs.filter(c => c.field_name === fieldName && c.is_active).sort((a, b) => a.sort_order - b.sort_order);

  const subCategories = useMemo(
    () => configs.filter(c => c.field_name === "sub_category" && c.is_active && c.parent_value === form.category).sort((a, b) => a.sort_order - b.sort_order),
    [configs, form.category]
  );

  const fetchAll = async () => {
    setLoading(true);
    const [ticketRes, configRes, projectRes, engRes, profileRes] = await Promise.all([
      supabase.from("support_tickets" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("support_ticket_config" as any).select("*").order("sort_order"),
      supabase.from("projects").select("id, name, client_name, client_email, product_id").order("name"),
      supabase.from("profiles").select("id, first_name, last_name, email"),
      supabase.from("profiles").select("id, first_name, last_name"),
    ]);

    setTickets((ticketRes.data as any) ?? []);
    setConfigs((configRes.data as any) ?? []);

    // Enrich projects with product names
    const rawProjects = (projectRes.data ?? []) as any[];
    const productIds = [...new Set(rawProjects.map(p => p.product_id).filter(Boolean))];
    let productMap: Record<string, string> = {};
    if (productIds.length) {
      const { data: prods } = await supabase.from("product_catalog" as any).select("id, name").in("id", productIds);
      (prods as any[])?.forEach(p => { productMap[p.id] = p.name; });
    }
    setProjects(rawProjects.map(p => ({
      id: p.id, name: p.name, client_name: p.client_name,
      client_email: p.client_email,
      product_name: p.product_id ? (productMap[p.product_id] || "") : "",
      admin_email: p.client_email,
    })));

    const engs = (engRes.data ?? []) as any[];
    setEngineers(engs);

    const pMap: Record<string, string> = {};
    ((profileRes.data ?? []) as any[]).forEach(p => { pMap[p.id] = `${p.first_name} ${p.last_name}`.trim() || p.id; });
    setProfileMap(pMap);

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projects;
    const q = projectSearch.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q));
  }, [projects, projectSearch]);

  const onProjectSelect = (projectId: string) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      setForm(f => ({
        ...f,
        project_id: proj.id,
        client_name: proj.client_name,
        client_email: proj.client_email || "",
        product_name: proj.product_name || "",
        admin_email: proj.admin_email || "",
      }));
    }
  };

  const openCreate = () => {
    setEditingTicket(null);
    setForm({ ...emptyForm, assigned_engineer_id: user?.id || "" });
    setReportFile(null);
    setDialogOpen(true);
  };

  const openEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setForm({
      project_id: ticket.project_id,
      client_name: ticket.client_name,
      client_email: ticket.client_email || "",
      product_name: ticket.product_name || "",
      admin_email: ticket.admin_email || "",
      status: ticket.status,
      priority: ticket.priority,
      department: ticket.department,
      subject: ticket.subject,
      description: ticket.description || "",
      resolution: ticket.resolution || "",
      issue_reported_via: ticket.issue_reported_via,
      case_type: ticket.case_type,
      category: ticket.category,
      sub_category: ticket.sub_category || "",
      assigned_engineer_id: ticket.assigned_engineer_id || "",
    });
    setReportFile(null);
    setDialogOpen(true);
  };

  const openView = async (ticket: Ticket) => {
    setViewingTicket(ticket);
    setViewDialogOpen(true);
    const { data } = await supabase.from("support_ticket_logs" as any).select("*").eq("ticket_id", ticket.id).order("changed_at", { ascending: false });
    setTicketLogs((data as any) ?? []);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this ticket?")) return;
    const { error } = await supabase.from("support_tickets" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Ticket deleted."); fetchAll(); }
  };

  const logChanges = async (ticketId: string, oldTicket: Ticket | null, newData: Record<string, any>) => {
    if (!oldTicket || !user) return;
    const fields = ["status", "priority", "department", "subject", "description", "resolution",
      "issue_reported_via", "case_type", "category", "sub_category", "assigned_engineer_id", "client_name", "client_email"];
    const logs: any[] = [];
    for (const f of fields) {
      const oldVal = (oldTicket as any)[f] || "";
      const newVal = newData[f] || "";
      if (oldVal !== newVal) {
        let displayOld = oldVal;
        let displayNew = newVal;
        if (f === "assigned_engineer_id") {
          displayOld = profileMap[oldVal] || oldVal;
          displayNew = profileMap[newVal] || newVal;
        }
        logs.push({ ticket_id: ticketId, field_name: f, old_value: displayOld, new_value: displayNew, changed_by: user.id });
      }
    }
    if (logs.length) await supabase.from("support_ticket_logs" as any).insert(logs);
  };

  const handleSubmit = async () => {
    if (!form.project_id || !form.subject || !form.department || !form.issue_reported_via ||
      !form.case_type || !form.category || !form.priority || !form.status || !form.client_name || !form.client_email) {
      toast.error("Please fill all mandatory fields.");
      return;
    }
    if (form.case_type === "Health Checkup" && !editingTicket?.report_file_url && !reportFile) {
      toast.error("Health Checkup requires a PDF report upload.");
      return;
    }

    setSaving(true);
    let reportUrl = editingTicket?.report_file_url || null;

    // Upload report file if present
    if (reportFile) {
      const ext = reportFile.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("ticket-reports").upload(path, reportFile);
      if (uploadError) { toast.error("File upload failed: " + uploadError.message); setSaving(false); return; }
      reportUrl = path;
    }

    const payload: any = {
      project_id: form.project_id,
      client_name: form.client_name,
      client_email: form.client_email || null,
      product_name: form.product_name || null,
      admin_email: form.admin_email || null,
      status: form.status,
      priority: form.priority,
      department: form.department,
      subject: form.subject,
      description: form.description || null,
      resolution: form.resolution || null,
      issue_reported_via: form.issue_reported_via,
      case_type: form.case_type,
      category: form.category,
      sub_category: form.sub_category || null,
      assigned_engineer_id: form.assigned_engineer_id || null,
      report_file_url: reportUrl,
    };

    if (editingTicket) {
      // Check if status changed to Closed
      if (form.status === "Closed" && editingTicket.status !== "Closed") {
        payload.closed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("support_tickets" as any).update(payload).eq("id", editingTicket.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await logChanges(editingTicket.id, editingTicket, payload);
      toast.success("Ticket updated.");
    } else {
      payload.created_by = user?.id;
      if (!payload.assigned_engineer_id) payload.assigned_engineer_id = user?.id;
      const { data, error } = await supabase.from("support_tickets" as any).insert(payload).select().single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      // Log creation
      if (data && user) {
        await supabase.from("support_ticket_logs" as any).insert({
          ticket_id: (data as any).id, field_name: "created", old_value: null,
          new_value: "Ticket created", changed_by: user.id,
        });
      }
      toast.success("Ticket created: " + (data as any)?.ticket_id);
    }

    setSaving(false);
    setDialogOpen(false);
    fetchAll();
  };

  const filtered = useMemo(() => {
    let list = tickets;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.ticket_id.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.client_name.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") list = list.filter(t => t.status === filterStatus);
    if (filterPriority !== "all") list = list.filter(t => t.priority === filterPriority);
    return list;
  }, [tickets, search, filterStatus, filterPriority]);

  const projectNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach(p => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground">Create and track customer issues.</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Ticket</Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search ticket ID, subject, client..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {getOptions("status").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {getOptions("priority").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No tickets found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => openView(t)}>
                    <TableCell className="font-mono text-xs font-semibold">{t.ticket_id}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{t.subject}</TableCell>
                    <TableCell className="text-sm">{projectNameMap[t.project_id] || "—"}</TableCell>
                    <TableCell className="text-sm">{t.client_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PRIORITY_STYLES[t.priority] || ""}>{t.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[t.status] || ""}>{t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{profileMap[t.assigned_engineer_id || ""] || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openView(t)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {(canCreate || isProjectManager) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isProjectManager && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTicket ? `Edit ${editingTicket.ticket_id}` : "New Support Ticket"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
              {/* Project with search */}
              <div className="space-y-2 md:col-span-2">
                <Label>Project Name *</Label>
                <Input placeholder="Search project..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)} className="mb-1" />
                <Select value={form.project_id} onValueChange={onProjectSelect}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {filteredProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.client_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Account Name (Client) *</Label>
                <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Client Email *</Label>
                <Input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Product Type *</Label>
                <Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Admin Email</Label>
                <Input value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} />
              </div>

              <div className="space-y-2">
                <Label>Priority *</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getOptions("priority").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getOptions("status").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getOptions("department").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Issue Reported Via *</Label>
                <Select value={form.issue_reported_via} onValueChange={v => setForm(f => ({ ...f, issue_reported_via: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getOptions("issue_reported_via").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Case Type *</Label>
                <Select value={form.case_type} onValueChange={v => setForm(f => ({ ...f, case_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getOptions("case_type").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v, sub_category: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getOptions("category").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub Category</Label>
                <Select value={form.sub_category} onValueChange={v => setForm(f => ({ ...f, sub_category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select sub category" /></SelectTrigger>
                  <SelectContent>
                    {subCategories.map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assigned Engineer</Label>
                <Select value={form.assigned_engineer_id} onValueChange={v => setForm(f => ({ ...f, assigned_engineer_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select engineer" /></SelectTrigger>
                  <SelectContent>
                    {engineers.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Subject / Name of Issue *</Label>
                <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Resolution / RCA</Label>
                <Textarea rows={3} value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} />
              </div>

              {form.case_type === "Health Checkup" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Health Checkup Report (PDF) *</Label>
                  <Input type="file" accept=".pdf" onChange={e => setReportFile(e.target.files?.[0] || null)} />
                  {editingTicket?.report_file_url && !reportFile && (
                    <p className="text-xs text-muted-foreground">Existing file attached. Upload a new one to replace.</p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : editingTicket ? "Update Ticket" : "Create Ticket"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {viewingTicket?.ticket_id}
            </DialogTitle>
          </DialogHeader>
          {viewingTicket && (
            <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="logs">Change Log ({ticketLogs.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="flex-1 overflow-auto">
                <div className="grid grid-cols-2 gap-4 py-2 text-sm">
                  <div><span className="text-muted-foreground">Project:</span> <span className="font-medium">{projectNameMap[viewingTicket.project_id]}</span></div>
                  <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{viewingTicket.client_name}</span></div>
                  <div><span className="text-muted-foreground">Client Email:</span> <span className="font-medium">{viewingTicket.client_email}</span></div>
                  <div><span className="text-muted-foreground">Product:</span> <span className="font-medium">{viewingTicket.product_name}</span></div>
                  <div><span className="text-muted-foreground">Priority:</span> <Badge variant="outline" className={PRIORITY_STYLES[viewingTicket.priority]}>{viewingTicket.priority}</Badge></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={STATUS_STYLES[viewingTicket.status]}>{viewingTicket.status}</Badge></div>
                  <div><span className="text-muted-foreground">Department:</span> <span className="font-medium">{viewingTicket.department}</span></div>
                  <div><span className="text-muted-foreground">Issue Via:</span> <span className="font-medium">{viewingTicket.issue_reported_via}</span></div>
                  <div><span className="text-muted-foreground">Case Type:</span> <span className="font-medium">{viewingTicket.case_type}</span></div>
                  <div><span className="text-muted-foreground">Category:</span> <span className="font-medium">{viewingTicket.category}</span></div>
                  <div><span className="text-muted-foreground">Sub Category:</span> <span className="font-medium">{viewingTicket.sub_category || "—"}</span></div>
                  <div><span className="text-muted-foreground">Admin Email:</span> <span className="font-medium">{viewingTicket.admin_email || "—"}</span></div>
                  <div><span className="text-muted-foreground">Assigned To:</span> <span className="font-medium">{profileMap[viewingTicket.assigned_engineer_id || ""] || "—"}</span></div>
                  <div><span className="text-muted-foreground">Created By:</span> <span className="font-medium">{profileMap[viewingTicket.created_by] || "—"}</span></div>
                  <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{format(new Date(viewingTicket.created_at), "dd MMM yyyy HH:mm:ss")}</span></div>
                  <div><span className="text-muted-foreground">Last Updated:</span> <span className="font-medium">{format(new Date(viewingTicket.updated_at), "dd MMM yyyy HH:mm:ss")}</span></div>
                  {viewingTicket.closed_at && (
                    <div><span className="text-muted-foreground">Closed:</span> <span className="font-medium">{format(new Date(viewingTicket.closed_at), "dd MMM yyyy HH:mm:ss")}</span></div>
                  )}
                  <div className="col-span-2"><Separator /></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Subject:</span><p className="font-medium mt-1">{viewingTicket.subject}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Description:</span><p className="mt-1 whitespace-pre-wrap">{viewingTicket.description || "—"}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Resolution / RCA:</span><p className="mt-1 whitespace-pre-wrap">{viewingTicket.resolution || "—"}</p></div>
                  {viewingTicket.report_file_url && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Health Checkup Report:</span>
                      <Button variant="link" className="p-0 h-auto ml-2" onClick={async () => {
                        const { data } = await supabase.storage.from("ticket-reports").createSignedUrl(viewingTicket.report_file_url!, 3600);
                        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                      }}>Download Report</Button>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="logs" className="flex-1 overflow-auto">
                {ticketLogs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No change logs.</p>
                ) : (
                  <div className="space-y-3 py-2">
                    {ticketLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 text-sm border-l-2 border-primary/30 pl-3">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">
                            {log.field_name === "created" ? "Ticket created" :
                              `${log.field_name} changed from "${log.old_value || "—"}" to "${log.new_value || "—"}"`
                            }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            by {profileMap[log.changed_by] || "Unknown"} • {format(new Date(log.changed_at), "dd MMM yyyy HH:mm:ss")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
