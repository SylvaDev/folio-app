-- ═══ ADVISOR HARDENING ════════════════════════════════════════════════════
-- Addresses everything actionable from the Supabase database advisors:
--   1. CRITICAL: user_reading_stats SECURITY DEFINER view → security_invoker
--   2. SECURITY BUG: book_club_reads + discussions tautological RLS
--   3. Revoke EXECUTE on trigger functions from anon/authenticated
--   4. Add search_path to remaining unhardened functions
--   5. Wrap auth.uid()/auth.role() in (select …) across all policies
--   6. Consolidate overlapping book_club_members policies
--   7. Add indexes for unindexed foreign keys
-- ═════════════════════════════════════════════════════════════════════════

-- ─── 1. CRITICAL: user_reading_stats view ────────────────────────────────
-- Without security_invoker the view ran as the owner (superuser), bypassing
-- RLS. Anyone calling it would see aggregate stats across ALL users.
alter view public.user_reading_stats set (security_invoker = on);

-- ─── 2. SECURITY BUG: book_club_reads + discussions tautology ────────────
-- The original policies had `m.club_id = m.club_id` which is always true.
-- Effect: any club member could see every club's reads + discussions, not
-- just the clubs they're actually members of. Fix the join condition.
drop policy if exists "Club members can see club reads" on public.book_club_reads;
create policy "Club members can see club reads"
  on public.book_club_reads for select
  using (
    exists (
      select 1 from public.book_club_members m
      where m.club_id = book_club_reads.club_id
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "Club members can view and post discussions" on public.discussions;
-- Split the "for all" policy into per-action ones so they don't conflict.
create policy "Club members can read discussions"
  on public.discussions for select
  using (
    exists (
      select 1 from public.book_club_members m
      where m.club_id = discussions.club_id
        and m.user_id = (select auth.uid())
    )
  );
create policy "Club members can post discussions"
  on public.discussions for insert
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.book_club_members m
      where m.club_id = discussions.club_id
        and m.user_id = (select auth.uid())
    )
  );
create policy "Users can edit their own discussions"
  on public.discussions for update
  using ((select auth.uid()) = user_id);
create policy "Users can delete their own discussions"
  on public.discussions for delete
  using ((select auth.uid()) = user_id);

-- ─── 3. Revoke EXECUTE on trigger functions ──────────────────────────────
-- These are TRIGGER functions, never meant to be called via /rpc. They use
-- SECURITY DEFINER so they can write to tables that the calling user can't
-- access directly. Triggers fire from inside the database, not via PostgREST,
-- so revoking EXECUTE doesn't break triggers.
--
-- IMPORTANT: revoke from PUBLIC, not just anon/authenticated. Postgres
-- grants EXECUTE on functions to PUBLIC by default, and authenticated roles
-- inherit from PUBLIC. Without revoking PUBLIC, the explicit revokes are
-- effectively no-ops.
revoke execute on function public.handle_new_user()                from public, anon, authenticated;
revoke execute on function public.write_user_book_activity()       from public, anon, authenticated;
revoke execute on function public.cleanup_user_book_activities()   from public, anon, authenticated;
revoke execute on function public.cleanup_activity_engagement()    from public, anon, authenticated;
revoke execute on function public.notify_on_like()                 from public, anon, authenticated;
revoke execute on function public.cleanup_like_notification()      from public, anon, authenticated;
revoke execute on function public.notify_on_comment()              from public, anon, authenticated;
revoke execute on function public.notify_on_follow()               from public, anon, authenticated;
revoke execute on function public.cleanup_follow_notification()    from public, anon, authenticated;

-- ─── 4. Harden remaining function search_paths ───────────────────────────
alter function public.set_updated_at()      set search_path = public;
alter function public.set_comment_edited()  set search_path = public;

-- ─── 5 + 6. Rewrite ALL public RLS policies with optimized (select auth.uid()) ──
-- and consolidate the overlapping book_club_members policies.
-- We drop + recreate every policy to use the subquery form. This is the
-- canonical fix per Supabase docs and gives meaningful perf gains at scale.

-- ─── profiles ──
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Profiles are publicly readable when public" on public.profiles;
create policy "Profiles are publicly readable when public"
  on public.profiles for select
  using (is_public = true or id = (select auth.uid()));
create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);
create policy "Users can insert own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

-- ─── books ──
drop policy if exists "Authenticated users can insert books" on public.books;
drop policy if exists "Authenticated users can update books" on public.books;
create policy "Authenticated users can insert books"
  on public.books for insert
  with check ((select auth.role()) = 'authenticated');
create policy "Authenticated users can update books"
  on public.books for update
  using ((select auth.role()) = 'authenticated');

-- ─── series ──
drop policy if exists "Authenticated users can insert series" on public.series;
create policy "Authenticated users can insert series"
  on public.series for insert
  with check ((select auth.role()) = 'authenticated');

-- ─── user_books ──
drop policy if exists "Users can manage their own books" on public.user_books;
drop policy if exists "Public reviews are readable" on public.user_books;
drop policy if exists "Books on public profiles are readable" on public.user_books;
create policy "Users can manage their own books"
  on public.user_books for all
  using ((select auth.uid()) = user_id);
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
create policy "Books on public profiles are readable"
  on public.user_books for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = user_books.user_id and p.is_public = true
    )
  );

