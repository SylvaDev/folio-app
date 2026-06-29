-- ═══ SOCIAL ENGAGEMENT ════════════════════════════════════════════════════
-- Sprint 2 of social: follows, activity feed, likes, comments.
-- Builds on 002_social_foundation.sql (which added public profiles + reviews).
--
-- Design notes:
--   - Activity visibility is determined at read-time by joining to profiles.is_public.
--     If a user toggles their profile private, their activity feed presence
--     disappears instantly without any batch update.
--   - Likes and comments are polymorphic: target_type='activity'|'review' +
--     target_id. One table per feature would explode later as we add more
--     likeable surfaces.
--   - Comments support a single level of replies via parent_id. No infinite
--     nesting — Reddit-style threading is a moderation nightmare and overkill
--     for our MVP.
--   - No denormalized counts. count(*) with indexes is fast enough at our
--     scale. Add likes_count / comments_count + triggers later if needed.
-- ═════════════════════════════════════════════════════════════════════════

-- ─── FOLLOWS ──────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  -- Prevent self-follows at the DB level
  check (follower_id != followed_id)
);

create index if not exists follows_follower_idx
  on public.follows (follower_id, created_at desc);
create index if not exists follows_followed_idx
  on public.follows (followed_id, created_at desc);

alter table public.follows enable row level security;

-- Follows are publicly readable so we can show counts and lists.
-- The graph being public is intentional (Twitter/Letterboxd model).
drop policy if exists "Follows are publicly readable" on public.follows;
create policy "Follows are publicly readable"
  on public.follows for select
  using (true);

drop policy if exists "Users can create their own follows" on public.follows;
create policy "Users can create their own follows"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Users can delete their own follows" on public.follows;
create policy "Users can delete their own follows"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ─── ACTIVITIES ───────────────────────────────────────────────────────────
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in (
                 'started_book',
                 'finished_book',
                 'rated_book',
                 'reviewed_book',
                 'added_to_tbr'
               )),
  -- Polymorphic target. For book-related activities, target_type='user_book'
  -- and target_id is the user_books.id. We resolve to the book via JOIN.
  target_type  text not null check (target_type in ('user_book', 'review', 'book')),
  target_id    uuid not null,
  -- Free-form metadata: e.g. { rating: 5, prev_status: 'tbr' }
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists activities_user_created_idx
  on public.activities (user_id, created_at desc);
create index if not exists activities_created_idx
  on public.activities (created_at desc);
create index if not exists activities_target_idx
  on public.activities (target_type, target_id);

alter table public.activities enable row level security;

-- Read access: you can see your own activities always, plus public-profile
-- activities from anyone. The feed API filters by "followed users" on top.
drop policy if exists "Activities readable based on profile visibility" on public.activities;
create policy "Activities readable based on profile visibility"
  on public.activities for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = activities.user_id and p.is_public = true
    )
  );

drop policy if exists "Users can create their own activities" on public.activities;
create policy "Users can create their own activities"
  on public.activities for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own activities" on public.activities;
create policy "Users can delete their own activities"
  on public.activities for delete
  using (auth.uid() = user_id);

-- ─── LIKES ────────────────────────────────────────────────────────────────
create table if not exists public.likes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('activity', 'review')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  -- Composite PK prevents double-likes at the DB level
  primary key (user_id, target_type, target_id)
);

create index if not exists likes_target_idx
  on public.likes (target_type, target_id);
create index if not exists likes_user_idx
  on public.likes (user_id, created_at desc);

alter table public.likes enable row level security;

-- Likes are publicly readable so we can show counts and "X people liked this"
drop policy if exists "Likes are publicly readable" on public.likes;
create policy "Likes are publicly readable"
  on public.likes for select
  using (true);

drop policy if exists "Users can create their own likes" on public.likes;
create policy "Users can create their own likes"
  on public.likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own likes" on public.likes;
create policy "Users can delete their own likes"
  on public.likes for delete
  using (auth.uid() = user_id);

-- ─── COMMENTS ─────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('activity', 'review')),
  target_id   uuid not null,
  content     text not null check (char_length(trim(content)) between 1 and 2000),
  -- Single-level threading. NULL = top-level comment.
  parent_id   uuid references public.comments(id) on delete cascade,
  edited      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists comments_target_idx
  on public.comments (target_type, target_id, created_at desc);
create index if not exists comments_parent_idx
  on public.comments (parent_id) where parent_id is not null;
create index if not exists comments_user_idx
  on public.comments (user_id, created_at desc);

alter table public.comments enable row level security;

drop policy if exists "Comments are publicly readable" on public.comments;
create policy "Comments are publicly readable"
  on public.comments for select
  using (true);

drop policy if exists "Users can create their own comments" on public.comments;
create policy "Users can create their own comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
  on public.comments for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

-- Updated_at trigger — set `edited = true` on update, refresh timestamp
create or replace function public.set_comment_edited()
returns trigger language plpgsql as $$
begin
  -- Skip if only updated_at changed (e.g. system reflow). Detect via content delta.
  if new.content is distinct from old.content then
    new.edited = true;
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists comments_set_edited on public.comments;
create trigger comments_set_edited before update on public.comments
  for each row execute procedure public.set_comment_edited();

-- ─── FEED-FRIENDLY VIEW (optional, simplifies API queries) ────────────────
-- A denormalized view that joins activities with the actor's profile data
-- so the feed API doesn't need to do a separate profile fetch per row.
--
-- CRITICAL: `with (security_invoker = on)` makes the view honor the calling
-- user's RLS policies on the underlying tables. Without it, the view would
-- run as its creator (postgres) and bypass RLS — a privacy leak.
create or replace view public.activity_feed
with (security_invoker = on) as
select
  a.id,
  a.user_id,
  a.type,
  a.target_type,
  a.target_id,
  a.metadata,
  a.created_at,
  p.username      as actor_username,
  p.display_name  as actor_display_name,
  p.avatar_url    as actor_avatar_url,
  p.is_public     as actor_is_public
from public.activities a
join public.profiles p on p.id = a.user_id;

grant select on public.activity_feed to authenticated, anon;
