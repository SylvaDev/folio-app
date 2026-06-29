-- ═══ REPOINT ACTOR/AUTHOR FKs FROM auth.users → public.profiles ═══════════
-- Background: PostgREST's `actor:profiles!notifications_actor_id_fkey(...)`
-- embed syntax requires a foreign key that lands directly on the embedded
-- table. The original FKs landed on `auth.users` which PostgREST can't see,
-- so every notifications/comments query failed with PGRST200.
--
-- We repoint the FK to `profiles.id`. The cascade chain stays correct
-- because `profiles.id` itself cascades from `auth.users.id`:
--   auth.users DELETE  →  profiles DELETE  →  notifications/comments DELETE
-- ═════════════════════════════════════════════════════════════════════════

-- ─── notifications.actor_id ──────────────────────────────────────────────
alter table public.notifications
  drop constraint if exists notifications_actor_id_fkey;

alter table public.notifications
  add constraint notifications_actor_id_fkey
    foreign key (actor_id)
    references public.profiles(id)
    on delete cascade;

-- ─── comments.user_id ────────────────────────────────────────────────────
alter table public.comments
  drop constraint if exists comments_user_id_fkey;

alter table public.comments
  add constraint comments_user_id_fkey
    foreign key (user_id)
    references public.profiles(id)
    on delete cascade;
