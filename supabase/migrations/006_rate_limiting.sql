-- ═══ RATE LIMITING ════════════════════════════════════════════════════════
-- Lightweight sliding-window rate limiter. Stores one row per (bucket,
-- minute-window) and increments on each hit. Old windows are pruned
-- automatically as they fall outside any active limit window.
--
-- We deliberately avoid an external service (Upstash, Redis) for MVP.
-- A single Postgres function call is atomic and good enough at our scale.
-- Worst case: ~100 rate-check writes/sec on a $25 Supabase instance.
-- ═════════════════════════════════════════════════════════════════════════

create table if not exists public.rate_limits (
  bucket       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, window_start)
);

create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);

-- We don't expose this table to clients. Writes happen via the function
-- (which uses security definer). No RLS policies means the table is
-- inaccessible to anon/authenticated users by default.
alter table public.rate_limits enable row level security;

-- ─── check_rate_limit ─────────────────────────────────────────────────────
-- Returns true if the request is allowed, false if rate-limited.
-- Bucket is a freeform string, typically "user_id:action" or "ip:action".
-- max_count is the maximum hits within window_seconds.
--
-- Atomic via a single transaction. Garbage-collects rows older than the
-- current window before counting, so the table doesn't grow unbounded.
create or replace function public.check_rate_limit(
  p_bucket          text,
  p_max_count       integer,
  p_window_seconds  integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now        timestamptz := now();
  v_window_floor timestamptz := v_now - make_interval(secs => p_window_seconds);
  v_minute_bucket timestamptz := date_trunc('minute', v_now);
  v_total      integer;
begin
  -- Prune stale rows for this bucket so the table doesn't grow.
  delete from public.rate_limits
  where bucket = p_bucket
    and window_start < v_window_floor;

  -- Count hits in the active window.
  select coalesce(sum(count), 0) into v_total
  from public.rate_limits
  where bucket = p_bucket
    and window_start >= v_window_floor;

  if v_total >= p_max_count then
    return false;
  end if;

  -- Increment the per-minute counter for this bucket.
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_minute_bucket, 1)
  on conflict (bucket, window_start) do update
    set count = public.rate_limits.count + 1;

  return true;
end;
$$;

-- Allow the function to be called from API routes (which use the
-- authenticated role). Security definer means the function bypasses RLS
-- on the table, but only allowed operations are performed.
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated, anon;
