import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, UserPlus, Trash2, Calendar, DollarSign, Package,
  Upload, FileText, CheckCircle, XCircle, Clock, PenTool, Eye, Download,
  AlertCircle, ChevronRight, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"] & {
  product_id?: string | null;
  product_version?: string | null;
  num_users?: number | null;
  num_channels?: number | null;
  trunk?: string | null;
  location?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-info/10 text-info border-info/20",
  in_progress: "bg-warning/10 text-warning border-warning/20",
  on_hold: "bg-destructive/10 text-destructive border-destructive/20",
  completed: "bg-success/10 text-success border-success/20",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  critical: "bg-destructive/10 text-destructive",
};

const PROJECT_STATUSES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

const DOCUMENT_TYPES = [
  { value: "sow", label: "Statement of Work (SOW)" },
  { value: "architecture", label: "Architecture Diagram" },
  { value: "sign_off", label: "Sign-Off Document" },
  { value: "security_guidelines", label: "Security Guidelines" },
  { value: "training_report", label: "Training Report" },
  { value: "other", label: "Other" },
];

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
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<AssignedEngineer[]>([]);
  const [available, setAvailable] = useState<AvailableEngineer[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [engineerLoading, setEngineerLoading] = useState(false);

  // Daily updates state
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [updateSummary, setUpdateSummary] = useState("");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateHours, setUpdateHours] = useState(0);
  const [updateBlockers, setUpdateBlockers] = useState("");
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Documents state
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Signature dialog state
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signingDoc, setSigningDoc] = useState<ProjectDocument | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [savingSignature, setSavingSignature] = useState(false);

  // Status management state
  const [selectedStatus, setSelectedStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchProject = async () => {
    if (!id) return;
    const { data } = await supabase.from("projects").select("*").eq("id", id).single();
    const proj = data as unknown as Project;
    setProject(proj);
    if (proj?.product_id) {
      const { data: prod } = await supabase
        .from("product_catalog" as any)
        .select("name")
        .eq("id", proj.product_id)
        .single();
      setProductName((prod as any)?.name ?? null);
    }
    if (proj?.status) setSelectedStatus(proj.status);
    if (proj?.client_email) setSignerEmail(proj.client_email);
  };

  const fetchAssignments = async () => {
    if (!id) return;
    const { data: assignments } = await supabase
      .from("project_assignments")
      .select("id, engineer_id, assigned_at")
      .eq("project_id", id);
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
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "engineer");
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
    const { data } = await supabase
      .from("daily_updates")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false });
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
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false });
    if (!data?.length) { setDocuments([]); return; }
    const uploaderIds = [...new Set(data.map((d) => d.uploaded_by))];
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", uploaderIds);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setDocuments((data as any[]).map((d) => ({
      ...d,
      uploader_name: (() => { const p = profileMap.get(d.uploaded_by); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; })(),
    })));
  };

  useEffect(() => {
    fetchProject();
    fetchAssignments();
    fetchUpdates();
    fetchDocuments();
  }, [id]);

  useEffect(() => {
    if (assignDialogOpen) fetchAvailableEngineers();
  }, [assignDialogOpen, assigned]);

  // ---- Engineer assign/unassign ----
  const handleAssign = async () => {
    if (!selectedEngineer || !id) return;
    setEngineerLoading(true);
    const { error } = await supabase.from("project_assignments").insert({ project_id: id, engineer_id: selectedEngineer });
    setEngineerLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Engineer assigned!");
    setSelectedEngineer("");
    setAssignDialogOpen(false);
    fetchAssignments();
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
      project_id: id,
      engineer_id: user.id,
      summary: updateSummary,
      percentage_complete: updateProgress,
      hours_worked: updateHours,
      blockers: updateBlockers || null,
    });
    if (error) { toast.error(error.message); setSubmittingUpdate(false); return; }
    // Update project progress
    await supabase.from("projects").update({ progress_percentage: updateProgress }).eq("id", id);
    toast.success("Update submitted!");
    setUpdateSummary("");
    setUpdateProgress(0);
    setUpdateHours(0);
    setUpdateBlockers("");
    setSubmittingUpdate(false);
    // Refresh both updates and project
    await Promise.all([fetchUpdates(), fetchProject()]);
  };

  // ---- Document upload ----
  const handleUpload = async () => {
    if (!uploadFile || !id || !user) return;
    setUploading(true);
    setUploadProgress(10);
    const ext = uploadFile.name.split(".").pop();
    const filePath = `${id}/${Date.now()}_${uploadFile.name}`;
    const { error: storageError } = await supabase.storage.from("documents").upload(filePath, uploadFile);
    if (storageError) { toast.error(storageError.message); setUploading(false); setUploadProgress(0); return; }
    setUploadProgress(70);
    const { error: dbError } = await supabase.from("documents").insert({
      project_id: id,
      uploaded_by: user.id,
      file_name: uploadFile.name,
      file_url: filePath,
      document_type: uploadDocType || null,
      approval_status: "pending",
    } as any);
    if (dbError) { toast.error(dbError.message); setUploading(false); setUploadProgress(0); return; }
    setUploadProgress(100);
    toast.success("Document uploaded!");
    setUploadFile(null);
    setUploadDocType("");
    setUploading(false);
    setUploadProgress(0);
    fetchDocuments();
  };

  const handleViewDocument = async (doc: ProjectDocument) => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Could not generate download link.");
  };

  const handleApproveReject = async (docId: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("documents").update({
      approval_status: status,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    } as any).eq("id", docId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Document ${status}!`);
    fetchDocuments();
  };

  const handleDeleteDocument = async (doc: ProjectDocument) => {
    await supabase.storage.from("documents").remove([doc.file_url]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted.");
    fetchDocuments();
  };

  // ---- Signature pad ----
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    setHasSigned(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleSaveSignature = async () => {
    if (!signingDoc || !canvasRef.current || !hasSigned) return;
    setSavingSignature(true);
    const signatureDataUrl = canvasRef.current.toDataURL("image/png");
    const { error } = await supabase.from("documents").update({
      signature_url: signatureDataUrl,
      signed_at: new Date().toISOString(),
      signer_name: signerName,
    } as any).eq("id", signingDoc.id);
    if (error) { toast.error(error.message); setSavingSignature(false); return; }
    toast.success("Signature saved!");
    setSavingSignature(false);
    setSignDialogOpen(false);
    setSigningDoc(null);
    setSignerName("");
    setHasSigned(false);
    clearSignature();
    fetchDocuments();
  };

  // ---- Status management ----
  const handleStatusChange = async () => {
    if (!id || !selectedStatus) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from("projects").update({ status: selectedStatus as any }).eq("id", id);
    if (error) { toast.error(error.message); setUpdatingStatus(false); return; }
    toast.success(`Status updated to "${PROJECT_STATUSES.find(s => s.value === selectedStatus)?.label}"!`);
    setStatusNote("");
    setUpdatingStatus(false);
    fetchProject();
  };

  if (!project) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading project...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">{project.client_name}{project.client_company ? ` — ${project.client_company}` : ""}</p>
        </div>
        <Badge variant="outline" className={STATUS_STYLES[project.status] || ""}>{project.status.replace("_", " ")}</Badge>
        <Badge variant="secondary" className={PRIORITY_STYLES[project.priority] || ""}>{project.priority}</Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start gap-1 h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="updates">Daily Updates</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {role === "admin" && <TabsTrigger value="status">Status</TabsTrigger>}
          <TabsTrigger value="engineers">Engineers</TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {project.start_date && (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-xs text-muted-foreground">Start Date</p><p className="text-sm font-medium">{project.start_date}</p></div>
                </CardContent>
              </Card>
            )}
            {project.deadline && (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-xs text-muted-foreground">Deadline</p><p className="text-sm font-medium">{project.deadline}</p></div>
                </CardContent>
              </Card>
            )}
            {project.budget != null && (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-xs text-muted-foreground">Budget</p><p className="text-sm font-medium">${Number(project.budget).toLocaleString()}</p></div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Progress</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${project.progress_percentage}%` }} />
                    </div>
                    <span className="text-sm font-medium">{project.progress_percentage}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {project.description && (
            <Card>
              <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p></CardContent>
            </Card>
          )}

          {(productName || project.product_version || project.num_users != null || project.num_channels != null || project.trunk || project.location) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Product Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {productName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Product</p>
                      <p className="text-sm font-medium">{productName}{project.product_version && <span className="ml-1 text-muted-foreground">{project.product_version}</span>}</p>
                    </div>
                  )}
                  {project.num_users != null && <div><p className="text-xs text-muted-foreground">No. of Users</p><p className="text-sm font-medium">{project.num_users}</p></div>}
                  {project.num_channels != null && <div><p className="text-xs text-muted-foreground">No. of Channels</p><p className="text-sm font-medium">{project.num_channels}</p></div>}
                  {project.trunk && <div><p className="text-xs text-muted-foreground">Trunk</p><p className="text-sm font-medium">{project.trunk}</p></div>}
                  {project.location && <div><p className="text-xs text-muted-foreground">Location</p><p className="text-sm font-medium">{project.location}</p></div>}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== DAILY UPDATES TAB ===== */}
        <TabsContent value="updates" className="space-y-4 mt-4">
          {/* Submit form for engineers */}
          <Card>
            <CardHeader><CardTitle className="text-base">Submit Daily Update</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Summary *</Label>
                  <Textarea
                    placeholder="What did you work on today?"
                    value={updateSummary}
                    onChange={(e) => setUpdateSummary(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Progress % ({updateProgress}%)</Label>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={updateProgress}
                      onChange={(e) => setUpdateProgress(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <Progress value={updateProgress} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <Label>Hours Worked</Label>
                    <Input type="number" min={0} max={24} step={0.5} value={updateHours} onChange={(e) => setUpdateHours(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Blockers (optional)</Label>
                  <Textarea placeholder="Any blockers or issues?" value={updateBlockers} onChange={(e) => setUpdateBlockers(e.target.value)} rows={2} />
                </div>
                <Button type="submit" disabled={submittingUpdate || !updateSummary}>
                  {submittingUpdate ? "Submitting..." : "Submit Update"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Updates list */}
          <div className="space-y-3">
            {updates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                <p>No updates yet for this project.</p>
              </div>
            ) : (
              updates.map((u) => (
                <Card key={u.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{u.summary}</p>
                        {u.blockers && (
                          <div className="mt-2 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2">
                            <p className="text-xs text-destructive font-medium">Blocker: {u.blockers}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">{new Date(u.update_date).toLocaleDateString()}</p>
                        {role === "admin" && <p className="text-xs text-muted-foreground">{u.engineer_name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 flex-1">
                        <div className="h-1.5 flex-1 rounded-full bg-muted">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${u.percentage_complete}%` }} />
                        </div>
                        <span className="font-medium text-foreground">{u.percentage_complete}%</span>
                      </div>
                      <span>{u.hours_worked}h worked</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ===== DOCUMENTS TAB ===== */}
        <TabsContent value="documents" className="space-y-4 mt-4">
          {/* Upload section */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Document</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={uploadDocType} onValueChange={setUploadDocType}>
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {uploading && <Progress value={uploadProgress} className="h-2" />}
              <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
                {uploading ? "Uploading..." : <><Upload className="mr-2 h-4 w-4" />Upload</>}
              </Button>
            </CardContent>
          </Card>

          {/* Document list */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No documents uploaded yet.</TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => {
                      const statusStyle = APPROVAL_STYLES[doc.approval_status] || APPROVAL_STYLES.pending;
                      const StatusIcon = statusStyle.icon;
                      const isOwn = doc.uploaded_by === user?.id;
                      const docTypeLabel = DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.label ?? doc.document_type ?? "—";
                      return (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate" title={doc.file_name}>{doc.file_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{docTypeLabel}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${statusStyle.class}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />{doc.approval_status}
                            </Badge>
                            {doc.signed_at && <p className="text-xs text-muted-foreground mt-1">Signed by {doc.signer_name}</p>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{doc.uploader_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDocument(doc)} title="View">
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {/* Sign-off button */}
                              {(doc.document_type === "sign_off" || role === "admin") && !doc.signed_at && (
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 text-primary"
                                  onClick={() => { setSigningDoc(doc); setSignerEmail(project.client_email ?? ""); setSignDialogOpen(true); }}
                                  title="Get Signed"
                                >
                                  <PenTool className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {/* Admin: approve / reject */}
                              {role === "admin" && doc.approval_status === "pending" && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => handleApproveReject(doc.id, "approved")} title="Approve">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleApproveReject(doc.id, "rejected")} title="Reject">
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {/* Engineer: delete own pending */}
                              {isOwn && doc.approval_status === "pending" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteDocument(doc)} title="Delete">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== STATUS TAB (admin only) ===== */}
        {role === "admin" && (
          <TabsContent value="status" className="space-y-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Project Status Pipeline</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {/* Visual stepper */}
                <div className="flex flex-wrap gap-2 items-center">
                  {PROJECT_STATUSES.map((s, i) => (
                    <div key={s.value} className="flex items-center gap-2">
                      <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${project.status === s.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border"}`}>
                        {s.label}
                      </div>
                      {i < PROJECT_STATUSES.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Change Status To</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select new status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Audit Note (optional)</Label>
                    <Textarea
                      placeholder="Add a note about this status change..."
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleStatusChange}
                    disabled={updatingStatus || selectedStatus === project.status}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {updatingStatus ? "Updating..." : "Update Status"}
                  </Button>
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
              {role === "admin" && (
                <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><UserPlus className="mr-2 h-4 w-4" /> Assign Engineer</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Assign Engineer to Project</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      {available.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No available engineers to assign.</p>
                      ) : (
                        <>
                          <Select value={selectedEngineer} onValueChange={setSelectedEngineer}>
                            <SelectTrigger><SelectValue placeholder="Select an engineer" /></SelectTrigger>
                            <SelectContent>
                              {available.map((eng) => (
                                <SelectItem key={eng.id} value={eng.id}>{eng.first_name} {eng.last_name} ({eng.email})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={handleAssign} disabled={!selectedEngineer || engineerLoading} className="w-full">
                            {engineerLoading ? "Assigning..." : "Assign"}
                          </Button>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assigned</TableHead>
                    {role === "admin" && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assigned.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={role === "admin" ? 4 : 3} className="py-8 text-center text-muted-foreground">No engineers assigned yet.</TableCell>
                    </TableRow>
                  ) : (
                    assigned.map((eng) => (
                      <TableRow key={eng.assignment_id}>
                        <TableCell className="font-medium">{eng.first_name} {eng.last_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{eng.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(eng.assigned_at).toLocaleDateString()}</TableCell>
                        {role === "admin" && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleUnassign(eng.assignment_id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== SIGNATURE PAD DIALOG ===== */}
      <Dialog open={signDialogOpen} onOpenChange={(open) => { setSignDialogOpen(open); if (!open) { clearSignature(); setSigningDoc(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><PenTool className="h-4 w-4" /> Signature Pad</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Signer Name</Label>
                <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Full name..." />
              </div>
              <div className="space-y-2">
                <Label>Signer Email</Label>
                <Input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Signature</Label>
              <div className="rounded-md border border-border bg-background overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={440}
                  height={160}
                  className="w-full touch-none cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <p className="text-xs text-muted-foreground">Draw your signature above using mouse or touch.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearSignature} className="flex-1">Clear</Button>
              <Button onClick={handleSaveSignature} disabled={!hasSigned || !signerName || savingSignature} className="flex-1">
                {savingSignature ? "Saving..." : "Save Signature"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
