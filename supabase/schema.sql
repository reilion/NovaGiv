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
  -- Plays of this collection's own video (movies, karaokes, especiales). An
  -- episodic collection keeps its count on the episode rows instead, so the
  -- total shown on the card is always this plus the sum of its episodes'.
  view_count int not null default 0,
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
alter table media_items add column if not exists view_count int not null default 0;

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
  -- Plays of this video. Carried over by ok.ru URL when the admin form rewrites
  -- the episode list (see lib/media-write.ts), so editing a collection or moving
  -- a video into another one never resets its count.
  view_count int not null default 0,
  unique (media_item_id, season_number, episode_number)
);

alter table episodes add column if not exists streamed_at timestamp;
alter table episodes add column if not exists view_count int not null default 0;

create index if not exists episodes_media_item_id_idx on episodes (media_item_id);
create index if not exists media_items_type_idx on media_items (type);
create index if not exists media_items_created_at_idx on media_items (created_at desc);
create index if not exists media_items_published_idx on media_items (published);
create index if not exists media_items_last_streamed_at_idx on media_items (last_streamed_at desc);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- Visitors sign up with a username, an email and a password, and from then on
-- log in with the username only (app/login). Supabase Auth has no notion of a
-- username, so this table is the missing half of an account: auth.users keeps
-- the email and the password, profiles keeps the username and the role, and the
-- triggers below keep the two in sync. The email is stored in both because
-- signing in by username means resolving it back to an email server-side, and
-- that lookup should not need a second round trip into the auth schema.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Always stored lowercase — together with the unique index below, that is
  -- what makes "Kevin" and "kevin" the same account.
  username text not null check (username = lower(username) and username ~ '^[a-z0-9_]{3,20}$'),
  email text not null,
  -- 'user' is everything the sign-up form can produce: the catalog is public,
  -- so for now the role only decides who gets into /admin. Promote by hand:
  --   update profiles set role = 'admin' where username = '...';
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_key on profiles (lower(username));
create index if not exists profiles_role_idx on profiles (role);

-- One profile per auth user, created in the same transaction as the auth row:
-- a username already taken makes the unique index abort the whole sign-up
-- instead of leaving an account with no profile behind.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := regexp_replace(
    lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '[^a-z0-9_]', '', 'g'
  );

  -- No username in the metadata means the account was created outside the
  -- sign-up form (Supabase dashboard, an invite): derive one from the email and
  -- suffix it so two such accounts cannot collide.
  if length(v_username) < 3 then
    v_username := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g');
    if length(v_username) < 3 then
      v_username := 'user';
    end if;
    v_username := left(v_username, 14) || '_' || left(replace(new.id::text, '-', ''), 5);
  end if;

  -- The role is hard-coded, never read from the metadata: the sign-up payload
  -- is attacker-controlled, and this is the only path that creates accounts.
  insert into public.profiles (id, username, email, role)
  values (new.id, left(v_username, 20), new.email, 'user');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keeps the email copy above honest when an account changes its email.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function public.sync_profile_email();

-- Runs once, when this table is introduced: back then the only accounts that
-- existed were the admin's (see README), so they all become admins, each with a
-- username taken from its email — `kevin@novagiv.com` logs in as `kevin` from
-- now on. Guarded on the table being empty, so a later re-run can never promote
-- a visitor who has signed up since.
--
-- Run this afterwards to see the usernames it handed out:
--   select username, email, role from profiles;
insert into profiles (id, username, email, role)
select
  seed.id,
  -- Only fall back to a suffixed name when the plain one is unusable: too
  -- short or too long for the check constraint, or claimed by another account.
  case
    when length(seed.base) between 3 and 20
      and count(*) over (partition by seed.base) = 1
    then seed.base
    else left(seed.base, 14) || '_' || left(replace(seed.id::text, '-', ''), 5)
  end,
  seed.email,
  'admin'
from (
  select
    u.id,
    u.email,
    coalesce(
      nullif(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]', '', 'g'), ''),
      'admin'
    ) as base
  from auth.users u
  where u.email is not null
    and not exists (select 1 from profiles)
) seed
on conflict do nothing;

-- Single source of truth for "is the caller an admin?", used by every policy
-- below and by the /admin gate. security definer so that reading profiles from
-- inside a profiles policy cannot recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table profiles enable row level security;
alter table media_items enable row level security;
alter table episodes enable row level security;
alter table okru_channels enable row level security;

