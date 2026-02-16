

# Project Management Internal Tool

## Overview
A data-rich internal dashboard for managing engineering projects end-to-end — from assignment to client sign-off — with automated email notifications, document management, and engineer performance tracking.

**Backend:** Lovable Cloud (Supabase) for database, auth, file storage, and edge functions
**Emails:** Resend (via edge functions) for all automated notifications

---

## Module 1: Authentication & Roles
- Login page for Admin (you) and Engineers
- Role-based access: Admin sees everything, Engineers see only their assigned projects
- Admin can invite engineers by email

## Module 2: Project Management
- **Create Project** — Add project name, client details (name, email, company), description, start date, deadline, budget, priority level
- **Assign Engineer** — Select an engineer to assign; triggers email to engineer with client details and project brief
- **Project Statuses** — Upcoming, In Progress, On Hold, Completed
- **Project Timeline** — Set milestones with target dates; track actual vs planned progress
- **Client & Stakeholder Contacts** — Store emails for automated notifications per project

## Module 3: Daily Progress Updates
- Engineers submit daily updates per project (text summary, % completion, blockers, hours worked)
- Updates auto-trigger email to client and internal stakeholders
- Admin can view full update history per project

## Module 4: Document Management & Digital Sign-off
- Engineers upload sign-off documents (stored in Supabase Storage)
- Built-in signature pad — engineers can digitally sign documents
- **Approval Workflow:** Upload → Admin reviews → Approve/Reject → On approval, sign-off email sent to client with document attached
- Document history and version tracking

## Module 5: Email Notifications (via Resend Edge Functions)
- **Project Assignment** — Engineer gets email with client details and project info
- **Daily Updates** — Auto-email to client and stakeholders after engineer submits update
- **Sign-off Approval** — Email to client with signed document after admin approval
- All emails use professional HTML templates

## Module 6: Dashboard & Analytics
- **Overview Dashboard** — Total projects by status (upcoming/ongoing/completed), overdue projects, recent activity feed
- **Project Tracker** — Filterable table of all projects with status, assigned engineer, deadline, progress %
- **Engineer Performance** — Projects completed, average completion time, on-time delivery rate, daily update consistency
- **Timeline View** — Visual timeline showing project durations and milestones
- **Workload Distribution** — See how many active projects each engineer has

## Module 7: Engineer Performance Tracking
- Metrics: projects completed, on-time delivery %, average daily update streak, client satisfaction (optional rating)
- Performance comparison view across engineers
- Individual engineer profile with project history

---

## Design Approach
- **Data-rich dashboard** with charts (Recharts), KPI cards, and status indicators
- Clean sidebar navigation with sections: Dashboard, Projects, Engineers, Documents, Settings
- Color-coded project status badges
- Responsive design for desktop-first use (with tablet support)

---

## Implementation Order
1. Auth & roles setup with database schema
2. Project CRUD and assignment flow
3. Daily updates module
4. Dashboard with charts and project tracker
5. Document upload and digital signature
6. Approval workflow
7. Email notifications (Resend integration)
8. Engineer performance analytics

