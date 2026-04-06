import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  HelpCircle,
  Headset,
  TrendingUp,
  Eye,
  EyeOff,
} from "lucide-react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export default function FAQPage() {
  const { user, isProjectManager, isSupportManager, isSalesManager, isEngineer } = useAuth();
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("support_implementation");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "support_implementation",
    is_published: true,
  });

  const canManageSupport = isProjectManager || isSupportManager || isEngineer;
  const canManageSales = isProjectManager || isSalesManager;
  const canManageCurrent = activeTab === "support_implementation" ? canManageSupport : canManageSales;

  useEffect(() => {
    fetchFaqs();
  }, []);

  async function fetchFaqs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("faq_items")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading FAQs", description: error.message, variant: "destructive" });
    } else {
      setFaqs((data as FaqItem[]) || []);
    }
    setLoading(false);
  }

  const filteredFaqs = useMemo(() => {
    return faqs
      .filter((f) => f.category === activeTab)
      .filter(
        (f) =>
          !search ||
          f.question.toLowerCase().includes(search.toLowerCase()) ||
          f.answer.toLowerCase().includes(search.toLowerCase())
      );
  }, [faqs, activeTab, search]);

  const publishedCount = useMemo(
    () => faqs.filter((f) => f.category === activeTab && f.is_published).length,
    [faqs, activeTab]
  );
  const totalCount = useMemo(
    () => faqs.filter((f) => f.category === activeTab).length,
    [faqs, activeTab]
  );

  function openAddDialog() {
    setEditingFaq(null);
    setFormData({ question: "", answer: "", category: activeTab, is_published: true });
    setDialogOpen(true);
  }

  function openEditDialog(faq: FaqItem) {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      is_published: faq.is_published,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.question.trim() || !formData.answer.trim()) {
      toast({ title: "Validation Error", description: "Question and answer are required.", variant: "destructive" });
      return;
    }

    if (editingFaq) {
      const { error } = await supabase
        .from("faq_items")
        .update({
          question: formData.question.trim(),
          answer: formData.answer.trim(),
          is_published: formData.is_published,
          updated_by: user?.id,
        } as any)
        .eq("id", editingFaq.id);

      if (error) {
        toast({ title: "Error updating FAQ", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "FAQ updated successfully" });
    } else {
      const { error } = await supabase.from("faq_items").insert({
        question: formData.question.trim(),
        answer: formData.answer.trim(),
        category: formData.category,
        is_published: formData.is_published,
        created_by: user?.id,
        sort_order: totalCount,
      } as any);

      if (error) {
        toast({ title: "Error creating FAQ", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "FAQ added successfully" });
    }

    setDialogOpen(false);
    fetchFaqs();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("faq_items").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting FAQ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "FAQ deleted" });
    fetchFaqs();
  }

  async function handleTogglePublish(faq: FaqItem) {
    const { error } = await supabase
      .from("faq_items")
      .update({ is_published: !faq.is_published, updated_by: user?.id } as any)
      .eq("id", faq.id);

    if (error) {
      toast({ title: "Error updating FAQ", description: error.message, variant: "destructive" });
      return;
    }
    fetchFaqs();
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading FAQs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">FAQ Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            Frequently asked questions and common resolutions
          </p>
        </div>
        {canManageCurrent && (
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Add FAQ
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="support_implementation" className="gap-2">
            <Headset className="h-4 w-4" />
            Support & Implementation
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Sales
          </TabsTrigger>
        </TabsList>

        {/* Stats and Search */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Badge variant="secondary" className="gap-1">
              <HelpCircle className="h-3 w-3" /> {totalCount} Total
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Eye className="h-3 w-3" /> {publishedCount} Published
            </Badge>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search FAQs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value="support_implementation" className="mt-4">
          <FaqList
            faqs={filteredFaqs}
            canManage={canManageSupport}
            onEdit={openEditDialog}
            onDelete={handleDelete}
            onTogglePublish={handleTogglePublish}
          />
        </TabsContent>
        <TabsContent value="sales" className="mt-4">
          <FaqList
            faqs={filteredFaqs}
            canManage={canManageSales}
            onEdit={openEditDialog}
            onDelete={handleDelete}
            onTogglePublish={handleTogglePublish}
          />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFaq ? "Edit FAQ" : "Add New FAQ"}</DialogTitle>
            <DialogDescription>
              {editingFaq
                ? "Update the question and answer below."
                : "Enter a question and its answer to add to the knowledge base."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="faq-question">Question</Label>
              <Input
                id="faq-question"
                placeholder="Enter the question..."
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-answer">Answer</Label>
              <Textarea
                id="faq-answer"
                placeholder="Enter the answer..."
                rows={5}
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="faq-published"
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
              />
              <Label htmlFor="faq-published">Published (visible to all users)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editingFaq ? "Update" : "Add"} FAQ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaqList({
  faqs,
  canManage,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  faqs: FaqItem[];
  canManage: boolean;
  onEdit: (faq: FaqItem) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (faq: FaqItem) => void;
}) {
  if (faqs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <HelpCircle className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No FAQs found.</p>
          {canManage && (
            <p className="mt-1 text-sm text-muted-foreground/70">
              Click "Add FAQ" to create the first entry.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Accordion type="multiple" className="w-full">
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <div className="flex items-center gap-2 pr-4">
                <AccordionTrigger className="flex-1 px-4 text-left">
                  <div className="flex items-center gap-2">
                    {!faq.is_published && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <EyeOff className="h-3 w-3" /> Draft
                      </Badge>
                    )}
                    <span>{faq.question}</span>
                  </div>
                </AccordionTrigger>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePublish(faq);
                      }}
                      title={faq.is_published ? "Unpublish" : "Publish"}
                    >
                      {faq.is_published ? (
                        <Eye className="h-4 w-4 text-primary" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(faq);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this FAQ entry.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(faq.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
              <AccordionContent className="px-4 pb-4 text-muted-foreground whitespace-pre-wrap">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
