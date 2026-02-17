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
import { Users, FolderKanban, UserPlus } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

interface EngineerProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  project_count: number;
}

export default function Engineers() {
  const { role } = useAuth();
  const [engineers, setEngineers] = useState<EngineerProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });

  const fetchEngineers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "engineer");
    if (!roles?.length) { setEngineers([]); return; }

    const ids = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
    const { data: assignments } = await supabase.from("project_assignments").select("engineer_id");

    const countMap: Record<string, number> = {};
    assignments?.forEach((a) => { countMap[a.engineer_id] = (countMap[a.engineer_id] || 0) + 1; });

    setEngineers(
      (profiles ?? []).map((p) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        project_count: countMap[p.id] || 0,
      }))
    );
  };

  useEffect(() => { fetchEngineers(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const { data, error } = await supabase.functions.invoke("invite-engineer", {
      body: form,
    });

    setSubmitting(false);

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to create engineer");
      return;
    }

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
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> Add Engineer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Engineer</DialogTitle></DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating..." : "Create Engineer Account"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Engineers</p>
              <p className="text-2xl font-bold">{engineers.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engineer Directory</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Active Projects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {engineers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                    No engineers registered yet. Click "Add Engineer" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                engineers.map((eng) => (
                  <TableRow key={eng.id}>
                    <TableCell className="font-medium">{eng.first_name} {eng.last_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{eng.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <FolderKanban className="h-3 w-3" /> {eng.project_count}
                      </Badge>
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
