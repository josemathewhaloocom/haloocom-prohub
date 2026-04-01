import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  AlertTriangle, TicketIcon, X,
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
  sla_end_date: string | null; purchase_type: string | null;
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
  const { user, isProjectManager, isEngineer, roles } = useAuth();
  const isSupportManager = roles.includes("support_manager" as any);
  const canCreate = isProjectManager || isEngineer || isSupportManager;
  const canDelete = isProjectManager || isSupportManager;

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

  // Project search state
  const [projectSearch, setProjectSearch] = useState("");
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);

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
      supabase.from("projects").select("id, name, client_name, client_email, product_id, sla_end_date, purchase_type").order("name"),
      supabase.from("profiles").select("id, first_name, last_name, email"),
      supabase.from("profiles").select("id, first_name, last_name"),
    ]);

    setTickets((ticketRes.data as any) ?? []);
    setConfigs((configRes.data as any) ?? []);

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
      sla_end_date: p.sla_end_date,
      purchase_type: p.purchase_type,
    })));

    const engs = (engRes.data ?? []) as any[];
    setEngineers(engs);

    const pMap: Record<string, string> = {};
    ((profileRes.data ?? []) as any[]).forEach(p => { pMap[p.id] = `${p.first_name} ${p.last_name}`.trim() || p.id; });
    setProfileMap(pMap);

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Close project dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectSearchRef.current && !projectSearchRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredProjects = useMemo(() => {
    if (!projectSearch) return projects.slice(0, 20);
    const q = projectSearch.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.client_name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [projects, projectSearch]);

  const selectedProject = useMemo(() => projects.find(p => p.id === form.project_id), [projects, form.project_id]);

  const onProjectSelect = (proj: ProjectOption) => {
    // Check SLA validity - Rental projects don't need SLA check
    if (proj.purchase_type !== "Rental" && proj.sla_end_date) {
      const slaEnd = new Date(proj.sla_end_date);
      if (slaEnd < new Date()) {
        toast.error(`Cannot create ticket: SLA expired on ${format(slaEnd, "dd MMM yyyy")} for this client.`);
        return;
      }
    }
    setForm(f => ({
      ...f,
      project_id: proj.id,
      client_name: proj.client_name,
      client_email: proj.client_email || "",
      product_name: proj.product_name || "",
      admin_email: proj.admin_email || "",
    }));
    setProjectSearch(proj.name + " — " + proj.client_name);
    setProjectDropdownOpen(false);
  };

  const openCreate = () => {
    setEditingTicket(null);
    setForm({ ...emptyForm, assigned_engineer_id: user?.id || "" });
    setProjectSearch("");
    setReportFile(null);
    setDialogOpen(true);
  };

  const openEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    const proj = projects.find(p => p.id === ticket.project_id);
    setProjectSearch(proj ? `${proj.name} — ${proj.client_name}` : "");
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
    const missing: string[] = [];
    if (!form.project_id) missing.push("Project");
    if (!form.subject) missing.push("Subject");
    if (!form.department) missing.push("Department");
    if (!form.issue_reported_via) missing.push("Issue Reported Via");
    if (!form.case_type) missing.push("Case Type");
    if (!form.category) missing.push("Category");
    if (!form.priority) missing.push("Priority");
    if (!form.status) missing.push("Status");
    if (!form.client_name) missing.push("Client Name");
    if (!form.client_email) missing.push("Client Email");

    if (missing.length) {
      toast.error(`Missing required fields: ${missing.join(", ")}`);
      return;
    }
    if (form.case_type === "Health Checkup" && !editingTicket?.report_file_url && !reportFile) {
      toast.error("Health Checkup requires a PDF report upload.");
      return;
    }

    setSaving(true);
    let reportUrl = editingTicket?.report_file_url || null;

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

  // Stats
  const stats = useMemo(() => {
    const open = tickets.filter(t => t.status === "Open").length;
    const inProgress = tickets.filter(t => t.status === "In-progress").length;
    const closed = tickets.filter(t => t.status === "Closed").length;
    const critical = tickets.filter(t => t.priority === "Critical" && t.status !== "Closed").length;
    return { open, inProgress, closed, critical, total: tickets.length };
  }, [tickets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TicketIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
            <p className="text-sm text-muted-foreground">Create and track customer issues</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={openCreate} size="lg" className="gap-2">
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Open", value: stats.open, color: "text-blue-600" },
          { label: "In Progress", value: stats.inProgress, color: "text-primary" },
          { label: "Closed", value: stats.closed, color: "text-muted-foreground" },
          { label: "Critical", value: stats.critical, color: "text-destructive" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
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
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Loading tickets...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <TicketIcon className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">No tickets found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">Ticket ID</TableHead>
                    <TableHead className="font-semibold">Subject</TableHead>
                    <TableHead className="font-semibold">Project</TableHead>
                    <TableHead className="font-semibold">Client</TableHead>
                    <TableHead className="font-semibold">Priority</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Assigned To</TableHead>
                    <TableHead className="font-semibold">Created</TableHead>
                    <TableHead className="w-28 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(t => (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openView(t)}>
                      <TableCell className="font-mono text-xs font-bold text-primary">{t.ticket_id}</TableCell>
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
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(t.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openView(t)} title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {(canCreate) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TicketIcon className="h-5 w-5 text-primary" />
              {editingTicket ? `Edit ${editingTicket.ticket_id}` : "New Support Ticket"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-2">
              {/* Project Search */}
              <div className="space-y-2" ref={projectSearchRef}>
                <Label className="text-sm font-semibold">Project Name <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type to search projects by name or client..."
                    className="pl-9 pr-8"
                    value={projectSearch}
                    onChange={e => {
                      setProjectSearch(e.target.value);
                      setProjectDropdownOpen(true);
                      if (!e.target.value) setForm(f => ({ ...f, project_id: "", client_name: "", client_email: "", product_name: "", admin_email: "" }));
                    }}
                    onFocus={() => setProjectDropdownOpen(true)}
                  />
                  {form.project_id && (
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => {
                      setProjectSearch("");
                      setForm(f => ({ ...f, project_id: "", client_name: "", client_email: "", product_name: "", admin_email: "" }));
                    }}>
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {projectDropdownOpen && filteredProjects.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full max-w-[calc(100%-3rem)] bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredProjects.map(p => {
                      const slaExpired = p.purchase_type !== "Rental" && p.sla_end_date && new Date(p.sla_end_date) < new Date();
                      return (
                        <button
                          key={p.id}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex justify-between items-center ${slaExpired ? "opacity-50" : ""}`}
                          onClick={() => onProjectSelect(p)}
                        >
                          <div>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground ml-2">— {p.client_name}</span>
                          </div>
                          {slaExpired && <Badge variant="outline" className="text-destructive text-xs ml-2">SLA Expired</Badge>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedProject && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected: <span className="font-medium text-foreground">{selectedProject.name}</span> — {selectedProject.client_name}
                  </p>
                )}
              </div>

              {/* Auto-filled fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Account Name (Client) <span className="text-destructive">*</span></Label>
                  <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} className="bg-muted/30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Client Email <span className="text-destructive">*</span></Label>
                  <Input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} className="bg-muted/30" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Product Type</Label>
                  <Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} className="bg-muted/30" readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Admin Email</Label>
                  <Input value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} className="bg-muted/30" />
                </div>
              </div>

              <Separator />

              {/* Core fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Priority <span className="text-destructive">*</span></Label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                    <SelectContent>
                      {getOptions("priority").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Status <span className="text-destructive">*</span></Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {getOptions("status").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Department <span className="text-destructive">*</span></Label>
                  <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {getOptions("department").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Issue Reported Via <span className="text-destructive">*</span></Label>
                  <Select value={form.issue_reported_via} onValueChange={v => setForm(f => ({ ...f, issue_reported_via: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                    <SelectContent>
                      {getOptions("issue_reported_via").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Case Type <span className="text-destructive">*</span></Label>
                  <Select value={form.case_type} onValueChange={v => setForm(f => ({ ...f, case_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select case type" /></SelectTrigger>
                    <SelectContent>
                      {getOptions("case_type").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Category <span className="text-destructive">*</span></Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v, sub_category: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {getOptions("category").map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Sub Category</Label>
                  <Select value={form.sub_category} onValueChange={v => setForm(f => ({ ...f, sub_category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select sub category" /></SelectTrigger>
                    <SelectContent>
                      {subCategories.map(o => <SelectItem key={o.id} value={o.field_value}>{o.field_value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Assigned Engineer</Label>
                  <Select value={form.assigned_engineer_id} onValueChange={v => setForm(f => ({ ...f, assigned_engineer_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select engineer" /></SelectTrigger>
                    <SelectContent>
                      {engineers.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Text fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Subject / Name of Issue <span className="text-destructive">*</span></Label>
                  <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief description of the issue" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Description</Label>
                  <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed description..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Resolution / RCA</Label>
                  <Textarea rows={3} value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} placeholder="Solution provided or root cause analysis..." />
                </div>
              </div>

              {form.case_type === "Health Checkup" && (
                <div className="space-y-1.5 p-4 border border-dashed border-destructive/30 rounded-lg bg-destructive/5">
                  <Label className="text-sm font-semibold">Health Checkup Report (PDF) <span className="text-destructive">*</span></Label>
                  <Input type="file" accept=".pdf" onChange={e => setReportFile(e.target.files?.[0] || null)} />
                  {editingTicket?.report_file_url && !reportFile && (
                    <p className="text-xs text-muted-foreground">Existing file attached. Upload a new one to replace.</p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="min-w-[120px]">
              {saving ? "Saving..." : editingTicket ? "Update Ticket" : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <span className="font-mono">{viewingTicket?.ticket_id}</span>
                {viewingTicket && (
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className={PRIORITY_STYLES[viewingTicket.priority]}>{viewingTicket.priority}</Badge>
                    <Badge variant="outline" className={STATUS_STYLES[viewingTicket.status]}>{viewingTicket.status}</Badge>
                  </div>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewingTicket && (
            <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="logs">Change Log ({ticketLogs.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="flex-1 overflow-auto">
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {[
                      ["Project", projectNameMap[viewingTicket.project_id]],
                      ["Client", viewingTicket.client_name],
                      ["Client Email", viewingTicket.client_email],
                      ["Product", viewingTicket.product_name],
                      ["Department", viewingTicket.department],
                      ["Issue Via", viewingTicket.issue_reported_via],
                      ["Case Type", viewingTicket.case_type],
                      ["Category", viewingTicket.category],
                      ["Sub Category", viewingTicket.sub_category],
                      ["Admin Email", viewingTicket.admin_email],
                      ["Assigned To", profileMap[viewingTicket.assigned_engineer_id || ""]],
                      ["Created By", profileMap[viewingTicket.created_by]],
                      ["Created", format(new Date(viewingTicket.created_at), "dd MMM yyyy HH:mm:ss")],
                      ["Last Updated", format(new Date(viewingTicket.updated_at), "dd MMM yyyy HH:mm:ss")],
                      ...(viewingTicket.closed_at ? [["Closed", format(new Date(viewingTicket.closed_at), "dd MMM yyyy HH:mm:ss")]] : []),
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex flex-col">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
                        <span className="font-medium">{value || "—"}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Subject</span>
                    <p className="font-medium mt-1">{viewingTicket.subject}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Description</span>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{viewingTicket.description || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Resolution / RCA</span>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{viewingTicket.resolution || "—"}</p>
                  </div>
                  {viewingTicket.report_file_url && (
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Health Checkup Report</span>
                      <Button variant="link" className="p-0 h-auto ml-2 text-sm" onClick={async () => {
                        const { data } = await supabase.storage.from("ticket-reports").createSignedUrl(viewingTicket.report_file_url!, 3600);
                        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                      }}>Download Report</Button>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="logs" className="flex-1 overflow-auto">
                {ticketLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Clock className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-muted-foreground">No change logs yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 py-2">
                    {ticketLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 text-sm border-l-2 border-primary/30 pl-3 py-1">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">
                            {log.field_name === "created" ? "Ticket created" :
                              <><span className="text-muted-foreground">{log.field_name}:</span> "{log.old_value || "—"}" → "{log.new_value || "—"}"</>
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
