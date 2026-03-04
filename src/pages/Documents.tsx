import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight, Search, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";

const APPROVAL_STYLES: Record<string, { class: string; icon: any }> = {
  pending: { class: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  approved: { class: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  rejected: { class: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

interface DocWithProject {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string | null;
  approval_status: string;
  created_at: string;
  signed_at: string | null;
  signer_name: string | null;
  signature_url: string | null;
  project_name: string;
  project_id: string;
}

export default function Documents() {
  const { isProjectManager } = useAuth();
  const [documents, setDocuments] = useState<DocWithProject[]>([]);
  const [search, setSearch] = useState("");
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchDocs = async () => {
      const { data } = await supabase
        .from("documents")
        .select("*, projects(name)")
        .order("created_at", { ascending: false });
      setDocuments(
        (data ?? []).map((d: any) => ({
          ...d,
          project_name: d.projects?.name || "Unknown",
          project_id: d.project_id,
        }))
      );
    };
    fetchDocs();
  }, []);

  const handleViewDocument = async (doc: DocWithProject) => {
    const newWindow = window.open("", "_blank");
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 60);
    if (data?.signedUrl && newWindow) {
      newWindow.location.href = data.signedUrl;
    } else {
      if (newWindow) newWindow.close();
      toast.error("Could not generate download link.");
    }
  };

  const handleDeleteDocument = async (doc: DocWithProject) => {
    await supabase.storage.from("documents").remove([doc.file_url]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Document deleted.");
    const { data } = await supabase
      .from("documents")
      .select("*, projects(name)")
      .order("created_at", { ascending: false });
    setDocuments(
      (data ?? []).map((d: any) => ({
        ...d,
        project_name: d.projects?.name || "Unknown",
        project_id: d.project_id,
      }))
    );
  };

  const filteredDocs = documents.filter(d => d.project_name.toLowerCase().includes(search.toLowerCase()) || d.file_name.toLowerCase().includes(search.toLowerCase()));
  const grouped = new Map<string, DocWithProject[]>();
  filteredDocs.forEach(d => {
    const key = d.project_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  });

  const toggleProject = (projectId: string) => {
    setOpenProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const pendingCount = documents.filter(d => d.approval_status === "pending").length;
  const approvedCount = documents.filter(d => d.approval_status === "approved").length;
  const rejectedCount = documents.filter(d => d.approval_status === "rejected").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Review and manage documents by project.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {([["pending", pendingCount], ["approved", approvedCount], ["rejected", rejectedCount]] as const).map(([status, count]) => {
          const { icon: Icon } = APPROVAL_STYLES[status];
          return (
            <Card key={status}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-lg bg-muted p-2.5"><Icon className="h-5 w-5" /></div>
                <div><p className="text-sm capitalize text-muted-foreground">{status}</p><p className="text-2xl font-bold">{count}</p></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by project or file name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {grouped.size === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No documents found.</CardContent></Card>
      ) : (
        Array.from(grouped.entries()).map(([projectId, docs]) => {
          const projectName = docs[0]?.project_name || "Unknown";
          const isOpen = openProjects.has(projectId);
          return (
            <Card key={projectId}>
              <Collapsible open={isOpen} onOpenChange={() => toggleProject(projectId)}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <CardTitle className="text-base">{projectName}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{docs.length} doc{docs.length !== 1 ? "s" : ""}</Badge>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Signed</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {docs.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{doc.file_name}</div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{doc.document_type || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={APPROVAL_STYLES[doc.approval_status]?.class || ""}>{doc.approval_status}</Badge>
                            </TableCell>
                            <TableCell>
                              {doc.signed_at ? (
                                <div>
                                  <p className="text-xs text-muted-foreground">{doc.signer_name}</p>
                                  {doc.signature_url && <img src={doc.signature_url} alt="Signature" className="h-6 border rounded mt-1" />}
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDocument(doc)} title="View">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {isProjectManager && (
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
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })
      )}
    </div>
  );
}
