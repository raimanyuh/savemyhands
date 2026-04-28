-- Initial schema: a single `hands` table backing the recorder, dashboard,
-- and public share URLs.
--
-- Design notes:
--   * Stores the full RecorderState in a `payload` jsonb column. Top-level
--     metadata (name, stakes, hero_position, …) is mirrored as columns so
--     the dashboard can sort/filter/index without parsing jsonb.
--   * Public SELECT (anon + authenticated): anyone with the URL can view a
--     hand. Mutations are owner-only.
--   * `id` is an 8-char text key minted client-side; collisions are caught
--     by the PK constraint and retried.

create table public.hands (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- Mirrored display fields (drive the dashboard table).
  name          text not null,
  date_display  text not null,         -- "Apr 24, 25" — user-visible.
  date_iso      date,                  -- ISO date for sort/filter.
  stakes        text not null,         -- "1/2"
  loc           text,
  hero_position text,                  -- "BTN" / "UTG+1" / etc.
  multiway      boolean,
  board         text[] not null,       -- length 5; "—" placeholders for empty slots.
  pot_type      text not null check (pot_type in ('LP','SRP','3BP','4BP','5BP')),
  tags          text[] not null default '{}',
  result        integer not null,
  fav           boolean not null default false,
  notes         text,

  -- Full RecorderState `_full` payload.
  payload       jsonb not null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Dashboard query pattern is "list this user's hands, newest first".
create index hands_user_id_created_at_idx
  on public.hands (user_id, created_at desc);

-- Auto-update updated_at on row mutation.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger hands_set_updated_at
  before update on public.hands
  for each row execute function public.set_updated_at();

-- RLS: public reads, owner-only writes.
alter table public.hands enable row level security;

create policy "hands_select_public"
  on public.hands for select
  to anon, authenticated
  using (true);

create policy "hands_insert_owner"
  on public.hands for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "hands_update_owner"
  on public.hands for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "hands_delete_owner"
  on public.hands for delete
  to authenticated
  using (auth.uid() = user_id);
