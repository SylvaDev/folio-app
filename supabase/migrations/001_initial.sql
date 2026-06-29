-- ─── EXTENSIONS ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";  -- for fuzzy book title search

-- ─── PROFILES ────────────────────────────────────────────────────────────────
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  username            text unique,
  display_name        text,
  avatar_url          text,
  bio                 text,
  reading_goal        integer,
  subscription        text not null default 'free' check (subscription in ('free','pro','book_club')),
  subscription_ends_at timestamptz,
  goodreads_imported  boolean not null default false,
  onboarding_complete boolean not null default false,
  preferred_genres    text[] not null default '{}',
  mood_tracking       boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── BOOKS (global catalog cache) ────────────────────────────────────────────
create table public.books (
  id                  uuid primary key default gen_random_uuid(),
  ol_key              text unique not null,   -- "/works/OL45804W"
  title               text not null,
  authors             text[] not null default '{}',
  cover_url           text,
  cover_id            integer,
  description         text,
  first_publish_year  integer,
  page_count          integer,
  isbn_13             text,
  isbn_10             text,
  genres              text[] not null default '{}',
  series_id           uuid,
  series_position     numeric,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index books_title_search on public.books using gin (title gin_trgm_ops);
create index books_authors on public.books using gin (authors);
create index books_ol_key on public.books (ol_key);

-- Anyone can read the global book catalog
alter table public.books enable row level security;
create policy "Books are publicly readable" on public.books for select using (true);
create policy "Authenticated users can insert books" on public.books for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update books" on public.books for update using (auth.role() = 'authenticated');

-- ─── SERIES ──────────────────────────────────────────────────────────────────
create table public.series (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  ol_series_key text,
  description   text,
  book_count    integer not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.series enable row level security;
create policy "Series are publicly readable" on public.series for select using (true);
create policy "Authenticated users can insert series" on public.series for insert with check (auth.role() = 'authenticated');

create table public.series_books (
  series_id    uuid not null references public.series(id) on delete cascade,
  book_id      uuid not null references public.books(id) on delete cascade,
  position     numeric not null,
  is_prequel   boolean not null default false,
  is_novella   boolean not null default false,
  primary key (series_id, book_id)
);

alter table public.series_books enable row level security;
create policy "Series books are publicly readable" on public.series_books for select using (true);

-- Add FK from books to series
alter table public.books
  add constraint books_series_fk foreign key (series_id) references public.series(id) on delete set null;

-- ─── USER BOOKS ──────────────────────────────────────────────────────────────
create table public.user_books (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  book_id         uuid not null references public.books(id) on delete cascade,
  status          text not null default 'tbr'
                  check (status in ('tbr','reading','read','dnf','paused')),
  rating          integer check (rating between 1 and 5),
  date_started    date,
  date_finished   date,
  date_added      timestamptz not null default now(),
  notes           text,
  review          text,
  is_favorite     boolean not null default false,
  owned           boolean not null default false,
  format          text check (format in ('physical','ebook','audio')),
  priority        integer not null default 3 check (priority between 1 and 5),
  mood_tags       text[] not null default '{}',
  pages_read      integer not null default 0,
  unique (user_id, book_id)
);

create index user_books_user on public.user_books (user_id);
create index user_books_status on public.user_books (user_id, status);

alter table public.user_books enable row level security;

create policy "Users can manage their own books"
  on public.user_books for all using (auth.uid() = user_id);

-- ─── SHELVES ─────────────────────────────────────────────────────────────────
create table public.shelves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  color       text,
  icon        text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index shelves_user on public.shelves (user_id);

alter table public.shelves enable row level security;
create policy "Users can manage their own shelves"
  on public.shelves for all using (auth.uid() = user_id);

create table public.shelf_books (
  id           uuid primary key default gen_random_uuid(),
  shelf_id     uuid not null references public.shelves(id) on delete cascade,
  user_book_id uuid not null references public.user_books(id) on delete cascade,
  added_at     timestamptz not null default now(),
  unique (shelf_id, user_book_id)
);

alter table public.shelf_books enable row level security;
create policy "Users can manage their shelf books"
  on public.shelf_books for all using (
    exists (
      select 1 from public.shelves s
      where s.id = shelf_id and s.user_id = auth.uid()
    )
  );

-- ─── READING SESSIONS ────────────────────────────────────────────────────────
create table public.reading_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  user_book_id  uuid not null references public.user_books(id) on delete cascade,
  pages_read    integer not null default 0,
  minutes_read  integer,
  session_date  date not null default current_date,
  created_at    timestamptz not null default now()
);

create index reading_sessions_user on public.reading_sessions (user_id);
create index reading_sessions_date on public.reading_sessions (user_id, session_date);

alter table public.reading_sessions enable row level security;
create policy "Users can manage their reading sessions"
  on public.reading_sessions for all using (auth.uid() = user_id);

-- ─── USER SERIES PROGRESS ────────────────────────────────────────────────────
create table public.user_series_progress (
  user_id          uuid not null references auth.users(id) on delete cascade,
  series_id        uuid not null references public.series(id) on delete cascade,
  current_position numeric,
  status           text not null default 'reading'
                   check (status in ('reading','completed','paused','abandoned')),
  last_updated     timestamptz not null default now(),
  primary key (user_id, series_id)
);

alter table public.user_series_progress enable row level security;
create policy "Users can manage their series progress"
  on public.user_series_progress for all using (auth.uid() = user_id);

-- ─── BOOK CLUBS ──────────────────────────────────────────────────────────────
create table public.book_clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  cover_url    text,
  is_public    boolean not null default false,
  invite_code  text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index book_clubs_owner on public.book_clubs (owner_id);

alter table public.book_clubs enable row level security;
create policy "Owners can manage their clubs"
  on public.book_clubs for all using (auth.uid() = owner_id);

create table public.book_club_members (
  club_id    uuid not null references public.book_clubs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','admin','member')),
  joined_at  timestamptz not null default now(),
  primary key (club_id, user_id)
);

alter table public.book_club_members enable row level security;
create policy "Members can see their own memberships"
  on public.book_club_members for select
  using (user_id = auth.uid());
create policy "Users can leave clubs"
  on public.book_club_members for delete using (user_id = auth.uid());
create policy "Club owners can manage members"
  on public.book_club_members for all using (
    exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = auth.uid())
  );

