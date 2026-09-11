-- Transitional cutover guard.
-- Keep the one pre-bound owner account usable while it is still anonymous,
-- but continue to reject every other anonymous account. Remove this exception
-- after the owner email identity is confirmed and anonymous sign-ins are disabled.

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

  if not found then
    raise insufficient_privilege using message = 'private app access denied';
  end if;

  if user_is_anonymous then
    if not exists (
      select 1
      from public.app_access a
      where a.enabled = true
        and a.role = 'owner'
        and a.user_id = new.user_id
    ) then
      raise insufficient_privilege using message = 'private app access denied';
    end if;
    return new;
  end if;

  if user_email is null then
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
