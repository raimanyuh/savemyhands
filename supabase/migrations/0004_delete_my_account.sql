-- Lets an authenticated user delete their own account.
--
-- The Supabase JS client doesn't expose `auth.admin.deleteUser` to anon /
-- authenticated keys (it requires the service role), so we wrap a self-delete
-- in a SECURITY DEFINER function that's locked down to `auth.uid() = id`.
-- Cascades on `profiles.id` and `hands.user_id` clean up the rest.
--
-- Callers invoke this via supabase.rpc('delete_my_account'). The function
-- returns void; on success the user's session is invalidated and the client
-- should sign out + redirect.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- Lock down: only authenticated users can call this. Anon and the public
-- role get no execute privilege.
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
