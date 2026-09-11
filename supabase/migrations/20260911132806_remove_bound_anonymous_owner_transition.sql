-- Final private-auth cutover cleanup.
-- Remove the temporary exception that allowed the pre-bound owner to start paid AI
-- jobs while still anonymous. The owner must now be a permanent email identity.

do $$
declare
  active_owner_count integer;
  permanent_owner_count integer;
begin
  select
    count(*),
    count(*) filter (
      where u.id is not null
        and coalesce(u.is_anonymous, true) = false
        and u.email is not null
        and lower(u.email) = lower(a.email)
    )
    into active_owner_count, permanent_owner_count
  from public.app_access a
  left join auth.users u on u.id = a.user_id
  where a.enabled = true
    and a.role = 'owner'
    and a.user_id is not null;

  if active_owner_count <> 1 or permanent_owner_count <> 1 then
    raise exception 'bound private app owner must be a confirmed permanent email user before cleanup';
  end if;
end
$$;

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
