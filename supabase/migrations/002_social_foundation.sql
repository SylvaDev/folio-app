-- ═══ SOCIAL FOUNDATION ═══════════════════════════════════════════════════
-- Adds the minimum schema needed for public profiles, usernames, and the
-- "share this book" feature. Follows / likes / comments / activities land
-- in a later migration (003_social_engagement.sql).
-- ═════════════════════════════════════════════════════════════════════════

-- ─── PROFILE EXTENSIONS ──────────────────────────────────────────────────
alter table public.profiles
  add column if not exists is_public boolean not null default true;

-- Clean up any pre-existing usernames that don't conform to the new format
-- (uppercase, spaces, dots, underscores, too short/long, etc.).
-- Affected users will be re-prompted via the onboarding flow on next page load.
update public.profiles
set username = null
where username is not null
  and username !~ '^[a-z0-9][a-z0-9-]{2,29}$';

-- Username must be 3-30 chars, lowercase alphanumerics + dashes, start with alphanum.
-- Allowing NULL until the user completes username onboarding.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_format'
  ) then
    alter table public.profiles
      add constraint profiles_username_format check (
        username is null or username ~ '^[a-z0-9][a-z0-9-]{2,29}$'
      );
  end if;
end $$;

-- Replace the owner-only SELECT policy with one that respects is_public
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Profiles are publicly readable when public"
  on public.profiles for select
  using (is_public = true or id = auth.uid());

-- Case-insensitive username lookups (for /u/[username] route)
create index if not exists profiles_username_lower
  on public.profiles (lower(username))
  where username is not null;

-- ─── USER_BOOKS EXTENSIONS ───────────────────────────────────────────────
alter table public.user_books
  add column if not exists review_is_public boolean not null default true;

-- Public reviews readable by anyone (additive to the existing owner-can-manage policy).
-- Postgres RLS OR's policies together, so the owner can still do everything;
-- this only ADDS the ability for non-owners to SELECT public reviews.
drop policy if exists "Public reviews are readable" on public.user_books;
create policy "Public reviews are readable"
  on public.user_books for select
  using (
    review is not null
    and review_is_public = true
    and exists (
      select 1 from public.profiles p
      where p.id = user_books.user_id and p.is_public = true
    )
  );

-- Public read of any user_book record on a public profile (needed for "currently
-- reading" / "recently finished" lists on profiles, even if no review yet).
drop policy if exists "Books on public profiles are readable" on public.user_books;
create policy "Books on public profiles are readable"
  on public.user_books for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_books.user_id and p.is_public = true
    )
  );

-- Index for "recently finished" / "currently reading" queries on profiles
create index if not exists user_books_status_finished
  on public.user_books (user_id, status, date_finished desc);
