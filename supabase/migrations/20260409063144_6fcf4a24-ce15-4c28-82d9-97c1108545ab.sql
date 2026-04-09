
-- Add engineering_manager to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'engineering_manager';

-- Add team and assigned_team columns to support_tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS team text NOT NULL DEFAULT 'support',
  ADD COLUMN IF NOT EXISTS assigned_team text;

-- RLS: Engineering Manager full access on tickets
CREATE POLICY "Engineering manager full access on tickets"
ON public.support_tickets
FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['engineering_manager'::text]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['engineering_manager'::text]));

-- RLS: Engineering Manager can manage ticket config
CREATE POLICY "Engineering manager manages ticket config"
ON public.support_ticket_config
FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['engineering_manager'::text]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['engineering_manager'::text]));

-- RLS: Engineering Manager can manage ticket logs
CREATE POLICY "Engineering manager manages ticket logs"
ON public.support_ticket_logs
FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['engineering_manager'::text]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['engineering_manager'::text]));

-- RLS: Engineering Manager can view all projects (needed for ticket creation)
CREATE POLICY "Engineering Manager can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['engineering_manager'::text]));

-- RLS: Engineering Manager can view all profiles
-- (profiles already has "Authenticated can view all profiles" so no need)

-- RLS: Engineering Manager can view published FAQs (already covered by authenticated policy)
-- Give engineering_manager full FAQ access for support_implementation category
CREATE POLICY "Engineering manager manages support FAQs"
ON public.faq_items
FOR ALL
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['engineering_manager'::text]) AND category = 'support_implementation')
WITH CHECK (has_any_role(auth.uid(), ARRAY['engineering_manager'::text]) AND category = 'support_implementation');
