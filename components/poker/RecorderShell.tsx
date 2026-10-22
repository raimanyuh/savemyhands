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
  const { isMobile } = useIsMobile();
  const [communityDraft, setCommunityDraft] = useState<RecorderState>();
  const [drawDraft, setDrawDraft] = useState<SingleDrawDraft>();
  // SingleDrawRecorder owns one controller across responsive layouts.
  if (drawDraft) return <SingleDrawRecorder initialDraft={drawDraft} onSwitchGame={() => setDrawDraft(undefined)} />;
  const selectSingleDraw = (state: RecorderState) => {
    setCommunityDraft(state);
    setDrawDraft(singleDrawDraftFromCommunity(state));
  };
  if (isMobile) return <MobileRecorder initialSetup={communityDraft} onSelectSingleDraw={selectSingleDraw} />;
  return <Recorder initialSetup={communityDraft} onSelectSingleDraw={selectSingleDraw} />;
}