-- ─── shelves + shelf_books ──
drop policy if exists "Users can manage their own shelves" on public.shelves;
create policy "Users can manage their own shelves"
  on public.shelves for all
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their shelf books" on public.shelf_books;
create policy "Users can manage their shelf books"
  on public.shelf_books for all
  using (
    exists (
      select 1 from public.shelves s
      where s.id = shelf_books.shelf_id and s.user_id = (select auth.uid())
    )
  );

-- ─── reading_sessions + user_series_progress ──
drop policy if exists "Users can manage their reading sessions" on public.reading_sessions;
create policy "Users can manage their reading sessions"
  on public.reading_sessions for all
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their series progress" on public.user_series_progress;
create policy "Users can manage their series progress"
  on public.user_series_progress for all
  using ((select auth.uid()) = user_id);

-- ─── book_clubs ──
drop policy if exists "Owners can manage their clubs" on public.book_clubs;
drop policy if exists "Public clubs are readable by all" on public.book_clubs;
create policy "Owners can manage their clubs"
  on public.book_clubs for all
  using ((select auth.uid()) = owner_id);
create policy "Public clubs are readable by all"
  on public.book_clubs for select
  using (
    is_public = true
    or owner_id = (select auth.uid())
    or exists (
      select 1 from public.book_club_members m
      where m.club_id = book_clubs.id and m.user_id = (select auth.uid())
    )
  );

-- ─── book_club_members (consolidated to remove overlapping policies) ──
drop policy if exists "Club owners can manage members" on public.book_club_members;
drop policy if exists "Members can see their own memberships" on public.book_club_members;
drop policy if exists "Users can leave clubs" on public.book_club_members;

-- Single SELECT policy: you can see memberships if it's yours OR you own the club
create policy "Visible memberships"
  on public.book_club_members for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.book_clubs c
      where c.id = book_club_members.club_id
        and c.owner_id = (select auth.uid())
    )
  );

-- Single DELETE policy: you can leave OR owner can kick
create policy "Removable memberships"
  on public.book_club_members for delete
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.book_clubs c
      where c.id = book_club_members.club_id
        and c.owner_id = (select auth.uid())
    )
  );

-- INSERT/UPDATE: owner-only
create policy "Owners can add members"
  on public.book_club_members for insert
  with check (
    exists (
      select 1 from public.book_clubs c
      where c.id = book_club_members.club_id
        and c.owner_id = (select auth.uid())
    )
  );
create policy "Owners can change member roles"
  on public.book_club_members for update
  using (
    exists (
      select 1 from public.book_clubs c
      where c.id = book_club_members.club_id
        and c.owner_id = (select auth.uid())
    )
  );

-- ─── activities ──
drop policy if exists "Activities readable based on profile visibility" on public.activities;
drop policy if exists "Users can create their own activities" on public.activities;
drop policy if exists "Users can delete their own activities" on public.activities;
create policy "Activities readable based on profile visibility"
  on public.activities for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = activities.user_id and p.is_public = true
    )
  );
create policy "Users can create their own activities"
  on public.activities for insert
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own activities"
  on public.activities for delete
  using ((select auth.uid()) = user_id);

-- ─── likes ──
drop policy if exists "Users can create their own likes" on public.likes;
drop policy if exists "Users can delete their own likes" on public.likes;
create policy "Users can create their own likes"
  on public.likes for insert
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own likes"
  on public.likes for delete
  using ((select auth.uid()) = user_id);

-- ─── comments ──
drop policy if exists "Users can create their own comments" on public.comments;
drop policy if exists "Users can update their own comments" on public.comments;
drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can create their own comments"
  on public.comments for insert
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own comments"
  on public.comments for update
  using ((select auth.uid()) = user_id);
create policy "Users can delete their own comments"
  on public.comments for delete
  using ((select auth.uid()) = user_id);

-- ─── follows ──
drop policy if exists "Users can create their own follows" on public.follows;
drop policy if exists "Users can delete their own follows" on public.follows;
create policy "Users can create their own follows"
  on public.follows for insert
  with check ((select auth.uid()) = follower_id);
create policy "Users can delete their own follows"
  on public.follows for delete
  using ((select auth.uid()) = follower_id);

-- ─── notifications ──
drop policy if exists "Users see their own notifications" on public.notifications;
drop policy if exists "Users can mark their own notifications read" on public.notifications;
drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users see their own notifications"
  on public.notifications for select
  using (user_id = (select auth.uid()));
create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (user_id = (select auth.uid()));
create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (user_id = (select auth.uid()));

-- ─── 7. Add indexes for unindexed foreign keys ───────────────────────────
-- These FKs lacked covering indexes, slowing cascade ops + joins.
create index if not exists book_club_members_user_idx     on public.book_club_members (user_id);
create index if not exists book_club_reads_book_idx       on public.book_club_reads (book_id);
create index if not exists book_club_reads_club_idx       on public.book_club_reads (club_id);
create index if not exists series_books_book_idx          on public.series_books (book_id);
create index if not exists discussions_user_idx           on public.discussions (user_id);
create index if not exists discussions_parent_idx_v2      on public.discussions (parent_id) where parent_id is not null;
create index if not exists discussions_club_read_idx      on public.discussions (club_read_id) where club_read_id is not null;
create index if not exists reading_sessions_user_book_idx on public.reading_sessions (user_book_id);
create index if not exists shelf_books_user_book_idx      on public.shelf_books (user_book_id);
create index if not exists books_series_idx               on public.books (series_id) where series_id is not null;
create index if not exists user_series_progress_series_idx on public.user_series_progress (series_id);
