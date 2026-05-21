
-- Master tracker fields on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS tech_stack text,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS client_poc_name text,
  ADD COLUMN IF NOT EXISTS client_poc_email text,
  ADD COLUMN IF NOT EXISTS ai_rep_id uuid,
  ADD COLUMN IF NOT EXISTS tech_rep_id uuid,
  ADD COLUMN IF NOT EXISTS sales_rep_id uuid,
  ADD COLUMN IF NOT EXISTS received_date date,
  ADD COLUMN IF NOT EXISTS uat_date date,
  ADD COLUMN IF NOT EXISTS actual_go_live_date date;

-- Master tracker fields on pocs
ALTER TABLE public.pocs
  ADD COLUMN IF NOT EXISTS tech_stack text,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS client_poc_name text,
  ADD COLUMN IF NOT EXISTS client_poc_email text,
  ADD COLUMN IF NOT EXISTS ai_rep_id uuid,
  ADD COLUMN IF NOT EXISTS tech_rep_id uuid,
  ADD COLUMN IF NOT EXISTS sales_rep_id uuid,
  ADD COLUMN IF NOT EXISTS received_date date,
  ADD COLUMN IF NOT EXISTS uat_date date,
  ADD COLUMN IF NOT EXISTS actual_go_live_date date;

-- Standup meetings
CREATE TABLE public.standup_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL UNIQUE,
  conducted_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.standup_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view standup_meetings"
  ON public.standup_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create standup_meetings"
  ON public.standup_meetings FOR INSERT TO authenticated WITH CHECK (auth.uid() = conducted_by OR conducted_by IS NULL);
CREATE POLICY "Conductor updates standup_meetings"
  ON public.standup_meetings FOR UPDATE TO authenticated USING (conducted_by = auth.uid() OR is_super_admin());
CREATE POLICY "Super admin manages standup_meetings"
  ON public.standup_meetings FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE TRIGGER standup_meetings_updated_at
  BEFORE UPDATE ON public.standup_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Standup items
CREATE TABLE public.standup_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  project_id uuid,
  poc_id uuid,
  status_today text,
  progress text,
  blockers text,
  next_steps text,
  eta_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT standup_item_target_check CHECK (
    (project_id IS NOT NULL AND poc_id IS NULL)
    OR (project_id IS NULL AND poc_id IS NOT NULL)
  )
);
CREATE INDEX idx_standup_items_meeting ON public.standup_items(meeting_id);
ALTER TABLE public.standup_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view standup_items"
  ON public.standup_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create standup_items"
  ON public.standup_items FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator updates standup_items"
  ON public.standup_items FOR UPDATE TO authenticated USING (created_by = auth.uid() OR is_super_admin());
CREATE POLICY "Creator deletes standup_items"
  ON public.standup_items FOR DELETE TO authenticated USING (created_by = auth.uid() OR is_super_admin());

CREATE TRIGGER standup_items_updated_at
  BEFORE UPDATE ON public.standup_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Standup action items
CREATE TABLE public.standup_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  poc_id uuid,
  source_standup_item_id uuid,
  description text NOT NULL,
  assigned_to uuid,
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Open',
  due_date date,
  closed_date date,
  comments text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_item_target_check CHECK (
    (project_id IS NOT NULL AND poc_id IS NULL)
    OR (project_id IS NULL AND poc_id IS NOT NULL)
  )
);
CREATE INDEX idx_action_items_status ON public.standup_action_items(status);
CREATE INDEX idx_action_items_assigned ON public.standup_action_items(assigned_to);
ALTER TABLE public.standup_action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view action_items"
  ON public.standup_action_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create action_items"
  ON public.standup_action_items FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator or assignee updates action_items"
  ON public.standup_action_items FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR assigned_to = auth.uid() OR is_super_admin());
CREATE POLICY "Creator deletes action_items"
  ON public.standup_action_items FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_super_admin());

CREATE TRIGGER action_items_updated_at
  BEFORE UPDATE ON public.standup_action_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