-- Now that book_club_members exists, add the cross-referencing select policy on book_clubs
create policy "Public clubs are readable by all"
  on public.book_clubs for select
  using (
    is_public = true
    or owner_id = auth.uid()
    or exists (
      select 1 from public.book_club_members m
      where m.club_id = book_clubs.id and m.user_id = auth.uid()
    )
  );

create table public.book_club_reads (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.book_clubs(id) on delete cascade,
  book_id            uuid not null references public.books(id) on delete cascade,
  started_at         timestamptz,
  ends_at            timestamptz,
  status             text not null default 'upcoming' check (status in ('upcoming','active','completed')),
  discussion_prompt  text,
  created_at         timestamptz not null default now()
);

alter table public.book_club_reads enable row level security;
create policy "Club members can see club reads"
  on public.book_club_reads for select
  using (
    exists (select 1 from public.book_club_members m where m.club_id = club_id and m.user_id = auth.uid())
  );

create table public.discussions (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.book_clubs(id) on delete cascade,
  club_read_id  uuid references public.book_club_reads(id) on delete set null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  content       text not null,
  parent_id     uuid references public.discussions(id) on delete cascade,
  likes         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index discussions_club on public.discussions (club_id);
create index discussions_read on public.discussions (club_read_id);

alter table public.discussions enable row level security;
create policy "Club members can view and post discussions"
  on public.discussions for all
  using (
    exists (select 1 from public.book_club_members m where m.club_id = club_id and m.user_id = auth.uid())
  );

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger books_updated_at before update on public.books
  for each row execute procedure public.set_updated_at();
create trigger shelves_updated_at before update on public.shelves
  for each row execute procedure public.set_updated_at();
create trigger book_clubs_updated_at before update on public.book_clubs
  for each row execute procedure public.set_updated_at();
create trigger discussions_updated_at before update on public.discussions
  for each row execute procedure public.set_updated_at();

-- ─── ANALYTICS VIEW ──────────────────────────────────────────────────────────
create or replace view public.user_reading_stats as
select
  ub.user_id,
  count(*) filter (where ub.status = 'read') as total_read,
  count(*) filter (where ub.status = 'read' and extract(year from ub.date_finished) = extract(year from now())) as read_this_year,
  count(*) filter (where ub.status = 'tbr') as tbr_count,
  count(*) filter (where ub.status = 'reading') as currently_reading,
  count(*) filter (where ub.status = 'dnf') as dnf_count,
  round(avg(ub.rating) filter (where ub.rating is not null), 1) as avg_rating,
  sum(b.page_count) filter (where ub.status = 'read') as total_pages_read,
  count(*) filter (where ub.is_favorite) as favorites_count
from public.user_books ub
join public.books b on b.id = ub.book_id
group by ub.user_id;
