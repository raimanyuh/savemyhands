// Shared save-hand pipeline used by both desktop Recorder and the
// upcoming MobileRecorder. Pure data + IO — no React, no router, no
// alerts. Call sites wrap this in their own useTransition + navigation.
//
// The pipeline:
//   1. Build the SavedHand payload from RecorderState + resolved awards.
//   2. Yield one frame so the calling transition can paint "Saving…"
//      before the equity precompute locks the main thread.
//   3. Precompute per-step equity for both boards (skipped silently if
//      anything throws — the replayer falls back to live computation).
//   4. POST the payload via the server action.
//
// Returns the new hand's id on success. Throws on save failure so the
// caller can decide how to surface it.

import { saveHandAction } from "@/lib/hands/actions";
import {
  derivePotType,
  isMultiway,
  recordedToHand,
  type SavedHand,
} from "@/components/poker/hand";
import { precomputeEquityByStep } from "@/components/poker/equity";
import { committedBySeatFinal } from "@/components/poker/engine";
import type { RecorderState } from "@/components/poker/engine";
import {
  seatWinnings,
  type PotAward,
} from "@/components/poker/hand-eval";

export type BuildAndSaveArgs = {
  state: RecorderState;
  // Per-pot awards from the showdown evaluator (resolvedAwards memo on
  // the call site). Null if the hand isn't fully resolved (missing
  // villain reveals, incomplete board, hero not shown). When null we
  // record heroWon = 0 — the caller is responsible for gating saves
  // on resolved !== null when that matters.
  resolvedAwards: PotAward[][] | null;
  heroPos: number;
  // Position label for the hero seat ("BTN", "SB", etc.) — derived by
  // the caller via POSITION_NAMES[playerCount][heroPos].
  heroPosName: string;
};

export type BuildAndSaveResult = {
  // The id assigned by the server action. Useful for navigating to
  // /hand/<id> after save.
  id: string;
};

export async function buildAndSaveHand(
  args: BuildAndSaveArgs,
): Promise<BuildAndSaveResult> {
  const { state, resolvedAwards: awards, heroPos, heroPosName } = args;

  // committedBySeatFinal applies the per-street uncalled-bet refund, so
  // heroPaid is what hero actually parted with — not the raw sum of
  // bet/raise amounts (which would double-count re-raises). seatWinnings
  // sums per-pot allocations for hero, handling side pots and split-pot
  // ties.
  const heroPaid = committedBySeatFinal(state)[heroPos] ?? 0;
  const heroWon = awards ? seatWinnings(awards, heroPos) : 0;
  const result = heroWon - heroPaid;

  const board = state.board.filter((c): c is string => Boolean(c));
  const padded: string[] = [...board];
  while (padded.length < 5) padded.push("—");

  // Render the user-chosen ISO date as "Mon DD, YY" for the dashboard
  // column. Parse as local time to avoid the off-by-one timezone shift.
  const [yy, mm, dd] = state.date.split("-").map(Number);
  const dateObj = new Date(yy, (mm || 1) - 1, dd || 1);
  const displayDate = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "2-digit",
  });

  let newHand: Omit<SavedHand, "id"> = {
    name: state.handName.trim() || "Untitled hand",
    date: displayDate,
    stakes: `${state.sb}/${state.bb}`,
    loc: state.venue.trim() || "—",
    positions: heroPosName,
    multiway: isMultiway({
      playerCount: state.playerCount,
      actions: state.actions,
    }),
    board: padded,
    type: state.bombPotOn ? "BP" : derivePotType(state.actions),
    tags: [],
    result,
    fav: false,
    notes: state.notes.trim() || undefined,
    _full: {
      players: state.players,
      actions: state.actions,
      board: state.board,
      sb: state.sb,
      bb: state.bb,
      playerCount: state.playerCount,
      heroPosition: state.heroPosition,
      straddleOn: state.straddleOn,
      straddleAmt: state.straddleAmt,
      bombPotOn: state.bombPotOn,
      bombPotAmt: state.bombPotAmt,
      doubleBoardOn: state.doubleBoardOn,
      board2: state.doubleBoardOn ? state.board2 : undefined,
      gameType: state.gameType,
      muckedSeats: [...state.muckedSeats],
      notes: state.notes.trim() || undefined,
      venue: state.venue.trim() || undefined,
      date: state.date,
      annotations:
        Object.keys(state.annotations).length > 0
          ? { ...state.annotations }
          : undefined,
    },
  };

  // Yield a frame before the heavy equity enumeration so React commits
  // the calling transition first — the Save button paints "Saving…" and
  // turns disabled before the main thread locks. Without this the INP
  // between click and next paint was several hundred ms on multiway /
  // PLO / double-board hands (tracked as a Vercel INP alert). The yield
  // itself is one microtask + a 0ms timeout, well under any
  // user-perceivable threshold.
  await new Promise((r) => setTimeout(r, 0));

  // Precompute per-step equity. recordedToHand needs an `id` to
  // typecheck; a placeholder is fine — we only read `steps` and
  // `players` back from it. Double-board runs the pass twice (once per
  // board) so the replayer renders two badges per seat.
  try {
    const replay = recordedToHand({ ...newHand, id: "tmp" } as SavedHand);
    if (replay && newHand._full) {
      const equityByStep = precomputeEquityByStep(
        replay,
        "board",
        state.gameType,
      );
      const equityByStep2 = state.doubleBoardOn
        ? precomputeEquityByStep(replay, "board2", state.gameType)
        : undefined;
      const patch: Partial<typeof newHand._full> = {};
      if (Object.keys(equityByStep).length > 0)
        patch.equityByStep = equityByStep;
      if (equityByStep2 && Object.keys(equityByStep2).length > 0)
        patch.equityByStep2 = equityByStep2;
      if (Object.keys(patch).length > 0) {
        newHand = { ...newHand, _full: { ...newHand._full, ...patch } };
      }
    }
  } catch (e) {
    // Equity precompute failures shouldn't block the save — the
    // replayer will fall back to live computation.
    console.warn("Equity precompute failed; replayer will compute live.", e);
  }

  const saved = await saveHandAction(newHand);
  return { id: saved.id };
}
