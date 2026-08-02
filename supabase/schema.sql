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
  -- Range of the stream dates parsed from the ok.ru video titles. Stored
  -- WITHOUT time zone on purpose: these are wall-clock stream dates, and
  -- converting them to UTC would slide a 00:19 stream to the previous day.
  first_streamed_at timestamp,
  last_streamed_at timestamp,
  -- Origin channel on ok.ru ("c1234567890"). This — not the title or the slug —
  -- is what `pnpm okru:sync` matches on, so renaming a collection here never
  -- makes the next sync create a duplicate; it just appends the new videos.
  okru_channel_id text,
  -- The channel's name on ok.ru, kept as it is there. Shown in the admin form
  -- so the original name stays visible after the collection is renamed.
  okru_channel_name text,
  okru_channel_url text,
  -- A channel often mixes unrelated content, so its videos can be split into
  -- several collections that all keep the reference above. Exactly one of them
  -- is the primary: the one `pnpm okru:sync` appends new videos to.
  okru_channel_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- These run when upgrading a table created by an older version of this file.
alter table media_items add column if not exists published boolean not null default true;
alter table media_items add column if not exists first_streamed_at timestamp;
alter table media_items add column if not exists last_streamed_at timestamp;
alter table media_items add column if not exists okru_channel_id text;
alter table media_items add column if not exists okru_channel_name text;
alter table media_items add column if not exists okru_channel_url text;
alter table media_items add column if not exists okru_channel_primary boolean not null default false;

-- Runs once, when the flag is introduced: back then every linked collection was
-- the channel's only one, so all of them are primary. Guarded so a later re-run
-- can't promote the derived collections created since.
do $$
begin
  if not exists (select 1 from media_items where okru_channel_primary) then
    update media_items set okru_channel_primary = true where okru_channel_id is not null;
  end if;
end $$;

-- Superseded by the index below: several collections may now share a channel.
drop index if exists media_items_okru_channel_id_key;

-- Only the primary is unique per channel. Partial so the many rows with no
-- channel (hand-made titles) don't collide on null.
create unique index if not exists media_items_okru_channel_primary_key
  on media_items (okru_channel_id)
  where okru_channel_id is not null and okru_channel_primary;

create index if not exists media_items_okru_channel_id_idx on media_items (okru_channel_id);

-- Catalogue of the channels seen on the streamer's ok.ru profile, refreshed by
-- `pnpm okru:sync`. Its only job is to power the "link this collection to a
-- channel" picker in /admin for collections imported before the id was stored
-- (or created by hand).
create table if not exists okru_channels (
  id text primary key,
  name text not null,
  url text not null,
  thumbnail_url text,
  video_count int,
  last_seen_at timestamptz not null default now()
);

create table if not exists episodes (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references media_items (id) on delete cascade,
  episode_number int not null,
  season_number int,
  title text not null,
  okru_embed_url text not null,
  duration text,
  thumbnail_url text,
  -- Date of the stream, parsed from the ok.ru video title. See the note on
  -- media_items above for why this is timestamp WITHOUT time zone.
  streamed_at timestamp,
  unique (media_item_id, season_number, episode_number)
);

alter table episodes add column if not exists streamed_at timestamp;

create index if not exists episodes_media_item_id_idx on episodes (media_item_id);
create index if not exists media_items_type_idx on media_items (type);
create index if not exists media_items_created_at_idx on media_items (created_at desc);
create index if not exists media_items_published_idx on media_items (published);
create index if not exists media_items_last_streamed_at_idx on media_items (last_streamed_at desc);

alter table media_items enable row level security;
alter table episodes enable row level security;
alter table okru_channels enable row level security;

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

-- Admin-only: the channel catalogue is a tool for the import panel, nothing on
-- the public site reads it.
drop policy if exists "Authenticated access on okru_channels" on okru_channels;
create policy "Authenticated access on okru_channels"
  on okru_channels for all
  to authenticated
  using (true)
  with check (true);
