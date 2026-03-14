import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, PackageOpen, Mail, Settings2, Headset } from "lucide-react";
import { toast } from "sonner";

interface SmtpSettings {
  id?: string;
  host: string; port: number; username: string; password: string;
  from_email: string; from_name: string; use_ssl: boolean; use_tls: boolean;
}

interface Product { id: string; name: string; is_active: boolean; created_at: string; }

interface CustomField {
  id: string; field_name: string; field_type: string;
  is_required: boolean; sort_order: number;
}

interface TicketConfigItem {
  id: string; field_name: string; field_value: string;
  parent_value: string | null; sort_order: number; is_active: boolean;
}

const TICKET_CONFIG_FIELDS = [
  { key: "status", label: "Status" },
  { key: "department", label: "Department" },
  { key: "issue_reported_via", label: "Issue Reported Via" },
  { key: "case_type", label: "Case Type" },
  { key: "category", label: "Category" },
  { key: "sub_category", label: "Sub Category" },
];

export default function SettingsPage() {
  const { user, isProjectManager } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [newProductName, setNewProductName] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  const [smtp, setSmtp] = useState<SmtpSettings>({
    host: "", port: 587, username: "", password: "",
    from_email: "", from_name: "", use_ssl: false, use_tls: true,
  });
  const [smtpId, setSmtpId] = useState<string | null>(null);
  const [savingSmtp, setSavingSmtp] = useState(false);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [addingField, setAddingField] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ first_name: firstName, last_name: lastName }).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile updated!");
    setSaving(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("product_catalog" as any).select("*").order("name");
    setProducts((data as unknown as Product[]) ?? []);
  };

  const handleAddProduct = async () => {
    if (!newProductName.trim()) return;
    setAddingProduct(true);
    const { error } = await supabase.from("product_catalog" as any).insert({ name: newProductName.trim(), created_by: user?.id });
    if (error) toast.error(error.message);
    else { toast.success("Product added!"); setNewProductName(""); fetchProducts(); }
    setAddingProduct(false);
  };

  const handleToggleActive = async (product: Product) => {
    const { error } = await supabase.from("product_catalog" as any).update({ is_active: !product.is_active }).eq("id", product.id);
    if (error) toast.error(error.message); else fetchProducts();
  };

  const handleRemoveProduct = async (id: string) => {
    const { error } = await supabase.from("product_catalog" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Product removed."); fetchProducts(); }
  };

  const fetchSmtpSettings = async () => {
    const { data } = await (supabase as any).from("smtp_settings").select("*").limit(1).maybeSingle();
    if (data) {
      setSmtpId(data.id);
      setSmtp({ host: data.host ?? "", port: data.port ?? 587, username: data.username ?? "", password: data.password ?? "", from_email: data.from_email ?? "", from_name: data.from_name ?? "", use_ssl: data.use_ssl ?? false, use_tls: data.use_tls ?? true });
    }
  };

  const handleSaveSmtp = async () => {
    setSavingSmtp(true);
    const payload = { ...smtp, updated_by: user?.id, updated_at: new Date().toISOString() };
    let error;
    if (smtpId) {
      ({ error } = await (supabase as any).from("smtp_settings").update(payload).eq("id", smtpId));
    } else {
      const { data, error: insertError } = await (supabase as any).from("smtp_settings").insert(payload).select().single();
      error = insertError; if (data) setSmtpId(data.id);
    }
    if (error) toast.error(error.message);
    else toast.success("SMTP settings saved!");
    setSavingSmtp(false);
  };

  const fetchCustomFields = async () => {
    const { data } = await supabase.from("project_field_config" as any).select("*").order("sort_order");
    setCustomFields((data as any) ?? []);
  };

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;
    setAddingField(true);
    const maxSort = customFields.length > 0 ? Math.max(...customFields.map(f => f.sort_order)) + 1 : 0;
    const { error } = await supabase.from("project_field_config" as any).insert({
      field_name: newFieldName.trim(), field_type: newFieldType,
      is_required: newFieldRequired, sort_order: maxSort, created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Field added!"); setNewFieldName(""); setNewFieldType("text"); setNewFieldRequired(false); fetchCustomFields(); }
    setAddingField(false);
  };

  const handleDeleteField = async (id: string) => {
    const { error } = await supabase.from("project_field_config" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Field removed."); fetchCustomFields(); }
  };

  useEffect(() => {
    if (isProjectManager) { fetchProducts(); fetchSmtpSettings(); fetchCustomFields(); }
  }, [isProjectManager]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Profile</CardTitle><CardDescription>Update your personal information.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Email</Label><Input value={user?.email || ""} disabled /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>First Name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Last Name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </CardContent>
      </Card>

      {isProjectManager && (
        <Card className="max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-2"><PackageOpen className="h-4 w-4 text-muted-foreground" /><CardTitle className="text-base">Product Catalog</CardTitle></div>
            <CardDescription>Manage products available in the project dropdown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="New product name..." value={newProductName} onChange={(e) => setNewProductName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddProduct()} />
              <Button onClick={handleAddProduct} disabled={addingProduct || !newProductName.trim()}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
            <Separator />
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No products yet.</p>
            ) : (
              <ul className="space-y-2">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <span className={`text-sm font-medium ${!p.is_active ? "text-muted-foreground line-through" : ""}`}>{p.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`cursor-pointer text-xs ${p.is_active ? "border-success/40 text-success bg-success/10" : "border-muted text-muted-foreground"}`} onClick={() => handleToggleActive(p)}>{p.is_active ? "Active" : "Inactive"}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoveProduct(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {isProjectManager && (
        <Card className="max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><CardTitle className="text-base">Email / SMTP Settings</CardTitle></div>
            <CardDescription>Configure your outgoing email server for notifications.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2 sm:col-span-1"><Label>SMTP Host</Label><Input placeholder="smtp.gmail.com" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} /></div>
              <div className="space-y-2"><Label>Port</Label><Input type="number" placeholder="587" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Username</Label><Input placeholder="user@example.com" value={smtp.username} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} /></div>
              <div className="space-y-2"><Label>Password</Label><Input type="password" placeholder="••••••••" value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>From Email</Label><Input placeholder="noreply@company.com" value={smtp.from_email} onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })} /></div>
              <div className="space-y-2"><Label>From Name</Label><Input placeholder="Haloocom ProHub" value={smtp.from_name} onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })} /></div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium">Use TLS</p><p className="text-xs text-muted-foreground">Recommended for most providers</p></div>
              <Switch checked={smtp.use_tls} onCheckedChange={(v) => setSmtp({ ...smtp, use_tls: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium">Use SSL</p><p className="text-xs text-muted-foreground">For legacy port 465</p></div>
              <Switch checked={smtp.use_ssl} onCheckedChange={(v) => setSmtp({ ...smtp, use_ssl: v })} />
            </div>
            <Separator />
            <Button onClick={handleSaveSmtp} disabled={savingSmtp}>{savingSmtp ? "Saving..." : "Save SMTP Settings"}</Button>
          </CardContent>
        </Card>
      )}

      {isProjectManager && (
        <Card className="max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-muted-foreground" /><CardTitle className="text-base">Project Fields Configuration</CardTitle></div>
            <CardDescription>Add custom fields that appear on all projects.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Field name" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} />
              <Select value={newFieldType} onValueChange={setNewFieldType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAddField} disabled={addingField || !newFieldName.trim()}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newFieldRequired} onCheckedChange={setNewFieldRequired} />
              <Label className="text-sm">Required field</Label>
            </div>
            <Separator />
            {customFields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No custom fields configured.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Required</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
                <TableBody>
                  {customFields.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium text-sm">{f.field_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">{f.field_type}</TableCell>
                      <TableCell>{f.is_required ? <Badge variant="outline" className="text-xs bg-primary/10 text-primary">Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteField(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
