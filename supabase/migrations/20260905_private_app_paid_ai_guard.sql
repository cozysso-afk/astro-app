-- Phase 2: fail-closed paid-AI guard.
-- Apply only after public.app_access contains at least one enabled owner.

do $$
begin
  if not exists (
    select 1 from public.app_access where enabled = true and role = 'owner'
  ) then
    raise exception 'private app owner must be seeded before enabling paid AI guard';
  end if;
end
$$;

-- AI Edge Functions use the service role for ai_interpret_jobs, so RLS alone cannot
-- prevent an authenticated-but-unapproved account from starting a paid Gemini job.
-- This trigger executes even for service-role inserts and rejects anonymous/unapproved users.
create or replace function public.enforce_private_app_ai_job_access()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  user_email text;
  user_is_anonymous boolean;
begin
  select lower(u.email), coalesce(u.is_anonymous, false)
    into user_email, user_is_anonymous
  from auth.users u
  where u.id = new.user_id;

  if user_email is null or user_is_anonymous then
    raise insufficient_privilege using message = 'private app access denied';
  end if;

  if not exists (
    select 1
    from public.app_access a
    where a.email = user_email
      and a.enabled = true
  ) then
    raise insufficient_privilege using message = 'private app access denied';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_private_app_ai_job_access() from public;

drop trigger if exists enforce_private_app_ai_job_access on public.ai_interpret_jobs;
create trigger enforce_private_app_ai_job_access
before insert on public.ai_interpret_jobs
for each row
execute function public.enforce_private_app_ai_job_access();
