"use client";

// Branches the landing page's embedded sample replayer between desktop
// (horizontal felt, max 960px) and mobile (vertical felt, ≤460px) based
// on viewport width. Mirrors RecorderShell / DashboardShell / ReplayerShell
// — server components can't call hooks, so the shell does the runtime
// branch in a client wrapper.

import { useIsMobile } from "@/lib/use-is-mobile";
import { MobileSampleReplay } from "./MobileSampleReplay";
import { SampleReplay } from "./SampleReplay";

export function SampleReplayShell() {
  const { isMobile } = useIsMobile();
  if (isMobile) return <MobileSampleReplay />;
  return <SampleReplay />;
}
