import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Settings from "@/components/settings/Settings";
import { getMyProfile } from "@/lib/profiles/db";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getMyProfile();

  // Supabase exposes `app_metadata.provider` (the most-recent sign-in
  // provider) and `.providers` (every linked provider). Fall back to "email"
  // if the metadata is missing — older test accounts pre-date the field.
  const provider = (user.app_metadata?.provider as string) ?? "email";
  const providersRaw = user.app_metadata?.providers;
  const providers = Array.isArray(providersRaw)
    ? (providersRaw as string[])
    : [provider];

  // Whether the user already has an email/password identity. Drives the
  // settings password form: if true, the form requires the current
  // password before changing; if false (OAuth-only), the user is setting
  // an initial password and current-password is omitted.
  const hasPasswordIdentity =
    user.identities?.some((i) => i.provider === "email") ?? false;

  return (
    <Settings
      email={user.email ?? ""}
      initialUsername={profile?.username ?? null}
      provider={provider}
      providers={providers}
      hasPasswordIdentity={hasPasswordIdentity}
    />
  );
}
