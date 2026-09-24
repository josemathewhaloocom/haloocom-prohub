import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSMTP, getSmtp } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const today = () => new Date().toISOString().slice(0, 10);

const LIVE_STATUSES = [
  "open", "qc_completed", "kick_off_scheduled", "site_ready", "scheduled",
  "in_progress", "client_signing_pending", "client_signed", "pending_admin_approval", "on_hold",
];

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const smtp = await getSmtp(admin);
    if (!smtp?.host) throw new Error("SMTP settings not configured");

    const { data: settings } = await admin.from("alert_settings").select("*").limit(1).maybeSingle();
    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    const { data: profiles } = await admin.from("profiles").select("id, email, first_name, last_name");

    const recipientEmails = new Set<string>(settings?.eod_recipients ?? []);
    for (const r of roles ?? []) {
      if (["project_manager", "support_manager", "engineering_manager", "ceo"].includes(r.role)) {
        const p = profiles?.find((x: any) => x.id === r.user_id);
        if (p?.email) recipientEmails.add(p.email);
      }
    }
    if (recipientEmails.size === 0) {
      return new Response(JSON.stringify({ success: true, message: "No recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: tickets }, { data: projects }, { data: tasks }] = await Promise.all([
      admin.from("support_tickets").select("*"),
      admin.from("projects").select("*").eq("is_active", true),
      admin.from("tasks").select("*").not("status", "in", '("done","cancelled")'),
    ]);

    const open = (tickets ?? []).filter((t: any) => !["closed", "resolved"].includes((t.status ?? "").toLowerCase()));
    const closedToday = (tickets ?? []).filter((t: any) => (t.closed_at ?? "").slice(0, 10) === today());
    const escalated = open.filter((t: any) => t.is_escalated);
    const live = (projects ?? []).filter((p: any) => LIVE_STATUSES.includes(p.status));
    const overdue = (tasks ?? []).filter((t: any) => t.due_date && t.due_date < today());

    const ticketRows = open
      .slice(0, 100)
      .map(
        (t: any) =>
          `<tr><td>${esc(t.ticket_id)}</td><td>${esc(t.client_name)}</td><td>${esc(t.subject)}</td><td>${esc(t.status)}</td><td>${esc(t.priority)}</td><td>${t.is_escalated ? "YES" : ""}</td></tr>`
      )
      .join("");

    const projectRows = live
      .map(
        (p: any) =>
          `<tr><td>${esc(p.name)}</td><td>${esc(p.client_name)}</td><td>${esc(p.status)}</td><td>${esc(p.progress_percentage ?? 0)}%</td><td>${esc(p.deadline ?? "—")}</td></tr>`
      )
      .join("");

    const taskRows = overdue
      .slice(0, 50)
      .map((t: any) => `<tr><td>${esc(t.title)}</td><td>${esc(t.priority)}</td><td>${esc(t.due_date)}</td></tr>`)
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px">
        <h2>End of Day Report — ${today()}</h2>
        <p><strong>${open.length}</strong> open tickets · <strong>${closedToday.length}</strong> closed today ·
           <strong>${escalated.length}</strong> escalated · <strong>${live.length}</strong> live projects ·
           <strong>${overdue.length}</strong> overdue tasks</p>

        <h3>Open tickets</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
          <tr><th>Ticket</th><th>Client</th><th>Subject</th><th>Status</th><th>Priority</th><th>Escalated</th></tr>
          ${ticketRows || "<tr><td colspan='6'>None</td></tr>"}
        </table>

        <h3>Live project status</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
          <tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Deadline</th></tr>
          ${projectRows || "<tr><td colspan='5'>None</td></tr>"}
        </table>

        <h3>Overdue tasks & follow-ups</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
          <tr><th>Task</th><th>Priority</th><th>Due</th></tr>
          ${taskRows || "<tr><td colspan='3'>None</td></tr>"}
        </table>
      </div>`;

    let sent = 0;
    for (const to of recipientEmails) {
      try {
        await sendViaSMTP(smtp, to, `EOD Report — ${today()}`, html);
        sent++;
      } catch (err) {
        console.error("EOD email failed", to, (err as Error).message);
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("eod-digest error", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
