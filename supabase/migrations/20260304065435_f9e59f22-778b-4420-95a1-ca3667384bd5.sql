
CREATE TABLE public.project_field_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  dropdown_options jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_field_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage field config"
ON public.project_field_config
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can view field config"
ON public.project_field_config
FOR SELECT
TO authenticated
USING (true);
