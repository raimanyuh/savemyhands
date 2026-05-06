"use server";

// Server Actions for the profiles table. Thin wrappers over the db module
// that revalidate the dashboard so the new username appears on the next
// navigation without a hard reload.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isUsernameAvailable,
  setUsername,
  USERNAME_REGEX,
  type Profile,
} from "./db";

// Returns { ok: true, profile } on success or { ok: false, error } on a
// validation / uniqueness failure. Errors come back as plain strings so the
// modal can render them inline without a separate exception path.
export type SetUsernameResult =
  | { ok: true; profile: Profile }
  | { ok: false; error: string };

export async function setUsernameAction(
  username: string,
): Promise<SetUsernameResult> {
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_REGEX.test(normalized)) {
    return {
      ok: false,
      error: "3-20 chars: lowercase letters, numbers, underscore.",
    };
  }
  const available = await isUsernameAvailable(normalized);
  if (!available) {
    return { ok: false, error: "That username is taken." };
  }
  try {
    const profile = await setUsername(normalized);
    revalidatePath("/dashboard");
    return { ok: true, profile };
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "23505") return { ok: false, error: "That username is taken." };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save username.",
    };
  }
}

// Live availability probe for the picker UI's debounced check.
export async function checkUsernameAvailableAction(
  username: string,
): Promise<{ ok: true; available: boolean } | { ok: false; error: string }> {
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_REGEX.test(normalized)) {
    return {
      ok: false,
      error: "3-20 chars: lowercase letters, numbers, underscore.",
    };
  }
  try {
    return { ok: true, available: await isUsernameAvailable(normalized) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not check username.",
    };
  }
}

// Sets a new password on the signed-in user's auth record. For users who
// already have an email/password identity, the current password must be
// supplied and is verified via signInWithPassword before the update —
// closes the "stolen session can lock out the owner" gap. OAuth-only
// users (no email-password identity yet) can set an initial password
// without verification, which is the standard Supabase pattern for
// adding a password to a Google/Discord-only account.
export async function changePasswordAction(
  currentPassword: string | null,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const hasEmailIdentity =
    user.identities?.some((i) => i.provider === "email") ?? false;

  if (hasEmailIdentity) {
    if (!currentPassword) {
      return { ok: false, error: "Current password is required." };
    }
    if (!user.email) {
      // Defensive: an email identity without an email shouldn't happen,
      // but if it does we can't verify, so refuse rather than fall
      // through to the unverified update path.
      return { ok: false, error: "Could not verify current password." };
    }
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return { ok: false, error: "Current password is incorrect." };
    }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Deletes the signed-in user's account via the SECURITY DEFINER RPC, then
// signs them out and redirects home. Cascades on profiles + hands clean up
// owned rows. Throws (not returns) on RPC failure so the form can surface it.
export async function deleteAccountAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    // Surface the underlying message so the client can render it; this is
    // the one settings action where we throw rather than return because the
    // success path redirects (no opportunity to consume a result).
    throw new Error(error.message);
  }
  // Session cookie is now stale (the user it referenced is gone). Clear it
  // before redirecting so the next request sees an anon visitor.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
