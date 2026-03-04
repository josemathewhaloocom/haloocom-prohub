
-- Phase 1: Complete multi-role system overhaul (single transaction)

-- Step 1: Drop ALL existing policies on ALL tables first
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "System inserts profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do anything with projects" ON public.projects;
DROP POLICY IF EXISTS "Engineers can view assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Admins manage assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Engineers can view own assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Admins can do anything with updates" ON public.daily_updates;
DROP POLICY IF EXISTS "Engineers can create updates for assigned projects" ON public.daily_updates;
DROP POLICY IF EXISTS "Engineers can update own updates" ON public.daily_updates;
DROP POLICY IF EXISTS "Engineers can view updates for assigned projects" ON public.daily_updates;
DROP POLICY IF EXISTS "Admins can do anything with documents" ON public.documents;
DROP POLICY IF EXISTS "Engineers can upload documents for assigned projects" ON public.documents;
DROP POLICY IF EXISTS "Engineers can update own pending documents" ON public.documents;
DROP POLICY IF EXISTS "Engineers can view documents for assigned projects" ON public.documents;
DROP POLICY IF EXISTS "Anon can read documents by signing_token" ON public.documents;
DROP POLICY IF EXISTS "Anon can update signature on documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can do anything with stakeholders" ON public.project_stakeholders;
DROP POLICY IF EXISTS "Engineers can manage stakeholders for assigned projects" ON public.project_stakeholders;
DROP POLICY IF EXISTS "Engineers can view stakeholders for assigned projects" ON public.project_stakeholders;
DROP POLICY IF EXISTS "Admins can do anything with milestones" ON public.milestones;
DROP POLICY IF EXISTS "Engineers can manage milestones for assigned projects" ON public.milestones;
DROP POLICY IF EXISTS "Engineers can update milestones for assigned projects" ON public.milestones;
DROP POLICY IF EXISTS "Engineers can view milestones for assigned projects" ON public.milestones;
DROP POLICY IF EXISTS "Admins can manage product catalog" ON public.product_catalog;
DROP POLICY IF EXISTS "Authenticated users can view active products" ON public.product_catalog;
DROP POLICY IF EXISTS "Admins can manage smtp_settings" ON public.smtp_settings;
DROP POLICY IF EXISTS "Admins can manage field config" ON public.project_field_config;
DROP POLICY IF EXISTS "Authenticated users can view field config" ON public.project_field_config;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;

-- Step 2: Drop functions (now safe since policies are gone)
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_assigned_to_project(uuid);
DROP FUNCTION IF EXISTS public.has_any_role(uuid, text[]);

-- Step 3: Swap app_role enum
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('project_manager','admin_manager','sales','sales_manager','accounts_manager','engineer','ceo');
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role
  USING (CASE role::text WHEN 'admin' THEN 'project_manager'::public.app_role WHEN 'engineer' THEN 'engineer'::public.app_role END);
DROP TYPE public.app_role_old;

-- Step 4: Swap project_status enum
ALTER TYPE public.project_status RENAME TO project_status_old;
CREATE TYPE public.project_status AS ENUM ('draft','sales_approved','accounts_approved','admin_reviewed','open','qc_completed','kick_off_scheduled','site_ready','on_hold','scheduled','in_progress','client_signing_pending','client_signed','pending_admin_approval','closed');
ALTER TABLE public.projects ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.projects ALTER COLUMN status TYPE public.project_status USING (status::text::public.project_status);
ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'draft'::public.project_status;
DROP TYPE public.project_status_old;

-- Step 5: New project columns
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS server_serial_number text,
  ADD COLUMN IF NOT EXISTS gw_sl_no text,
  ADD COLUMN IF NOT EXISTS sl_no_remarks text,
  ADD COLUMN IF NOT EXISTS sla_period text,
  ADD COLUMN IF NOT EXISTS sla_start_date date,
  ADD COLUMN IF NOT EXISTS sla_end_date date,
  ADD COLUMN IF NOT EXISTS amc_start_date date,
  ADD COLUMN IF NOT EXISTS amc_end_date date;

-- Step 6: Recreate functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'project_manager') $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_super_admin() $$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = ANY(_roles)) $$;

CREATE OR REPLACE FUNCTION public.is_assigned_to_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.project_assignments WHERE project_id = _project_id AND engineer_id = auth.uid()) $$;

-- Step 7: Recreate ALL policies

