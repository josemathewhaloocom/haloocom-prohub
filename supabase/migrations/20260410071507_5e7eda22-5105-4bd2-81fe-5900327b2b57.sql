
-- Migrate existing engineer roles to support_engineer
UPDATE public.user_roles SET role = 'support_engineer' WHERE role = 'engineer';

-- Drop assigned_team column from support_tickets
ALTER TABLE public.support_tickets DROP COLUMN IF EXISTS assigned_team;

-- Update RLS policies on support_tickets
DROP POLICY IF EXISTS "Engineers can create tickets" ON public.support_tickets;
CREATE POLICY "Engineers can create tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND 
    has_any_role(auth.uid(), ARRAY['support_engineer','engineering','project_manager'])
  );

DROP POLICY IF EXISTS "Engineers can update own tickets" ON public.support_tickets;
CREATE POLICY "Engineers can update own tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (
    ((created_by = auth.uid()) OR (assigned_engineer_id = auth.uid())) 
    AND has_any_role(auth.uid(), ARRAY['support_engineer','engineering'])
  );

DROP POLICY IF EXISTS "Engineers can view relevant tickets" ON public.support_tickets;
CREATE POLICY "Engineers can view relevant tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    (created_by = auth.uid()) OR 
    (assigned_engineer_id = auth.uid()) OR 
    is_assigned_to_project(project_id) OR 
    is_super_admin() OR 
    has_any_role(auth.uid(), ARRAY['admin_manager','ceo'])
  );

-- Update RLS on faq_items
DROP POLICY IF EXISTS "Engineers manage support FAQs" ON public.faq_items;
CREATE POLICY "Engineers manage support FAQs" ON public.faq_items
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['support_engineer','engineering']) AND category = 'support_implementation')
  WITH CHECK (has_any_role(auth.uid(), ARRAY['support_engineer','engineering']) AND category = 'support_implementation');

-- Update RLS on projects
DROP POLICY IF EXISTS "Engineers can view all projects" ON public.projects;
CREATE POLICY "Engineers can view all projects" ON public.projects
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['support_engineer','engineering']));
