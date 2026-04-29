import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import Dashboard from "@/components/poker/Dashboard";
import { listMyHands } from "@/lib/hands/db";
import { getMyProfile } from "@/lib/profiles/db";

export default async function DashboardPage({
  searchParams,
}: {
  // Next.js 16 hands searchParams as a Promise.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [hands, profile, params] = await Promise.all([
    listMyHands(),
    getMyProfile(),
    searchParams,
  ]);
  // First-run UX: surface the bundled sample rows only when the user has no
  // hands of their own. Once they record one, the samples disappear.
  const showSamples = hands.length === 0;

  // ?demo=N → inject N generated hands into the dashboard for visual review.
  // Capped at 500 so a typo doesn't melt the browser. Not persisted; not
  // surfaced anywhere except this page.
  const demoRaw = params.demo;
  const demoStr = Array.isArray(demoRaw) ? demoRaw[0] : demoRaw;
  const demoCount = demoStr
    ? Math.min(500, Math.max(0, Number.parseInt(demoStr, 10) || 0))
    : 0;

  return (
    <Dashboard
      initialUsername={profile?.username ?? null}
      signOutAction={logout}
      initialHands={hands}
      showSamples={showSamples}
      demoCount={demoCount}
    />
  );
}
