-- Browser job access must go through the Edge public-response boundary.
-- Keep historical rows and service_role grants intact; RLS remains enabled.
REVOKE ALL ON TABLE public.ai_interpret_jobs FROM anon, authenticated;
DROP POLICY IF EXISTS ai_interpret_jobs_select_own ON public.ai_interpret_jobs;
