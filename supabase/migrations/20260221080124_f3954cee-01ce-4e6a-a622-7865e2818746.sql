-- Add signing_token and signing_token_expires_at columns to documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS signing_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS signing_token_expires_at timestamp with time zone;

-- Replace the project_status enum with the expanded set
-- First rename old enum
ALTER TYPE public.project_status RENAME TO project_status_old;

-- Create new enum
CREATE TYPE public.project_status AS ENUM (
  'open', 'qc_completed', 'kick_off_scheduled', 'site_ready',
  'on_hold', 'scheduled', 'in_progress', 'client_signing_pending',
  'client_signed', 'pending_admin_approval', 'closed'
);

-- Migrate existing data
ALTER TABLE public.projects
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.projects
  ALTER COLUMN status TYPE public.project_status
  USING (
    CASE status::text
      WHEN 'upcoming' THEN 'open'::public.project_status
      WHEN 'completed' THEN 'closed'::public.project_status
      ELSE status::text::public.project_status
    END
  );

ALTER TABLE public.projects
  ALTER COLUMN status SET DEFAULT 'open'::public.project_status;

-- Drop old enum
DROP TYPE public.project_status_old;

-- Allow anon users to query documents by signing_token (for public signing page)
CREATE POLICY "Anon can read documents by signing_token"
  ON public.documents
  FOR SELECT
  USING (signing_token IS NOT NULL);

-- Allow anon users to update signature fields on documents
CREATE POLICY "Anon can update signature on documents"
  ON public.documents
  FOR UPDATE
  USING (signing_token IS NOT NULL AND signed_at IS NULL)
  WITH CHECK (signing_token IS NOT NULL);