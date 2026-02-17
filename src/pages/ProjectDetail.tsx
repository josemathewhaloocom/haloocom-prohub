import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, UserPlus, Trash2, Calendar, DollarSign, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

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

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [assigned, setAssigned] = useState<AssignedEngineer[]>([]);
  const [available, setAvailable] = useState<AvailableEngineer[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchProject = async () => {
    if (!id) return;
    const { data } = await supabase.from("projects").select("*").eq("id", id).single();
    setProject(data);
  };

  const fetchAssignments = async () => {
    if (!id) return;
    const { data: assignments } = await supabase
      .from("project_assignments")
      .select("id, engineer_id, assigned_at")
      .eq("project_id", id);

    if (!assignments?.length) {
      setAssigned([]);
      return;
    }

    const engineerIds = assignments.map((a) => a.engineer_id);
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", engineerIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    setAssigned(
      assignments.map((a) => {
        const p = profileMap.get(a.engineer_id);
        return {
          assignment_id: a.id,
          engineer_id: a.engineer_id,
          first_name: p?.first_name ?? "",
          last_name: p?.last_name ?? "",
          email: p?.email ?? "",
          assigned_at: a.assigned_at,
        };
      })
    );
  };

  const fetchAvailableEngineers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "engineer");
    if (!roles?.length) { setAvailable([]); return; }

    const allIds = roles.map((r) => r.user_id);
    const assignedIds = assigned.map((a) => a.engineer_id);
    const unassignedIds = allIds.filter((id) => !assignedIds.includes(id));

    if (!unassignedIds.length) { setAvailable([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", unassignedIds);
    setAvailable(profiles ?? []);
  };

  useEffect(() => {
    fetchProject();
    fetchAssignments();
  }, [id]);

  useEffect(() => {
    if (assignDialogOpen) fetchAvailableEngineers();
  }, [assignDialogOpen, assigned]);

  const handleAssign = async () => {
    if (!selectedEngineer || !id) return;
    setLoading(true);
    const { error } = await supabase.from("project_assignments").insert({
      project_id: id,
      engineer_id: selectedEngineer,
    });
    setLoading(false);
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

  if (!project) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading project...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">{project.client_name}{project.client_company ? ` — ${project.client_company}` : ""}</p>
        </div>
        <Badge variant="outline" className={STATUS_STYLES[project.status] || ""}>
          {project.status.replace("_", " ")}
        </Badge>
        <Badge variant="secondary" className={PRIORITY_STYLES[project.priority] || ""}>
          {project.priority}
        </Badge>
      </div>

      {/* Project Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {project.start_date && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="text-sm font-medium">{project.start_date}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {project.deadline && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="text-sm font-medium">{project.deadline}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {project.budget != null && (
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Budget</p>
                <p className="text-sm font-medium">${Number(project.budget).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Progress</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-2 flex-1 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${project.progress_percentage}%` }} />
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

      {/* Assigned Engineers */}
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
                            <SelectItem key={eng.id} value={eng.id}>
                              {eng.first_name} {eng.last_name} ({eng.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAssign} disabled={!selectedEngineer || loading} className="w-full">
                        {loading ? "Assigning..." : "Assign"}
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
                  <TableCell colSpan={role === "admin" ? 4 : 3} className="py-8 text-center text-muted-foreground">
                    No engineers assigned yet.
                  </TableCell>
                </TableRow>
              ) : (
                assigned.map((eng) => (
                  <TableRow key={eng.assignment_id}>
                    <TableCell className="font-medium">{eng.first_name} {eng.last_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{eng.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(eng.assigned_at).toLocaleDateString()}
                    </TableCell>
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
    </div>
  );
}
