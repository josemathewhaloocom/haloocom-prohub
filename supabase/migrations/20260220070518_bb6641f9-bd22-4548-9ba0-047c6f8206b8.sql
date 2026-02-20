-- One engineer per project unique constraint
CREATE UNIQUE INDEX idx_one_engineer_per_project ON public.project_assignments (project_id);
