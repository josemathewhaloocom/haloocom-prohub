# Plan: Tasks + Command Center (360° Project Management)

## 1. Tasks module (new)
A real task tracker attached to any Project or POC.

Fields: title, description, parent task (self-reference → sub-tasks), project/POC link, assignee, priority (Critical/High/Medium/Low), status (Open / In Progress / Blocked / Done / Cancelled), due date, reminder/alert lead time (e.g. 1 day before due), completed date, comments.

UI:
- `/tasks` page: filterable table (assignee, status, priority, project, overdue), grouped or expandable to show sub-tasks under parents.
- "Create Task" dialog with an "Add sub-task" repeater.
- Tasks tab inside Project Detail and POC Detail, so tasks are managed in context.
- Overdue and due-today rows highlighted; in-app alert badge in the sidebar.

## 2. Command Center dashboard (new `/command-center`)
One screen with everything live:
- KPI strip: Live projects, Open tickets, Escalated tickets, Follow-ups pending, Overdue tasks, Health checkups overdue.
- Live Projects table: status, phase, % complete, engineer, next milestone/ETA, last update age (flags "no update in N days").
- Escalations panel: tickets flagged as escalated or breaching SLA, with age and owner.
- Tickets panel: by status/priority/team, aging buckets.
- Follow-ups pending: tasks and standup items past due or with no next step.
- Project status highlights: at-risk / delayed / blocked items pulled from standups.
- Alerts panel: support members with zero tasks created in the last N days; SLA breaches; missing health checkups.

## 3. Project 360 (extend Project Detail)
New tabs on each project so one place holds the whole lifecycle:
- **Customizations** — log of customizations done (title, description, date, done by, version).
- **Upgrades** — upgrade history (from version → to version, date, engineer, notes); dashboard shows last upgrade date.
- **Health Checkups** — scheduled + completed checkups (due date, completed date, engineer, report file, findings). Overdue checkups raise a reminder on the dashboard.
- **Client Feedback** — rating (1–5), comments, captured date, source; rolls up into performance reports.
- Existing Documents / Tickets / Daily Updates surfaced in the same tab strip.

## 4. Reviews & Reports (new `/reviews`)
- **Weekly review** — auto-generated per week: projects moved, tickets opened/closed, TAT, tasks completed vs overdue, escalations, plus a free-text review note and action points.
- **Monthly review** — same rolled to month, with trends.
- **Suggestions & Feedback** — internal suggestion box any user can post to; managers mark reviewed/actioned.
- **Performance report** — per engineer: tickets closed, avg TAT, tasks completed on time, projects delivered, health checkups done, client feedback average.

## 5. Alerts & notifications
- **SLA escalation to team leads**: when a ticket crosses its SLA threshold, notify the assignee's reporting manager (Support Manager / Engineering Manager / PM) by email.
- **No-task alert**: if a support team member has created/updated no tasks for N days, flag on the dashboard and email their manager.
- **Health checkup reminder**: email when a checkup is past its due date.
- **Task due alerts**: reminder email at the configured lead time before due date.
- All alerts also appear in an in-app Notifications bell with read/unread.

## 6. EOD digest email
A scheduled edge function (`eod-digest`) runs daily at end of day and emails managers + PM:
- all support tickets (open / in-progress / closed today, with escalations called out)
- live project status snapshot (status, % complete, blockers, ETA)
- overdue tasks and pending follow-ups

Runs via pg_cron on the database calling the function; uses the existing SMTP setup.

## Technical notes
- New tables: `tasks`, `task_comments`, `notifications`, `project_customizations`, `project_upgrades`, `health_checkups`, `client_feedback`, `reviews`, `suggestions`, `alert_settings`.
- Add `is_escalated`, `escalated_at`, `sla_due_at` to `support_tickets`.
- All tables: GRANTs + RLS (authenticated read for the small team; write scoped to creator/assignee, managers full access), `updated_at` triggers.
- New edge functions: `eod-digest`, `run-alerts` (SLA / health-check / no-task / task-due scanning), both reusing the existing SMTP sender.
- pg_cron + pg_net schedule for the two functions.
- New pages: `Tasks.tsx`, `CommandCenter.tsx`, `Reviews.tsx`; new tabs in `ProjectDetail.tsx`; sidebar entries; notification bell in `AppLayout`.

## Build order
1. DB migration (all tables, RLS, grants)
2. Tasks module + sub-tasks + project/POC tabs
3. Command Center dashboard
4. Project 360 tabs (customizations, upgrades, health checkups, feedback)
5. Reviews, suggestions, performance report
6. Alerts engine + notification bell
7. EOD digest email + cron
