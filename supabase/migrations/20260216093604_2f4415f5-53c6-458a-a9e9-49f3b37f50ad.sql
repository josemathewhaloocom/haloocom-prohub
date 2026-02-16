
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'engineer');

-- Create project status enum
CREATE TYPE public.project_status AS ENUM ('upcoming', 'in_progress', 'on_hold', 'completed');

-- Create priority enum
CREATE TYPE public.project_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create approval status enum
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Create milestone status enum
CREATE TYPE public.milestone_status AS ENUM ('pending', 'in_progress', 'completed');

-- ============ USER ROLES TABLE ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES TABLE ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ PROJECTS TABLE ============
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_company TEXT,
  status project_status NOT NULL DEFAULT 'upcoming',
  priority project_priority NOT NULL DEFAULT 'medium',
  start_date DATE,
  deadline DATE,
  budget NUMERIC(12,2),
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- ============ PROJECT ASSIGNMENTS TABLE ============
CREATE TABLE public.project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  engineer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, engineer_id)
);
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- ============ DAILY UPDATES TABLE ============
CREATE TABLE public.daily_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  engineer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  percentage_complete INTEGER NOT NULL DEFAULT 0,
  blockers TEXT,
  hours_worked NUMERIC(5,2) NOT NULL DEFAULT 0,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_updates ENABLE ROW LEVEL SECURITY;

-- ============ DOCUMENTS TABLE ============
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  signature_url TEXT,
  approval_status approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ============ PROJECT STAKEHOLDERS TABLE ============
CREATE TABLE public.project_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_stakeholders ENABLE ROW LEVEL SECURITY;

-- ============ MILESTONES TABLE ============
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status milestone_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS ============

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Check if engineer is assigned to project
CREATE OR REPLACE FUNCTION public.is_assigned_to_project(_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_assignments
    WHERE project_id = _project_id AND engineer_id = auth.uid()
  )
$$;

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============ UPDATE TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ RLS POLICIES ============

-- user_roles: only admins can manage, users can read own
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin());

-- profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin() OR id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "System inserts profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- projects
CREATE POLICY "Admins can do anything with projects" ON public.projects FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Engineers can view assigned projects" ON public.projects FOR SELECT TO authenticated USING (public.is_assigned_to_project(id));

-- project_assignments
CREATE POLICY "Admins manage assignments" ON public.project_assignments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Engineers can view own assignments" ON public.project_assignments FOR SELECT TO authenticated USING (engineer_id = auth.uid());

-- daily_updates
CREATE POLICY "Admins can do anything with updates" ON public.daily_updates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Engineers can view updates for assigned projects" ON public.daily_updates FOR SELECT TO authenticated USING (public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can create updates for assigned projects" ON public.daily_updates FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_project(project_id) AND engineer_id = auth.uid());
CREATE POLICY "Engineers can update own updates" ON public.daily_updates FOR UPDATE TO authenticated USING (engineer_id = auth.uid() AND public.is_assigned_to_project(project_id));

-- documents
CREATE POLICY "Admins can do anything with documents" ON public.documents FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Engineers can view documents for assigned projects" ON public.documents FOR SELECT TO authenticated USING (public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can upload documents for assigned projects" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_project(project_id) AND uploaded_by = auth.uid());
CREATE POLICY "Engineers can update own pending documents" ON public.documents FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() AND approval_status = 'pending');

-- project_stakeholders
CREATE POLICY "Admins can do anything with stakeholders" ON public.project_stakeholders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Engineers can view stakeholders for assigned projects" ON public.project_stakeholders FOR SELECT TO authenticated USING (public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can manage stakeholders for assigned projects" ON public.project_stakeholders FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_project(project_id));

-- milestones
CREATE POLICY "Admins can do anything with milestones" ON public.milestones FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Engineers can view milestones for assigned projects" ON public.milestones FOR SELECT TO authenticated USING (public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can manage milestones for assigned projects" ON public.milestones FOR INSERT TO authenticated WITH CHECK (public.is_assigned_to_project(project_id));
CREATE POLICY "Engineers can update milestones for assigned projects" ON public.milestones FOR UPDATE TO authenticated USING (public.is_assigned_to_project(project_id));

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

CREATE POLICY "Authenticated users can upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Users can view documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Admins can delete documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND public.is_admin());
