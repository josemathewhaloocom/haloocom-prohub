import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSMTP, getSmtp } from "../_shared/smtp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const smtp = await getSmtp(admin);
    const { data: settings } = await admin.from("alert_settings").select("*").limit(1).maybeSingle();
    const slaHours: Record<string, number> = {
      critical: settings?.sla_critical_hours ?? 4,
      high: settings?.sla_high_hours ?? 8,
      medium: settings?.sla_medium_hours ?? 24,
      low: settings?.sla_low_hours ?? 48,
    };
    const inactivityDays = settings?.inactivity_days ?? 3;

    const notifications: any[] = [];
    const emails: { to: string; subject: string; html: string }[] = [];

    const { data: profiles } = await admin.from("profiles").select("id, email, first_name, last_name");
    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    const { data: managers } = await admin.from("reporting_managers").select("user_id, manager_id");

    const profileOf = (id: string) => profiles?.find((p: any) => p.id === id);
    const managerOf = (id: string) => {
      const rel = managers?.find((m: any) => m.user_id === id);
      return rel ? profileOf(rel.manager_id) : null;
    };
    const leadIds = (roles ?? [])
      .filter((r: any) => ["project_manager", "support_manager", "engineering_manager"].includes(r.role))
      .map((r: any) => r.user_id);

    // 1. SLA breaches on open tickets
    const { data: tickets } = await admin
      .from("support_tickets")
      .select("*")
      .not("status", "in", '("closed","resolved")');

    for (const t of tickets ?? []) {
      const limit = slaHours[(t.priority ?? "medium").toLowerCase()] ?? 24;
      const ageH = (Date.now() - new Date(t.created_at).getTime()) / 3600000;
      if (ageH > limit && !t.is_escalated) {
        await admin
          .from("support_tickets")
          .update({
            is_escalated: true,
            escalated_at: new Date().toISOString(),
            sla_due_at: new Date(new Date(t.created_at).getTime() + limit * 3600000).toISOString(),
          })
          .eq("id", t.id);

        const owner = t.assigned_engineer_id ? profileOf(t.assigned_engineer_id) : null;
        const lead = t.assigned_engineer_id ? managerOf(t.assigned_engineer_id) : null;
        const recipients = new Set<string>();
        if (lead?.email) recipients.add(lead.email);
        for (const id of leadIds) {
          const p = profileOf(id);
          if (p?.email) recipients.add(p.email);
        }
        const html = `<p>Ticket <strong>${t.ticket_id}</strong> has breached its ${limit}h SLA.</p>
          <p>Subject: ${t.subject}<br/>Client: ${t.client_name}<br/>Priority: ${t.priority}<br/>
          Owner: ${owner ? owner.first_name + " " + owner.last_name : "Unassigned"}<br/>
          Age: ${Math.round(ageH)} hours</p>`;
        for (const to of recipients) emails.push({ to, subject: `SLA breach: ${t.ticket_id}`, html });
        for (const id of [...leadIds, t.assigned_engineer_id].filter(Boolean)) {
          notifications.push({
            user_id: id,
            title: `SLA breach: ${t.ticket_id}`,
            body: t.subject,
            category: "sla",
            link: "/tickets",
          });
        }
      }
    }

    // 2. Overdue health checkups
    const { data: checkups } = await admin
      .from("health_checkups")
      .select("*, projects(name)")
      .neq("status", "completed")
      .lt("scheduled_date", today())
      .is("reminder_sent_at", null);

    for (const c of checkups ?? []) {
      const html = `<p>Health checkup for <strong>${c.projects?.name ?? "a project"}</strong> was due on ${c.scheduled_date} and is not completed.</p>`;
      const targets = new Set<string>([...leadIds, c.engineer_id].filter(Boolean) as string[]);
      for (const id of targets) {
        const p = profileOf(id);
        if (p?.email) emails.push({ to: p.email, subject: "Health checkup overdue", html });
        notifications.push({
          user_id: id,
          title: "Health checkup overdue",
          body: `${c.projects?.name ?? "Project"} — due ${c.scheduled_date}`,
          category: "health",
          link: `/projects/${c.project_id}`,
        });
      }
      await admin.from("health_checkups").update({ reminder_sent_at: new Date().toISOString() }).eq("id", c.id);
    }

    // 3. Task due reminders
    const { data: tasks } = await admin
      .from("tasks")
      .select("*")
      .not("status", "in", '("done","cancelled")')
      .not("due_date", "is", null)
      .is("reminder_sent_at", null);

    for (const t of tasks ?? []) {
      const dueMs = new Date(t.due_date).getTime();
      const leadMs = (t.reminder_days_before ?? 1) * 86400000;
      if (Date.now() >= dueMs - leadMs) {
        if (t.assignee_id) {
          const p = profileOf(t.assignee_id);
          notifications.push({
            user_id: t.assignee_id,
            title: `Task due ${t.due_date}`,
            body: t.title,
            category: "task",
            link: "/tasks",
          });
          if (p?.email) {
            emails.push({
              to: p.email,
              subject: `Task due ${t.due_date}: ${t.title}`,
              html: `<p>Your task <strong>${t.title}</strong> is due on ${t.due_date}.</p>`,
            });
          }
        }
        await admin.from("tasks").update({ reminder_sent_at: new Date().toISOString() }).eq("id", t.id);
      }
    }

    // 4. Inactive support members (no tasks created/assigned recently)
    const supportIds = (roles ?? [])
      .filter((r: any) => ["support_engineer", "engineering"].includes(r.role))
      .map((r: any) => r.user_id);
    const { data: recentTasks } = await admin.from("tasks").select("created_by, assignee_id").gt("created_at", daysAgo(inactivityDays));

    for (const uid of supportIds) {
      const active = (recentTasks ?? []).some((t: any) => t.created_by === uid || t.assignee_id === uid);
      if (!active) {
        const p = profileOf(uid);
        const lead = managerOf(uid);
        const body = `${p?.first_name ?? "A team member"} ${p?.last_name ?? ""} has not created or worked on any task in ${inactivityDays} days.`;
        const targets = new Set<string>([...leadIds, lead?.id].filter(Boolean) as string[]);
        for (const id of targets) {
          notifications.push({ user_id: id, title: "No task activity", body, category: "inactivity", link: "/tasks" });
          const mp = profileOf(id);
          if (mp?.email) emails.push({ to: mp.email, subject: "No task activity alert", html: `<p>${body}</p>` });
        }
      }
    }

    if (notifications.length) await admin.from("notifications").insert(notifications);

    let sent = 0;
    if (smtp?.host) {
      for (const e of emails) {
        try {
          await sendViaSMTP(smtp, e.to, e.subject, e.html);
          sent++;
        } catch (err) {
          console.error("email failed", e.to, (err as Error).message);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, notifications: notifications.length, emails_sent: sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("run-alerts error", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
