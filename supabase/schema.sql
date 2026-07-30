-- Run this in the Supabase SQL editor for your project. Safe to re-run —
-- every statement is idempotent, so this also works as a migration if you
-- already applied an older version of this file.
-- Mirrors types/media.ts (MediaItem / Episode).

create table if not exists media_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  type text not null check (type in ('movie', 'series', 'anime', 'special', 'karaoke')),
  poster_url text not null,
  genres text[] not null default '{}',
  year int,
  description text,
  duration text,
  okru_embed_url text,
  status text check (status in ('ongoing', 'completed')),
  rating numeric(3, 1),
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Runs when upgrading a table created by an older version of this file.
alter table media_items add column if not exists published boolean not null default true;

create table if not exists episodes (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references media_items (id) on delete cascade,
  episode_number int not null,
  season_number int,
  title text not null,
  okru_embed_url text not null,
  duration text,
  thumbnail_url text,
  unique (media_item_id, season_number, episode_number)
);

create index if not exists episodes_media_item_id_idx on episodes (media_item_id);
create index if not exists media_items_type_idx on media_items (type);
create index if not exists media_items_created_at_idx on media_items (created_at desc);
create index if not exists media_items_published_idx on media_items (published);

alter table media_items enable row level security;
alter table episodes enable row level security;

-- Public catalog: only published rows are visible without a session.
-- Drafts (published = false) — e.g. ok.ru imports awaiting review — stay
-- invisible until the admin flips them live.
drop policy if exists "Public read access on media_items" on media_items;
create policy "Public read access on media_items"
  on media_items for select
  using (published = true);

drop policy if exists "Public read access on episodes" on episodes;
create policy "Public read access on episodes"
  on episodes for select
  using (
    exists (
      select 1 from media_items
      where media_items.id = episodes.media_item_id
        and media_items.published = true
    )
  );

-- Admin panel (app/admin): any authenticated Supabase user can manage the
-- catalog, drafts included. There is only ever one admin account (see
-- README), so a broad "authenticated" policy is enough — no per-row
-- ownership to check.
drop policy if exists "Authenticated write access on media_items" on media_items;
create policy "Authenticated write access on media_items"
  on media_items for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated write access on episodes" on episodes;
create policy "Authenticated write access on episodes"
  on episodes for all
  to authenticated
  using (true)
  with check (true);