-- An account can read itself and nothing more: other people's usernames and
-- emails never reach the browser. The sign-in lookup (username -> email) runs
-- server-side with the service-role key instead — see lib/supabase/admin.ts.
drop policy if exists "Users read own profile" on profiles;
create policy "Users read own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- Renaming yourself from /account is the one write a session may make here.
drop policy if exists "Users update own profile" on profiles;
create policy "Users update own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ...and the column grant is what keeps that policy honest. A `with check`
-- expression cannot see *which* columns an update touched, so on its own the
-- policy above would happily accept `set role = 'admin'`. Postgres can: only
-- username is writable by a session, which leaves the role reachable by hand in
-- the SQL editor alone. email is off the list too — it is a copy of the auth
-- record, and only the trigger above may move it.
revoke update on profiles from anon, authenticated;
grant update (username) on profiles to authenticated;

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

-- Admin panel (app/admin): managing the catalog, drafts included, is limited to
-- profiles with role = 'admin'. Being logged in is no longer enough — now that
-- visitors can sign up, "authenticated" means any of them.
drop policy if exists "Authenticated write access on media_items" on media_items;
drop policy if exists "Admin write access on media_items" on media_items;
create policy "Admin write access on media_items"
  on media_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Authenticated write access on episodes" on episodes;
drop policy if exists "Admin write access on episodes" on episodes;
create policy "Admin write access on episodes"
  on episodes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admin-only: the channel catalogue is a tool for the import panel, nothing on
-- the public site reads it.
drop policy if exists "Authenticated access on okru_channels" on okru_channels;
drop policy if exists "Admin access on okru_channels" on okru_channels;
create policy "Admin access on okru_channels"
  on okru_channels for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Watch history
-- ---------------------------------------------------------------------------
-- One row per account per collection: where to pick it up again, and when it
-- was last opened. That is what "Seguir viendo" needs, and keeping it to one
-- row per collection is also what stops a binge from burying everything else
-- in the history.
--
-- The resume point is stored as the same "12" / "2x12" the URL carries, never
-- as an episode id: saving a collection in /admin deletes and reinserts every
-- episode row (see lib/media-write.ts), so an id would be dangling after the
-- next edit while the season/number pair survives it. Keep the shape in step
-- with `episodeParam()` in lib/episode-param.ts.

create table if not exists watch_history (
  user_id uuid not null references auth.users (id) on delete cascade,
  media_item_id uuid not null references media_items (id) on delete cascade,
  -- Null for a collection with a single video: a movie, karaoke or especial.
  episode_ref text,
  watched_at timestamptz not null default now(),
  primary key (user_id, media_item_id)
);

create index if not exists watch_history_user_watched_idx
  on watch_history (user_id, watched_at desc);

alter table watch_history enable row level security;

-- Your own history and nothing else. There is deliberately no insert or update
-- policy: the only way in is register_video_view() below, which writes it as
-- part of counting the play, so a browser cannot forge somebody's history.
drop policy if exists "Users read own history" on watch_history;
create policy "Users read own history"
  on watch_history for select
  to authenticated
  using (user_id = auth.uid());

-- Removing a title from "Seguir viendo" is the one write a session may make.
drop policy if exists "Users delete own history" on watch_history;
create policy "Users delete own history"
  on watch_history for delete
  to authenticated
  using (user_id = auth.uid());

