-- Async speaking score job storage (Phase 2)
-- Run this in Supabase Studio → SQL Editor once, then add SUPABASE_SERVICE_ROLE_KEY
-- to Netlify env vars (Site settings → Environment variables → Add variable).
--
-- Security model: jobs are accessed only via Netlify functions using the
-- service-role key, which bypasses RLS. The client never queries score_jobs
-- directly — it only knows the random uuid jobId returned by /start, which is
-- treated as a capability token (122 bits of entropy).

create table if not exists public.score_jobs (
  id uuid primary key,
  client_user_id text not null default 'local-student',
  user_id uuid null,
  status text not null default 'queued',
  progress text null,
  result jsonb null,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists score_jobs_user_idx
  on public.score_jobs (client_user_id, created_at desc);

-- Lock the table down: only the service_role (used by Netlify functions) can
-- read/write. anon and authenticated roles get no direct access.
alter table public.score_jobs enable row level security;
revoke all on public.score_jobs from anon;
revoke all on public.score_jobs from authenticated;
grant all on public.score_jobs to service_role;

-- Optional: auto-clean rows older than 7 days. Uncomment if you have pg_cron.
-- select cron.schedule(
--   'score_jobs_cleanup',
--   '0 3 * * *',
--   $$delete from public.score_jobs where updated_at < now() - interval '7 days'$$
-- );
