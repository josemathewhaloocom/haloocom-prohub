import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, UserPlus, Trash2, Calendar, DollarSign, Package,
  Upload, FileText, CheckCircle, XCircle, Clock, PenTool, Eye,
  AlertCircle, ChevronRight, RefreshCw, Edit, Link2, Copy, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

const ALL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sales_approved", label: "Sales Approved" },
  { value: "accounts_approved", label: "Accounts Approved" },
  { value: "admin_reviewed", label: "Admin Reviewed" },
  { value: "open", label: "Open" },
  { value: "qc_completed", label: "QC Completed" },
  { value: "kick_off_scheduled", label: "Kick-Off Scheduled" },
  { value: "site_ready", label: "Site Ready" },
  { value: "on_hold", label: "On Hold" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "client_signing_pending", label: "Client Signing Pending" },
  { value: "client_signed", label: "Client Signed Pending Approval" },
  { value: "pending_admin_approval", label: "Pending Admin Approval" },
  { value: "closed", label: "Completed" },
];

const PM_MANUAL_STATUSES = [
  { value: "open", label: "Open" },
  { value: "qc_completed", label: "QC Completed" },
  { value: "kick_off_scheduled", label: "Kick-Off Scheduled" },
  { value: "site_ready", label: "Site Ready" },
  { value: "on_hold", label: "On Hold" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "client_signing_pending", label: "Client Signing Pending" },
  { value: "client_signed", label: "Client Signed Pending Approval" },
  { value: "pending_admin_approval", label: "Pending Admin Approval" },
  { value: "closed", label: "Completed" },
];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sales_approved: "bg-info/10 text-info border-info/20",
  accounts_approved: "bg-info/10 text-info border-info/20",
  admin_reviewed: "bg-info/10 text-info border-info/20",
  open: "bg-info/10 text-info border-info/20",
  qc_completed: "bg-info/10 text-info border-info/20",
  kick_off_scheduled: "bg-info/10 text-info border-info/20",
  site_ready: "bg-info/10 text-info border-info/20",
  on_hold: "bg-destructive/10 text-destructive border-destructive/20",
  scheduled: "bg-warning/10 text-warning border-warning/20",
  in_progress: "bg-warning/10 text-warning border-warning/20",
  client_signing_pending: "bg-warning/10 text-warning border-warning/20",
  client_signed: "bg-warning/10 text-warning border-warning/20",
  pending_admin_approval: "bg-warning/10 text-warning border-warning/20",
  closed: "bg-success/10 text-success border-success/20",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

const SLA_PERIODS = ["1 Month", "2 Months", "3 Months", "6 Months", "1 Year", "2 Years"];

// ===== Document types by role =====
const SALES_DOC_TYPES = [
  { value: "sow", label: "Statement of Work (SOW)" },
  { value: "pre_installation_checklist", label: "Pre-Installation Checklist" },
  { value: "msa", label: "MSA" },
];

const ADMIN_MANAGER_DOC_TYPES = [
  { value: "dc_document", label: "DC Document" },
  { value: "gate_pass", label: "Gate Pass" },
];

const ENGINEER_DOC_TYPES = [
  { value: "qc_report", label: "QC Report" },
  { value: "installation_completion_report", label: "Installation Completion Report" },
  { value: "security_guidelines", label: "Security Guidelines" },
  { value: "signed_dc", label: "Signed DC" },
  { value: "training_report", label: "Training Report" },
  { value: "project_architecture", label: "Project Architecture" },
  { value: "completed_sow", label: "Completed SOW" },
];

// Sales doc types (approved by Sales Manager)
const SALES_DOC_TYPE_VALUES = SALES_DOC_TYPES.map(d => d.value);
// Admin Manager doc types (approved by PM)
const ADMIN_DOC_TYPE_VALUES = ADMIN_MANAGER_DOC_TYPES.map(d => d.value);
// Engineer doc types (approved by PM)
const ENGINEER_DOC_TYPE_VALUES = ENGINEER_DOC_TYPES.map(d => d.value);

// Docs requiring client signature
const CLIENT_SIGNABLE_TYPES = ["installation_completion_report", "security_guidelines", "training_report", "signed_dc"];

const ALL_DOC_TYPES = [...SALES_DOC_TYPES, ...ADMIN_MANAGER_DOC_TYPES, ...ENGINEER_DOC_TYPES, { value: "other", label: "Other" }];

