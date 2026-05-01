// Server-side data layer for the `profiles` table.
//
// RLS enforces:
//   * SELECT — public (anon + authenticated) so usernames render on shared
//     hand pages for logged-out viewers.
//   * INSERT/UPDATE — owner only (auth.uid() = id).

import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  username: string;
};

// 3-20 chars, lowercase alphanumeric + underscore. Mirrors the DB CHECK so
// we can give the user a friendly error before round-tripping to Postgres.
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

// Returns the signed-in user's profile, or null if they haven't set one yet.
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

// Public read by user id — used to attribute shared hands.
export async function getProfileByUserId(
  userId: string,
): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

// Live availability check for the picker UI. Case-folds before querying so
// the user can't reserve "Foo" while someone else holds "foo".
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data === null;
}

// Upsert the signed-in user's username. Throws on validation, RLS, or
// uniqueness failures — the action layer translates those into friendly
// messages for the client.
export async function setUsername(username: string): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const normalized = username.toLowerCase();
  if (!USERNAME_REGEX.test(normalized)) {
    throw new Error(
      "Username must be 3-20 chars: lowercase letters, numbers, underscore",
    );
  }
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, username: normalized },
      { onConflict: "id" },
    )
    .select("id, username")
    .single();
  if (error) throw error;
  return data as Profile;
}
