import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, FolderKanban } from "lucide-react";
import { Navigate } from "react-router-dom";

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

  useEffect(() => {
    const fetchEngineers = async () => {
      // Get all engineers
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "engineer");
      if (!roles?.length) return;

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
    fetchEngineers();
  }, []);

  if (role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engineers</h1>
        <p className="text-muted-foreground">Manage team members and workload.</p>
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
                    No engineers registered yet.
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
