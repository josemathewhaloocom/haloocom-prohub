# Plan: Daily Standup Meeting Module

## Goal
Replace the Google Sheet standup tracker with an in-app module that pulls Projects and POCs already in the system, lets the team log a daily meeting per date, and tracks open action items with priority and status across days.

## How it links to existing modules
- **Source of truth stays in Projects / POCs.** The standup picker only lists existing Projects and POCs — nothing standalone. New Projects/POCs added anywhere appear automatically in the next standup.
- Project/POC name, client, product, phase, % complete, go-live date, AI/Tech/Sales rep are **read live** from the project/POC record — no duplicate entry.
- A standup discussion item's "progress today / blockers" can optionally be pushed into the project's existing **Daily Updates** in one click, so engineers don't double-enter.
- Action items remain open across days until closed, independent of which meeting created them.

## New module: Standups
Sidebar entry "Standups". Two views:

1. **Today's Meeting** — open or create today's standup, add a row per project/POC discussed.
2. **Open Action Items** — global list across all clients/dates, filterable by status, priority, assignee, client.

### Per-item fields (per Daily Updates Log in the sheet)
- Project or POC (dropdown from existing records)
- Status Today (On Track / In Progress / At Risk / Delayed / On Hold / Completed)
- Progress / Activities done
- Blockers / Issues
- Next steps
- ETA for next milestone
- "Also save to project Daily Updates" toggle

### Action items (Pending Tasks Tracker)
Created from any standup item or directly:
- Linked project/POC, description, assignee, priority (Critical/High/Medium/Low), status (Open/In Progress/Completed/Cancelled), created date, due date, closed date, comments. Overdue items auto-highlight.

## Master Tracker fields added to Projects & POCs
Add the columns from the sheet's master tracker that we don't already have, so the standup can show them:
- `tech_stack` (text)
- `phase` (dropdown: Kickoff / Requirements / Design / Development / UAT / Go-Live / Closed)
- `client_poc_name`, `client_poc_email`
- `ai_rep_id` — dropdown of users in the **Engineering** role
- `tech_rep_id` — dropdown of users in **Support Engineer** or **Implementation Engineering** roles
- `sales_rep_id` — dropdown of users in **Sales** or **Sales Manager** roles
- `received_date`, `uat_date`, `actual_go_live_date` (dates; expected go-live = existing `deadline`)

Existing fields reused: client_name, product, num_users, num_channels, num_trunks (POC: `trunk`), description, start_date, status, progress_percentage.

## Database
- `standup_meetings` (meeting_date unique, conducted_by, notes)
- `standup_items` (meeting_id, project_id nullable, poc_id nullable — exactly one set, status_today, progress, blockers, next_steps, eta_date)
- `standup_action_items` (project_id nullable, poc_id nullable, source_standup_item_id nullable, description, assigned_to, priority, status, created_date, due_date, closed_date, comments)
- ALTER `projects` and `pocs` to add the master tracker columns above.

RLS: visible to all authenticated users (small team, <10 people, matching existing pattern). Creators and assignees can edit their own items; PM/managers full access.

## UI
- `src/pages/Standups.tsx` — today's meeting board: header with date picker + "Create today's standup", grid of items per project, inline add-row, action-items side panel.
- `src/pages/ActionItems.tsx` — filterable global table of all open/closed action items, color-coded by overdue/priority.
- Add to `AppSidebar.tsx` and `App.tsx` routes `/standups` and `/action-items`.
- Reuse existing dropdown config pattern for Status/Phase/Priority values so PM can customize.

## Out of scope (for later if needed)
- Meeting attendance / notes export
- Email digests of the standup
- Auto-creating action items from blockers via AI

