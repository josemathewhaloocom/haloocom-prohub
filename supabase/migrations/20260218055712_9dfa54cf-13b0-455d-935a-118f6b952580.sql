
-- Create product_catalog table
CREATE TABLE public.product_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

-- Admins full CRUD
CREATE POLICY "Admins can manage product catalog"
  ON public.product_catalog FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- All authenticated users can SELECT
CREATE POLICY "Authenticated users can view active products"
  ON public.product_catalog FOR SELECT
  TO authenticated
  USING (true);

-- Add product fields to projects table
ALTER TABLE public.projects
  ADD COLUMN product_id uuid REFERENCES public.product_catalog(id) ON DELETE SET NULL,
  ADD COLUMN product_version text,
  ADD COLUMN num_users integer,
  ADD COLUMN num_channels integer,
  ADD COLUMN trunk text,
  ADD COLUMN location text;
