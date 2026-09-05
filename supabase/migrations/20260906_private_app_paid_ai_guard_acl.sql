-- Follow-up hardening for the paid-AI trigger function.
-- Supabase may retain explicit EXECUTE grants for exposed API roles even after
-- revoking PUBLIC, so revoke those roles explicitly as well.

revoke execute on function public.enforce_private_app_ai_job_access() from public;
revoke execute on function public.enforce_private_app_ai_job_access() from anon;
revoke execute on function public.enforce_private_app_ai_job_access() from authenticated;
