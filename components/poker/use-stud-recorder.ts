"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { startRouteProgress } from "@/lib/route-progress";
import { buildAndSaveStudHand } from "@/lib/recorder/save-hand";
import { buildStudHand, type BuildStudHandArgs } from "@/lib/recorder/stud-hand";
import { deriveStudBetting, pendingStudDealSeat, studAccounting, undoStud, type StudState } from "./stud-engine";
import { studRecorderCards, type StudDraft } from "./stud-ui";

export type StudSaveOptions = {
  onSaveAction?: (args: BuildStudHandArgs) => Promise<{ id: string }>;
  onSavedAction?: (id: string) => void;
};
/** Shared controller, ready for a mobile sibling without remounting state. */
export function useStudRecorder(initialDraft: StudDraft, { onSaveAction = buildAndSaveStudHand, onSavedAction }: StudSaveOptions) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState(initialDraft.state);
  const [name, setName] = useState(initialDraft.name);
  const [notes, setNotes] = useState(initialDraft.notes);
  const [venue, setVenue] = useState(initialDraft.venue);
  const [date, setDate] = useState(initialDraft.date);
  const [editingSeat, setEditingSeat] = useState<number | null>(null);
  const [openFullBet, setOpenFullBet] = useState(false);
  const [saving, startSave] = useTransition();
  const setup = state.phase === "setup";
  const finished = state.phase === "showdown" || state.phase === "done";
  const betting = deriveStudBetting(state);
  const dealSeat = pendingStudDealSeat(state);
  const activeSeat = betting?.activeSeat ?? dealSeat;
  const folded = state.events.flatMap((event) => event.type === "action" && event.action === "fold" ? [event.seat] : []);
  const accounting = studAccounting(state, finished);
  const cards = studRecorderCards(state);
  const labels: Record<number, string> = {};
  if (betting) for (const event of state.events) if (event.round === state.street && event.type === "action") {
    if (event.action === "check") labels[event.seat] = "check";
    else delete labels[event.seat];
  }
  const args = useMemo(() => ({ state, name, notes, venue, date }), [state, name, notes, venue, date]);
  const resolution = useMemo(() => {
    if (!finished) return { payload: null, reason: "Finish the hand before saving." };
    try { return { payload: buildStudHand(args), reason: "" }; }
    catch (error) { return { payload: null, reason: error instanceof Error ? error.message : "Resolve all hands." }; }
  }, [finished, args]);
  const apply = (update: (current: StudState) => StudState) => {
    if (saving) return false;
    try { const next = update(state); setState(next); setEditingSeat(null); return true; }
    catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't record that action."); return false; }
  };
  const undo = () => apply(undoStud);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" &&
          !(event.target as HTMLElement | null)?.closest("input, textarea, [contenteditable='true']")) {
        event.preventDefault();
        if (!saving) { setState((current) => undoStud(current)); setEditingSeat(null); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving]);
  const save = () => {
    if (!resolution.payload || editingSeat !== null || saving) return;
    startSave(async () => {
      try {
        const saved = await onSaveAction(args);
        if (onSavedAction) onSavedAction(saved.id);
        else { startRouteProgress(); router.push(`/hand/${saved.id}`); }
      } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save the hand. Try again."); }
    });
  };
  return { state, name, setName, notes, setNotes, venue, setVenue, date, setDate,
    editingSeat, setEditingSeat, openFullBet, setOpenFullBet, saving, setup, finished,
    betting, dealSeat, activeSeat, folded, committed: accounting.committed, pot: accounting.totalPot,
    cards, labels, resolution, apply, undo, save,
  };
}
export type StudRecorderController = ReturnType<typeof useStudRecorder>;
