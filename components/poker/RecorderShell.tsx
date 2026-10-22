"use client";

// Route-level branch between desktop and mobile recorder. The /record
// page is server-rendered (auth gate); this client wrapper picks which
// recorder to mount once the viewport is known. Below 640px → mobile;
// 640px and up → existing desktop UI (tablet reuses desktop).

import { useIsMobile } from "@/lib/use-is-mobile";
import { useState } from "react";
import type { RecorderState } from "./engine";
import SingleDrawRecorder from "./SingleDrawRecorder";
import { singleDrawDraftFromCommunity, type SingleDrawDraft } from "./single-draw-ui";
import Recorder from "./Recorder";
import MobileRecorder from "@/components/mobile/MobileRecorder";

export default function RecorderShell() {
  const { isMobile, isDesktop } = useIsMobile();
  const [communityDraft, setCommunityDraft] = useState<RecorderState>();
  const [drawDraft, setDrawDraft] = useState<SingleDrawDraft>();
  // Preserve an in-progress draw when resizing; mobile's own recorder
  // does not offer the format until its adaptation is complete.
  if (drawDraft) return <SingleDrawRecorder initialDraft={drawDraft} onSwitchGame={() => setDrawDraft(undefined)} />;
  if (isMobile) return <MobileRecorder />;
  return <Recorder initialSetup={communityDraft} onSelectSingleDraw={isDesktop ? (state) => {
    setCommunityDraft(state);
    setDrawDraft(singleDrawDraftFromCommunity(state));
  } : undefined} />;
}
