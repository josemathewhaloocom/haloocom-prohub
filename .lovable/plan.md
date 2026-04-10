

## Plan: Split Engineer Role into Two Team-Based Roles

### Summary

Replace the single `engineer` role with two distinct roles: `support_engineer` (Support & Implementation) and `engineering` (Engineering team). The ticket's team will be auto-determined based on the creator's/assignee's role, removing the manual "Team" and "Assigned Team" dropdowns from the ticket form.

### Database Changes (Migration)

1. **Add two new values to `app_role` enum**: `support_engineer`, `engineering`
2. **Migrate existing `engineer` role data**: All current users with `engineer` role get converted to `support_engineer` (preserving backward compatibility; admins can reassign via Users page)
3. **Remove `assigned_team` column** from `support_tickets` (no longer needed)
4. **Update `team` column logic**: Will be auto-set based on the creator's role (`support_engineer` -> `support`, `engineering` -> `engineering`)
5. **Update RLS policies** on `support_tickets`, `faq_items`, `support_ticket_config`, `support_ticket_logs` to reference the new role names instead of `engineer`
6. **Keep `engineering_manager` role** as-is (already exists)

### Frontend Changes

**`src/hooks/useAuth.tsx`**
- Replace `isEngineer` with `isSupportEngineer` and `isEngineering`
- Add role checks for both new roles

**`src/pages/UsersPage.tsx`**
- Update `ROLE_LABELS` and `ROLE_COLORS` to show "Support & Implementation Engineer" and "Engineering" instead of "Engineer"
- Remove old `engineer` from the role list

**`src/pages/Engineers.tsx`**
- Add tabs or sections for "Support & Implementation" vs "Engineering" team members
- Filter by respective roles

**`src/pages/SupportTickets.tsx`**
- Remove "Team" and "Assigned Team" dropdowns from the form
- Auto-set `team` based on the logged-in user's role when creating a ticket
- Filter "Assigned Engineer" dropdown to show engineers from both teams (cross-team assignment is still allowed per earlier requirements)
- Remove `assigned_team` from form state, payload, log tracking, and view dialog

**`src/pages/Dashboard.tsx`**
- Route `isSupportEngineer` to `EngineerDashboard`
- Route `isEngineering` to a similar engineer dashboard (or share the same component)

**`src/components/AppSidebar.tsx`**
- Update visibility rules to use new role flags

**`src/components/dashboards/EngineerDashboard.tsx`**
- Update to work with new role names

**`src/components/dashboards/EngineeringManagerDashboard.tsx`**
- Update engineer queries to filter by `engineering` role for team-specific stats

**`src/components/dashboards/SupportManagerDashboard.tsx`**
- Update engineer queries to filter by `support_engineer` role for team-specific stats

**`src/pages/SettingsPage.tsx`**
- Update any role references

**`src/pages/TicketReports.tsx`**
- Remove `assigned_team` references; use `team` field (auto-set) for team-based breakdowns

**`supabase/functions/invite-engineer/index.ts`**
- Update to accept new role values

### Key Behavior

- When a **Support & Implementation Engineer** creates a ticket, `team` is auto-set to `"support"`
- When an **Engineering** team member creates a ticket, `team` is auto-set to `"engineering"`
- When a **Manager** creates a ticket, they pick which team it belongs to (keep the Team dropdown only for managers)
- Cross-team assignment remains: any engineer from either team can be assigned to any ticket
- TAT continues to be calculated as before

### Technical Details

- The `engineer` enum value will be removed after migrating existing data to `support_engineer`
- All `has_any_role` checks referencing `'engineer'` will be updated to `ARRAY['support_engineer', 'engineering']`
- The `is_assigned_to_project` function remains unchanged (works on `project_assignments` table regardless of role name)

