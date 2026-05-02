"use client";

// Route-level branch between desktop and mobile recorder. The /record
// page is server-rendered (auth gate); this client wrapper picks which
// recorder to mount once the viewport is known. Below 640px → mobile;
// 640px and up → existing desktop UI (tablet reuses desktop).

import { useIsMobile } from "@/lib/use-is-mobile";
import Recorder from "./Recorder";
import MobileRecorder from "@/components/mobile/MobileRecorder";

export default function RecorderShell() {
  const { isMobile } = useIsMobile();
  if (isMobile) return <MobileRecorder />;
  return <Recorder />;
}
