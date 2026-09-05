-- Phase 1: private app access table + self-read RLS.
-- Seed allowed emails separately after choosing the owner address.
-- The paid-AI enforcement trigger is intentionally installed by the second migration
-- only after at least one owner row has been seeded.

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

-- Example owner seed (DO NOT COMMIT A REAL EMAIL):
-- insert into public.app_access(email, role) values ('owner@example.com', 'owner')
-- on conflict (email) do update set enabled = true, role = excluded.role, updated_at = now();
