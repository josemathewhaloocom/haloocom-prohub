
-- Add support_manager to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_manager';

-- Add purchase_type to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS purchase_type text;

-- Add is_active flag to projects for customer deactivation
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Support manager can view all projects
CREATE POLICY "Support Manager can view projects"
ON public.projects FOR SELECT TO authenticated
USING (has_any_role(auth.uid(), ARRAY['support_manager']));

-- Support manager can update projects
CREATE POLICY "Support Manager can update projects"
ON public.projects FOR UPDATE TO authenticated
USING (has_any_role(auth.uid(), ARRAY['support_manager']));

-- Support manager full access on support_tickets
CREATE POLICY "Support manager full access on tickets"
ON public.support_tickets FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['support_manager']))
WITH CHECK (has_any_role(auth.uid(), ARRAY['support_manager']));

-- Support manager can manage ticket config
CREATE POLICY "Support manager manages ticket config"
ON public.support_ticket_config FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['support_manager']))
WITH CHECK (has_any_role(auth.uid(), ARRAY['support_manager']));

-- Support manager can view/manage ticket logs
CREATE POLICY "Support manager manages ticket logs"
ON public.support_ticket_logs FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['support_manager']))
WITH CHECK (has_any_role(auth.uid(), ARRAY['support_manager']));
