
-- Sequence for auto-generating ticket IDs
CREATE SEQUENCE public.ticket_id_seq START WITH 1 INCREMENT BY 1;

-- Config table for ticket dropdown values
CREATE TABLE public.support_ticket_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text NOT NULL,
  field_value text NOT NULL,
  parent_value text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(field_name, field_value)
);

ALTER TABLE public.support_ticket_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ticket config"
ON public.support_ticket_config FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Super admin manages ticket config"
ON public.support_ticket_config FOR ALL TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Insert default values (all with 4 columns)
INSERT INTO public.support_ticket_config (field_name, field_value, sort_order, parent_value) VALUES
  ('status', 'Open', 0, NULL),
  ('status', 'In-progress', 1, NULL),
  ('status', 'Hold', 2, NULL),
  ('status', 'Awaiting Client Confirmation', 3, NULL),
  ('status', 'Closed', 4, NULL),
  ('priority', 'Critical', 0, NULL),
  ('priority', 'High', 1, NULL),
  ('priority', 'Moderate', 2, NULL),
  ('priority', 'Low', 3, NULL),
  ('department', 'Engineering', 0, NULL),
  ('department', 'Implementation', 1, NULL),
  ('department', 'Support', 2, NULL),
  ('department', 'Sales', 3, NULL),
  ('issue_reported_via', 'Call', 0, NULL),
  ('issue_reported_via', 'Email', 1, NULL),
  ('issue_reported_via', 'Sales Team', 2, NULL),
  ('issue_reported_via', 'WhatsApp', 3, NULL),
  ('case_type', 'Bug Fix', 0, NULL),
  ('case_type', 'Feature Request', 1, NULL),
  ('case_type', 'Health Checkup', 2, NULL),
  ('case_type', 'Configuration', 3, NULL),
  ('category', 'Hardware', 0, NULL),
  ('category', 'Software', 1, NULL),
  ('category', 'Network', 2, NULL),
  ('sub_category', 'Server', 0, 'Hardware'),
  ('sub_category', 'Phone', 1, 'Hardware'),
  ('sub_category', 'Application', 0, 'Software'),
  ('sub_category', 'Database', 1, 'Software'),
  ('sub_category', 'LAN', 0, 'Network'),
  ('sub_category', 'WAN', 1, 'Network');

-- Main support tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL UNIQUE DEFAULT ('TKT-' || lpad(nextval('public.ticket_id_seq')::text, 5, '0')),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_email text,
  product_name text,
  admin_email text,
  status text NOT NULL DEFAULT 'Open',
  priority text NOT NULL DEFAULT 'High',
  department text NOT NULL,
  subject text NOT NULL,
  description text,
  resolution text,
  issue_reported_via text NOT NULL,
  case_type text NOT NULL,
  category text NOT NULL,
  sub_category text,
  assigned_engineer_id uuid REFERENCES public.profiles(id),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  report_file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "Engineers can view relevant tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_engineer_id = auth.uid()
  OR is_assigned_to_project(project_id)
  OR is_super_admin()
  OR has_any_role(auth.uid(), ARRAY['admin_manager'::text, 'ceo'::text])
);

CREATE POLICY "Engineers can create tickets"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND has_any_role(auth.uid(), ARRAY['engineer'::text, 'project_manager'::text])
);

CREATE POLICY "Engineers can update own tickets"
ON public.support_tickets FOR UPDATE TO authenticated
USING (
  (created_by = auth.uid() OR assigned_engineer_id = auth.uid())
  AND has_any_role(auth.uid(), ARRAY['engineer'::text])
);

CREATE POLICY "Super admin full access on tickets"
ON public.support_tickets FOR ALL TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE POLICY "PM can delete tickets"
ON public.support_tickets FOR DELETE TO authenticated
USING (is_super_admin());

-- Change logs table
CREATE TABLE public.support_ticket_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid NOT NULL REFERENCES public.profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ticket logs"
ON public.support_ticket_logs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert ticket logs"
ON public.support_ticket_logs FOR INSERT TO authenticated
WITH CHECK (changed_by = auth.uid());

CREATE POLICY "Super admin manages ticket logs"
ON public.support_ticket_logs FOR ALL TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Storage bucket for health checkup PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-reports', 'ticket-reports', false);

CREATE POLICY "Engineers can upload ticket reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ticket-reports' AND has_any_role(auth.uid(), ARRAY['engineer'::text, 'project_manager'::text]));

CREATE POLICY "Authenticated can view ticket reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ticket-reports');

CREATE POLICY "Super admin manages ticket report files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ticket-reports' AND is_super_admin());
