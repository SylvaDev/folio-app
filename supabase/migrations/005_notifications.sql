-- ═══ NOTIFICATIONS ═══════════════════════════════════════════════════════
-- Tracks events that need to surface to a specific user, e.g.:
--   - Someone liked one of your activities
--   - Someone commented on one of your activities
--   - Someone replied to your comment
--   - Someone followed you
--
-- Triggers handle writes automatically when likes/comments/follows insert.
-- Self-actions (you liking your own activity) do not create a notification.
-- ═════════════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  -- Recipient: whose inbox does this land in
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- Actor: who caused it (may be null for system notifications later)
  actor_id     uuid references auth.users(id) on delete cascade,
  type         text not null check (type in ('like', 'comment', 'reply', 'follow')),
  -- Polymorphic context — the thing being interacted with
  target_type  text check (target_type in ('activity', 'comment')),
  target_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- Hot path: unread badge query
create index if not exists notifications_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

-- Full list query
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Only the recipient can read their own notifications
drop policy if exists "Users see their own notifications" on public.notifications;
create policy "Users see their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

-- Only the recipient can update (mark as read) their own
drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (user_id = auth.uid());

-- Only the recipient can delete their own
drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (user_id = auth.uid());

-- Writes happen via triggers (security definer), not via direct INSERT.
-- We intentionally do NOT add an INSERT policy — only triggers can write.

-- ─── TRIGGER: like on an activity → notify the activity owner ─────────────
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_target_user_id uuid;
begin
  -- Only handle activity likes for now; review likes will join through user_books
  if new.target_type = 'activity' then
    select user_id into v_target_user_id
      from public.activities where id = new.target_id;
  elsif new.target_type = 'review' then
    select user_id into v_target_user_id
      from public.user_books where id = new.target_id;
  end if;

  -- Don't notify self
  if v_target_user_id is not null and v_target_user_id != new.user_id then
    insert into public.notifications (user_id, actor_id, type, target_type, target_id)
    values (v_target_user_id, new.user_id, 'like', new.target_type, new.target_id);
  end if;

  return new;
end;
$$;

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify
  after insert on public.likes
  for each row execute procedure public.notify_on_like();

-- When a like is deleted, also remove the notification (so an unlike then
-- re-like doesn't pile up duplicate notifications). Otherwise unread badges
-- could get inflated.
create or replace function public.cleanup_like_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
  where actor_id = old.user_id
    and type = 'like'
    and target_type = old.target_type
    and target_id = old.target_id;
  return old;
end;
$$;

drop trigger if exists likes_cleanup_notification on public.likes;
create trigger likes_cleanup_notification
  after delete on public.likes
  for each row execute procedure public.cleanup_like_notification();

-- ─── TRIGGER: comment → notify activity owner + replied-to comment author ─
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_target_user_id uuid;
  v_parent_user_id uuid;
begin
  -- Resolve the activity/review owner
  if new.target_type = 'activity' then
    select user_id into v_target_user_id
      from public.activities where id = new.target_id;
  elsif new.target_type = 'review' then
    select user_id into v_target_user_id
      from public.user_books where id = new.target_id;
  end if;

  -- Notify the target owner (a 'comment' notification)
  if v_target_user_id is not null and v_target_user_id != new.user_id then
    insert into public.notifications (user_id, actor_id, type, target_type, target_id, metadata)
    values (
      v_target_user_id, new.user_id, 'comment',
      new.target_type, new.target_id,
      jsonb_build_object('comment_id', new.id)
    );
  end if;

  -- If this is a reply, also notify the parent comment author (a 'reply' notification)
  if new.parent_id is not null then
    select user_id into v_parent_user_id
      from public.comments where id = new.parent_id;
    -- Skip if it's the same person we already notified, or self
    if v_parent_user_id is not null
       and v_parent_user_id != new.user_id
       and v_parent_user_id != coalesce(v_target_user_id, '00000000-0000-0000-0000-000000000000'::uuid) then
      insert into public.notifications (user_id, actor_id, type, target_type, target_id, metadata)
      values (
        v_parent_user_id, new.user_id, 'reply',
        'comment', new.parent_id,
        jsonb_build_object('comment_id', new.id, 'activity_id', new.target_id)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row execute procedure public.notify_on_comment();

-- ─── TRIGGER: follow → notify the followed user ──────────────────────────
create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Self-follows are prevented by a CHECK constraint on the follows table
  insert into public.notifications (user_id, actor_id, type)
  values (new.followed_id, new.follower_id, 'follow');
  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute procedure public.notify_on_follow();

-- When an unfollow happens, clean up the corresponding "follow" notification
-- so re-following doesn't double-notify.
create or replace function public.cleanup_follow_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
  where user_id = old.followed_id
    and actor_id = old.follower_id
    and type = 'follow';
  return old;
end;
$$;

drop trigger if exists follows_cleanup_notification on public.follows;
create trigger follows_cleanup_notification
  after delete on public.follows
  for each row execute procedure public.cleanup_follow_notification();
