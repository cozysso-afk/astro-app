create or replace view public.archive_index_v1
with (security_invoker = true) as
select
  id,
  user_id,
  'readings'::text as source_table,
  reading_type,
  period_start,
  period_end,
  engine_version,
  summary,
  created_at,
  calculation_json->>'local_id' as local_id,
  calculation_json->>'period_key' as period_key,
  coalesce(calculation_json->'request', '{}'::jsonb) as request_json,
  (interpretation_json is not null) as has_interpretation
from public.readings
where calculation_json->>'archive_v' = '1'
union all
select
  id,
  user_id,
  'relationship_readings'::text as source_table,
  reading_type,
  period_start,
  period_end,
  engine_version,
  summary,
  created_at,
  calculation_json->>'local_id' as local_id,
  calculation_json->>'period_key' as period_key,
  coalesce(calculation_json->'request', '{}'::jsonb) as request_json,
  (interpretation_json is not null) as has_interpretation
from public.relationship_readings
where calculation_json->>'archive_v' = '1';

grant select on public.archive_index_v1 to authenticated;
