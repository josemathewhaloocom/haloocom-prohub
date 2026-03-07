
-- Sales Manager can update documents (to approve sales docs)
CREATE POLICY "Sales Manager can update documents"
ON public.documents FOR UPDATE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['sales_manager'::text]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['sales_manager'::text]));
