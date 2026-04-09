import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, Trash2, Pencil, Eye, Clock, FileText,
  TicketIcon, X, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────
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
  team: string; assigned_team: string | null;
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

// ── Style maps ─────────────────────────────────────────────────────
const PRIORITY_STYLES: Record<string, string> = {
  Critical: "border-destructive/20 bg-destructive/10 text-destructive",
  High: "border-primary/20 bg-primary/10 text-primary",
  Moderate: "border-warning/30 bg-warning/15 text-warning",
  Low: "border-border bg-muted text-muted-foreground",
};
const STATUS_STYLES: Record<string, string> = {
  Open: "border-blue-400/30 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  "In-progress": "border-primary/20 bg-primary/10 text-primary",
  Hold: "border-yellow-400/30 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300",
  "Awaiting Client Confirmation": "border-border bg-secondary text-secondary-foreground",
  Closed: "border-border bg-muted text-muted-foreground",
};

// ── NativeSelect ───────────────────────────────────────────────────
function NativeSelect({
  value, onChange, placeholder, options, disabled = false,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(o => (
          <option key={`${o.value}-${o.label}`} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

const emptyForm = {
  project_id: "", client_name: "", client_email: "", product_name: "",
  admin_email: "", status: "Open", priority: "High", department: "",
  subject: "", description: "", resolution: "", issue_reported_via: "",
  case_type: "", category: "", sub_category: "", assigned_engineer_id: "",
  team: "support", assigned_team: "",
};

// ═══════════════════════════════════════════════════════════════════
export default function SupportTickets() {
  const { user, isProjectManager, isEngineer, isSupportManager, isEngineeringManager } = useAuth();
  const canManageTickets = isProjectManager || isSupportManager || isEngineeringManager;
  const canCreate = canManageTickets || isEngineer;
  const canDelete = canManageTickets;

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const [projectSearch, setProjectSearch] = useState("");
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectSearchRef = useRef<HTMLDivElement>(null);

  // ── helpers ────────────────────────────────────────────────────
  const getOptions = (fieldName: string) =>
    configs.filter(c => c.field_name === fieldName && c.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const getSelectOptions = (fieldName: string) =>
    getOptions(fieldName).map(o => ({ value: o.field_value, label: o.field_value }));

  const subCategories = useMemo(
    () => configs.filter(c => c.field_name === "sub_category" && c.is_active && c.parent_value === form.category).sort((a, b) => a.sort_order - b.sort_order),
    [configs, form.category],
  );

  const isProjectBlocked = (p: ProjectOption) =>
    p.purchase_type !== "Rental" && !!p.sla_end_date && new Date(p.sla_end_date) < new Date();

  const resetProjectSelection = () =>
    setForm(f => ({ ...f, project_id: "", client_name: "", client_email: "", product_name: "", admin_email: "" }));

  // ── data loading ──────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    const [ticketRes, configRes, projectRes, profileRes, roleRes] = await Promise.all([
      supabase.from("support_tickets" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("support_ticket_config" as any).select("*").order("sort_order"),
      supabase.from("projects").select("id, name, client_name, client_email, admin_email, product_id, sla_end_date, purchase_type").order("name"),
      supabase.from("profiles").select("id, first_name, last_name, email"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    setTickets((ticketRes.data as any) ?? []);
    setConfigs((configRes.data as any) ?? []);

    // Build engineer list from roles
    const engineerIds = new Set(
      ((roleRes.data as any[]) ?? []).filter(r => r.role === "engineer").map(r => r.user_id),
    );

    const rawProfiles = ((profileRes.data ?? []) as any[]).map(p => ({
      ...p, first_name: p.first_name ?? "", last_name: p.last_name ?? "",
    }));
    setEngineers(
      rawProfiles.filter(p => engineerIds.has(p.id))
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)),
    );

    const pMap: Record<string, string> = {};
    rawProfiles.forEach(p => { pMap[p.id] = `${p.first_name} ${p.last_name}`.trim() || p.email || p.id; });
    setProfileMap(pMap);

    // Build projects with product names
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
      admin_email: p.admin_email || p.client_email,
      sla_end_date: p.sla_end_date, purchase_type: p.purchase_type,
    })));

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Close project dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectSearchRef.current && !projectSearchRef.current.contains(e.target as Node)) setProjectDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return projects.slice(0, 10);
    const q = projectSearch.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q) ||
      (p.client_email || "").toLowerCase().includes(q) || (p.product_name || "").toLowerCase().includes(q),
    ).slice(0, 10);
  }, [projects, projectSearch]);

  const selectedProject = useMemo(() => projects.find(p => p.id === form.project_id), [projects, form.project_id]);

  const onProjectSelect = (proj: ProjectOption) => {
    if (isProjectBlocked(proj)) {
      toast.error(`Cannot create ticket: SLA expired on ${format(new Date(proj.sla_end_date!), "dd MMM yyyy")}.`);
      return;
    }
    setForm(f => ({
      ...f, project_id: proj.id, client_name: proj.client_name,
      client_email: proj.client_email || "", product_name: proj.product_name || "",
      admin_email: proj.admin_email || "",
    }));
    setProjectSearch(`${proj.name} — ${proj.client_name}`);
    setProjectDropdownOpen(false);
    setFieldErrors(e => ({ ...e, project_id: false }));
  };

  // ── CRUD ──────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingTicket(null);
    setForm({ ...emptyForm, assigned_engineer_id: user?.id || "" });
    setProjectSearch(""); setProjectDropdownOpen(false);
    setReportFile(null); setFieldErrors({});
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
      status: ticket.status, priority: ticket.priority,
      department: ticket.department, subject: ticket.subject,
      description: ticket.description || "", resolution: ticket.resolution || "",
      issue_reported_via: ticket.issue_reported_via,
      case_type: ticket.case_type, category: ticket.category,
      sub_category: ticket.sub_category || "",
      assigned_engineer_id: ticket.assigned_engineer_id || "",
      team: ticket.team || "support",
      assigned_team: ticket.assigned_team || "",
    });
    setReportFile(null); setProjectDropdownOpen(false); setFieldErrors({});
    setDialogOpen(true);
  };

  const openView = async (ticket: Ticket) => {
    setViewingTicket(ticket); setViewDialogOpen(true);
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
        let dOld = oldVal, dNew = newVal;
        if (f === "assigned_engineer_id") { dOld = profileMap[oldVal] || oldVal; dNew = profileMap[newVal] || newVal; }
        logs.push({ ticket_id: ticketId, field_name: f, old_value: dOld, new_value: dNew, changed_by: user.id });
      }
    }
    if (logs.length) await supabase.from("support_ticket_logs" as any).insert(logs);
  };

  const handleSubmit = async () => {
    const required: [string, string][] = [
      ["project_id", "Project"], ["subject", "Subject"], ["department", "Department"],
      ["issue_reported_via", "Issue Reported Via"], ["case_type", "Case Type"],
      ["category", "Category"], ["sub_category", "Sub Category"],
      ["priority", "Priority"], ["status", "Status"],
      ["client_name", "Account Name"], ["client_email", "Client Email"],
      ["product_name", "Product Type"],
    ];
    const errors: Record<string, boolean> = {};
    const missing: string[] = [];
    for (const [key, label] of required) {
      if (!(form as any)[key]?.toString().trim()) { errors[key] = true; missing.push(label); }
    }
    setFieldErrors(errors);
    if (missing.length) { toast.error(`Missing: ${missing.join(", ")}`); return; }
    if (form.case_type === "Health Checkup" && !editingTicket?.report_file_url && !reportFile) {
      toast.error("Health Checkup requires a PDF report."); return;
    }

    setSaving(true);
    let reportUrl = editingTicket?.report_file_url || null;
    if (reportFile) {
      const path = `${crypto.randomUUID()}.${reportFile.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("ticket-reports").upload(path, reportFile);
      if (upErr) { toast.error("Upload failed: " + upErr.message); setSaving(false); return; }
      reportUrl = path;
    }

    const payload: any = {
      project_id: form.project_id, client_name: form.client_name,
      client_email: form.client_email || null, product_name: form.product_name || null,
      admin_email: form.admin_email || null, status: form.status, priority: form.priority,
      department: form.department, subject: form.subject,
      description: form.description || null, resolution: form.resolution || null,
      issue_reported_via: form.issue_reported_via, case_type: form.case_type,
      category: form.category, sub_category: form.sub_category || null,
      assigned_engineer_id: form.assigned_engineer_id || null,
      report_file_url: reportUrl,
      team: form.team || "support",
      assigned_team: form.assigned_team || null,
    };

    if (editingTicket) {
      if (form.status === "Closed" && editingTicket.status !== "Closed") payload.closed_at = new Date().toISOString();
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
    setSaving(false); setDialogOpen(false); fetchAll();
  };

  // ── filters ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = tickets;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.ticket_id.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.client_name.toLowerCase().includes(q));
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

  const canEditTicket = (t: Ticket) =>
    canManageTickets || t.created_by === user?.id || t.assigned_engineer_id === user?.id;

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === "Open").length,
    inProgress: tickets.filter(t => t.status === "In-progress").length,
    closed: tickets.filter(t => t.status === "Closed").length,
    critical: tickets.filter(t => t.priority === "Critical" && t.status !== "Closed").length,
  }), [tickets]);

  // helper for field error border
  const errCls = (key: string) => fieldErrors[key] ? "border-destructive" : "";

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TicketIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
            <p className="text-sm text-muted-foreground">Create and track support & engineering issues</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={openCreate} size="lg" className="gap-2">
            <Plus className="h-4 w-4" /> New Ticket
          </Button>
        )}
      </div>

      {/* KPI */}
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
            <div className="w-[180px]">
              <NativeSelect value={filterStatus} onChange={setFilterStatus} placeholder="Status"
                options={[{ value: "all", label: "All Statuses" }, ...getSelectOptions("status")]} />
            </div>
            <div className="w-[160px]">
              <NativeSelect value={filterPriority} onChange={setFilterPriority} placeholder="Priority"
                options={[{ value: "all", label: "All Priorities" }, ...getSelectOptions("priority")]} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="animate-pulse text-muted-foreground">Loading tickets...</div></div>
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
                      <TableCell><Badge variant="outline" className={PRIORITY_STYLES[t.priority] || ""}>{t.priority}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_STYLES[t.status] || ""}>{t.status}</Badge></TableCell>
                      <TableCell className="text-sm">{profileMap[t.assigned_engineer_id || ""] || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(t.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openView(t)} title="View"><Eye className="h-3.5 w-3.5" /></Button>
                          {canEditTicket(t) && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>}
                          {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>}
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

      {/* ════════════════════════════════════════════════════════════
          CREATE / EDIT DIALOG — scrollable body, sticky footer
         ════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <TicketIcon className="h-5 w-5 text-primary" />
              {editingTicket ? `Edit ${editingTicket.ticket_id}` : "New Ticket"}
            </DialogTitle>
            <DialogDescription>Fill all mandatory fields marked with *</DialogDescription>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Info cards */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Ticket ID</p>
                <p className="mt-1 font-mono text-sm font-semibold">{editingTicket?.ticket_id || "Auto-generated"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Created By</p>
                <p className="mt-1 text-sm font-semibold">{editingTicket ? profileMap[editingTicket.created_by] || "—" : profileMap[user?.id || ""] || user?.email || "You"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Timeline</p>
                <p className="mt-1 text-sm font-semibold">{editingTicket ? format(new Date(editingTicket.created_at), "dd MMM yyyy HH:mm") : "On save"}</p>
                {editingTicket?.closed_at && <p className="text-xs text-muted-foreground">Closed {format(new Date(editingTicket.closed_at), "dd MMM yyyy HH:mm")}</p>}
              </div>
            </div>

            {/* Project Search */}
            <div ref={projectSearchRef} className="space-y-1.5">
              <Label className="text-sm font-semibold">Project Name <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by project name, client, product..."
                  className={`pl-9 pr-8 ${errCls("project_id")}`}
                  value={projectSearch}
                  onChange={e => { setProjectSearch(e.target.value); setProjectDropdownOpen(true); resetProjectSelection(); }}
                  onFocus={() => setProjectDropdownOpen(true)}
                  onKeyDown={e => { if (e.key === "Escape") setProjectDropdownOpen(false); }}
                />
                {form.project_id && (
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setProjectSearch(""); resetProjectSelection(); }}>
                    <X className="h-4 w-4" />
                  </button>
                )}
                {projectDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-popover shadow-lg">
                    {filteredProjects.length > 0 ? (
                      <div className="max-h-52 overflow-y-auto p-1">
                        {filteredProjects.map(p => {
                          const blocked = isProjectBlocked(p);
                          return (
                            <button key={p.id} type="button" disabled={blocked}
                              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => onProjectSelect(p)}>
                              <div>
                                <span className="font-medium">{p.name}</span>
                                <span className="mx-1 text-muted-foreground">—</span>
                                <span className="text-muted-foreground">{p.client_name}</span>
                                {p.product_name && <span className="ml-2 text-xs text-muted-foreground">({p.product_name})</span>}
                              </div>
                              {blocked && <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">SLA expired</Badge>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-4 py-3 text-sm text-muted-foreground">No projects match.</p>
                    )}
                  </div>
                )}
              </div>
              {selectedProject && <p className="text-xs text-muted-foreground">Selected: <span className="font-medium text-foreground">{selectedProject.name}</span></p>}
            </div>

            {/* Auto-filled fields */}
            <div className="grid gap-3 md:grid-cols-2 rounded-lg border p-4 bg-muted/10">
              <div className="space-y-1">
                <Label className="text-xs">Account Name (Client) <span className="text-destructive">*</span></Label>
                <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} className={errCls("client_name")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Email <span className="text-destructive">*</span></Label>
                <Input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} className={errCls("client_email")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Product Type <span className="text-destructive">*</span></Label>
                <Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} className={errCls("product_name")} placeholder="Auto-filled from project" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Admin Email</Label>
                <Input value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} />
              </div>
            </div>

            {/* Core dropdowns – 2 cols */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Priority <span className="text-destructive">*</span></Label>
                <NativeSelect value={form.priority} onChange={v => { setForm(f => ({ ...f, priority: v })); setFieldErrors(e => ({ ...e, priority: false })); }} placeholder="Select priority" options={getSelectOptions("priority")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status <span className="text-destructive">*</span></Label>
                <NativeSelect value={form.status} onChange={v => { setForm(f => ({ ...f, status: v })); setFieldErrors(e => ({ ...e, status: false })); }} placeholder="Select status" options={getSelectOptions("status")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Department <span className="text-destructive">*</span></Label>
                <NativeSelect value={form.department} onChange={v => { setForm(f => ({ ...f, department: v })); setFieldErrors(e => ({ ...e, department: false })); }} placeholder="Select department" options={getSelectOptions("department")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Issue Reported Via <span className="text-destructive">*</span></Label>
                <NativeSelect value={form.issue_reported_via} onChange={v => { setForm(f => ({ ...f, issue_reported_via: v })); setFieldErrors(e => ({ ...e, issue_reported_via: false })); }} placeholder="Select channel" options={getSelectOptions("issue_reported_via")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Case Type <span className="text-destructive">*</span></Label>
                <NativeSelect value={form.case_type} onChange={v => { setForm(f => ({ ...f, case_type: v })); setFieldErrors(e => ({ ...e, case_type: false })); }} placeholder="Select case type" options={getSelectOptions("case_type")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category <span className="text-destructive">*</span></Label>
                <NativeSelect value={form.category} onChange={v => { setForm(f => ({ ...f, category: v, sub_category: "" })); setFieldErrors(e => ({ ...e, category: false })); }} placeholder="Select category" options={getSelectOptions("category")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sub Category <span className="text-destructive">*</span></Label>
                <NativeSelect value={form.sub_category} onChange={v => { setForm(f => ({ ...f, sub_category: v })); setFieldErrors(e => ({ ...e, sub_category: false })); }}
                  placeholder={form.category ? "Select sub category" : "Choose category first"}
                  options={subCategories.map(o => ({ value: o.field_value, label: o.field_value }))}
                  disabled={!form.category || subCategories.length === 0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assigned Engineer</Label>
                <NativeSelect value={form.assigned_engineer_id} onChange={v => setForm(f => ({ ...f, assigned_engineer_id: v }))} placeholder="Select engineer"
                  options={engineers.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}`.trim() || e.email }))} />
              </div>
            </div>

            {/* Text fields */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Subject / Name of Issue <span className="text-destructive">*</span></Label>
                <Input value={form.subject} onChange={e => { setForm(f => ({ ...f, subject: e.target.value })); setFieldErrors(er => ({ ...er, subject: false })); }} className={errCls("subject")} placeholder="Brief description of the issue" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed description..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Resolution / RCA</Label>
                <Textarea rows={3} value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} placeholder="Solution or root cause analysis..." />
              </div>
            </div>

            {/* Health Checkup PDF */}
            {form.case_type === "Health Checkup" && (
              <div className="p-3 border border-dashed border-destructive/30 rounded-lg bg-destructive/5 space-y-1">
                <Label className="text-xs font-semibold">Health Checkup Report (PDF) <span className="text-destructive">*</span></Label>
                <Input type="file" accept=".pdf" onChange={e => setReportFile(e.target.files?.[0] || null)} />
                {editingTicket?.report_file_url && !reportFile && <p className="text-xs text-muted-foreground">Existing file attached.</p>}
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t bg-muted/20 px-6 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="min-w-[120px]">
              {saving ? "Saving..." : editingTicket ? "Update Ticket" : "Create Ticket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════
          VIEW DIALOG
         ════════════════════════════════════════════════════════════ */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center"><FileText className="h-4 w-4 text-primary" /></div>
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
            <DialogDescription>View ticket details and change history</DialogDescription>
          </DialogHeader>
          {viewingTicket && (
            <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="mx-6 mt-2 w-fit">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="logs">Change Log ({ticketLogs.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="flex-1 overflow-y-auto px-6 pb-6">
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {[
                      ["Ticket ID", viewingTicket.ticket_id],
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
                  <div><span className="text-xs text-muted-foreground uppercase tracking-wide">Subject</span><p className="font-medium mt-1">{viewingTicket.subject}</p></div>
                  <div><span className="text-xs text-muted-foreground uppercase tracking-wide">Description</span><p className="mt-1 whitespace-pre-wrap text-sm">{viewingTicket.description || "—"}</p></div>
                  <div><span className="text-xs text-muted-foreground uppercase tracking-wide">Resolution / RCA</span><p className="mt-1 whitespace-pre-wrap text-sm">{viewingTicket.resolution || "—"}</p></div>
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
              <TabsContent value="logs" className="flex-1 overflow-y-auto px-6 pb-6">
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
                              <><span className="text-muted-foreground">{log.field_name}:</span> "{log.old_value || "—"}" → "{log.new_value || "—"}"</>}
                          </p>
                          <p className="text-xs text-muted-foreground">by {profileMap[log.changed_by] || "Unknown"} • {format(new Date(log.changed_at), "dd MMM yyyy HH:mm:ss")}</p>
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
