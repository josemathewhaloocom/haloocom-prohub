
Goal: fix the Support Ticket module end-to-end, starting with the current blocker where the form cannot scroll and the submit button is clipped.

What I found
- The create/edit modal in `src/pages/SupportTickets.tsx` is the immediate problem. It uses `DialogContent` with `overflow-hidden` and a `ScrollArea` inside a grid layout, but the scrollable body is not given a real bounded height. That makes the lower fields and footer fall outside the visible area, which matches your “no scroll / submit button not visible” issue.
- Session replay shows project selection is working. Network logs also show valid `support_ticket_config` rows for Department and Issue Reported Via. So the dropdown data exists; the main blocker is the form/modal behavior.
- There are still spec gaps in the current module:
  - `admin_email` is being filled from `client_email`, not from dedicated project info.
  - engineer assignment currently uses all profiles, not only engineers.
  - engineers still depend on project-assignment visibility, which conflicts with your requirement that they can create tickets for all eligible projects.
  - ticket dropdown config supports add/delete/toggle, but not proper edit/modify flow.

Implementation plan

1. Fix the modal layout first in `src/pages/SupportTickets.tsx`
- Convert the ticket dialog into a true `flex flex-col` modal with fixed viewport height.
- Give the body a bounded `overflow-y-auto` region and keep the footer sticky/always visible.
- Add `DialogDescription` to remove the current accessibility warning and stabilize the dialog structure.

2. Rebuild the ticket form so all required fields are reachable and clear
- Keep the full required field set visible in a consistent order:
  - Ticket ID preview
  - Project search
  - auto-filled account/client/product/admin info
  - Priority, Status, Department, Issue Reported Via, Case Type, Category, Sub Category
  - Subject, Description, Resolution / RCA
  - Assigned Engineer
  - conditional Health Checkup PDF upload
- Add inline field errors, not only a generic toast, so users can see exactly what is missing.
- Keep the submit action visible and clearly disabled/enabled based on form state.

3. Rework the project search and ticket eligibility flow
- Keep the searchable project picker, but make its result panel contained and non-blocking inside the form.
- Show project name, client name, and product in the search results.
- Enforce eligibility clearly:
  - allow ticket creation for active support customers
  - block expired SLA projects
  - allow Rental projects even if SLA/AMC is not relevant
- Show a readable blocked-state message instead of failing late during submit.

4. Fix the data gaps behind the form
- Add a dedicated project-level admin/support email field via migration so `admin_email` is truly auto-filled from project info.
- If not already wired in UI, finish wiring `purchase_type` in project create/edit so Buyout / Rental / L2H actually feeds the ticket eligibility logic.
- Restrict Assigned Engineer choices to real engineers only.

5. Align permissions with your required access model
- Engineers: create and edit their own / assigned tickets only.
- Project Managers and Support Managers: create, edit, and delete all tickets.
- Adjust RLS and frontend behavior so engineers can browse all allowed projects for ticket creation, while assignment-based restrictions stay in place for upload-only modules where needed.

6. Finish the admin configuration side
- Upgrade `src/pages/SettingsPage.tsx` so ticket dropdowns can be add / edit / delete / activate / deactivate, not just add/delete/toggle.
- Keep category → sub-category relationships editable.
- If your “Admin” role should also manage ticket config, extend access to that role too; otherwise keep PM/support-manager as the ticket administrators.

7. Recheck reports after the create/edit flow is stable
- Validate `src/pages/TicketReports.tsx` against the final ticket data.
- Confirm Client-wise summary, Engineer performance, and TAT still calculate correctly after ticket creation/editing is fixed.
- Add stronger empty/error states so reports remain usable.

Technical details
- Main files involved:
  - `src/pages/SupportTickets.tsx`
  - `src/pages/SettingsPage.tsx`
  - `src/pages/Projects.tsx`
  - new migration(s) under `supabase/migrations/`
- Expected backend changes:
  - dedicated project admin/support email field
  - possible policy adjustment for engineer project visibility in ticket creation
  - possible safe source for “engineer-only” assignment options

QA checklist
- Open New Ticket on a short-height screen and confirm the form body scrolls while the footer stays visible.
- Search and select a project, fill all mandatory fields, and create a normal ticket successfully.
- Create a Health Checkup ticket and confirm PDF upload is mandatory.
- Verify engineer / project manager / support manager permissions for create, edit, and delete.
- Confirm change logs, created/closed timestamps, and reports update correctly after edits.
