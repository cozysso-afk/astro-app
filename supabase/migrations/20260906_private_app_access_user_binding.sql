-- Bind private-app access rows to Supabase Auth user IDs when available.
-- This makes the owner cutover fail closed if an email confirmation unexpectedly
-- lands on a different Auth user than the anonymous account that owns the archive.

alter table public.app_access
  add column if not exists user_id uuid references auth.users(id) on delete restrict;

create unique index if not exists app_access_user_id_unique
  on public.app_access(user_id)
  where user_id is not null;

-- Replace the original policy so a bound row is visible only to that exact user ID.
drop policy if exists "app_access_read_own_enabled_email" on public.app_access;
create policy "app_access_read_own_enabled_email"
on public.app_access
for select
to authenticated
using (
  enabled = true
  and email = lower(coalesce(auth.jwt() ->> 'email', ''))
  and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
  and (user_id is null or user_id = auth.uid())
);

-- Tighten the paid-AI trigger as well. Unbound member rows remain supported for
-- admin provisioning, but once user_id is bound it must match the job owner.
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
      and (a.user_id is null or a.user_id = new.user_id)
  ) then
    raise insufficient_privilege using message = 'private app access denied';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_private_app_ai_job_access() from public;
revoke execute on function public.enforce_private_app_ai_job_access() from anon, authenticated;
grant execute on function public.enforce_private_app_ai_job_access() to service_role;
