import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, PackageOpen } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const { user, role } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

  // Product catalog state
  const [products, setProducts] = useState<Product[]>([]);
  const [newProductName, setNewProductName] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ first_name: firstName, last_name: lastName }).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile updated!");
    setSaving(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("product_catalog" as any)
      .select("*")
      .order("name");
    if (error) { toast.error(error.message); return; }
    setProducts((data as unknown as Product[]) ?? []);
  };

  useEffect(() => {
    if (role === "admin") fetchProducts();
  }, [role]);

  const handleAddProduct = async () => {
    if (!newProductName.trim()) return;
    setAddingProduct(true);
    const { error } = await supabase
      .from("product_catalog" as any)
      .insert({ name: newProductName.trim(), created_by: user?.id });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Product added!");
      setNewProductName("");
      fetchProducts();
    }
    setAddingProduct(false);
  };

  const handleToggleActive = async (product: Product) => {
    const { error } = await supabase
      .from("product_catalog" as any)
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    if (error) toast.error(error.message);
    else fetchProducts();
  };

  const handleRemoveProduct = async (id: string) => {
    const { error } = await supabase
      .from("product_catalog" as any)
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Product removed.");
      fetchProducts();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings.</p>
      </div>

      {/* Profile Card */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Product Catalog — admin only */}
      {role === "admin" && (
        <Card className="max-w-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Product Catalog</CardTitle>
            </div>
            <CardDescription>Manage products available in the project dropdown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new product */}
            <div className="flex gap-2">
              <Input
                placeholder="New product name..."
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddProduct()}
              />
              <Button onClick={handleAddProduct} disabled={addingProduct || !newProductName.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            <Separator />

            {/* Product list */}
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No products yet. Add one above.</p>
            ) : (
              <ul className="space-y-2">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <span className={`text-sm font-medium ${!p.is_active ? "text-muted-foreground line-through" : ""}`}>
                      {p.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`cursor-pointer text-xs ${p.is_active ? "border-success/40 text-success bg-success/10" : "border-muted text-muted-foreground"}`}
                        onClick={() => handleToggleActive(p)}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveProduct(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