-- The "12" / "2x12" an episode goes by in the URL, in the history and in "Ver
-- después". Mirrors episodeParam() in lib/episode-param.ts, so this is the one
-- place in SQL to keep in step with it. Null when the episode is not part of
-- the collection.
create or replace function public.episode_ref_of(p_media_item_id uuid, p_episode_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select case
           when coalesce(e.season_number, 1) > 1
             then e.season_number::text || 'x' || e.episode_number::text
           else e.episode_number::text
         end
    from episodes e
   where e.id = p_episode_id and e.media_item_id = p_media_item_id;
$$;

-- Counting a play is the only write the public site makes, and the policies
-- above only let an authenticated admin write. This function is the exception:
-- security definer, so an anonymous visitor can bump exactly one counter by one
-- and touch nothing else. Views of a draft are ignored, matching the read
-- policies — a collection only starts counting once it is public.
create or replace function register_video_view(p_media_item_id uuid, p_episode_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_published boolean;
  v_ref text;
begin
  select published into v_published from media_items where id = p_media_item_id;
  if not coalesce(v_published, false) then
    return;
  end if;

  if p_episode_id is null then
    update media_items
      set view_count = view_count + 1
      where id = p_media_item_id;
  else
    update episodes
      set view_count = view_count + 1
      where id = p_episode_id
        and media_item_id = p_media_item_id;
  end if;

  -- Anonymous plays only move the counter; there is nobody to remember them
  -- for. auth.uid() still reports the caller inside a security definer
  -- function, so this is the signed-in half of the same round trip.
  if v_user is null then
    return;
  end if;

  if p_episode_id is not null then
    v_ref := episode_ref_of(p_media_item_id, p_episode_id);
  end if;

  insert into watch_history (user_id, media_item_id, episode_ref, watched_at)
  values (v_user, p_media_item_id, v_ref, now())
  on conflict (user_id, media_item_id)
  do update set episode_ref = excluded.episode_ref, watched_at = excluded.watched_at;
end;
$$;

revoke all on function register_video_view(uuid, uuid) from public;
grant execute on function register_video_view(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Likes
-- ---------------------------------------------------------------------------
-- One row per person per video, which is what makes a like undoable and stops
-- the same account from counting twice. Keyed exactly like a view is: an
-- episode when the collection is episodic, the collection itself for a movie,
-- karaoke or especial.

create table if not exists video_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_item_id uuid not null references media_items (id) on delete cascade,
  episode_id uuid references episodes (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- "One like per person per video" in two halves, because a plain unique
-- constraint would let a movie be liked twice: null episode_id values do not
-- compare equal to each other.
create unique index if not exists video_likes_episode_key
  on video_likes (user_id, episode_id)
  where episode_id is not null;

create unique index if not exists video_likes_item_key
  on video_likes (user_id, media_item_id)
  where episode_id is null;

create index if not exists video_likes_media_item_id_idx on video_likes (media_item_id);

-- Denormalized totals, kept beside view_count and maintained by the trigger
-- below. The catalog grid reads one row per collection; counting likes per
-- video on every render would mean an aggregate join for a number that changes
-- a handful of times a day.
alter table media_items add column if not exists like_count int not null default 0;
alter table episodes add column if not exists like_count int not null default 0;

create or replace function public.sync_video_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.episode_id is null then
      update media_items set like_count = like_count + 1 where id = new.media_item_id;
    else
      update episodes set like_count = like_count + 1 where id = new.episode_id;
    end if;
  else
    -- greatest() so a counter that somehow drifted can never go negative.
    if old.episode_id is null then
      update media_items set like_count = greatest(like_count - 1, 0) where id = old.media_item_id;
    else
      update episodes set like_count = greatest(like_count - 1, 0) where id = old.episode_id;
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists on_video_like_changed on video_likes;
create trigger on_video_like_changed
  after insert or delete on video_likes
  for each row execute function public.sync_video_like_count();

-- Re-derives both counters from the likes themselves, so re-running this file
-- repairs a drift instead of leaving it to be found by hand. A no-op when the
-- numbers already agree — the `is distinct from` is what keeps it from
-- rewriting every row on every run.
update media_items m
set like_count = coalesce(c.total, 0)
from media_items base
left join (
  select media_item_id, count(*) as total
  from video_likes
  where episode_id is null
  group by media_item_id
) c on c.media_item_id = base.id
where m.id = base.id and m.like_count is distinct from coalesce(c.total, 0);

update episodes e
set like_count = coalesce(c.total, 0)
from episodes base
left join (
  select episode_id, count(*) as total
  from video_likes
  where episode_id is not null
  group by episode_id
) c on c.episode_id = base.id
where e.id = base.id and e.like_count is distinct from coalesce(c.total, 0);

alter table video_likes enable row level security;

-- Your own likes are all you may read: the totals everyone sees live on the
-- catalog rows, so nobody ever needs to look at who liked what.
drop policy if exists "Users read own likes" on video_likes;
create policy "Users read own likes"
  on video_likes for select
  to authenticated
  using (user_id = auth.uid());

-- Liking is for signed-in visitors only — an anonymous like could not be
-- undone, and would be counted again on the next browser. The row has to point
-- at a published video, and at an episode that really belongs to the
-- collection, so the counter can never be moved by a hand-made request.
drop policy if exists "Users like published videos" on video_likes;
create policy "Users like published videos"
  on video_likes for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from media_items mi
      where mi.id = video_likes.media_item_id and mi.published
    )
    and (
      episode_id is null
      or exists (
        select 1 from episodes e
        where e.id = video_likes.episode_id
          and e.media_item_id = video_likes.media_item_id
      )
    )
  );

drop policy if exists "Users remove own likes" on video_likes;
create policy "Users remove own likes"
  on video_likes for delete
  to authenticated
  using (user_id = auth.uid());

-- Toggling in one round trip, and in one transaction: the read of the counter
-- below happens after the trigger above has already applied the change, so two
-- people liking the same video at once can't hand each other a stale total.
-- security invoker on purpose — the policies above stay the enforcement, this
-- is only here to make the toggle atomic.
create or replace function toggle_video_like(p_media_item_id uuid, p_episode_id uuid default null)
returns table (liked boolean, likes int)
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_deleted int;
begin
  if v_user is null then
    raise exception 'Hay que iniciar sesión para dar me gusta.' using errcode = '42501';
  end if;

  delete from video_likes
   where user_id = v_user
     and media_item_id = p_media_item_id
     and episode_id is not distinct from p_episode_id;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    insert into video_likes (user_id, media_item_id, episode_id)
    values (v_user, p_media_item_id, p_episode_id);
    liked := true;
  else
    liked := false;
  end if;

  if p_episode_id is null then
    select m.like_count into likes from media_items m where m.id = p_media_item_id;
  else
    select e.like_count into likes from episodes e where e.id = p_episode_id;
  end if;

  likes := coalesce(likes, 0);
  return next;
end;
$$;

revoke all on function toggle_video_like(uuid, uuid) from public;
grant execute on function toggle_video_like(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Watch later
-- ---------------------------------------------------------------------------
-- "Ver después": the videos an account set aside to watch. The same shape as a
-- like — one row per person per video, the collection plus the episode when
-- there is one — with one deliberate difference: the episode is named by its
-- "12" / "2x12" ref, as in watch_history, and not by its id. Saving a
-- collection in /admin deletes and reinserts every episode row (see
-- lib/media-write.ts), so a row keyed by episode id would be wiped by the next
-- edit — the known hole in video_likes, and one a list somebody keeps on
-- purpose cannot afford.
--
-- No counter: how many people saved a video is nobody else's business, so
-- there is nothing to denormalize and no trigger.

create table if not exists watch_later (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  media_item_id uuid not null references media_items (id) on delete cascade,
  -- Null for a collection with a single video: a movie, karaoke or especial.
  episode_ref text,
  created_at timestamptz not null default now()
);

-- One row per person per video, in two halves for the same reason as the
-- likes: null episode_ref values do not compare equal to each other.
create unique index if not exists watch_later_episode_key
  on watch_later (user_id, media_item_id, episode_ref)
  where episode_ref is not null;

create unique index if not exists watch_later_item_key
  on watch_later (user_id, media_item_id)
  where episode_ref is null;

create index if not exists watch_later_user_created_idx
  on watch_later (user_id, created_at desc);

alter table watch_later enable row level security;

-- Your own list and nothing else. There is deliberately no insert policy: the
-- only way in is toggle_watch_later() below, which derives the ref from a real
-- episode, so every stored ref is one episodeParam() would produce.
drop policy if exists "Users read own watch later" on watch_later;
create policy "Users read own watch later"
  on watch_later for select
  to authenticated
  using (user_id = auth.uid());

-- Taking a video off the list from /ver-despues.
drop policy if exists "Users remove own watch later" on watch_later;
create policy "Users remove own watch later"
  on watch_later for delete
  to authenticated
  using (user_id = auth.uid());

-- Adds or removes one video in one round trip and answers whether it ended up
-- on the list. security definer because of the missing insert policy above; it
-- only ever writes the caller's own row, and only for a published collection.
create or replace function toggle_watch_later(p_media_item_id uuid, p_episode_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_published boolean;
  v_ref text;
  v_deleted int;
begin
  if v_user is null then
    raise exception 'Hay que iniciar sesión para guardar videos.' using errcode = '42501';
  end if;

  select published into v_published from media_items where id = p_media_item_id;
  if not coalesce(v_published, false) then
    raise exception 'Ese título no está publicado.' using errcode = '22023';
  end if;

  if p_episode_id is not null then
    v_ref := episode_ref_of(p_media_item_id, p_episode_id);

    -- An episode of another collection, or one the admin rewrote away while
    -- the player sat open.
    if v_ref is null then
      raise exception 'Ese episodio ya no está en la colección.' using errcode = '22023';
    end if;
  end if;

  delete from watch_later
   where user_id = v_user
     and media_item_id = p_media_item_id
     and episode_ref is not distinct from v_ref;

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    return false;
  end if;

  insert into watch_later (user_id, media_item_id, episode_ref)
  values (v_user, p_media_item_id, v_ref);

  return true;
end;
$$;

revoke all on function toggle_watch_later(uuid, uuid) from public;
grant execute on function toggle_watch_later(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Catálogo paginado
-- ---------------------------------------------------------------------------
-- The grid used to be built by loading `select *, episodes(*)` with no limit
-- and doing every filter, every sort and every counter in JavaScript. That is
-- the whole catalog — posters, descriptions and one row per stream — travelling
-- to the server on each request, and growing without a ceiling as the channel
-- does. Everything below moves that work into Postgres: one view that already
-- carries the aggregated counters and the normalized keys the filters compare
-- against, and two functions the app calls instead — a page of results, and the
-- facets the filter bar lists.
--
-- The matching rules are the ones lib/media-filter.ts applied in JS, kept
-- deliberately identical so the same URL returns the same catalog as before.

-- Case- and accent-insensitive form, mirroring normalizeSearch() in lib/text.ts.
-- Immutable — that is what lets the genre index below be built on it.
create or replace function public.normalize_search(p_value text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(translate(coalesce(p_value, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'));
$$;

-- The genres of a collection as the filter compares them: trimmed, normalized,
-- deduplicated. "Fantasia", "Fantasía" and "fantasía" collapse into one key
-- here, exactly as collectGenres() folds them into one option.
create or replace function public.normalize_genres(p_genres text[])
returns text[]
language sql
immutable
parallel safe
as $$
  select coalesce(
    array_agg(distinct public.normalize_search(btrim(g))) filter (where btrim(g) <> ''),
    '{}'::text[]
  )
  from unnest(coalesce(p_genres, '{}'::text[])) g;
$$;

-- "2026-07-28T00:19:09" — a stream date exactly as the app receives it. Written
-- out by hand rather than with to_char(), which reads DateStyle and is
-- therefore only stable; this has to be immutable to be storable below.
create or replace function public.iso_stamp(p_at timestamp)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_at is null then ''
    else
      lpad(extract(year from p_at)::text, 4, '0') || '-' ||
      lpad(extract(month from p_at)::text, 2, '0') || '-' ||
      lpad(extract(day from p_at)::text, 2, '0') || 'T' ||
      lpad(extract(hour from p_at)::text, 2, '0') || ':' ||
      lpad(extract(minute from p_at)::text, 2, '0') || ':' ||
      lpad(trunc(extract(second from p_at))::text, 2, '0')
  end;
$$;

-- What one episode can be found by: its title and the stream date behind it, so
-- an ISO-style query ("2026-07-13") lands on the night somebody remembers.
-- Mirrors episodeHaystack() in lib/media-filter.ts.
create or replace function public.episode_search_text(p_title text, p_streamed_at timestamp)
returns text
language sql
immutable
parallel safe
as $$
  select public.normalize_search(coalesce(p_title, '') || ' ' || public.iso_stamp(p_streamed_at));
$$;

-- ...stored, because building it per row is what a catalog-wide search costs.
-- Over sixty thousand episodes, computing this on the fly is ~130 ms and
-- reading it back is ~12 ms: the same scan, minus the string building. Adding
-- the column rewrites the table once, which is the point — every search after
-- that is paid for at import time instead.
--
-- Generated, not a trigger, so it cannot drift from the episode it describes.
-- Postgres allows `create or replace` on the function above even with this
-- column depending on it, so re-running this file is safe — but *changing* that
-- function's body would leave the stored text behind, and the column has to be
-- dropped and re-added to pick the new one up.
alter table episodes add column if not exists search_text text
  generated always as (public.episode_search_text(title, streamed_at)) stored;

-- Concrete dates a collection was streamed on — its episodes' when they carry
-- dates, else the two ends of its range. Drives the custom-range filter, and
-- matches coveredDates() in lib/media-filter.ts.
create or replace function public.stream_date_keys(
  p_episode_dates date[],
  p_first timestamp,
  p_last timestamp
)
returns date[]
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(array_length(p_episode_dates, 1), 0) > 0 then p_episode_dates
    else (
      select coalesce(array_agg(distinct d), '{}'::date[])
      from unnest(array[p_first::date, p_last::date]) d
      where d is not null
    )
  end;
$$;

-- The months a collection covers, as YYYYMM. Episode dates when it has them;
-- otherwise every month its range spans, so a collection streamed across March
-- and April answers to both. Mirrors coveredMonths(), guard included: a
-- malformed range cannot make this walk forever.
create or replace function public.stream_month_keys(
  p_episode_dates date[],
  p_first timestamp,
  p_last timestamp
)
returns int[]
language sql
immutable
parallel safe
as $$
  select case
    when coalesce(array_length(p_episode_dates, 1), 0) > 0 then (
      select coalesce(
        array_agg(distinct extract(year from d)::int * 100 + extract(month from d)::int),
        '{}'::int[]
      )
      from unnest(p_episode_dates) d
    )
    when p_first is null and p_last is null then '{}'::int[]
    else (
      select coalesce(
        array_agg(extract(year from g)::int * 100 + extract(month from g)::int),
        '{}'::int[]
      )
      from generate_series(
        date_trunc('month', coalesce(p_first, p_last)),
        least(
          date_trunc('month', coalesce(p_last, p_first)),
          date_trunc('month', coalesce(p_first, p_last)) + interval '600 months'
        ),
        interval '1 month'
      ) g
    )
  end;
$$;

-- One row per collection, carrying what the grid draws and what the filters
-- compare against — so neither the episode rows nor their counters ever have to
-- reach the app.
--
-- security_invoker so the read policies on media_items and episodes still
-- decide what a caller sees: for an anonymous visitor this view holds exactly
-- the published catalog, and drafts stay invisible without a second `published`
-- check anywhere.
drop view if exists public.media_catalog;
create view public.media_catalog
with (security_invoker = on)
as
select
  m.id,
  m.title,
  m.slug,
  m.type,
  m.poster_url,
  m.genres,
  m.year,
  m.description,
  m.duration,
  m.okru_embed_url,
  m.status,
  m.rating,
  m.published,
  m.first_streamed_at,
  m.last_streamed_at,
  m.okru_channel_id,
  m.okru_channel_name,
  m.okru_channel_url,
  m.okru_channel_primary,
  m.created_at,
  coalesce(ep.episode_count, 0)::int as episode_count,
  -- What totalViewsOf()/totalLikesOf() used to add up in the browser: the
  -- collection's own counter plus every one of its episodes'.
  (m.view_count + coalesce(ep.view_total, 0))::int as total_view_count,
  (m.like_count + coalesce(ep.like_total, 0))::int as total_like_count,
  public.normalize_genres(m.genres) as genres_normalized,
  -- The collection's own searchable text. Its episodes' is deliberately not
  -- folded in here: building it would mean concatenating every episode title in
  -- the catalog on every request, including the vast majority that carry no
  -- search at all. search_media reaches for the episodes only when there is a
  -- query, and then one at a time — which is also how the JS search read them.
  public.normalize_search(m.title || E'\n' || coalesce(m.description, ''))
    as search_text,
  public.stream_date_keys(ep.streamed_dates, m.first_streamed_at, m.last_streamed_at)
    as stream_dates,
  public.stream_month_keys(ep.streamed_dates, m.first_streamed_at, m.last_streamed_at)
    as stream_months,
  -- The date the chronological sorts and the year sections key on; null for a
  -- collection that has never been dated, which sinks it to the bottom.
  coalesce(m.last_streamed_at, m.first_streamed_at) as streamed_sort_at
from media_items m
left join lateral (
  select
    count(*) as episode_count,
    sum(e.view_count) as view_total,
    sum(e.like_count) as like_total,
    array_agg(distinct e.streamed_at::date) filter (where e.streamed_at is not null)
      as streamed_dates
  from episodes e
  where e.media_item_id = m.id
) ep on true;

grant select on public.media_catalog to anon, authenticated;

-- Genre filtering is an array containment test over a normalized array, which
-- is exactly what a GIN index answers.
create index if not exists media_items_genres_normalized_idx
  on media_items using gin (public.normalize_genres(genres));

-- The two orderings the catalog pages through, with the published predicate
-- they always carry.
create index if not exists media_items_published_created_at_idx
  on media_items (published, created_at desc);
create index if not exists media_items_published_streamed_idx
  on media_items (published, last_streamed_at desc nulls last);

-- One page of the catalog: filtered, sorted and counted in the database.
--
-- Returns json rather than a row set so a page arrives in one round trip with
-- the two numbers only the database can know — how many collections match in
-- total, and how many fall in each year section — instead of the app inferring
-- them from the slice it happens to hold.
--
-- Everything here is a value the address bar can carry, so every parameter is
-- clamped or normalized before it reaches a query: p_limit has a ceiling, the
-- sort falls back to the default, and the search is compared with strpos()
-- rather than LIKE, so a `%` typed into the box is a literal percent sign.
drop function if exists public.search_media(text, text, text, text, int, int, date, date, int, int);
create function public.search_media(
  p_type text default 'all',
  p_search text default '',
  p_genre text default 'all',
  p_sort text default 'streamed',
  p_year int default null,
  p_month int default null,
  p_from date default null,
  p_to date default null,
  p_limit int default 24,
  p_offset int default 0
)
returns json
language plpgsql
stable
set search_path = public
as $$
declare
  v_query text := nullif(public.normalize_search(btrim(coalesce(p_search, ''))), '');
  v_genre text := case
                    when coalesce(btrim(p_genre), 'all') in ('all', '') then null
                    else nullif(public.normalize_search(btrim(p_genre)), '')
                  end;
  v_type text := nullif(coalesce(btrim(p_type), 'all'), 'all');
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'streamed');
  v_limit int := least(greatest(coalesce(p_limit, 24), 1), 60);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  -- A custom range replaces the year/month quick filters rather than stacking
  -- with them, so the two can never contradict each other.
  v_has_range boolean := p_from is not null or p_to is not null;
  v_from date := coalesce(p_from, date '0001-01-01');
  v_to date := coalesce(p_to, date '9999-12-31');
  v_result json;
begin
  with filtered as (
    -- Projected down to what the page actually draws: the keys the filters
    -- compare against are of no use past this point, and carrying them through
    -- the sort would mean materializing them for every matching collection.
    select
      c.id,
      c.title,
      c.slug,
      c.type,
      c.poster_url,
      c.genres,
      c.year,
      c.duration,
      c.status,
      c.created_at,
      c.first_streamed_at,
      c.last_streamed_at,
      c.episode_count,
      c.total_view_count,
      c.total_like_count,
      c.streamed_sort_at
    from public.media_catalog c
    where c.published
      and (v_type is null or c.type = v_type)
      and (v_genre is null or v_genre = any (c.genres_normalized))
      -- Title or description, or any one of its episodes — reaching the
      -- episodes is what makes a catalog of dated streams findable at all: the
      -- collection is called "H1NMTSR", while what somebody remembers is the
      -- night they watched it. The exists() stops at the first match, and never
      -- runs at all when nothing is being searched.
      and (
        v_query is null
        or strpos(c.search_text, v_query) > 0
        or exists (
          select 1
          from episodes e
          where e.media_item_id = c.id
            and strpos(e.search_text, v_query) > 0
        )
      )
      and (
        case
          when v_has_range then exists (
            select 1 from unnest(c.stream_dates) d where d between v_from and v_to
          )
          when p_year is null and p_month is null then true
          else exists (
            select 1 from unnest(c.stream_months) mm
            where (p_year is null or mm / 100 = p_year)
              and (p_month is null or mm % 100 = p_month)
          )
        end
      )
  ),
  -- Numbered before the slice, so the ordering is written once and the page
  -- boundaries can never disagree with it. created_at + id break every tie:
  -- without a total order, two requests for consecutive pages could show the
  -- same collection twice, or skip it.
  ranked as (
    select
      f.*,
      row_number() over (
        order by
          case when v_sort = 'az' then public.normalize_search(f.title) end asc nulls last,
          case when v_sort = 'year' then f.year end desc nulls last,
          case when v_sort = 'recent' then f.created_at end desc nulls last,
          case when v_sort = 'streamed-asc' then f.streamed_sort_at end asc nulls last,
          case
            when v_sort not in ('az', 'year', 'recent', 'streamed-asc')
            then f.streamed_sort_at
          end desc nulls last,
          f.created_at desc,
          f.id
      ) as rn
    from filtered f
  ),
  page as (
    select r.* from ranked r where r.rn > v_offset and r.rn <= v_offset + v_limit
  ),
  -- Only over the page: which of this collection's episodes the search matched,
  -- and which one its card should open at. What matchingEpisodes() did in the
  -- browser, except the episode rows never leave the database.
  page_matches as (
    select p.*, coalesce(me.matched_count, 0) as matched_count, me.first_ref
    from page p
    left join lateral (
      select
        count(*)::int as matched_count,
        (array_agg(x.ref order by x.season_key, x.episode_number))[1] as first_ref
      from (
        select
          coalesce(e.season_number, 1) as season_key,
          e.episode_number,
          -- The "12" / "2x12" the URL carries — see episodeParam() in
          -- lib/episode-param.ts and episode_ref_of() above, which this agrees with.
          case
            when coalesce(e.season_number, 1) > 1
              then coalesce(e.season_number, 1)::text || 'x' || e.episode_number::text
            else e.episode_number::text
          end as ref
        from episodes e
        where e.media_item_id = p.id
          and v_query is not null
          and strpos(e.search_text, v_query) > 0
      ) x
    ) me on true
  ),
  -- How many collections each year section holds across the whole result, not
  -- just the part loaded so far, so an infinite-scrolling grid can label its
  -- sections correctly from the first screen. Filed under the year of the most
  -- recent stream, as groupByStreamYear() files them.
  year_counts as (
    select extract(year from f.streamed_sort_at)::int as year, count(*)::int as count
    from filtered f
    group by 1
  )
  select json_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce(
      (
        select json_agg(
          json_build_object(
            'id', p.id,
            'title', p.title,
            'slug', p.slug,
            'type', p.type,
            'posterUrl', p.poster_url,
            'genres', p.genres,
            'year', p.year,
            'duration', p.duration,
            'status', p.status,
            'createdAt', p.created_at,
            'firstStreamedAt', p.first_streamed_at,
            'lastStreamedAt', p.last_streamed_at,
            'episodeCount', p.episode_count,
            'views', p.total_view_count,
            'likes', p.total_like_count,
            'matchedEpisodes', p.matched_count,
            'matchedEpisodeRef', p.first_ref
          )
          order by p.rn
        )
        from page_matches p
      ),
      '[]'::json
    ),
    'yearCounts', coalesce(
      (
        select json_agg(json_build_object('year', y.year, 'count', y.count))
        from year_counts y
      ),
      '[]'::json
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.search_media(text, text, text, text, int, int, date, date, int, int) from public;
grant execute on function public.search_media(text, text, text, text, int, int, date, date, int, int)
  to anon, authenticated;

-- What the filter bar lists: the genres actually present in the catalog with
-- how many collections carry each, and every year that was streamed in.
--
-- Both are derived rather than kept by hand — the admin form takes genres as
-- free text, so a fixed list would offer genres nothing is filed under and
-- never show a new one. Of several spellings of the same genre the one that
-- kept its accents wins (it is the correct Spanish one), and between equals the
-- one used most. Same rule as preferredSpelling() in lib/media-filter.ts.
drop function if exists public.catalog_facets();
create function public.catalog_facets()
returns json
language sql
stable
set search_path = public
as $$
  with tagged as (
    select m.id, btrim(g) as label, public.normalize_search(btrim(g)) as key
    from media_items m
    cross join unnest(m.genres) g
    where m.published and btrim(g) <> ''
  ),
  counts as (
    -- Per collection, so one tagged both "Fantasia" and "Fantasía" counts once.
    select t.key, count(distinct t.id)::int as count from tagged t group by t.key
  ),
  variants as (
    select
      t.key,
      t.label,
      count(*)::int as uses,
      -- Diacritics the spelling kept, which is what picks "Fantasía".
      length(t.label) - length(translate(t.label, 'áéíóúüñÁÉÍÓÚÜÑ', '')) as accents
    from tagged t
    group by t.key, t.label
  ),
  best as (
    select distinct on (v.key) v.key, v.label
    from variants v
    order by v.key, v.accents desc, v.uses desc, v.label
  ),
  years as (
    select distinct (mm / 100) as year
    from public.media_catalog c
    cross join unnest(c.stream_months) mm
    where c.published
  )
  select json_build_object(
    'genres', coalesce(
      (
        select json_agg(json_build_object('genre', b.label, 'count', c.count) order by b.label)
        from best b
        join counts c on c.key = b.key
      ),
      '[]'::json
    ),
    'years', coalesce((select json_agg(y.year order by y.year desc) from years y), '[]'::json)
  );
$$;

revoke all on function public.catalog_facets() from public;
grant execute on function public.catalog_facets() to anon, authenticated;
