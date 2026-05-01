-- User profiles: a public-facing handle (`username`) attached to each
-- auth.users row. Surfaces in the dashboard header (in place of the email)
-- and as "by @username" attribution on shared hand replayer pages.
--
-- Design notes:
--   * One profile per auth user. PK is the user id, so the join is trivial
--     and the profile vanishes when the user does.
--   * Username is normalized to lowercase via a CHECK; we keep it case-
--     sensitive in storage but reject mixed-case at write time so display
--     is stable. 3-20 chars, [a-z0-9_].
--   * Public read (anon + authenticated): usernames are intended to be seen
--     on shared hand pages by people who aren't logged in.
--   * Owner-only insert/update: a user can only create/edit their own row.

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique
              check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (username);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "profiles_insert_owner"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_owner"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
