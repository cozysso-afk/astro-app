-- Private app access control.
-- Seed allowed emails separately after choosing the owner address.

create table if not exists public.app_access (
  email text primary key,
  enabled boolean not null default true,
  role text not null default 'member' check (role in ('owner', 'member')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_access_email_normalized check (email = lower(btrim(email)) and position('@' in email) > 1)
);

alter table public.app_access enable row level security;

revoke all on table public.app_access from anon;
revoke all on table public.app_access from authenticated;
grant select on table public.app_access to authenticated;

drop policy if exists "app_access_read_own_enabled_email" on public.app_access;
create policy "app_access_read_own_enabled_email"
on public.app_access
for select
to authenticated
using (
  enabled = true
  and email = lower(coalesce(auth.jwt() ->> 'email', ''))
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
);

-- AI Edge Functions use the service role for ai_interpret_jobs, so RLS alone cannot
-- prevent an authenticated-but-unapproved account from starting a paid Gemini job.
-- This trigger is intentionally fail-closed and executes even for service-role inserts.
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

-- Example owner seed (DO NOT COMMIT A REAL EMAIL):
-- insert into public.app_access(email, role) values ('owner@example.com', 'owner')
-- on conflict (email) do update set enabled = true, role = excluded.role, updated_at = now();
