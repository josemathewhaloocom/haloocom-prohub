
-- 1. Migrate any leftover engineer users
UPDATE public.user_roles SET role = 'support_engineer' WHERE role::text = 'engineer';

-- 2. Update older policies that referenced 'engineer' (text-only refs - safe to update)
DROP POLICY IF EXISTS "Engineers can view all projects" ON public.projects;
-- (replacement policy already exists from previous migration: "Engineers can view all projects" with support_engineer/engineering)

-- Ticket reports storage policy (was referencing 'engineer')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Engineers and PMs can upload ticket reports' AND schemaname = 'storage') THEN
    DROP POLICY "Engineers and PMs can upload ticket reports" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "Engineers and PMs can upload ticket reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ticket-reports' AND public.has_any_role(auth.uid(), ARRAY['support_engineer'::text, 'engineering'::text, 'project_manager'::text]));

-- 3. Rebuild app_role enum without 'engineer'
ALTER TYPE public.app_role RENAME TO app_role_old;

CREATE TYPE public.app_role AS ENUM (
  'project_manager',
  'admin_manager',
  'sales',
  'sales_manager',
  'accounts_manager',
  'support_engineer',
  'engineering',
  'ceo',
  'support_manager',
  'engineering_manager'
);

ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role
  USING role::text::public.app_role;

-- has_role() takes app_role; recreate to bind to the new type
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role_old);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

DROP TYPE public.app_role_old;

-- 4. Loosen reporting_managers CHECK so engineers of either type can have a manager
ALTER TABLE public.reporting_managers DROP CONSTRAINT IF EXISTS reporting_managers_relationship_type_check;
ALTER TABLE public.reporting_managers ADD CONSTRAINT reporting_managers_relationship_type_check
  CHECK (relationship_type IN (
    'sales_to_sales_manager',
    'engineer_to_project_manager',
    'support_engineer_to_manager',
    'engineering_to_manager'
  ));

-- Migrate any old engineer_to_project_manager rows (kept for back-compat but expose new types going forward)

-- 5. Projects: custom_fields jsonb storage
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 6. Project dropdown config table (mirrors support_ticket_config)
CREATE TABLE IF NOT EXISTS public.project_dropdown_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text NOT NULL,
  field_value text NOT NULL,
  parent_value text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_dropdown_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view project dropdown config"
ON public.project_dropdown_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin manages project dropdown config"
ON public.project_dropdown_config FOR ALL TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_project_dropdown_config_field ON public.project_dropdown_config(field_name, sort_order);
