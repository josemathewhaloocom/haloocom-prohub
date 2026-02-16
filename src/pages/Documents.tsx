import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, CheckCircle2, Clock, XCircle } from "lucide-react";

const APPROVAL_STYLES: Record<string, { class: string; icon: any }> = {
  pending: { class: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  approved: { class: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  rejected: { class: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

export default function Documents() {
  const { role } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    const fetchDocs = async () => {
      const { data } = await supabase
        .from("documents")
        .select("*, projects(name)")
        .order("created_at", { ascending: false });
      setDocuments(data ?? []);
    };
    fetchDocs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Review and manage sign-off documents.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(["pending", "approved", "rejected"] as const).map((status) => {
          const count = documents.filter((d) => d.approval_status === status).length;
          const { icon: Icon } = APPROVAL_STYLES[status];
          return (
            <Card key={status}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-lg bg-muted p-2.5">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm capitalize text-muted-foreground">{status}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    No documents uploaded yet.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {doc.file_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{doc.projects?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={APPROVAL_STYLES[doc.approval_status]?.class || ""}>
                        {doc.approval_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
