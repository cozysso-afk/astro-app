create table if not exists public.ai_interpret_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'fortune',
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  model text,
  fallback_from text,
  result_json jsonb,
  usage_json jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_interpret_jobs_user_created_idx
  on public.ai_interpret_jobs(user_id, created_at desc);

alter table public.ai_interpret_jobs enable row level security;

drop policy if exists ai_interpret_jobs_select_own on public.ai_interpret_jobs;
create policy ai_interpret_jobs_select_own on public.ai_interpret_jobs
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.ai_interpret_jobs from anon;
grant select on public.ai_interpret_jobs to authenticated;
