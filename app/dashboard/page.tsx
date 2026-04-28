import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import Dashboard from "@/components/poker/Dashboard";
import { listMyHands } from "@/lib/hands/db";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const hands = await listMyHands();
  // First-run UX: surface the bundled sample rows only when the user has no
  // hands of their own. Once they record one, the samples disappear.
  const showSamples = hands.length === 0;

  return (
    <Dashboard
      user={user.email ?? ""}
      signOutAction={logout}
      initialHands={hands}
      showSamples={showSamples}
    />
  );
}
