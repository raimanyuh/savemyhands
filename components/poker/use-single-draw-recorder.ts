"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { buildAndSaveSingleDrawHand } from "@/lib/recorder/save-hand";
import { buildSingleDrawHand, type BuildSingleDrawHandArgs } from "@/lib/recorder/single-draw-hand";
import { startRouteProgress } from "@/lib/route-progress";
import {
  deriveSingleDrawBetting, singleDrawCommittedBySeat, singleDrawCommittedBySeatFinal,
  undoSingleDraw, type SingleDrawState,
} from "./single-draw-engine";
import type { DrawReplayCard } from "./single-draw-replay";
import type { SingleDrawDraft } from "./single-draw-ui";

export type SingleDrawSaveOptions = {
  onSaveAction?: (args: BuildSingleDrawHandArgs) => Promise<{ id: string }>;
  onSavedAction?: (id: string) => void;
};

/** One controller survives desktop/mobile layout changes. All edits use the domain engine. */
export function useSingleDrawRecorder(initialDraft: SingleDrawDraft, {
  onSaveAction = buildAndSaveSingleDrawHand, onSavedAction,
}: SingleDrawSaveOptions) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState(initialDraft.state);
  const [name, setName] = useState(initialDraft.name);
  const [notes, setNotes] = useState(initialDraft.notes);
  const [venue, setVenue] = useState(initialDraft.venue);
  const [date, setDate] = useState(initialDraft.date);
  const [selected, setSelected] = useState<number[]>([]);
  const [editingSeat, setEditingSeat] = useState<number | null>(null);
  const [saving, startSave] = useTransition();
  const betting = deriveSingleDrawBetting(state);
  const drawSeat = state.exchange?.order[state.exchange.cursor] ?? null;
  const activeSeat = betting?.activeSeat ?? drawSeat;
  const setup = state.phase === "setup";
  const finished = state.phase === "showdown" || state.phase === "done";
  const folded = state.actions.filter((action) => action.action === "fold").map((action) => action.seat);
  const committed = setup ? {} : betting ? singleDrawCommittedBySeat(state) : singleDrawCommittedBySeatFinal(state);
  const pot = Object.values(committed).reduce((sum, amount) => sum + amount, 0);
  const args = useMemo(() => ({ state, name, notes, venue, date }), [state, name, notes, venue, date]);
  const resolution = useMemo(() => {
    if (!finished) return { payload: null, reason: "Finish the hand before saving." };
    try { return { payload: buildSingleDrawHand(args), reason: "" }; }
    catch (error) { return { payload: null, reason: error instanceof Error ? error.message : "Resolve all hands." }; }
  }, [finished, args]);
  const apply = (update: (current: SingleDrawState) => SingleDrawState) => {
    if (saving) return false;
    try {
      const next = update(state);
      setState(next); setSelected([]); setEditingSeat(null);
      return true;
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't record that action."); return false; }
  };
  const undo = () => apply(undoSingleDraw);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" &&
          !(event.target as HTMLElement | null)?.closest("input, textarea, [contenteditable='true']")) {
        event.preventDefault();
        if (!saving) { setState((current) => undoSingleDraw(current)); setSelected([]); setEditingSeat(null); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving]);
  const cards: Record<number, DrawReplayCard[]> = Object.fromEntries(state.players.map((player) => [player.seat,
    Array.from({ length: 5 }, (_, index) => {
      const known = (player.seat === state.heroSeat || finished) ? player.cards?.[index] : undefined;
      return { present: !!known || player.seat !== state.heroSeat, visibility: known ? "up" : "down", ...(known ? { card: known } : {}) };
    }),
  ]));
  const labels: Record<number, string> = {};
  if (state.phase === "draw") for (const draw of state.draws) labels[draw.seat] = draw.count ? `Draw ${draw.count}` : "Pat";
  if (betting) for (const action of state.actions.filter((action) => action.round === betting.round)) {
    if (action.action === "check") labels[action.seat] = "check";
    else delete labels[action.seat];
  }
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
  return {
    state, name, setName, notes, setNotes, venue, setVenue, date, setDate,
    selected, setSelected, editingSeat, setEditingSeat, saving,
    betting, drawSeat, activeSeat, setup, finished, folded, committed, pot, resolution,
    apply, undo, cards, labels, save,
  };
}

export type SingleDrawRecorderController = ReturnType<typeof useSingleDrawRecorder>;
