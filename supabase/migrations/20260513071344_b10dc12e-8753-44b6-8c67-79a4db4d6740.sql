
-- POC tracking tables
CREATE TABLE public.pocs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_company TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  priority TEXT NOT NULL DEFAULT 'medium',
  start_date DATE,
  evaluation_date DATE,
  success_criteria TEXT,
  outcome TEXT,
  outcome_reason TEXT,
  product_id UUID,
  product_version TEXT,
  num_users INTEGER,
  num_channels INTEGER,
  trunk TEXT,
  location TEXT,
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  converted_project_id UUID,
  converted_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.poc_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poc_id UUID NOT NULL REFERENCES public.pocs(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poc_id, engineer_id)
);

CREATE TABLE public.poc_daily_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poc_id UUID NOT NULL REFERENCES public.pocs(id) ON DELETE CASCADE,
  engineer_id UUID NOT NULL,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT NOT NULL,
  blockers TEXT,
  hours_worked NUMERIC NOT NULL DEFAULT 0,
  percentage_complete INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.poc_stakeholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poc_id UUID NOT NULL REFERENCES public.pocs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poc_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poc_daily_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poc_stakeholders ENABLE ROW LEVEL SECURITY;

-- Helper: assigned to POC
CREATE OR REPLACE FUNCTION public.is_assigned_to_poc(_poc_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.poc_assignments WHERE poc_id = _poc_id AND engineer_id = auth.uid())
$$;

-- POCs RLS: same creators as projects (sales, PM) + viewers
CREATE POLICY "Super admin full access on pocs" ON public.pocs FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Creators can view own pocs" ON public.pocs FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Creators can create pocs" ON public.pocs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND has_any_role(auth.uid(), ARRAY['sales','sales_manager','project_manager','admin_manager','ceo']));
CREATE POLICY "Creators can update own pocs" ON public.pocs FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Sales Manager can view pocs" ON public.pocs FOR SELECT TO authenticated USING (has_any_role(auth.uid(), ARRAY['sales_manager']));
CREATE POLICY "CEO can view pocs" ON public.pocs FOR SELECT TO authenticated USING (has_any_role(auth.uid(), ARRAY['ceo']));
CREATE POLICY "Engineers can view assigned pocs" ON public.pocs FOR SELECT TO authenticated USING (is_assigned_to_poc(id));

-- POC assignments
CREATE POLICY "Super admin manages poc assignments" ON public.poc_assignments FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Creators manage poc assignments" ON public.poc_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pocs WHERE id = poc_id AND created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pocs WHERE id = poc_id AND created_by = auth.uid()));
CREATE POLICY "Engineers view own poc assignments" ON public.poc_assignments FOR SELECT TO authenticated USING (engineer_id = auth.uid());

-- POC daily updates
CREATE POLICY "Super admin full access on poc updates" ON public.poc_daily_updates FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Engineers create poc updates" ON public.poc_daily_updates FOR INSERT TO authenticated
  WITH CHECK (engineer_id = auth.uid() AND (is_assigned_to_poc(poc_id) OR EXISTS (SELECT 1 FROM public.pocs WHERE id = poc_id AND created_by = auth.uid())));
CREATE POLICY "Engineers update own poc updates" ON public.poc_daily_updates FOR UPDATE TO authenticated USING (engineer_id = auth.uid());
CREATE POLICY "View poc updates if related" ON public.poc_daily_updates FOR SELECT TO authenticated
  USING (engineer_id = auth.uid() OR is_assigned_to_poc(poc_id) OR EXISTS (SELECT 1 FROM public.pocs WHERE id = poc_id AND created_by = auth.uid()));

-- POC stakeholders
CREATE POLICY "Super admin full access on poc stakeholders" ON public.poc_stakeholders FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "Manage poc stakeholders" ON public.poc_stakeholders FOR ALL TO authenticated
  USING (is_assigned_to_poc(poc_id) OR EXISTS (SELECT 1 FROM public.pocs WHERE id = poc_id AND created_by = auth.uid()))
  WITH CHECK (is_assigned_to_poc(poc_id) OR EXISTS (SELECT 1 FROM public.pocs WHERE id = poc_id AND created_by = auth.uid()));

-- Auto-update progress on daily update insert
CREATE OR REPLACE FUNCTION public.sync_poc_progress()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.pocs SET progress_percentage = NEW.percentage_complete, updated_at = now() WHERE id = NEW.poc_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER poc_update_progress AFTER INSERT ON public.poc_daily_updates
FOR EACH ROW EXECUTE FUNCTION public.sync_poc_progress();

CREATE TRIGGER pocs_updated_at BEFORE UPDATE ON public.pocs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
