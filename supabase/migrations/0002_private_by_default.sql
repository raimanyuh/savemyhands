-- Hands default private. The owner always sees their own; everyone else
-- only sees rows the owner has explicitly toggled to public.

alter table public.hands
  add column is_public boolean not null default false;

-- Replace the public SELECT policy with an OR clause that lets owners
-- view their private rows while still letting strangers view shared ones.
drop policy "hands_select_public" on public.hands;

create policy "hands_select_public_or_owner"
  on public.hands for select
  to anon, authenticated
  using (is_public or auth.uid() = user_id);
