
-- Migrate any pending_admin_approval projects to client_signed
UPDATE public.projects SET status = 'client_signed' WHERE status = 'pending_admin_approval';
