
-- Add admin_email column to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS admin_email text;

-- Allow engineers to view all projects (for ticket creation project search)
-- Drop existing restrictive engineer SELECT policy first
DROP POLICY IF EXISTS "Engineers can view assigned projects" ON public.projects;

-- Re-create: engineers can view all projects (read-only)
CREATE POLICY "Engineers can view all projects"
ON public.projects
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['engineer'::text]));