-- PROFILES
CREATE POLICY "Authenticated can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can update any profile" ON public.profiles FOR UPDATE USING (public.is_super_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "System inserts profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- USER_ROLES
CREATE POLICY "Super admin can manage roles" ON public.user_roles FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- PROJECTS
CREATE POLICY "Super admin full access on projects" ON public.projects FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Sales can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['sales']));
CREATE POLICY "Sales can update own projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['sales']) AND created_by = auth.uid());
CREATE POLICY "Sales can view own projects" ON public.projects FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['sales']) AND created_by = auth.uid());
CREATE POLICY "Sales Manager can view projects" ON public.projects FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['sales_manager']));
CREATE POLICY "Sales Manager can update projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['sales_manager']));
CREATE POLICY "Accounts Manager can view projects" ON public.projects FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['accounts_manager']));
CREATE POLICY "Accounts Manager can update projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['accounts_manager']));
CREATE POLICY "Admin Manager can view projects" ON public.projects FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin_manager']));
CREATE POLICY "Admin Manager can update projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin_manager']));
CREATE POLICY "CEO can view all projects" ON public.projects FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['ceo']));
CREATE POLICY "Engineers can view assigned projects" ON public.projects FOR SELECT TO authenticated USING (public.is_assigned_to_project(id));
CREATE POLICY "Engineers can update assigned projects" ON public.projects FOR UPDATE TO authenticated USING (public.is_assigned_to_project(id));

-- PROJECT_ASSIGNMENTS
CREATE POLICY "Super admin manages assignments" ON public.project_assignments FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Engineers can view own assignments" ON public.project_assignments FOR SELECT TO authenticated USING (engineer_id = auth.uid());

-- DOCUMENTS
CREATE POLICY "Super admin full access on documents" ON public.documents FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Sales can upload documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['sales']) AND uploaded_by = auth.uid());
CREATE POLICY "Sales can view own project documents" ON public.documents FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['sales']) AND EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND created_by = auth.uid()));
CREATE POLICY "Admin Manager can upload documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin_manager']) AND uploaded_by = auth.uid());
CREATE POLICY "Admin Manager can view documents" ON public.documents FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['admin_manager']));
CREATE POLICY "Sales Manager can view documents" ON public.documents FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['sales_manager']));
CREATE POLICY "Accounts Manager can view documents" ON public.documents FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['accounts_manager']));
CREATE POLICY "CEO can view documents" ON public.documents FOR SELECT TO authenticated USING (public.has_any_role(auth.uid(), ARRAY['ceo']));
CREATE POLICY "Engineers can upload documents for assigned projects" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_project(project_id) AND uploaded_by = auth.uid());
CREATE POLICY "Engineers can view documents for assigned projects" ON public.documents FOR SELECT TO authenticated USING (public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can update own pending documents" ON public.documents FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() AND approval_status = 'pending'::approval_status);
CREATE POLICY "Anon can read documents by signing_token" ON public.documents FOR SELECT USING (signing_token IS NOT NULL);
CREATE POLICY "Anon can update signature on documents" ON public.documents FOR UPDATE USING (signing_token IS NOT NULL AND signed_at IS NULL) WITH CHECK (signing_token IS NOT NULL);

-- DAILY_UPDATES
CREATE POLICY "Super admin full access on updates" ON public.daily_updates FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Engineers can create updates for assigned projects" ON public.daily_updates FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_project(project_id) AND engineer_id = auth.uid());
CREATE POLICY "Engineers can update own updates" ON public.daily_updates FOR UPDATE TO authenticated USING (engineer_id = auth.uid() AND public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can view updates for assigned projects" ON public.daily_updates FOR SELECT TO authenticated USING (public.is_assigned_to_project(project_id));

-- MILESTONES
CREATE POLICY "Super admin full access on milestones" ON public.milestones FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Engineers can manage milestones for assigned projects" ON public.milestones FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can update milestones for assigned projects" ON public.milestones FOR UPDATE TO authenticated USING (public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can view milestones for assigned projects" ON public.milestones FOR SELECT TO authenticated USING (public.is_assigned_to_project(project_id));

-- PROJECT_STAKEHOLDERS
CREATE POLICY "Super admin full access on stakeholders" ON public.project_stakeholders FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Engineers can manage stakeholders for assigned projects" ON public.project_stakeholders FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can view stakeholders for assigned projects" ON public.project_stakeholders FOR SELECT TO authenticated USING (public.is_assigned_to_project(project_id));

-- PRODUCT_CATALOG
CREATE POLICY "Super admin manages product catalog" ON public.product_catalog FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Authenticated users can view active products" ON public.product_catalog FOR SELECT TO authenticated USING (true);

-- PROJECT_FIELD_CONFIG
CREATE POLICY "Super admin manages field config" ON public.project_field_config FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Authenticated users can view field config" ON public.project_field_config FOR SELECT TO authenticated USING (true);

-- SMTP_SETTINGS
CREATE POLICY "Super admin manages smtp_settings" ON public.smtp_settings FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- STORAGE
CREATE POLICY "Admins can delete documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND public.is_super_admin());
