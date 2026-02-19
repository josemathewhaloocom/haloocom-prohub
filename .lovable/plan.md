
# Project Detail Hub — Full Implementation Plan

## Summary of Changes Requested

1. **Project Detail as Lifecycle Hub** — Daily updates and documents embedded inside the Project Detail page as tabs, so everything about a project is in one place.
2. **Admin Status Control** — Admin can change the project status directly from the Project Detail page.
3. **Document Upload** — Engineers can upload files to a project; admins can approve/reject them.
4. **Document Signing** — Client-facing signature pad embedded in documents, with signature capture and storage.
5. **Progress Sync Fix** — When a daily update is submitted from inside a project, the project's `progress_percentage` should update immediately and visibly.
6. **SMTP / Email Settings** — A new admin-only "Email Settings" section in Settings to configure SMTP credentials for sending notifications.

---

## What's NOT Changing

- The standalone `/updates` and `/documents` pages remain as global views (useful for admins).
- The sidebar navigation stays the same.
- The database schema for `daily_updates` and `documents` does not change — only UI is added.

---

## Phase 1: Database Changes (Migration)

### 1.1 — New Table: `smtp_settings`

A new table to store admin-configured SMTP settings. Only one row is expected (global config).

```text
id          uuid (primary key)
host        text
port        integer (default 587)
username    text
password    text (stored encrypted at rest via Supabase)
from_email  text
from_name   text
use_ssl     boolean (default false)
use_tls     boolean (default true)
updated_by  uuid
updated_at  timestamptz
```

RLS:
- Admins: full CRUD
- Non-admins: no access (SMTP password must be protected)

### 1.2 — Extend `documents` Table

Add two columns needed for the document signing and upload workflow:

```text
document_type   text (nullable) — e.g. 'sow', 'architecture', 'sign_off', 'other'
signed_at       timestamptz (nullable)
signer_name     text (nullable)
signer_ip       text (nullable)
```

---

## Phase 2: Project Detail Page — Full Rebuild

The `ProjectDetail.tsx` page becomes the central hub with **5 tabs**:

```text
[Overview] [Daily Updates] [Documents] [Status] [Engineers]
```

### Tab 1: Overview (existing content)
- Project metadata cards (start date, deadline, budget, progress bar)
- Product Details card
- Description
- Progress bar now **re-fetches from the database** after every daily update submission

### Tab 2: Daily Updates (new in project detail)
- Shows all updates for **this specific project** only (filtered by `project_id`)
- Engineers can submit a new daily update directly from here (the project is pre-selected)
- When submitted, it calls `supabase.from("projects").update({ progress_percentage })` AND re-fetches the project — so the progress bar on the Overview tab updates instantly
- Admins can see all updates with engineer names
- Engineers see only their own updates

**Progress Fix:** Currently the progress update call exists in `DailyUpdates.tsx` but the `ProjectDetail.tsx` page doesn't re-fetch after update. By embedding the submit form inside the project detail, both the update list and the progress bar will refresh together.

### Tab 3: Documents (new in project detail)
Two sections:

**Upload Section (Engineers + Admins)**
- File input (accepts PDF, images, Word docs)
- Document type selector: SOW / Architecture Diagram / Sign-Off / Security Guidelines / Training Report / Other
- Upload triggers: read file → upload to `documents` storage bucket → insert record into `documents` table
- Shows upload progress

**Document List**
- Shows all documents for this project
- Columns: File Name, Type, Status (pending/approved/rejected), Uploaded By, Date, Actions
- Admin actions: Approve / Reject (updates `approval_status`)
- Engineer actions: View, Delete (only pending own docs)
- **Signature button**: For sign-off type documents, shows a "Get Signed" button that opens a canvas signature pad dialog

**Signature Pad Dialog**
- Canvas element for drawing signature (mouse + touch)
- Fields: Signer Name, Signer Email (pre-filled from project's `client_email`)
- On submit: saves signature as base64 data URL to `documents.signature_url`, sets `signed_at = now()`, saves `signer_name`
- No external library needed — HTML5 Canvas API

### Tab 4: Status Management (Admin Only)
- Shows current status as a visual pipeline/stepper
- Admin can select the next allowed status from a dropdown or click a "Move to Next Stage" button
- All 11 lifecycle statuses available (from the approved Haloocom plan)
- Status options: Open → QC Completed → Kick-Off Scheduled → Site Ready → Scheduled → In Progress → Client Signing Pending → Client Signed → Pending Admin Approval → Closed
- On-Hold option always available as a side-branch
- Writes an audit note (optional text field) alongside every status change
- Status change calls `supabase.from("projects").update({ status })` with confirmation toast

### Tab 5: Engineers (existing content moved)
- Assign/unassign engineers (existing functionality, just moved to a tab)

---

## Phase 3: Settings Page — SMTP Email Configuration

Add a new "Email / SMTP" card in `SettingsPage.tsx` (admin only).

**Fields:**
- SMTP Host (e.g. smtp.gmail.com)
- SMTP Port (default 587)
- Username
- Password (masked input)
- From Email
- From Name
- Use TLS toggle
- Use SSL toggle

**Behavior:**
- On save: upsert into `smtp_settings` table
- Shows "Test Connection" button (for now, just saves and shows success — actual test can be wired later via an edge function)
- Loads existing config on mount

---

## Phase 4: Progress Sync Fix

The bug: when a daily update is submitted from `DailyUpdates.tsx`, the project's `progress_percentage` is updated in the DB but the Project Detail page doesn't know about it.

The fix inside Project Detail:
- After the daily update form is submitted inside the project detail tab, call `fetchProject()` immediately
- The progress bar on the Overview tab reads from `project.progress_percentage` which is now up-to-date
- The progress bar updates visually without any page refresh

---

## Files to Create / Edit

| File | Change |
|---|---|
| `src/pages/ProjectDetail.tsx` | Full rebuild with 5 tabs, daily updates tab, documents tab, status tab |
| `src/pages/SettingsPage.tsx` | Add SMTP email settings card (admin only) |
| `src/integrations/supabase/types.ts` | Auto-updated by migration |
| Migration SQL | Create `smtp_settings` table, extend `documents` table |

The standalone `DailyUpdates.tsx` and `Documents.tsx` pages are **not changed** — they remain as global views.

---

## Implementation Order

1. Run database migration (smtp_settings table + document type/signing columns)
2. Rebuild `ProjectDetail.tsx` with tabs (Overview, Daily Updates, Documents, Status, Engineers)
3. Add SMTP settings card to `SettingsPage.tsx`

---

## Technical Notes

- File uploads use the existing `documents` storage bucket (already configured, private)
- Signed URLs will be generated via `supabase.storage.from("documents").createSignedUrl()` for viewing files
- The signature canvas uses native `HTMLCanvasElement` — no new npm package needed
- The 11 Haloocom lifecycle statuses (from the existing approved plan) will be used in the Status tab; the current DB still has the old enum values (`upcoming`, `in_progress`, etc.) — the Status tab dropdown will show all DB-valid values (the full lifecycle migration was planned but not yet run, so the status tab initially shows the 4 current statuses and will expand once the lifecycle migration runs)
- SMTP password stored in the DB row — no plaintext in code or env vars
