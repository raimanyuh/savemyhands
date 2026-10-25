"use client";

// Route-level branch between desktop and mobile recorder. The /record
// page is server-rendered (auth gate); this client wrapper picks which
// recorder to mount once the viewport is known. Below 640px → mobile;
// 640px and up → existing desktop UI (tablet reuses desktop).

import { useIsMobile } from "@/lib/use-is-mobile";
import { useState } from "react";
import type { RecorderState } from "./engine";
import SingleDrawRecorder from "./SingleDrawRecorder";
import StudRecorder from "./StudRecorder";
import { studDraftFromCommunity, type StudDraft } from "./stud-ui";
import { singleDrawDraftFromCommunity, type SingleDrawDraft } from "./single-draw-ui";
import Recorder from "./Recorder";
import MobileRecorder from "@/components/mobile/MobileRecorder";

export default function RecorderShell({ enableStud = false, enableRazz = false, enableStudHilo = false }: { enableStud?: boolean; enableRazz?: boolean; enableStudHilo?: boolean }) {
  const { isMobile } = useIsMobile();
  const [communityDraft, setCommunityDraft] = useState<RecorderState>();
  const [drawDraft, setDrawDraft] = useState<SingleDrawDraft>();
  const [studDraft, setStudDraft] = useState<StudDraft>();
  // SingleDrawRecorder owns one controller across responsive layouts.
  if (drawDraft) return <SingleDrawRecorder initialDraft={drawDraft} onSwitchGame={() => setDrawDraft(undefined)} />;
  if (studDraft && (studDraft.state.variant === "RAZZ" ? enableRazz : studDraft.state.variant === "STUD_HILO_8" ? enableStudHilo : enableStud)) return <StudRecorder initialDraft={studDraft} onSwitchGame={() => setStudDraft(undefined)} />;
  const selectSingleDraw = (state: RecorderState) => {
    setCommunityDraft(state);
    setDrawDraft(singleDrawDraftFromCommunity(state));
  };
  const selectStud = enableStud ? (state: RecorderState) => {
    setCommunityDraft(state);
    setStudDraft(studDraftFromCommunity(state));
  } : undefined;
  const selectRazz = enableRazz ? (state: RecorderState) => {
    setCommunityDraft(state);
    setStudDraft(studDraftFromCommunity(state, "RAZZ"));
  } : undefined;
  const selectStudHilo = enableStudHilo ? (state: RecorderState) => {
    setCommunityDraft(state);
    setStudDraft(studDraftFromCommunity(state, "STUD_HILO_8"));
  } : undefined;
  if (isMobile) return <MobileRecorder initialSetup={communityDraft} onSelectSingleDraw={selectSingleDraw} onSelectStud={selectStud} onSelectRazz={selectRazz} onSelectStudHilo={selectStudHilo} />;
  return <Recorder initialSetup={communityDraft} onSelectSingleDraw={selectSingleDraw} onSelectStud={selectStud} onSelectRazz={selectRazz} onSelectStudHilo={selectStudHilo} />;
}
