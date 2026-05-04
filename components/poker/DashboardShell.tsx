"use client";

// Route-level branch between desktop and mobile dashboard. Mirrors
// RecorderShell — the /dashboard page is server-rendered (auth + data
// fetch); this client wrapper picks which UI to mount once the
// viewport is known. Below 640px → mobile; 640px and up → existing
// desktop UI (tablet reuses desktop).

import { useIsMobile } from "@/lib/use-is-mobile";
import Dashboard from "./Dashboard";
import MobileDashboard from "@/components/mobile/MobileDashboard";
import type { SavedHand } from "./hand";

export default function DashboardShell({
  initialUsername,
  signOutAction,
  initialHands,
}: {
  initialUsername: string | null;
  signOutAction?: () => void | Promise<void>;
  initialHands: SavedHand[];
}) {
  const { isMobile } = useIsMobile();
  if (isMobile) {
    return (
      <MobileDashboard
        initialUsername={initialUsername}
        signOutAction={signOutAction}
        initialHands={initialHands}
      />
    );
  }
  return (
    <Dashboard
      initialUsername={initialUsername}
      signOutAction={signOutAction}
      initialHands={initialHands}
    />
  );
}
