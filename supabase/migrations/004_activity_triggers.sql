-- ═══ ACTIVITY WRITE TRIGGERS ═════════════════════════════════════════════
-- Centralized triggers that write to `activities` when user_books changes.
-- One source of truth, so no matter which code path mutates user_books
-- (web app, mobile app, import flow, AI hook), the feed stays consistent.
--
-- Rules:
--   - Status flips to 'reading'              → started_book
--   - Status flips to 'read'                 → finished_book (metadata.rating)
--   - Rating set or upgraded to >=4          → rated_book   (positive feed only)
--   - Review added/edited with public flag   → reviewed_book
--   - Public review unpublished              → corresponding reviewed_book deleted
--   - user_book deleted                      → all related activities cleaned up
--   - activity deleted                       → its likes + comments cleaned up
--
-- We deliberately do NOT write activities for plain TBR adds (would flood
-- the feed during Goodreads imports). They can be re-enabled later by
-- changing one branch below.
-- ═════════════════════════════════════════════════════════════════════════

-- ─── MAIN ACTIVITY WRITER ────────────────────────────────────────────────
create or replace function public.write_user_book_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- INSERT path: book just appeared in the user's library
  if TG_OP = 'INSERT' then
    if new.status = 'reading' then
      insert into public.activities (user_id, type, target_type, target_id)
      values (new.user_id, 'started_book', 'user_book', new.id);
    elsif new.status = 'read' then
      insert into public.activities (user_id, type, target_type, target_id, metadata)
      values (
        new.user_id, 'finished_book', 'user_book', new.id,
        jsonb_build_object('rating', new.rating)
      );
    end if;
    -- (TBR inserts intentionally don't write an activity — too noisy on imports)
    return new;
  end if;

  -- UPDATE path: status / rating / review transitions
  if TG_OP = 'UPDATE' then
    -- Started reading
    if (old.status is distinct from 'reading') and new.status = 'reading' then
      insert into public.activities (user_id, type, target_type, target_id)
      values (new.user_id, 'started_book', 'user_book', new.id);
    end if;

    -- Finished reading
    if (old.status is distinct from 'read') and new.status = 'read' then
      insert into public.activities (user_id, type, target_type, target_id, metadata)
      values (
        new.user_id, 'finished_book', 'user_book', new.id,
        jsonb_build_object('rating', new.rating)
      );
    end if;

    -- Rating raised to a positive score
    if (
      (old.rating is null or old.rating < 4)
      and new.rating is not null and new.rating >= 4
    ) then
      insert into public.activities (user_id, type, target_type, target_id, metadata)
      values (
        new.user_id, 'rated_book', 'user_book', new.id,
        jsonb_build_object('rating', new.rating)
      );
    end if;

    -- Public review added or made-public
    if (
      new.review is not null
      and char_length(trim(new.review)) > 0
      and new.review_is_public = true
      and (
        old.review is null
        or char_length(trim(coalesce(old.review, ''))) = 0
        or old.review_is_public = false
      )
    ) then
      insert into public.activities (user_id, type, target_type, target_id)
      values (new.user_id, 'reviewed_book', 'user_book', new.id);
    end if;

    -- Public review unpublished → retract the reviewed_book activity
    if old.review_is_public = true and new.review_is_public = false then
      delete from public.activities
      where user_id = new.user_id
        and type = 'reviewed_book'
        and target_type = 'user_book'
        and target_id = new.id;
    end if;

    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists user_books_write_activity on public.user_books;
create trigger user_books_write_activity
  after insert or update on public.user_books
  for each row execute procedure public.write_user_book_activity();

-- ─── CASCADE CLEANUP: user_books DELETE → its activities ─────────────────
-- Activities reference user_books polymorphically (target_type='user_book',
-- target_id=user_books.id). There's no FK we can cascade on, so we do it
-- manually with a BEFORE DELETE trigger.
create or replace function public.cleanup_user_book_activities()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.activities
  where target_type = 'user_book' and target_id = old.id;
  return old;
end;
$$;

drop trigger if exists user_books_cleanup_activities on public.user_books;
create trigger user_books_cleanup_activities
  before delete on public.user_books
  for each row execute procedure public.cleanup_user_book_activities();

-- ─── CASCADE CLEANUP: activities DELETE → its likes + comments ───────────
-- Same polymorphic situation for likes/comments referencing activities.
create or replace function public.cleanup_activity_engagement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.likes
  where target_type = 'activity' and target_id = old.id;
  delete from public.comments
  where target_type = 'activity' and target_id = old.id;
  return old;
end;
$$;

drop trigger if exists activities_cleanup_engagement on public.activities;
create trigger activities_cleanup_engagement
  before delete on public.activities
  for each row execute procedure public.cleanup_activity_engagement();
