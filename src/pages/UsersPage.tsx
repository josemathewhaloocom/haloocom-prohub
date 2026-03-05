import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Search, Users } from "lucide-react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Constants } from "@/integrations/supabase/types";

const ALL_ROLES = Constants.public.Enums.app_role;

const ROLE_LABELS: Record<string, string> = {
  project_manager: "Project Manager",
  admin_manager: "Admin Manager",
  sales: "Sales",
  sales_manager: "Sales Manager",
  accounts_manager: "Accounts Manager",
  engineer: "Engineer",
  ceo: "CEO",
};

const ROLE_COLORS: Record<string, string> = {
  project_manager: "bg-primary/10 text-primary border-primary/20",
  admin_manager: "bg-info/10 text-info border-info/20",
  sales: "bg-success/10 text-success border-success/20",
  sales_manager: "bg-success/10 text-success border-success/20",
  accounts_manager: "bg-warning/10 text-warning border-warning/20",
  engineer: "bg-info/10 text-info border-info/20",
  ceo: "bg-muted text-muted-foreground border-border",
};

interface UserWithRoles {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  roles: string[];
}

export default function UsersPage() {
  const { isProjectManager } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, email");
    const { data: allRoles } = await supabase.from("user_roles").select("user_id, role");

    const roleMap = new Map<string, string[]>();
    (allRoles ?? []).forEach(r => {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
      roleMap.get(r.user_id)!.push(r.role);
    });

    setUsers(
      (profiles ?? []).map(p => ({
        ...p,
        roles: roleMap.get(p.id) ?? [],
      }))
    );
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoles.length === 0) { toast.error("Select at least one role"); return; }
    setSubmitting(true);

    const { data, error } = await supabase.functions.invoke("invite-engineer", {
      body: { ...form, roles: selectedRoles },
    });
    setSubmitting(false);
    if (error || data?.error) { toast.error(data?.error || error?.message || "Failed to create user"); return; }
    toast.success(`User ${form.first_name} created successfully!`);
    setDialogOpen(false);
    setForm({ email: "", password: "", first_name: "", last_name: "" });
    setSelectedRoles([]);
    fetchUsers();
  };

  const toggleRole = async (userId: string, role: string, currentRoles: string[]) => {
    if (currentRoles.includes(role)) {
      // Remove role
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as any);
      if (error) { toast.error(error.message); return; }
      toast.success(`Removed ${ROLE_LABELS[role]} role`);
    } else {
      // Add role
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) { toast.error(error.message); return; }
      toast.success(`Added ${ROLE_LABELS[role]} role`);
    }
    fetchUsers();
  };

  if (!isProjectManager) return <Navigate to="/" replace />;

  const filteredUsers = users.filter(u =>
    u.first_name.toLowerCase().includes(search.toLowerCase()) ||
    u.last_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage users and their roles.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> Invite User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite New User</DialogTitle></DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>First Name *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Last Name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
              <div className="space-y-2">
                <Label>Roles *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_ROLES.map(role => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`invite-${role}`}
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={(checked) => {
                          setSelectedRoles(prev =>
                            checked ? [...prev, role] : prev.filter(r => r !== role)
                          );
                        }}
                      />
                      <label htmlFor={`invite-${role}`} className="text-sm cursor-pointer">{ROLE_LABELS[role] || role}</label>
                    </div>
                  ))}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Creating..." : "Create User"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Users className="h-5 w-5" /></div>
            <div><p className="text-sm text-muted-foreground">Total Users</p><p className="text-2xl font-bold">{users.length}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">User Directory</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Manage Roles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-12 text-center text-muted-foreground">No users found.</TableCell></TableRow>
              ) : filteredUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.first_name} {u.last_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      ) : u.roles.map(r => (
                        <Badge key={r} variant="outline" className={`text-xs ${ROLE_COLORS[r] || ""}`}>
                          {ROLE_LABELS[r] || r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {ALL_ROLES.map(role => (
                        <Button
                          key={role}
                          variant={u.roles.includes(role) ? "default" : "outline"}
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => toggleRole(u.id, role, u.roles)}
                        >
                          {u.roles.includes(role) ? "✓ " : ""}{ROLE_LABELS[role]?.split(" ")[0] || role}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
