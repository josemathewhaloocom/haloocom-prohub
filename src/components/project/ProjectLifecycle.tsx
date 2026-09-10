import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Person = { id: string; first_name: string; last_name: string };
type Section = "customizations" | "upgrades" | "health" | "feedback";

const selectCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const today = () => new Date().toISOString().slice(0, 10);

export default function ProjectLifecycle({
  projectId,
  section,
}: {
  projectId: string;
  section: Section;
}) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const table =
    section === "customizations"
      ? "project_customizations"
      : section === "upgrades"
      ? "project_upgrades"
      : section === "health"
      ? "health_checkups"
      : "client_feedback";

  const orderCol =
    section === "customizations"
      ? "done_on"
      : section === "upgrades"
      ? "upgrade_date"
      : section === "health"
      ? "scheduled_date"
      : "feedback_date";

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from(table as never).select("*").eq("project_id", projectId).order(orderCol, { ascending: false }),
      supabase.from("profiles").select("id, first_name, last_name").order("first_name"),
    ]);
    setRows((data ?? []) as any[]);
    setPeople((p ?? []) as Person[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, section]);

  const name = (id: string | null) => {
    const p = people.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "—";
  };

  const defaults = () => {
    switch (section) {
      case "customizations":
        return { title: "", description: "", version: "", done_by: "", done_on: today() };
      case "upgrades":
        return { from_version: "", to_version: "", upgrade_date: today(), performed_by: "", notes: "" };
      case "health":
        return { scheduled_date: today(), completed_date: "", status: "scheduled", engineer_id: "", findings: "" };
      default:
        return { rating: 5, comments: "", source: "call", feedback_date: today(), engineer_id: "" };
    }
  };

  const openNew = () => {
    setForm(defaults());
    setOpen(true);
  };

  const save = async () => {
    const payload: any = { ...form, project_id: projectId, created_by: user?.id };
    Object.keys(payload).forEach((k) => {
      if (payload[k] === "") payload[k] = null;
    });
    if (section === "customizations" && !payload.title) return toast.error("Title is required");
    if (section === "upgrades" && !payload.to_version) return toast.error("Target version is required");
    if (section === "health" && !payload.scheduled_date) return toast.error("Scheduled date is required");
    if (section === "health" && payload.completed_date) payload.status = "completed";
    if (section === "feedback") payload.rating = Number(payload.rating);

    const { error } = await supabase.from(table as never).insert(payload as never);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    load();
  };

  const markComplete = async (id: string) => {
    const { error } = await supabase
      .from("health_checkups")
      .update({ status: "completed", completed_date: today() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from(table as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const headers: Record<Section, string[]> = {
    customizations: ["Title", "Version", "Done by", "Date", ""],
    upgrades: ["From", "To", "Date", "By", ""],
    health: ["Scheduled", "Status", "Completed", "Engineer", ""],
    feedback: ["Rating", "Comments", "Source", "Date", ""],
  };

  const titles: Record<Section, string> = {
    customizations: "Customization",
    upgrades: "Upgrade",
    health: "Health Checkup",
    feedback: "Client Feedback",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {titles[section]} history ({rows.length})
        </h3>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Add {titles[section]}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers[section].map((h, i) => (
                <TableHead key={i}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Nothing recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  {section === "customizations" && (
                    <>
                      <TableCell>
                        <div className="font-medium">{r.title}</div>
                        {r.description && (
                          <div className="text-xs text-muted-foreground">{r.description}</div>
                        )}
                      </TableCell>
                      <TableCell>{r.version ?? "—"}</TableCell>
                      <TableCell>{name(r.done_by)}</TableCell>
                      <TableCell>{r.done_on}</TableCell>
                    </>
                  )}
                  {section === "upgrades" && (
                    <>
                      <TableCell>{r.from_version ?? "—"}</TableCell>
                      <TableCell className="font-medium">{r.to_version}</TableCell>
                      <TableCell>{r.upgrade_date}</TableCell>
                      <TableCell>{name(r.performed_by)}</TableCell>
                    </>
                  )}
                  {section === "health" && (
                    <>
                      <TableCell
                        className={cn(
                          r.status !== "completed" &&
                            r.scheduled_date < today() &&
                            "font-semibold text-destructive"
                        )}
                      >
                        {r.scheduled_date}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.completed_date ?? (
                          <Button size="sm" variant="outline" onClick={() => markComplete(r.id)}>
                            Mark done
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>{name(r.engineer_id)}</TableCell>
                    </>
                  )}
                  {section === "feedback" && (
                    <>
                      <TableCell>
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-4 w-4",
                                i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                              )}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-sm text-sm">{r.comments ?? "—"}</TableCell>
                      <TableCell>{r.source ?? "—"}</TableCell>
                      <TableCell>{r.feedback_date}</TableCell>
                    </>
                  )}
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col">
          <DialogHeader>
            <DialogTitle>Add {titles[section]}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {section === "customizations" && (
              <>
                <div>
                  <Label>Title *</Label>
                  <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    rows={3}
                    value={form.description ?? ""}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Version</Label>
                    <Input value={form.version ?? ""} onChange={(e) => setForm({ ...form, version: e.target.value })} />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.done_on ?? ""}
                      onChange={(e) => setForm({ ...form, done_on: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Done by</Label>
                  <select
                    className={selectCls}
                    value={form.done_by ?? ""}
                    onChange={(e) => setForm({ ...form, done_by: e.target.value })}
                  >
                    <option value="">Select</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {section === "upgrades" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>From version</Label>
                    <Input
                      value={form.from_version ?? ""}
                      onChange={(e) => setForm({ ...form, from_version: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>To version *</Label>
                    <Input
                      value={form.to_version ?? ""}
                      onChange={(e) => setForm({ ...form, to_version: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.upgrade_date ?? ""}
                      onChange={(e) => setForm({ ...form, upgrade_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Performed by</Label>
                    <select
                      className={selectCls}
                      value={form.performed_by ?? ""}
                      onChange={(e) => setForm({ ...form, performed_by: e.target.value })}
                    >
                      <option value="">Select</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    rows={3}
                    value={form.notes ?? ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </>
            )}

            {section === "health" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Scheduled date *</Label>
                    <Input
                      type="date"
                      value={form.scheduled_date ?? ""}
                      onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Completed date</Label>
                    <Input
                      type="date"
                      value={form.completed_date ?? ""}
                      onChange={(e) => setForm({ ...form, completed_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Engineer</Label>
                  <select
                    className={selectCls}
                    value={form.engineer_id ?? ""}
                    onChange={(e) => setForm({ ...form, engineer_id: e.target.value })}
                  >
                    <option value="">Select</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Findings</Label>
                  <Textarea
                    rows={3}
                    value={form.findings ?? ""}
                    onChange={(e) => setForm({ ...form, findings: e.target.value })}
                  />
                </div>
              </>
            )}

            {section === "feedback" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Rating (1-5)</Label>
                    <select
                      className={selectCls}
                      value={form.rating ?? 5}
                      onChange={(e) => setForm({ ...form, rating: e.target.value })}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.feedback_date ?? ""}
                      onChange={(e) => setForm({ ...form, feedback_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Source</Label>
                  <select
                    className={selectCls}
                    value={form.source ?? "call"}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                  >
                    <option value="call">Call</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="survey">Survey</option>
                  </select>
                </div>
                <div>
                  <Label>Comments</Label>
                  <Textarea
                    rows={3}
                    value={form.comments ?? ""}
                    onChange={(e) => setForm({ ...form, comments: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
