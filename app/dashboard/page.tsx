import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import DashboardShell from "@/components/poker/DashboardShell";
import { listMyHands } from "@/lib/hands/db";
import { getMyProfile } from "@/lib/profiles/db";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [hands, profile] = await Promise.all([listMyHands(), getMyProfile()]);

  return (
    <DashboardShell
      initialUsername={profile?.username ?? null}
      signOutAction={logout}
      initialHands={hands}
    />
  );
}
