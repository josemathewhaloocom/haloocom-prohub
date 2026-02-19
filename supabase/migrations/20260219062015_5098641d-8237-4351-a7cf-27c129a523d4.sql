
-- Create smtp_settings table (admin only)
CREATE TABLE public.smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text,
  port integer DEFAULT 587,
  username text,
  password text,
  from_email text,
  from_name text,
  use_ssl boolean DEFAULT false,
  use_tls boolean DEFAULT true,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage smtp_settings"
  ON public.smtp_settings
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Extend documents table with new columns for type and signing
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_ip text;
