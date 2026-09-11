import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const selectCls =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function periodBounds(type: "weekly" | "monthly", ref = new Date()) {
  const d = new Date(ref);
  if (type === "weekly") {
    const day = (d.getDay() + 6) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function Reviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [checkups, setCheckups] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sugOpen, setSugOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({ highlights: "", lowlights: "", action_points: "" });
  const [sugForm, setSugForm] = useState({ title: "", body: "", category: "suggestion" });

  const load = async () => {
    const [rv, sg, tk, ts, cf, hc, pf] = await Promise.all([
      supabase.from("reviews").select("*").order("period_start", { ascending: false }),
      supabase.from("suggestions").select("*").order("created_at", { ascending: false }),
      supabase.from("support_tickets").select("*"),
      supabase.from("tasks").select("*"),
      supabase.from("client_feedback").select("*"),
      supabase.from("health_checkups").select("*"),
      supabase.from("profiles").select("id, first_name, last_name"),
    ]);
    setReviews(rv.data ?? []);
    setSuggestions(sg.data ?? []);
    setTickets(tk.data ?? []);
    setTasks(ts.data ?? []);
    setFeedback(cf.data ?? []);
    setCheckups(hc.data ?? []);
    setPeople(pf.data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const bounds = periodBounds(periodType);

  const metrics = useMemo(() => {
    const inRange = (iso?: string | null) =>
      !!iso && iso.slice(0, 10) >= bounds.start && iso.slice(0, 10) <= bounds.end;
    const opened = tickets.filter((t) => inRange(t.created_at));
    const closed = tickets.filter((t) => inRange(t.closed_at));
    const tats = closed
      .map((t) => (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 3600000)
      .filter((n) => Number.isFinite(n));
    const doneTasks = tasks.filter((t) => inRange(t.completed_at));
    const overdue = tasks.filter(
      (t) => t.due_date && !["done", "cancelled"].includes(t.status) && t.due_date < new Date().toISOString().slice(0, 10)
    );
    const escal = tickets.filter((t) => t.is_escalated && inRange(t.created_at));
    return {
      opened: opened.length,
      closed: closed.length,
      avgTat: tats.length ? Math.round(tats.reduce((a, b) => a + b, 0) / tats.length) : 0,
      tasksDone: doneTasks.length,
      overdue: overdue.length,
      escalations: escal.length,
    };
  }, [tickets, tasks, bounds.start, bounds.end]);

  const performance = useMemo(() => {
    return people
      .map((p) => {
        const closed = tickets.filter((t) => t.assigned_engineer_id === p.id && t.closed_at);
        const tats = closed.map(
          (t) => (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 3600000
        );
        const myTasks = tasks.filter((t) => t.assignee_id === p.id);
        const doneOnTime = myTasks.filter(
          (t) => t.status === "done" && (!t.due_date || (t.completed_at ?? "").slice(0, 10) <= t.due_date)
        ).length;
        const fb = feedback.filter((f) => f.engineer_id === p.id);
        return {
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          closed: closed.length,
          avgTat: tats.length ? Math.round(tats.reduce((a, b) => a + b, 0) / tats.length) : 0,
          tasksDone: myTasks.filter((t) => t.status === "done").length,
          doneOnTime,
          checkups: checkups.filter((c) => c.engineer_id === p.id && c.status === "completed").length,
          rating: fb.length ? (fb.reduce((a, b) => a + b.rating, 0) / fb.length).toFixed(1) : "—",
        };
      })
      .filter((r) => r.closed || r.tasksDone || r.checkups);
  }, [people, tickets, tasks, feedback, checkups]);

  const saveReview = async () => {
    const { error } = await supabase.from("reviews").upsert(
      {
        period_type: periodType,
        period_start: bounds.start,
        period_end: bounds.end,
        highlights: reviewForm.highlights || null,
        lowlights: reviewForm.lowlights || null,
        action_points: reviewForm.action_points || null,
        metrics: metrics as never,
        created_by: user?.id,
      } as never,
      { onConflict: "period_type,period_start" }
    );
    if (error) return toast.error(error.message);
    toast.success("Review saved");
    setReviewOpen(false);
    setReviewForm({ highlights: "", lowlights: "", action_points: "" });
    load();
  };

  const saveSuggestion = async () => {
    if (!sugForm.title.trim()) return toast.error("Title is required");
    const { error } = await supabase.from("suggestions").insert({
      ...sugForm,
      created_by: user?.id,
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Submitted");
    setSugOpen(false);
    setSugForm({ title: "", body: "", category: "suggestion" });
    load();
  };

  const setSugStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reviews & Reports</h1>
          <p className="text-sm text-muted-foreground">
            Weekly and monthly reviews, team performance, suggestions and feedback.
          </p>
        </div>
      </div>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review">Periodic Review</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions & Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as "weekly" | "monthly")}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <span className="text-sm text-muted-foreground">
              {bounds.start} → {bounds.end}
            </span>
            <Button size="sm" className="ml-auto" onClick={() => setReviewOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Save this review
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Tickets opened", metrics.opened],
              ["Tickets closed", metrics.closed],
              ["Avg TAT (h)", metrics.avgTat],
              ["Tasks completed", metrics.tasksDone],
              ["Overdue tasks", metrics.overdue],
              ["Escalations", metrics.escalations],
            ].map(([l, v]) => (
              <Card key={l as string}>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{v as number}</div>
                  <div className="text-xs text-muted-foreground">{l as string}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saved reviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviews.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No reviews saved yet.</p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{r.period_type}</Badge>
                      <span className="text-sm font-medium">
                        {r.period_start} → {r.period_end}
                      </span>
                    </div>
                    {r.highlights && <p className="mt-2 text-sm"><strong>Highlights:</strong> {r.highlights}</p>}
                    {r.lowlights && <p className="text-sm"><strong>Lowlights:</strong> {r.lowlights}</p>}
                    {r.action_points && <p className="text-sm"><strong>Actions:</strong> {r.action_points}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team performance</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Tickets closed</TableHead>
                    <TableHead>Avg TAT (h)</TableHead>
                    <TableHead>Tasks done</TableHead>
                    <TableHead>On time</TableHead>
                    <TableHead>Checkups</TableHead>
                    <TableHead>Client rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.closed}</TableCell>
                      <TableCell>{r.avgTat}</TableCell>
                      <TableCell>{r.tasksDone}</TableCell>
                      <TableCell>{r.doneOnTime}</TableCell>
                      <TableCell>{r.checkups}</TableCell>
                      <TableCell className="flex items-center gap-1">
                        {r.rating}
                        {r.rating !== "—" && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                      </TableCell>
                    </TableRow>
                  ))}
                  {performance.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                        No activity recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-4 space-y-4">
          <Button size="sm" onClick={() => setSugOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> New suggestion / feedback
          </Button>
          <div className="grid gap-3 md:grid-cols-2">
            {suggestions.map((s) => (
              <Card key={s.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.title}</span>
                    <Badge variant="outline">{s.category}</Badge>
                  </div>
                  {s.body && <p className="text-sm text-muted-foreground">{s.body}</p>}
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={s.status}
                    onChange={(e) => setSugStatus(s.id, e.target.value)}
                  >
                    {["new", "reviewing", "actioned", "declined"].map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </CardContent>
              </Card>
            ))}
            {suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col">
          <DialogHeader>
            <DialogTitle>
              {periodType === "weekly" ? "Weekly" : "Monthly"} review ({bounds.start} → {bounds.end})
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            <div>
              <Label>Highlights</Label>
              <Textarea
                rows={3}
                value={reviewForm.highlights}
                onChange={(e) => setReviewForm({ ...reviewForm, highlights: e.target.value })}
              />
            </div>
            <div>
              <Label>Lowlights</Label>
              <Textarea
                rows={3}
                value={reviewForm.lowlights}
                onChange={(e) => setReviewForm({ ...reviewForm, lowlights: e.target.value })}
              />
            </div>
            <div>
              <Label>Action points</Label>
              <Textarea
                rows={3}
                value={reviewForm.action_points}
                onChange={(e) => setReviewForm({ ...reviewForm, action_points: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveReview}>Save review</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sugOpen} onOpenChange={setSugOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New suggestion / feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={sugForm.title} onChange={(e) => setSugForm({ ...sugForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <select
                className={selectCls}
                value={sugForm.category}
                onChange={(e) => setSugForm({ ...sugForm, category: e.target.value })}
              >
                <option value="suggestion">Suggestion</option>
                <option value="feedback">Feedback</option>
                <option value="issue">Issue</option>
              </select>
            </div>
            <div>
              <Label>Details</Label>
              <Textarea rows={4} value={sugForm.body} onChange={(e) => setSugForm({ ...sugForm, body: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => setSugOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSuggestion}>Submit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
