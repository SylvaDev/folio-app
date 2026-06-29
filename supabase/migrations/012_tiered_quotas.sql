-- ═══ TIERED QUOTAS ════════════════════════════════════════════════════════
-- Two functions on top of the existing rate_limits table:
--   internal.consume_quota   — atomic check + increment + return status
--   internal.peek_quota      — read-only status (used by UI to show remaining)
--
-- Caller sets the limit + window based on the user's subscription tier.
-- That keeps tier policy in the application layer where it's easy to tune,
-- while the database handles atomicity.
--
-- Sliding window (not calendar-day): a user's quota refreshes gradually
-- as old hits age out. Avoids the "blew my whole week on Monday" cliff and
-- the "wait until midnight to game it" edge.
-- ═════════════════════════════════════════════════════════════════════════

-- ─── consume_quota ───────────────────────────────────────────────────────
create or replace function internal.consume_quota(
  p_bucket          text,
  p_limit           integer,
  p_window_seconds  integer
) returns table(
  allowed    boolean,
  used       integer,
  remaining  integer,
  "limit"    integer,
  resets_at  timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now           timestamptz := now();
  v_window_floor  timestamptz := v_now - make_interval(secs => p_window_seconds);
  v_minute_bucket timestamptz := date_trunc('minute', v_now);
  v_total         integer;
  v_oldest        timestamptz;
begin
  -- GC stale rows
  delete from public.rate_limits
  where bucket = p_bucket
    and window_start < v_window_floor;

  -- Count active hits + find when the oldest one ages out
  select coalesce(sum(count), 0), min(window_start)
    into v_total, v_oldest
  from public.rate_limits
  where bucket = p_bucket
    and window_start >= v_window_floor;

  if v_total >= p_limit then
    return query select
      false                                              as allowed,
      v_total                                            as used,
      0                                                  as remaining,
      p_limit                                            as "limit",
      coalesce(v_oldest, v_now) + make_interval(secs => p_window_seconds) as resets_at;
    return;
  end if;

  -- Consume one
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_minute_bucket, 1)
  on conflict (bucket, window_start) do update
    set count = public.rate_limits.count + 1;

  return query select
    true                                                 as allowed,
    (v_total + 1)                                        as used,
    (p_limit - v_total - 1)                              as remaining,
    p_limit                                              as "limit",
    coalesce(v_oldest, v_now) + make_interval(secs => p_window_seconds) as resets_at;
end;
$$;

grant execute on function internal.consume_quota(text, integer, integer)
  to authenticated, anon;

-- ─── peek_quota ──────────────────────────────────────────────────────────
-- Read-only: returns current status without incrementing. Used by UI to
-- display "X recommendations left" before the user even clicks.
create or replace function internal.peek_quota(
  p_bucket          text,
  p_limit           integer,
  p_window_seconds  integer
) returns table(
  used       integer,
  remaining  integer,
  "limit"    integer,
  resets_at  timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now           timestamptz := now();
  v_window_floor  timestamptz := v_now - make_interval(secs => p_window_seconds);
  v_total         integer;
  v_oldest        timestamptz;
begin
  select coalesce(sum(count), 0), min(window_start)
    into v_total, v_oldest
  from public.rate_limits
  where bucket = p_bucket
    and window_start >= v_window_floor;

  return query select
    v_total                                              as used,
    greatest(p_limit - v_total, 0)                       as remaining,
    p_limit                                              as "limit",
    coalesce(v_oldest, v_now) + make_interval(secs => p_window_seconds) as resets_at;
end;
$$;

grant execute on function internal.peek_quota(text, integer, integer)
  to authenticated, anon;
