

# Comprehensive Project Hub Enhancement Plan

This plan covers all requested changes organized into 7 phases for clear implementation.

---

## Phase 1: Database Migration

### 1.1 Add Haloocom Lifecycle Statuses
Replace the current 4-status enum with the full 11-stage lifecycle:
- `open`, `qc_completed`, `kick_off_scheduled`, `site_ready`, `on_hold`, `scheduled`, `in_progress`, `client_signing_pending`, `client_signed`, `pending_admin_approval`, `closed`

This requires creating a new enum and migrating the `projects.status` column (Postgres does not allow removing values from enums easily, so we create a new type).

### 1.2 Add `signing_token` and `signing_token_expires_at` to `documents`
For the public client signing portal, each sign-off document needs a unique token and expiry.

### 1.3 Create `project_field_config` table (dynamic fields)
Stores admin-defined custom fields per project:
```text
id          uuid PK
field_name  text
field_type  text (text, number, date, select)
is_required boolean default false
sort_order  integer default 0
created_by  uuid
created_at  timestamptz
```

### 1.4 Create `project_custom_values` table
Stores actual values for custom fields per project:
```text
id          uuid PK
project_id  uuid FK -> projects
field_id    uuid FK -> project_field_config
value       text
```

RLS: Admins full CRUD; engineers SELECT on assigned projects.

---

## Phase 2: Admin Can Edit All Project Fields

### `ProjectDetail.tsx` - Overview Tab
- Add an "Edit Project" button (admin only) that opens a dialog pre-filled with all current project fields (name, client info, dates, budget, product details, description)
- On save, updates the `projects` row and re-fetches

---

## Phase 3: Document Signing Portal + Link Generation

### 3.1 Generate signing link on document upload
- When a sign-off document is uploaded, generate a unique `signing_token` (UUID) and store it in the `documents` row
- Display a "Copy Signing Link" button that copies `{origin}/sign/{token}` to clipboard
- This link can be shared with the client via email

### 3.2 Public Signing Page (`/sign/:token`)
- New file: `src/pages/PublicSign.tsx`
- Route: `/sign/:token` (outside `AppLayout`, no auth required)
- Flow:
  1. Looks up document by `signing_token` where `signed_at IS NULL` and token is not expired
  2. Shows document name, project name, and a "View Document" button (signed URL)
  3. Signature pad (canvas) + signer name input
  4. On submit: updates `signature_url`, `signed_at`, `signer_name`, `signer_ip`
- Uses the service role via a new edge function `sign-document` for the unauthenticated update

### 3.3 View signed document + approve/reject flow change
- Always show "View" button on all documents (not just approved)
- Show signature image inline when `signature_url` exists
- Approve/Reject buttons available for admin on ALL documents (not just pending) -- admin sees them after client signs so they can review the signature and then approve/reject

---

## Phase 4: One Engineer Per Project + Email Notification

### 4.1 Enforce one engineer per project
- In `ProjectDetail.tsx`, hide "Assign Engineer" button if one is already assigned
- Add a unique constraint on `project_assignments(project_id)` via migration (or enforce in code)

### 4.2 Send email on engineer assignment
- New edge function: `send-email`
  - Reads SMTP settings from `smtp_settings` table
  - Accepts `to`, `subject`, `html` body
  - Sends email using SMTP (via Deno's `smtp` module or raw SMTP)
- Modify `handleAssign` in `ProjectDetail.tsx`:
  - After successful assignment, invoke `send-email` edge function with engineer's email, project name, and assignment details

---

## Phase 5: Enhanced Dashboard, Projects List, Engineers Page

### 5.1 Projects List Table Columns
Update `Projects.tsx` table to show:
- Client Name, Product, Engineer, Status, Progress, Start Date, Go Live Date (deadline)
- Fetch product names and assigned engineer names alongside projects

### 5.2 Engineers Page Enhancement
Update `Engineers.tsx` to show per-engineer:
- Name, Active Projects, Completed Projects, In Progress, On Hold, Total Projects
- Fetch all project assignments + project statuses to compute counts

### 5.3 Date Filter on Dashboard, Projects, Engineers
Add a date range filter (Start Date / End Date) to:
- `Dashboard.tsx` - filter projects by `start_date`/`deadline` within range
- `Projects.tsx` - filter by date range
- `Engineers.tsx` - filter projects within date range

---

## Phase 6: Documents Page - Group by Project

Update `Documents.tsx`:
- Group documents by project name using collapsible sections
- Each project section shows all its documents with view/status info
- Add search/filter by project name

---

## Phase 7: Dynamic Project Fields (Admin Configurable)

### Settings Page Addition
Add a "Project Fields" section in Settings (admin only):
- List existing custom fields with name, type, required toggle
- Add new field form (name, type: text/number/date/select, required)
- Delete/reorder fields

### Project Detail Integration
- In the Overview tab, render custom fields below the standard fields
- Admin edit dialog includes custom fields
- Custom field values stored in `project_custom_values` table

---

## Files to Create

| File | Purpose |
|---|---|
| `src/pages/PublicSign.tsx` | Public client signing portal |
| `supabase/functions/sign-document/index.ts` | Unauthenticated document signing endpoint |
| `supabase/functions/send-email/index.ts` | SMTP email sending function |

## Files to Edit

| File | Changes |
|---|---|
| `src/App.tsx` | Add `/sign/:token` route |
| `src/pages/ProjectDetail.tsx` | Admin edit dialog, one-engineer enforcement, signing link generation, view signed docs, lifecycle statuses, custom fields display |
| `src/pages/Projects.tsx` | New table columns (client, product, engineer, start date, go-live), date filter, lifecycle statuses |
| `src/pages/Engineers.tsx` | Enhanced stats per engineer, date filter |
| `src/pages/Dashboard.tsx` | Date range filter |
| `src/pages/Documents.tsx` | Group by project, search |
| `src/pages/SettingsPage.tsx` | Dynamic field config section |
| `src/integrations/supabase/types.ts` | Auto-updated by migration |

## Implementation Order

1. Database migration (lifecycle enum, signing tokens, dynamic fields tables, unique constraint)
2. `send-email` edge function
3. `sign-document` edge function
4. `PublicSign.tsx` + route
5. `ProjectDetail.tsx` rebuild (edit, signing links, lifecycle statuses, one-engineer, email trigger, custom fields)
6. `Projects.tsx` (new columns, date filter, lifecycle statuses)
7. `Engineers.tsx` (enhanced stats, date filter)
8. `Dashboard.tsx` (date filter)
9. `Documents.tsx` (group by project)
10. `SettingsPage.tsx` (dynamic field config)