const APPROVAL_STYLES: Record<string, { class: string; icon: any }> = {
  pending: { class: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  approved: { class: "bg-success/10 text-success border-success/20", icon: CheckCircle },
  rejected: { class: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

interface AssignedEngineer {
  assignment_id: string;
  engineer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  assigned_at: string;
}

interface AvailableEngineer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface DailyUpdate {
  id: string;
  summary: string;
  percentage_complete: number;
  hours_worked: number;
  blockers: string | null;
  update_date: string;
  created_at: string;
  engineer_id: string;
  engineer_name?: string;
}

interface ProjectDocument {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string | null;
  approval_status: string;
  uploaded_by: string;
  uploader_name?: string;
  created_at: string;
  signature_url: string | null;
  signed_at: string | null;
  signer_name: string | null;
  notes: string | null;
  signing_token: string | null;
}

interface CustomField {
  id: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
}

// Helper to send workflow notification emails via edge function (bypasses RLS)
async function sendWorkflowEmail(targetRole: string, subject: string, html: string) {
  try {
    console.log("Sending workflow email to role:", targetRole);
    const { error } = await supabase.functions.invoke("send-email", {
      body: { target_role: targetRole, subject, html },
    });
    if (error) console.error("Email send error:", error);
  } catch (err) {
    console.error("Workflow email failed:", err);
  }
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isProjectManager, isSupportEngineer, isEngineering, isAdminManager, isSales, isSalesManager, isAccountsManager, isCEO, user } = useAuth();
  const isAnyEngineer = isSupportEngineer || isEngineering;
  const [project, setProject] = useState<Project | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<AssignedEngineer[]>([]);
  const [available, setAvailable] = useState<AvailableEngineer[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [engineerLoading, setEngineerLoading] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [updateSummary, setUpdateSummary] = useState("");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateHours, setUpdateHours] = useState(0);
  const [updateBlockers, setUpdateBlockers] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signingDoc, setSigningDoc] = useState<ProjectDocument | null>(null);
  const [signerName, setSignerName] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [savingSignature, setSavingSignature] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const [approving, setApproving] = useState(false);

  const getUploadableDocTypes = () => {
    const types: { value: string; label: string }[] = [];
    if (isSales || isProjectManager) types.push(...SALES_DOC_TYPES);
    if (isAdminManager || isProjectManager) types.push(...ADMIN_MANAGER_DOC_TYPES);
    if (isAnyEngineer || isProjectManager) types.push(...ENGINEER_DOC_TYPES);
    if (isProjectManager) types.push({ value: "other", label: "Other" });
    const seen = new Set<string>();
    return types.filter(t => { if (seen.has(t.value)) return false; seen.add(t.value); return true; });
  };

  const canEdit = isProjectManager || isSales || isAdminManager;
  const canUploadDocs = isSales || isAdminManager || isAnyEngineer || isProjectManager;
  const canManageStatus = isProjectManager;
  const canAssignEngineer = isProjectManager;
  const canSubmitUpdate = isAnyEngineer || isProjectManager;

  // Who can approve/reject a given document?
  const canApproveDoc = (doc: ProjectDocument) => {
    const dtype = doc.document_type ?? "";
    // Sales docs -> approved by Sales Manager
    if (SALES_DOC_TYPE_VALUES.includes(dtype)) return isSalesManager || isProjectManager;
    // Admin/Engineer docs -> approved by PM
    return isProjectManager;
  };

  const fetchProject = async () => {
    if (!id) return;
    const { data } = await supabase.from("projects").select("*").eq("id", id).single();
    const proj = data as Project;
    setProject(proj);
    if (proj?.product_id) {
      const { data: prod } = await supabase.from("product_catalog" as any).select("name").eq("id", proj.product_id).single();
      setProductName((prod as any)?.name ?? null);
    }
    if (proj?.status) setSelectedStatus(proj.status);
  };

  const fetchAssignments = async () => {
    if (!id) return;
    const { data: assignments } = await supabase.from("project_assignments").select("id, engineer_id, assigned_at").eq("project_id", id);
    if (!assignments?.length) { setAssigned([]); return; }
    const engineerIds = assignments.map((a) => a.engineer_id);
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", engineerIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setAssigned(assignments.map((a) => {
      const p = profileMap.get(a.engineer_id);
      return { assignment_id: a.id, engineer_id: a.engineer_id, first_name: p?.first_name ?? "", last_name: p?.last_name ?? "", email: p?.email ?? "", assigned_at: a.assigned_at };
    }));
  };

  const fetchAvailableEngineers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["support_engineer", "engineering"]);
    if (!roles?.length) { setAvailable([]); return; }
    const allIds = roles.map((r) => r.user_id);
    const assignedIds = assigned.map((a) => a.engineer_id);
    const unassignedIds = allIds.filter((uid) => !assignedIds.includes(uid));
    if (!unassignedIds.length) { setAvailable([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", unassignedIds);
    setAvailable(profiles ?? []);
  };

  const fetchUpdates = async () => {
    if (!id) return;
    const { data } = await supabase.from("daily_updates").select("*").eq("project_id", id).order("created_at", { ascending: false });
    if (!data?.length) { setUpdates([]); return; }
    const engineerIds = [...new Set(data.map((u) => u.engineer_id))];
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", engineerIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setUpdates(data.map((u) => ({
      ...u,
      engineer_name: (() => { const p = profileMap.get(u.engineer_id); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; })(),
    })));
  };

  const fetchDocuments = async () => {
    if (!id) return;
    const { data } = await supabase.from("documents").select("*").eq("project_id", id).order("created_at", { ascending: false });
    if (!data?.length) { setDocuments([]); return; }
    const uploaderIds = [...new Set(data.map((d) => d.uploaded_by))];
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", uploaderIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setDocuments((data as any[]).map((d) => ({
      ...d,
      uploader_name: (() => { const p = profileMap.get(d.uploaded_by); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; })(),
    })));
  };

  const fetchCustomFields = async () => {
    const { data } = await supabase.from("project_field_config" as any).select("*").order("sort_order");
    setCustomFields((data as any) ?? []);
  };

  const fetchCustomValues = async () => {
    if (!id) return;
    const { data } = await supabase.from("project_custom_values" as any).select("field_id, value").eq("project_id", id);
    const map: Record<string, string> = {};
    ((data as any[]) ?? []).forEach((v: any) => { map[v.field_id] = v.value ?? ""; });
    setCustomValues(map);
  };

  useEffect(() => {
    fetchProject();
    fetchAssignments();
    fetchUpdates();
    fetchDocuments();
    fetchCustomFields();
    fetchCustomValues();
  }, [id]);

  useEffect(() => {
    if (assignDialogOpen) fetchAvailableEngineers();
  }, [assignDialogOpen, assigned]);

  // ---- Approval workflow actions ----
  const handleApproveWorkflow = async (nextStatus: string, emailRole: string, emailSubject: string) => {
    if (!id || !project) return;
    setApproving(true);

    // For Sales Manager approving draft -> sales_approved:
    // Check that all sales docs (SOW, MSA, Pre-install checklist) are approved first
    if (project.status === "draft" && nextStatus === "sales_approved") {
      const salesDocs = documents.filter(d => SALES_DOC_TYPE_VALUES.includes(d.document_type ?? ""));
      const unapproved = salesDocs.filter(d => d.approval_status !== "approved");
      if (unapproved.length > 0) {
        toast.error("Please approve all Sales documents (SOW, MSA, Pre-Installation Checklist) before approving the project.");
        setApproving(false);
        return;
      }
    }

    const { error } = await supabase.from("projects").update({ status: nextStatus as any }).eq("id", id);
    if (error) { toast.error(error.message); setApproving(false); return; }
    toast.success(`Project approved! Status updated.`);

    // Send notification email to next role
    if (emailRole) {
      await sendWorkflowEmail(
        emailRole,
        emailSubject.replace("{{project}}", project.name),
        `<h2>Project Requires Your Attention</h2>
         <p>Hi {{name}},</p>
         <p>The project <strong>${project.name}</strong> for client <strong>${project.client_name}</strong> requires your review and approval.</p>
         <p>Please log in to review the project details.</p>`
      );
    }

    setApproving(false);
    fetchProject();
  };

  // ---- Engineer assign/unassign ----
  const handleAssign = async () => {
    if (!selectedEngineer || !id || engineerLoading) return;
    setEngineerLoading(true);
    const { data: existing } = await supabase.from("project_assignments").select("id").eq("project_id", id).eq("engineer_id", selectedEngineer).maybeSingle();
    if (existing) {
      toast.info("Engineer is already assigned to this project.");
      setEngineerLoading(false);
      setAssignDialogOpen(false);
      return;
    }
    const { error } = await supabase.from("project_assignments").insert({ project_id: id, engineer_id: selectedEngineer });
    if (error) { toast.error(error.message); setEngineerLoading(false); return; }
    setAssignDialogOpen(false);
    const eng = available.find(e => e.id === selectedEngineer);
    if (eng && project) {
      await supabase.functions.invoke("send-email", {
        body: {
          to: eng.email,
          subject: `You've been assigned to project: ${project.name}`,
          html: `<h2>Project Assignment</h2><p>Hi ${eng.first_name},</p><p>You have been assigned to the project <strong>${project.name}</strong> for client <strong>${project.client_name}</strong>.</p><p>Please log in to view the project details.</p>`,
        },
      }).catch(() => toast.warning("Engineer assigned but email notification failed."));
    }
    toast.success("Engineer assigned!");
    setSelectedEngineer("");
    await fetchAssignments();
    setEngineerLoading(false);
  };

  const handleUnassign = async (assignmentId: string) => {
    const { error } = await supabase.from("project_assignments").delete().eq("id", assignmentId);
    if (error) { toast.error(error.message); return; }
    toast.success("Engineer removed from project.");
    fetchAssignments();
  };

  // ---- Daily updates ----
  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;
    setSubmittingUpdate(true);
    const { error } = await supabase.from("daily_updates").insert({
      project_id: id, engineer_id: user.id, summary: updateSummary,
      percentage_complete: updateProgress, hours_worked: updateHours, blockers: updateBlockers || null,
    });
    if (error) { toast.error(error.message); setSubmittingUpdate(false); return; }
    await supabase.from("projects").update({ progress_percentage: updateProgress }).eq("id", id);
    toast.success("Update submitted!");
    setUpdateSummary(""); setUpdateProgress(0); setUpdateHours(0); setUpdateBlockers("");
    setSubmittingUpdate(false);
    await Promise.all([fetchUpdates(), fetchProject()]);
  };

  // ---- Document upload ----
  const handleUpload = async () => {
    if (!uploadFile || !id || !user) return;
    setUploading(true); setUploadProgress(10);
    const filePath = `${id}/${Date.now()}_${uploadFile.name}`;
    const { error: storageError } = await supabase.storage.from("documents").upload(filePath, uploadFile);
    if (storageError) { toast.error(storageError.message); setUploading(false); setUploadProgress(0); return; }
    setUploadProgress(70);

    const needsSignature = CLIENT_SIGNABLE_TYPES.includes(uploadDocType);
    const signingToken = needsSignature ? crypto.randomUUID() : null;
    const expiresAt = needsSignature ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;

    const { error: dbError } = await supabase.from("documents").insert({
      project_id: id, uploaded_by: user.id, file_name: uploadFile.name,
      file_url: filePath, document_type: uploadDocType || null, approval_status: "pending",
      ...(signingToken ? { signing_token: signingToken, signing_token_expires_at: expiresAt } : {}),
    } as any);
    if (dbError) { toast.error(dbError.message); setUploading(false); setUploadProgress(0); return; }
    setUploadProgress(100);

    // Auto status change based on document type
    if (uploadDocType === "qc_report" && project?.status === "open") {
      await supabase.from("projects").update({ status: "qc_completed" as any }).eq("id", id);
      toast.info("Project status updated to QC Completed");
      fetchProject();
    } else if (needsSignature && project && !["client_signing_pending", "client_signed", "pending_admin_approval", "closed"].includes(project.status)) {
      await supabase.from("projects").update({ status: "client_signing_pending" as any }).eq("id", id);
      toast.info("Project status updated to Client Signing Pending");
      fetchProject();
    }

    if (needsSignature && signingToken) {
      const link = `${window.location.origin}/sign/${signingToken}`;
      await navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Document uploaded! Signing link copied to clipboard.");
    } else {
      toast.success("Document uploaded!");
    }

    // Send email notification to client for signable docs
    if (project?.client_email && needsSignature && signingToken) {
      const docTypeLabel = ALL_DOC_TYPES.find(d => d.value === uploadDocType)?.label || uploadDocType;
      const signingLink = `${window.location.origin}/sign/${signingToken}`;
      await supabase.functions.invoke("send-email", {
        body: {
          to: project.client_email,
          subject: `Document requires your signature: ${project.name}`,
          html: `<h2>Document Signature Required</h2>
            <p>Dear ${project.client_name},</p>
            <p>A <strong>${docTypeLabel}</strong> document (<strong>${uploadFile.name}</strong>) has been uploaded for your project <strong>${project.name}</strong> and requires your signature.</p>
            <p><a href="${signingLink}" style="background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Sign Document</a></p>`,
        },
      }).catch(() => toast.warning("Document uploaded but client email notification failed."));
    }

    setUploadFile(null); setUploadDocType(""); setUploading(false); setUploadProgress(0);
    fetchDocuments();
  };

  const handleViewDocument = async (doc: ProjectDocument) => {
    // Pre-open blank window for Chrome compatibility
    const newWindow = window.open("", "_blank");
    try {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 3600);
      if (error || !data?.signedUrl) {
        if (newWindow) newWindow.close();
        toast.error("Could not generate download link: " + (error?.message || "Unknown error"));
        return;
      }
      if (newWindow) {
        newWindow.location.href = data.signedUrl;
      } else {
        // Fallback if popup was blocked
        window.location.href = data.signedUrl;
      }
    } catch (err: any) {
      if (newWindow) newWindow.close();
      toast.error("Error viewing document: " + err.message);
    }
  };

  const handleApproveReject = async (docId: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("documents").update({
      approval_status: status, approved_by: user?.id, approved_at: new Date().toISOString(),
    } as any).eq("id", docId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Document ${status}!`);
    if (status === "approved" && id && project?.status === "client_signed") {
      await supabase.from("projects").update({ status: "closed" as any }).eq("id", id);
      toast.info("Project status updated to Completed");
      fetchProject();
    }
    fetchDocuments();
  };

  const handleDeleteDocument = async (doc: ProjectDocument) => {
    await supabase.storage.from("documents").remove([doc.file_url]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted.");
    fetchDocuments();
  };

  const copySigningLink = (doc: ProjectDocument) => {
    if (!doc.signing_token) return;
    const link = `${window.location.origin}/sign/${doc.signing_token}`;
    navigator.clipboard.writeText(link);
    toast.success("Signing link copied to clipboard!");
  };

  // ---- Signature pad ----
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true); setHasSigned(true);
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y); ctx.strokeStyle = "hsl(var(--foreground))"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); setHasSigned(false);
  };

  const handleSaveSignature = async () => {
    if (!signingDoc || !canvasRef.current || !hasSigned) return;
    setSavingSignature(true);
    const signatureDataUrl = canvasRef.current.toDataURL("image/png");
    const { error } = await supabase.from("documents").update({
      signature_url: signatureDataUrl, signed_at: new Date().toISOString(), signer_name: signerName,
    } as any).eq("id", signingDoc.id);
    if (error) { toast.error(error.message); setSavingSignature(false); return; }
    toast.success("Signature saved!");

    if (id && project && project.status === "client_signing_pending") {
      await supabase.from("projects").update({ status: "client_signed" as any }).eq("id", id);
      toast.info("Project status updated to Client Signed Pending Approval");
      fetchProject();
    }

    // Notify project managers about client signature
    await sendWorkflowEmail(
      "project_manager",
      `Client signed document on project: ${project?.name}`,
      `<h2>Client Signature Received</h2>
       <p>Hi {{name}},</p>
       <p>Client <strong>${signerName}</strong> has signed the document <strong>${signingDoc.file_name}</strong> on project <strong>${project?.name}</strong>.</p>
       <p>Please review and approve the document.</p>`
    );

    setSavingSignature(false); setSignDialogOpen(false); setSigningDoc(null); setSignerName(""); setHasSigned(false);
    clearSignature(); fetchDocuments();
  };

  // ---- Status management ----
  const handleStatusChange = async () => {
    if (!id || !selectedStatus) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from("projects").update({ status: selectedStatus as any }).eq("id", id);
    if (error) { toast.error(error.message); setUpdatingStatus(false); return; }
    toast.success(`Status updated to "${ALL_STATUSES.find(s => s.value === selectedStatus)?.label}"!`);
    setStatusNote(""); setUpdatingStatus(false); fetchProject();
  };

  // ---- Edit project ----
  const openEditDialog = async () => {
    if (!project) return;
    const { data: prods } = await supabase.from("product_catalog" as any).select("id, name").eq("is_active", true).order("name");
    setProducts((prods as any) ?? []);
    setEditForm({
      name: project.name, client_name: project.client_name, client_email: project.client_email ?? "",
      client_company: project.client_company ?? "", description: project.description ?? "",
      start_date: project.start_date ?? "", deadline: project.deadline ?? "",
      budget: project.budget ?? "", product_id: project.product_id ?? "",
      product_version: project.product_version ?? "", num_users: project.num_users ?? "",
      num_channels: project.num_channels ?? "", trunk: project.trunk ?? "", location: project.location ?? "",
      priority: project.priority,
      sla_period: project.sla_period ?? "", sla_start_date: project.sla_start_date ?? "",
      sla_end_date: project.sla_end_date ?? "", amc_start_date: project.amc_start_date ?? "",
      amc_end_date: project.amc_end_date ?? "",
      server_serial_number: project.server_serial_number ?? "",
      gw_sl_no: project.gw_sl_no ?? "", sl_no_remarks: project.sl_no_remarks ?? "",
    });

    if (id) {
      const { data: cv } = await supabase.from("project_custom_values" as any).select("field_id, value").eq("project_id", id);
      const map: Record<string, string> = {};
      ((cv as any[]) ?? []).forEach((v: any) => { map[v.field_id] = v.value ?? ""; });
      setCustomValues(map);
    }
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id) return;
    setSavingEdit(true);

    const updatePayload: any = {};

    if (isProjectManager) {
      Object.assign(updatePayload, {
        name: editForm.name, client_name: editForm.client_name, client_email: editForm.client_email || null,
        client_company: editForm.client_company || null, description: editForm.description || null,
        start_date: editForm.start_date || null, deadline: editForm.deadline || null,
        budget: editForm.budget ? Number(editForm.budget) : null, product_id: editForm.product_id || null,
        product_version: editForm.product_version || null, num_users: editForm.num_users ? Number(editForm.num_users) : null,
        num_channels: editForm.num_channels ? Number(editForm.num_channels) : null,
        trunk: editForm.trunk || null, location: editForm.location || null, priority: editForm.priority,
        sla_period: editForm.sla_period || null, sla_start_date: editForm.sla_start_date || null,
        sla_end_date: editForm.sla_end_date || null, amc_start_date: editForm.amc_start_date || null,
        amc_end_date: editForm.amc_end_date || null,
        server_serial_number: editForm.server_serial_number || null,
        gw_sl_no: editForm.gw_sl_no || null, sl_no_remarks: editForm.sl_no_remarks || null,
      });
    } else if (isSales) {
      Object.assign(updatePayload, {
        name: editForm.name, client_name: editForm.client_name, client_email: editForm.client_email || null,
        client_company: editForm.client_company || null, description: editForm.description || null,
        start_date: editForm.start_date || null, deadline: editForm.deadline || null,
        budget: editForm.budget ? Number(editForm.budget) : null, product_id: editForm.product_id || null,
        product_version: editForm.product_version || null, num_users: editForm.num_users ? Number(editForm.num_users) : null,
        num_channels: editForm.num_channels ? Number(editForm.num_channels) : null,
        trunk: editForm.trunk || null, location: editForm.location || null, priority: editForm.priority,
        sla_period: editForm.sla_period || null, sla_start_date: editForm.sla_start_date || null,
        sla_end_date: editForm.sla_end_date || null, amc_start_date: editForm.amc_start_date || null,
        amc_end_date: editForm.amc_end_date || null,
      });
    } else if (isAdminManager) {
      Object.assign(updatePayload, {
        server_serial_number: editForm.server_serial_number || null,
        gw_sl_no: editForm.gw_sl_no || null, sl_no_remarks: editForm.sl_no_remarks || null,
      });
    }

    const { error } = await supabase.from("projects").update(updatePayload).eq("id", id);
    if (error) { toast.error(error.message); setSavingEdit(false); return; }

    if (isProjectManager) {
      for (const field of customFields) {
        const val = customValues[field.id] ?? "";
        await supabase.from("project_custom_values" as any).upsert({
          project_id: id, field_id: field.id, value: val || null,
        }, { onConflict: "project_id,field_id" });
      }
    }

    toast.success("Project updated!");
    setSavingEdit(false); setEditDialogOpen(false);
    fetchProject(); fetchCustomValues();
  };

  if (!project) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading project...</div>;
  }

  const statusLabel = ALL_STATUSES.find(s => s.value === project.status)?.label || project.status.replace(/_/g, " ");

  // Determine if current user has an approval action
  const getApprovalAction = () => {
    if (project.status === "draft" && isSalesManager) {
      return { label: "Approve (Sales Manager)", action: () => handleApproveWorkflow("sales_approved", "accounts_manager", "Project pending your approval: {{project}}") };
    }
    if (project.status === "sales_approved" && isAccountsManager) {
      return { label: "Approve (Accounts Manager)", action: () => handleApproveWorkflow("accounts_approved", "admin_manager", "Project pending your review: {{project}}") };
    }
    if (project.status === "accounts_approved" && isAdminManager) {
      return { label: "Submit Review (Admin Manager)", action: () => handleApproveWorkflow("admin_reviewed", "project_manager", "Project ready for assignment: {{project}}") };
    }
    if (project.status === "admin_reviewed" && isProjectManager) {
      return { label: "Set to Open & Assign Engineer", action: () => handleApproveWorkflow("open", "", "") };
    }
    return null;
  };

  const approvalAction = getApprovalAction();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">{project.client_name}{project.client_company ? ` — ${project.client_company}` : ""}</p>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={openEditDialog}><Edit className="mr-2 h-4 w-4" /> Edit Project</Button>
        )}
        <Badge variant="outline" className={STATUS_STYLES[project.status] || ""}>{statusLabel}</Badge>
        <Badge variant="secondary" className={PRIORITY_STYLES[project.priority] || ""}>{project.priority}</Badge>
      </div>

      {/* Approval workflow banner */}
      {approvalAction && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Approval Required</p>
                <p className="text-xs text-muted-foreground">
                  {project.status === "draft" && isSalesManager
                    ? "Please review and approve all Sales documents before approving this project."
                    : "This project is awaiting your approval to proceed to the next stage."}
                </p>
              </div>
            </div>
            <Button onClick={approvalAction.action} disabled={approving}>
              {approving ? "Processing..." : approvalAction.label}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Admin Manager: DC/Gate Pass upload + serial numbers section during accounts_approved */}
      {project.status === "accounts_approved" && isAdminManager && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle className="text-base">Admin Review: Upload DC/Gate Pass & Serial Numbers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Please upload the DC document and/or Gate Pass and fill in the serial numbers before approving.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2"><Label>Server Serial Number</Label><Input value={editForm.server_serial_number || project.server_serial_number || ""} onChange={(e) => setEditForm({ ...editForm, server_serial_number: e.target.value })} /></div>
              <div className="space-y-2"><Label>GW SL No</Label><Input value={editForm.gw_sl_no || project.gw_sl_no || ""} onChange={(e) => setEditForm({ ...editForm, gw_sl_no: e.target.value })} /></div>
              <div className="space-y-2"><Label>SL No Remarks</Label><Input value={editForm.sl_no_remarks || project.sl_no_remarks || ""} onChange={(e) => setEditForm({ ...editForm, sl_no_remarks: e.target.value })} /></div>
            </div>
            <Button variant="outline" onClick={async () => {
              if (!id) return;
              await supabase.from("projects").update({
                server_serial_number: editForm.server_serial_number || null,
                gw_sl_no: editForm.gw_sl_no || null,
                sl_no_remarks: editForm.sl_no_remarks || null,
              } as any).eq("id", id);
              toast.success("Serial numbers saved!");
              fetchProject();
            }}>Save Serial Numbers</Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start gap-1 h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canSubmitUpdate && <TabsTrigger value="updates">Daily Updates</TabsTrigger>}
          {!canSubmitUpdate && <TabsTrigger value="updates">Daily Updates</TabsTrigger>}
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {canManageStatus && <TabsTrigger value="status">Status</TabsTrigger>}
          <TabsTrigger value="engineers">Engineers</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="customizations">Customizations</TabsTrigger>
          <TabsTrigger value="upgrades">Upgrades</TabsTrigger>
          <TabsTrigger value="health">Health Checkups</TabsTrigger>
          <TabsTrigger value="feedback">Client Feedback</TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {project.start_date && (
              <Card><CardContent className="flex items-center gap-3 p-4">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Start Date</p><p className="text-sm font-medium">{project.start_date}</p></div>
              </CardContent></Card>
            )}
            {project.deadline && (
              <Card><CardContent className="flex items-center gap-3 p-4">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Go Live Date</p><p className="text-sm font-medium">{project.deadline}</p></div>
              </CardContent></Card>
            )}
            {project.budget != null && (
              <Card><CardContent className="flex items-center gap-3 p-4">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div><p className="text-xs text-muted-foreground">Budget</p><p className="text-sm font-medium">${Number(project.budget).toLocaleString()}</p></div>
              </CardContent></Card>
            )}
            <Card><CardContent className="flex items-center gap-3 p-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Progress</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={project.progress_percentage} className="h-2 flex-1" />
                  <span className="text-sm font-medium">{project.progress_percentage}%</span>
                </div>
              </div>
            </CardContent></Card>
          </div>

          {project.description && (
            <Card><CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p></CardContent></Card>
          )}

          {(productName || project.product_version || project.num_users != null || project.num_channels != null || project.trunk || project.location) && (
            <Card>
              <CardHeader><div className="flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground" /><CardTitle className="text-base">Product Details</CardTitle></div></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {productName && <div><p className="text-xs text-muted-foreground">Product</p><p className="text-sm font-medium">{productName}{project.product_version && <span className="ml-1 text-muted-foreground">{project.product_version}</span>}</p></div>}
                  {project.num_users != null && <div><p className="text-xs text-muted-foreground">No. of Users</p><p className="text-sm font-medium">{project.num_users}</p></div>}
                  {project.num_channels != null && <div><p className="text-xs text-muted-foreground">No. of Channels</p><p className="text-sm font-medium">{project.num_channels}</p></div>}
                  {project.trunk && <div><p className="text-xs text-muted-foreground">Trunk</p><p className="text-sm font-medium">{project.trunk}</p></div>}
                  {project.location && <div><p className="text-xs text-muted-foreground">Location</p><p className="text-sm font-medium">{project.location}</p></div>}
                </div>
              </CardContent>
            </Card>
          )}

          {(project.sla_period || project.sla_start_date || project.sla_end_date || project.amc_start_date || project.amc_end_date) && (
            <Card>
              <CardHeader><CardTitle className="text-base">SLA & AMC Details</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {project.sla_period && <div><p className="text-xs text-muted-foreground">SLA Period</p><p className="text-sm font-medium">{project.sla_period}</p></div>}
                  {project.sla_start_date && <div><p className="text-xs text-muted-foreground">SLA Start</p><p className="text-sm font-medium">{project.sla_start_date}</p></div>}
                  {project.sla_end_date && <div><p className="text-xs text-muted-foreground">SLA End</p><p className="text-sm font-medium">{project.sla_end_date}</p></div>}
                  {project.amc_start_date && <div><p className="text-xs text-muted-foreground">AMC Start</p><p className="text-sm font-medium">{project.amc_start_date}</p></div>}
                  {project.amc_end_date && <div><p className="text-xs text-muted-foreground">AMC End</p><p className="text-sm font-medium">{project.amc_end_date}</p></div>}
                </div>
              </CardContent>
            </Card>
          )}

          {(project.server_serial_number || project.gw_sl_no || project.sl_no_remarks) && (
            <Card>
              <CardHeader><CardTitle className="text-base">Hardware Details</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {project.server_serial_number && <div><p className="text-xs text-muted-foreground">Server Serial Number</p><p className="text-sm font-medium">{project.server_serial_number}</p></div>}
                  {project.gw_sl_no && <div><p className="text-xs text-muted-foreground">GW SL No</p><p className="text-sm font-medium">{project.gw_sl_no}</p></div>}
                  {project.sl_no_remarks && <div><p className="text-xs text-muted-foreground">SL No Remarks</p><p className="text-sm font-medium">{project.sl_no_remarks}</p></div>}
                </div>
              </CardContent>
            </Card>
          )}

          {customFields.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Additional Fields</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {customFields.map(f => (
                    <div key={f.id}>
                      <p className="text-xs text-muted-foreground">{f.field_name}</p>
                      <p className="text-sm font-medium">{customValues[f.id] || "—"}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== DAILY UPDATES TAB ===== */}
        <TabsContent value="updates" className="space-y-4 mt-4">
          {canSubmitUpdate && (
            <Card>
              <CardHeader><CardTitle className="text-base">Submit Daily Update</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitUpdate} className="space-y-4">
                  <div className="space-y-2"><Label>Summary *</Label><Textarea placeholder="What did you work on today?" value={updateSummary} onChange={(e) => setUpdateSummary(e.target.value)} required /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Progress % ({updateProgress}%)</Label>
                      <input type="range" min={0} max={100} step={5} value={updateProgress} onChange={(e) => setUpdateProgress(Number(e.target.value))} className="w-full accent-primary" />
                      <Progress value={updateProgress} className="h-2" />
                    </div>
                    <div className="space-y-2"><Label>Hours Worked</Label><Input type="number" min={0} max={24} step={0.5} value={updateHours} onChange={(e) => setUpdateHours(Number(e.target.value))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Blockers (optional)</Label><Textarea placeholder="Any blockers or issues?" value={updateBlockers} onChange={(e) => setUpdateBlockers(e.target.value)} rows={2} /></div>
                  <Button type="submit" disabled={submittingUpdate || !updateSummary}>{submittingUpdate ? "Submitting..." : "Submit Update"}</Button>
                </form>
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {updates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><AlertCircle className="h-8 w-8 mb-2 opacity-40" /><p>No updates yet for this project.</p></div>
            ) : updates.map((u) => (
              <Card key={u.id}><CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{u.summary}</p>
                    {u.blockers && <div className="mt-2 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2"><p className="text-xs text-destructive font-medium">Blocker: {u.blockers}</p></div>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">{new Date(u.update_date).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">{u.engineer_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1 flex-1">
                    <div className="h-1.5 flex-1 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${u.percentage_complete}%` }} /></div>
                    <span className="font-medium text-foreground">{u.percentage_complete}%</span>
                  </div>
                  <span>{u.hours_worked}h worked</span>
                </div>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        {/* ===== DOCUMENTS TAB ===== */}
        <TabsContent value="documents" className="space-y-4 mt-4">
          {canUploadDocs && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Document</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>File</Label><Input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} /></div>
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <Select value={uploadDocType} onValueChange={setUploadDocType}>
                      <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                      <SelectContent>{getUploadableDocTypes().map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {uploading && <Progress value={uploadProgress} className="h-2" />}
                <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
                  {uploading ? "Uploading..." : <><Upload className="mr-2 h-4 w-4" />Upload</>}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Signature</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No documents uploaded yet.</TableCell></TableRow>
                  ) : documents.map((doc) => {
                    const statusStyle = APPROVAL_STYLES[doc.approval_status] || APPROVAL_STYLES.pending;
                    const StatusIcon = statusStyle.icon;
                    const isOwn = doc.uploaded_by === user?.id;
                    const docTypeLabel = ALL_DOC_TYPES.find(t => t.value === doc.document_type)?.label ?? doc.document_type ?? "—";
                    const isSignable = CLIENT_SIGNABLE_TYPES.includes(doc.document_type ?? "");
                    const showApproveReject = canApproveDoc(doc) && doc.approval_status === "pending";
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate" title={doc.file_name}>{doc.file_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{docTypeLabel}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${statusStyle.class}`}>
                            <StatusIcon className="h-3 w-3 mr-1" />{doc.approval_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {doc.signed_at ? (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Signed by {doc.signer_name}</p>
                              {doc.signature_url && <img src={doc.signature_url} alt="Signature" className="h-8 border rounded" />}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{doc.uploader_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDocument(doc)} title="View"><Eye className="h-3.5 w-3.5" /></Button>
                            {/* Copy signing link - available anytime for signable docs with a token */}
                            {doc.signing_token && isSignable && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-info" onClick={() => copySigningLink(doc)} title="Copy Signing Link"><Copy className="h-3.5 w-3.5" /></Button>
                            )}
                            {isSignable && !doc.signed_at && (isProjectManager || isOwn) && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => { setSigningDoc(doc); setSignerName(""); setSignDialogOpen(true); }} title="Get Signed"><PenTool className="h-3.5 w-3.5" /></Button>
                            )}
                            {showApproveReject && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => handleApproveReject(doc.id, "approved")} title="Approve"><CheckCircle className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleApproveReject(doc.id, "rejected")} title="Reject"><XCircle className="h-3.5 w-3.5" /></Button>
                              </>
                            )}
                            {(isProjectManager || (isOwn && doc.approval_status === "pending")) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete "{doc.file_name}". This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteDocument(doc)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== STATUS TAB (PM only) ===== */}
        {canManageStatus && (
          <TabsContent value="status" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Project Status Pipeline</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2 items-center">
                  {ALL_STATUSES.map((s, i) => (
                    <div key={s.value} className="flex items-center gap-2">
                      <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${project.status === s.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border"}`}>{s.label}</div>
                      {i < ALL_STATUSES.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Change Status To</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="w-64"><SelectValue placeholder="Select new status..." /></SelectTrigger>
                      <SelectContent>{PM_MANUAL_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Audit Note (optional)</Label><Textarea placeholder="Add a note about this status change..." value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={3} /></div>
                  <Button onClick={handleStatusChange} disabled={updatingStatus || selectedStatus === project.status}><RefreshCw className="mr-2 h-4 w-4" />{updatingStatus ? "Updating..." : "Update Status"}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ===== ENGINEERS TAB ===== */}
        <TabsContent value="engineers" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Assigned Engineers</CardTitle>
              {canAssignEngineer && assigned.length === 0 && (
                <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                  <DialogTrigger asChild><Button size="sm"><UserPlus className="mr-2 h-4 w-4" /> Assign Engineer</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Assign Engineer to Project</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      {available.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No available engineers to assign.</p>
                      ) : (
                        <>
                          <Select value={selectedEngineer} onValueChange={setSelectedEngineer}>
                            <SelectTrigger><SelectValue placeholder="Select an engineer" /></SelectTrigger>
                            <SelectContent>{available.map((eng) => <SelectItem key={eng.id} value={eng.id}>{eng.first_name} {eng.last_name} ({eng.email})</SelectItem>)}</SelectContent>
                          </Select>
                          <Button onClick={handleAssign} disabled={!selectedEngineer || engineerLoading} className="w-full">{engineerLoading ? "Assigning..." : "Assign"}</Button>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              {canAssignEngineer && assigned.length > 0 && (
                <p className="text-xs text-muted-foreground">One engineer per project</p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Assigned</TableHead>{canAssignEngineer && <TableHead className="w-12" />}</TableRow></TableHeader>
                <TableBody>
                  {assigned.length === 0 ? (
                    <TableRow><TableCell colSpan={canAssignEngineer ? 4 : 3} className="py-8 text-center text-muted-foreground">No engineers assigned yet.</TableCell></TableRow>
                  ) : assigned.map((eng) => (
                    <TableRow key={eng.assignment_id}>
                      <TableCell className="font-medium">{eng.first_name} {eng.last_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{eng.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(eng.assigned_at).toLocaleDateString()}</TableCell>
                      {canAssignEngineer && <TableCell><Button variant="ghost" size="icon" onClick={() => handleUnassign(eng.assignment_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TASKS TAB ===== */}
        <TabsContent value="tasks" className="mt-4">
          <TaskManager projectId={id!} embedded />
        </TabsContent>

        {/* ===== LIFECYCLE TABS ===== */}
        <TabsContent value="customizations" className="mt-4">
          <ProjectLifecycle projectId={id!} section="customizations" />
        </TabsContent>
        <TabsContent value="upgrades" className="mt-4">
          <ProjectLifecycle projectId={id!} section="upgrades" />
        </TabsContent>
        <TabsContent value="health" className="mt-4">
          <ProjectLifecycle projectId={id!} section="health" />
        </TabsContent>
        <TabsContent value="feedback" className="mt-4">
          <ProjectLifecycle projectId={id!} section="feedback" />
        </TabsContent>
      </Tabs>

      {/* ===== SIGNATURE PAD DIALOG ===== */}
      <Dialog open={signDialogOpen} onOpenChange={(open) => { setSignDialogOpen(open); if (!open) { clearSignature(); setSigningDoc(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><PenTool className="h-4 w-4" /> Signature Pad</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Signer Name</Label><Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Full name..." /></div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <div className="rounded-md border border-border bg-background overflow-hidden">
                <canvas ref={canvasRef} width={440} height={160} className="w-full touch-none cursor-crosshair" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
              </div>
              <p className="text-xs text-muted-foreground">Draw your signature above using mouse or touch.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearSignature} className="flex-1">Clear</Button>
              <Button onClick={handleSaveSignature} disabled={!hasSigned || !signerName || savingSignature} className="flex-1">{savingSignature ? "Saving..." : "Save Signature"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== EDIT PROJECT DIALOG ===== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {(isSales || isProjectManager) && (
              <>
                <div className="space-y-2"><Label>Project Name *</Label><Input value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Client Name *</Label><Input value={editForm.client_name || ""} onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Client Email</Label><Input value={editForm.client_email || ""} onChange={(e) => setEditForm({ ...editForm, client_email: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Client Company</Label><Input value={editForm.client_company || ""} onChange={(e) => setEditForm({ ...editForm, client_company: e.target.value })} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={editForm.start_date || ""} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Go Live Date</Label><Input type="date" value={editForm.deadline || ""} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Budget</Label><Input type="number" value={editForm.budget ?? ""} onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })} /></div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={editForm.priority || "medium"} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Product Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Select value={editForm.product_id || ""} onValueChange={(v) => setEditForm({ ...editForm, product_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Version</Label><Input value={editForm.product_version || ""} onChange={(e) => setEditForm({ ...editForm, product_version: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>No. of Users</Label><Input type="number" value={editForm.num_users ?? ""} onChange={(e) => setEditForm({ ...editForm, num_users: e.target.value })} /></div>
                  <div className="space-y-2"><Label>No. of Channels</Label><Input type="number" value={editForm.num_channels ?? ""} onChange={(e) => setEditForm({ ...editForm, num_channels: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Trunk</Label><Input value={editForm.trunk || ""} onChange={(e) => setEditForm({ ...editForm, trunk: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Location</Label><Input value={editForm.location || ""} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} /></div>
                </div>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SLA & AMC</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>SLA Period</Label>
                    <Select value={editForm.sla_period || ""} onValueChange={(v) => setEditForm({ ...editForm, sla_period: v })}>
                      <SelectTrigger><SelectValue placeholder="Select SLA" /></SelectTrigger>
                      <SelectContent>{SLA_PERIODS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>SLA Start Date</Label><Input type="date" value={editForm.sla_start_date || ""} onChange={(e) => setEditForm({ ...editForm, sla_start_date: e.target.value })} /></div>
                  <div className="space-y-2"><Label>SLA End Date</Label><Input type="date" value={editForm.sla_end_date || ""} onChange={(e) => setEditForm({ ...editForm, sla_end_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>AMC Start Date</Label><Input type="date" value={editForm.amc_start_date || ""} onChange={(e) => setEditForm({ ...editForm, amc_start_date: e.target.value })} /></div>
                  <div className="space-y-2"><Label>AMC End Date</Label><Input type="date" value={editForm.amc_end_date || ""} onChange={(e) => setEditForm({ ...editForm, amc_end_date: e.target.value })} /></div>
                </div>
              </>
            )}

            {(isAdminManager || isProjectManager) && (
              <>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hardware / Serial Numbers</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Server Serial Number</Label><Input value={editForm.server_serial_number || ""} onChange={(e) => setEditForm({ ...editForm, server_serial_number: e.target.value })} /></div>
                  <div className="space-y-2"><Label>GW SL No</Label><Input value={editForm.gw_sl_no || ""} onChange={(e) => setEditForm({ ...editForm, gw_sl_no: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>SL No Remarks</Label><Input value={editForm.sl_no_remarks || ""} onChange={(e) => setEditForm({ ...editForm, sl_no_remarks: e.target.value })} /></div>
              </>
            )}

            {/* Custom Fields (PM only) */}
            {isProjectManager && customFields.length > 0 && (
              <>
                <Separator />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom Fields</p>
                {customFields.map(f => (
                  <div key={f.id} className="space-y-2">
                    <Label>{f.field_name}{f.is_required ? " *" : ""}</Label>
                    <Input value={customValues[f.id] || ""} onChange={(e) => setCustomValues(prev => ({ ...prev, [f.id]: e.target.value }))} />
                  </div>
                ))}
              </>
            )}

            <Button onClick={handleSaveEdit} disabled={savingEdit} className="w-full">{savingEdit ? "Saving..." : "Save Changes"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
