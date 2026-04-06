
CREATE TABLE public.faq_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'support_implementation',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  updated_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT faq_category_check CHECK (category IN ('support_implementation', 'sales'))
);

ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read published FAQs
CREATE POLICY "Authenticated can view published FAQs"
ON public.faq_items FOR SELECT TO authenticated
USING (is_published = true);

-- Super admin full access
CREATE POLICY "Super admin full access on faq_items"
ON public.faq_items FOR ALL TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Support managers can manage support_implementation FAQs
CREATE POLICY "Support manager manages support FAQs"
ON public.faq_items FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['support_manager'::text]) AND category = 'support_implementation')
WITH CHECK (has_any_role(auth.uid(), ARRAY['support_manager'::text]) AND category = 'support_implementation');

-- Engineers can manage support_implementation FAQs
CREATE POLICY "Engineers manage support FAQs"
ON public.faq_items FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['engineer'::text]) AND category = 'support_implementation')
WITH CHECK (has_any_role(auth.uid(), ARRAY['engineer'::text]) AND category = 'support_implementation');

-- Sales managers can manage sales FAQs
CREATE POLICY "Sales manager manages sales FAQs"
ON public.faq_items FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['sales_manager'::text]) AND category = 'sales')
WITH CHECK (has_any_role(auth.uid(), ARRAY['sales_manager'::text]) AND category = 'sales');

-- Trigger for updated_at
CREATE TRIGGER update_faq_items_updated_at
BEFORE UPDATE ON public.faq_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
