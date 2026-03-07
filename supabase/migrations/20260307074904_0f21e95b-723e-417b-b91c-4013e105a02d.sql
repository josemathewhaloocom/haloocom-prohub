
CREATE TABLE public.reporting_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('sales_to_sales_manager', 'engineer_to_project_manager')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, relationship_type)
);

ALTER TABLE public.reporting_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages reporting_managers"
ON public.reporting_managers FOR ALL TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "Users can read own reporting manager"
ON public.reporting_managers FOR SELECT TO authenticated
USING (user_id = auth.uid() OR manager_id = auth.uid());

CREATE POLICY "Authenticated can read all reporting_managers"
ON public.reporting_managers FOR SELECT TO authenticated
USING (true);
