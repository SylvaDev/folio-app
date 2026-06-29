-- ═══ LATE-MIGRATION HARDENING ═════════════════════════════════════════════
-- Addresses advisor findings introduced by migrations 006-008 once they
-- were applied to the live database.
--   1. rate_limits has RLS but no policy → add explicit deny-all
--   2. Avatar bucket SELECT policy lets clients LIST all avatars → drop it
--      (public URL access still works because bucket is public)
--   3. check_rate_limit was exposed via /rpc as SECURITY DEFINER → move
--      to an `internal` schema so it's no longer in the PostgREST surface
-- ═════════════════════════════════════════════════════════════════════════

-- ─── 1. Explicit deny-all on rate_limits ─────────────────────────────────
-- The table should never be accessed directly by clients — only via the
-- function (which is SECURITY DEFINER and bypasses RLS). Making the deny
-- explicit silences the advisor and prevents accidental future grants.
drop policy if exists "Block direct access" on public.rate_limits;
create policy "Block direct access"
  on public.rate_limits for all
  using (false)
  with check (false);

-- ─── 2. Drop the broad avatars-listing policy ─────────────────────────────
-- Public buckets serve files via /storage/v1/object/public/<path> without
-- any RLS check. The "Avatars are publicly readable" policy only enables
-- the Storage API's LIST endpoint, which exposes the directory structure
-- (effectively letting anyone enumerate every avatar). Dropping it is
-- strictly safer; direct URL fetches continue to work.
drop policy if exists "Avatars are publicly readable" on storage.objects;

-- ─── 3. Move check_rate_limit out of the public/PostgREST surface ────────
-- We move the function (not the table) to an `internal` schema so it's
-- no longer auto-exposed as /rest/v1/rpc/check_rate_limit. PostgreSQL
-- supabase-js can still call it via `.schema('internal').rpc(...)`.
create schema if not exists internal;
grant usage on schema internal to authenticated, anon;

-- Recreate the function in `internal`. We keep SECURITY DEFINER because
-- it needs to bypass the deny-all policy we just added to rate_limits.
create or replace function internal.check_rate_limit(
  p_bucket          text,
  p_max_count       integer,
  p_window_seconds  integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now           timestamptz := now();
  v_window_floor  timestamptz := v_now - make_interval(secs => p_window_seconds);
  v_minute_bucket timestamptz := date_trunc('minute', v_now);
  v_total         integer;
begin
  delete from public.rate_limits
  where bucket = p_bucket
    and window_start < v_window_floor;

  select coalesce(sum(count), 0) into v_total
  from public.rate_limits
  where bucket = p_bucket
    and window_start >= v_window_floor;

  if v_total >= p_max_count then
    return false;
  end if;

  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_minute_bucket, 1)
  on conflict (bucket, window_start) do update
    set count = public.rate_limits.count + 1;

  return true;
end;
$$;

grant execute on function internal.check_rate_limit(text, integer, integer)
  to authenticated, anon;

-- Drop the old public-schema function so it's no longer in PostgREST
drop function if exists public.check_rate_limit(text, integer, integer);
