-- ═══ BETA ACCESS FLAG ════════════════════════════════════════════════════
-- Adds explicit beta-cohort participation to profiles. Beta status is
-- evaluated as: (deterministic 5% bucket) OR (manual opt-in). The bucket
-- is computed in application code from the user_id, not stored here.
-- ═════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists beta_access boolean not null default false;

-- Audit log: who opted in/out and when. Useful for debugging "why did
-- this user see/not see the new feature" later. Optional rows; the boolean
-- above is the source of truth.
create table if not exists public.beta_access_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  enabled    boolean not null,
  reason     text,                          -- 'self-opt-in', 'manual-grant', 'bucket-promotion'
  created_at timestamptz not null default now()
);

create index if not exists beta_access_log_user_idx
  on public.beta_access_log (user_id, created_at desc);

alter table public.beta_access_log enable row level security;

drop policy if exists "Users can read their own beta log" on public.beta_access_log;
create policy "Users can read their own beta log"
  on public.beta_access_log for select
  using (user_id = auth.uid());

drop policy if exists "Users can write their own beta log" on public.beta_access_log;
create policy "Users can write their own beta log"
  on public.beta_access_log for insert
  with check (user_id = auth.uid());
