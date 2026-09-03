-- TASKS
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  poc_id uuid REFERENCES public.pocs(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  due_date date,
  reminder_days_before integer NOT NULL DEFAULT 1,
  reminder_sent_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR assignee_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['project_manager','support_manager','engineering_manager','ceo']));
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['project_manager','support_manager','engineering_manager']));
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_assignee_status ON public.tasks(assignee_id, status);
CREATE INDEX idx_tasks_parent ON public.tasks(parent_task_id);

-- TASK COMMENTS
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_comments_select" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_comments_insert" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "task_comments_delete" ON public.task_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_super_admin());

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'general',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);

-- PROJECT CUSTOMIZATIONS
CREATE TABLE public.project_customizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  version text,
  done_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  done_on date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_customizations TO authenticated;
GRANT ALL ON public.project_customizations TO service_role;
ALTER TABLE public.project_customizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc_select" ON public.project_customizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "pc_write" ON public.project_customizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "pc_update" ON public.project_customizations FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_super_admin());
CREATE POLICY "pc_delete" ON public.project_customizations FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_super_admin());
CREATE TRIGGER pc_updated_at BEFORE UPDATE ON public.project_customizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- PROJECT UPGRADES
CREATE TABLE public.project_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_version text,
  to_version text NOT NULL,
  upgrade_date date NOT NULL DEFAULT CURRENT_DATE,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_upgrades TO authenticated;
GRANT ALL ON public.project_upgrades TO service_role;
ALTER TABLE public.project_upgrades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pu_select" ON public.project_upgrades FOR SELECT TO authenticated USING (true);
CREATE POLICY "pu_insert" ON public.project_upgrades FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "pu_update" ON public.project_upgrades FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_super_admin());
CREATE POLICY "pu_delete" ON public.project_upgrades FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_super_admin());
CREATE TRIGGER pu_updated_at BEFORE UPDATE ON public.project_upgrades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- HEALTH CHECKUPS
CREATE TABLE public.health_checkups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  completed_date date,
  status text NOT NULL DEFAULT 'scheduled',
  engineer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  findings text,
  report_url text,
  reminder_sent_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_checkups TO authenticated;
GRANT ALL ON public.health_checkups TO service_role;
ALTER TABLE public.health_checkups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hc_select" ON public.health_checkups FOR SELECT TO authenticated USING (true);
CREATE POLICY "hc_insert" ON public.health_checkups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "hc_update" ON public.health_checkups FOR UPDATE TO authenticated USING (created_by = auth.uid() OR engineer_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['project_manager','support_manager','engineering_manager']));
CREATE POLICY "hc_delete" ON public.health_checkups FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_super_admin());
CREATE TRIGGER hc_updated_at BEFORE UPDATE ON public.health_checkups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_hc_project ON public.health_checkups(project_id, status);

-- CLIENT FEEDBACK
CREATE TABLE public.client_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments text,
  source text,
  feedback_date date NOT NULL DEFAULT CURRENT_DATE,
  engineer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_feedback TO authenticated;
GRANT ALL ON public.client_feedback TO service_role;
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cf_select" ON public.client_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "cf_insert" ON public.client_feedback FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "cf_update" ON public.client_feedback FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_super_admin());
CREATE POLICY "cf_delete" ON public.client_feedback FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_super_admin());
CREATE TRIGGER cf_updated_at BEFORE UPDATE ON public.client_feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- REVIEWS
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  highlights text,
  lowlights text,
  action_points text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_type, period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rv_select" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "rv_insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "rv_update" ON public.reviews FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['project_manager','support_manager','engineering_manager','ceo']));
CREATE POLICY "rv_delete" ON public.reviews FOR DELETE TO authenticated USING (public.is_super_admin());
CREATE TRIGGER rv_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- SUGGESTIONS
CREATE TABLE public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'suggestion',
  status text NOT NULL DEFAULT 'new',
  response text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sg_select" ON public.suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sg_insert" ON public.suggestions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "sg_update" ON public.suggestions FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['project_manager','support_manager','engineering_manager','ceo']));
CREATE POLICY "sg_delete" ON public.suggestions FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_super_admin());
CREATE TRIGGER sg_updated_at BEFORE UPDATE ON public.suggestions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ALERT SETTINGS
CREATE TABLE public.alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_critical_hours integer NOT NULL DEFAULT 4,
  sla_high_hours integer NOT NULL DEFAULT 8,
  sla_medium_hours integer NOT NULL DEFAULT 24,
  sla_low_hours integer NOT NULL DEFAULT 48,
  inactivity_days integer NOT NULL DEFAULT 3,
  health_checkup_interval_days integer NOT NULL DEFAULT 90,
  eod_recipients text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_settings TO authenticated;
GRANT ALL ON public.alert_settings TO service_role;
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as_select" ON public.alert_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "as_write" ON public.alert_settings FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['project_manager','support_manager','engineering_manager']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['project_manager','support_manager','engineering_manager']));
INSERT INTO public.alert_settings DEFAULT VALUES;

-- TICKET ESCALATION FIELDS
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS is_escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_tickets_status_team ON public.support_tickets(status, team);