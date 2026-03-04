# Multi-Role System, Approval Workflow & Dual-Role Project Manager

## Summary

Overhaul the role system from 2 roles to 7, add a multi-stage approval workflow before projects reach "open", add new project fields (serial numbers, SLA, AMC), restructure document uploads by role, and allow users (including Project Managers) to hold multiple roles simultaneously.

---

## Key Design Decision: Multi-Role Support

A user can hold **multiple roles** (e.g., Project Manager + Engineer). The `user_roles` table already supports this (one row per role). The auth system will be updated to track `roles: AppRole[]` with helper booleans. When a Project Manager also has the `engineer` role, they get engineer capabilities (document uploads, daily updates on assigned projects) in addition to super-admin access.

---

## Phase 1: Database Migration

**Enum changes:**

- Replace `app_role` enum: `project_manager`, `admin_manager`, `sales`, `sales_manager`, `accounts_manager`, `engineer`, `ceo`
- Extend `project_status` enum: add `draft`, `sales_approved`, `accounts_approved`, `admin_reviewed` before `open`

**New columns on `projects`:**

- `server_serial_number` (text), `gw_sl_no` (text), `sl_no_remarks` (text)
- `sla_period` (text), `sla_start_date` (date), `sla_end_date` (date)
- `amc_start_date` (date), `amc_end_date` (date)

**New DB functions:**

- `is_super_admin()` — checks for `project_manager` role
- `has_any_role(roles text[])` — checks if user has any of the listed roles

**RLS policy updates** (all tables):

- Replace `is_admin()` references with `is_super_admin()` for full-access policies
- Add role-specific policies:
  - `projects`: Sales + Project Manager can INSERT; Sales Manager / Accounts Manager / Admin Manager can UPDATE during their approval step; CEO can SELECT all; Engineer can SELECT assigned
  - `documents`: role-based INSERT (Sales for SOW/MSA/Pre-install; Admin Manager for DC; Engineer for QC/Installation/Security/Training/Architecture/Completed SOW)
  - `project_assignments`: Project Manager can manage
  - `profiles`: all authenticated can view (needed for Users page)
  - `user_roles`: Project Manager can manage all; users can read own

---

## Phase 2: Auth System (`useAuth.tsx`)

- Fetch **all** roles: `roles: AppRole[]`
- Add helpers: `isProjectManager`, `isAdminManager`, `isSales`, `isSalesManager`, `isAccountsManager`, `isEngineer`, `isCEO`
- A user with both `project_manager` and `engineer` roles gets `isProjectManager = true` AND `isEngineer = true`
- All role checks throughout the app use these helpers

---

## Phase 3: Sidebar & Routing

`**AppSidebar.tsx**` — role-based nav visibility:

- Dashboard, Projects, Documents: all roles
- Engineers: Project Manager only
- Daily Updates: Engineer, Project Manager
- Users: Project Manager only
- Settings: Project Manager only
- CEO: view-only everywhere

`**App.tsx**` — add `/users` route

---

## Phase 4: Project Creation & Approval Workflow

`**Projects.tsx`:**

- Sales and Project Manager can create projects (status = `draft`)
- Sales uploads SOW, Pre-Installation Checklist, MSA during creation

`**ProjectDetail.tsx` — approval chain:**

1. `draft` → Sales Manager sees "Approve" button → `sales_approved` → email to Accounts Manager
2. `sales_approved` → Accounts Manager approves → `accounts_approved` → email to Admin Manager
3. `accounts_approved` → Admin Manager uploads DC + fills serial numbers → `admin_reviewed` → email to Project Manager
4. `admin_reviewed` → Project Manager sets to `open`, assigns engineer

**Field editing by role:**

- Sales: SLA Period, SLA Start/End, AMC Start/End, client details
- Admin Manager: Server Serial Number, GW SL No, SL No Remarks
- Project Manager: everything (super admin)
- Project Manager with engineer role: can also upload engineer documents and submit daily updates on assigned projects

---

## Phase 5: Document Types by Role


| Role                                | Can Upload                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Sales                               | SOW, Pre-Installation Checklist, MSA                                                                                            |
| Admin Manager                       | DC Document                                                                                                                     |
| Engineer (or PM with engineer role) | QC Report, Installation Completion Report, Security Guidelines, Signed DC, Training Report, Project Architecture, Completed SOW |


**Client signing** (public link): Installation Completion Report, Security Guidelines, Training Report, Signed DC only.
**Internal only** (no client signature): Project Architecture, Completed SOW.

---

## Phase 6: Users Page (`UsersPage.tsx`)

- Project Manager can view all users, toggle roles on/off per user
- A user can have multiple roles (e.g., Project Manager + Engineer)
- Invite new users with selected roles
- Rename/refactor `invite-engineer` edge function to `invite-user` supporting any role(s)

---

## Phase 7: Edge Function & Email Updates

- `send-email`: allow all roles (not just admin/engineer)
- `invite-user`: accept `roles: string[]` param, insert multiple `user_roles` rows
- Workflow emails: notify Sales Manager on draft creation, Accounts Manager on sales approval, Admin Manager on accounts approval, Project Manager on admin review

---

## Files to Create/Modify


| Action | File                                          |
| ------ | --------------------------------------------- |
| Create | `src/pages/UsersPage.tsx`                     |
| Modify | `src/hooks/useAuth.tsx`                       |
| Modify | `src/components/AppSidebar.tsx`               |
| Modify | `src/App.tsx`                                 |
| Modify | `src/pages/Projects.tsx`                      |
| Modify | `src/pages/ProjectDetail.tsx`                 |
| Modify | `src/pages/Dashboard.tsx`                     |
| Modify | `src/pages/Documents.tsx`                     |
| Modify | `src/pages/Engineers.tsx`                     |
| Modify | `src/pages/SettingsPage.tsx`                  |
| Modify | `supabase/functions/send-email/index.ts`      |
| Modify | `supabase/functions/invite-engineer/index.ts` |
| Create | SQL migration (enum + columns + RLS)          |


This is a large change. I will implement it in the phases listed above, starting with the database migration and auth changes, then the UI.