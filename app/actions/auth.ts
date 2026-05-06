"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AuthState = { error: string | null };

export async function login(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signup(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = formData.get("password") as string;
  // Server-side floor matches the settings password-change action so a
  // user can rotate to a same-length password later without hitting
  // "must be at least 8 characters". Client-side `minLength` on the
  // form catches most cases; this guards against a request that bypasses
  // the HTML constraint.
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
