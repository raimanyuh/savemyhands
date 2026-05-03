"use client";

// Mobile recorder — sibling of components/poker/Recorder.tsx for
// viewports below 640px. Reuses the same reducer, derivations, and
// save pipeline; only the UI is parallel.
//
// This file is the shell + orchestration. UI sub-pieces (vertical felt,
// card picker sheet, raise sizer, setup sheet, showdown panel) live
// in adjacent files under components/mobile/ and get composed here.
//
// Build order matters — until a sub-piece lands, its placeholder lives
// inline so the route compiles and the layout is testable end-to-end.

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { POSITION_NAMES } from "@/components/poker/lib";
import {
  committedBySeat,
  computeSidePots,
  deriveStreet,
  holeCardCount,
  initialStateFromDefaults,
  reducer,
} from "@/components/poker/engine";
import type { Player, RecorderState } from "@/components/poker/engine";
import {
  awardPots,
  awardPotsMultiBoard,
  type PotAward,
} from "@/components/poker/hand-eval";
import { buildAndSaveHand } from "@/lib/recorder/save-hand";
import { VerticalFelt } from "./VerticalFelt";
import { CardPickerSheet } from "./CardPickerSheet";
import { RaiseSizer } from "./RaiseSizer";
import { SetupSheet } from "./SetupSheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const BG = "oklch(0.145 0 0)";

export default function MobileRecorder() {
  const router = useRouter();
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => initialStateFromDefaults(),
  );
  const [savePending, startSave] = useTransition();
  const [setupOpen, setSetupOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  // Picker target — null when closed. Carries enough info for the pick
  // handler to dispatch the right reducer event and to advance to the
  // next empty slot in the same row when one exists.
  const [pickerTarget, setPickerTarget] = useState<
    | { kind: "hero"; slot: number }
    | { kind: "board"; slot: number; boardIdx: 0 | 1 }
    | { kind: "villain"; seat: number; slot: number }
    | null
  >(null);
  const [sizerOpen, setSizerOpen] = useState(false);

  const N = state.playerCount;
  const heroPos = state.heroPosition;
  const posNames = POSITION_NAMES[N];

  const derived = useMemo(() => deriveStreet(state), [state]);

  // Board-completion flags drive both auto-advance and the deal CTAs.
  // Mirrored from Recorder.tsx so the mobile shell behaves identically.
  const board1FlopFilled =
    !!(state.board[0] && state.board[1] && state.board[2]);
  const board2FlopFilled =
    !!(state.board2[0] && state.board2[1] && state.board2[2]);
  const board1TurnFilled = !!state.board[3];
  const board2TurnFilled = !!state.board2[3];
  const board1RiverFilled = !!state.board[4];
  const board2RiverFilled = !!state.board2[4];
  const flopFilled =
    board1FlopFilled && (!state.doubleBoardOn || board2FlopFilled);
  const turnFilled =
    board1TurnFilled && (!state.doubleBoardOn || board2TurnFilled);
  const riverFilled =
    board1RiverFilled && (!state.doubleBoardOn || board2RiverFilled);

  // Auto-advance once a street's board is complete and betting closed.
  useEffect(() => {
    if (!derived || !derived.streetClosed) return;
    if (state.phase === "preflop" && flopFilled)
      dispatch({ type: "advanceStreet" });
    else if (state.phase === "flop" && turnFilled)
      dispatch({ type: "advanceStreet" });
    else if (state.phase === "turn" && riverFilled)
      dispatch({ type: "advanceStreet" });
  }, [
    flopFilled,
    turnFilled,
    riverFilled,
    derived?.streetClosed,
    derived,
    state.phase,
  ]);

  // Hand-over → showdown after a short pause so the last action's bubble
  // gets a moment on screen before the panel takes over.
  useEffect(() => {
    if (!derived) return;
    if (derived.handOver) {
      const t = setTimeout(() => dispatch({ type: "goShowdown" }), 250);
      return () => clearTimeout(t);
    }
  }, [derived?.handOver, derived]);

  // River close → showdown. Without this the recorder would freeze on
  // the river phase after betting closes with multiple players still in
  // — the action bar gates on activeSeat, which is null when the
  // street is closed. Desktop has a manual "Go to showdown" CTA; the
  // mobile recorder skips that ceremony and just advances.
  useEffect(() => {
    if (!derived || !derived.streetClosed) return;
    if (state.phase === "river" && riverFilled) {
      dispatch({ type: "goShowdown" });
    }
  }, [derived?.streetClosed, derived, state.phase, riverFilled]);

  // Auto-open the card picker on the next-to-deal board slot when a
  // betting round closes. Mirrors the desktop picker's
  // autoOpenOnHighlight behavior — the user shouldn't have to know that
  // tapping the dashed slot is what advances the hand. The ref tracks
  // which (phase + slot + boardIdx) tuple we last auto-opened for, so
  // dismissing the picker doesn't trigger a re-open. Manual taps on
  // any board slot still work via openBoardSlot.
  const lastAutoOpenRef = useRef<string | null>(null);
  // Helper used by both the auto-open effect below and the
  // "Deal next street" CTA in the bottom region. Returns the
  // next slot/board to deal into based on current phase, or null
  // when nothing's pending.
  const nextDealSlot = useMemo<
    { slot: number; boardIdx: 0 | 1 } | null
  >(() => {
    if (state.phase === "preflop") {
      const b1 = state.board.findIndex((c, i) => i <= 2 && !c);
      if (b1 !== -1) return { slot: b1, boardIdx: 0 };
      if (state.doubleBoardOn) {
        const b2 = state.board2.findIndex((c, i) => i <= 2 && !c);
        if (b2 !== -1) return { slot: b2, boardIdx: 1 };
      }
    } else if (state.phase === "flop") {
      if (!state.board[3]) return { slot: 3, boardIdx: 0 };
      if (state.doubleBoardOn && !state.board2[3])
        return { slot: 3, boardIdx: 1 };
    } else if (state.phase === "turn") {
      if (!state.board[4]) return { slot: 4, boardIdx: 0 };
      if (state.doubleBoardOn && !state.board2[4])
        return { slot: 4, boardIdx: 1 };
    }
    return null;
  }, [state.phase, state.board, state.board2, state.doubleBoardOn]);

  useEffect(() => {
    if (!derived || !derived.streetClosed) return;
    if (!nextDealSlot) return;
    const key = `${state.phase}-${nextDealSlot.slot}-${nextDealSlot.boardIdx}`;
    if (lastAutoOpenRef.current === key) return;
    lastAutoOpenRef.current = key;
    setPickerTarget({
      kind: "board",
      slot: nextDealSlot.slot,
      boardIdx: nextDealSlot.boardIdx,
    });
  }, [
    derived?.streetClosed,
    derived,
    state.phase,
    nextDealSlot,
  ]);

  // resolvedAwards: per-pot allocation when showdown is fully resolved.
  // Returns null if any villain hasn't shown/mucked, the board is
  // incomplete, or hero hasn't been shown — the Save button reads this
  // null to gate the save action. Logic mirrors Recorder.tsx so both
  // surfaces gate saves identically.
  const resolvedAwards = useMemo<PotAward[][] | null>(() => {
    if (state.phase !== "showdown" && state.phase !== "done") return null;
    const board1 = state.board.filter((c): c is string => Boolean(c));
    const board2 = state.doubleBoardOn
      ? state.board2.filter((c): c is string => Boolean(c))
      : null;
    const folded = new Set<number>();
    for (const a of state.actions) if (a.action === "fold") folded.add(a.seat);
    const muckedSet = new Set(state.muckedSeats);
    const pots = computeSidePots(state);
    const survivors = state.players.filter((p) => !folded.has(p.seat));
    const villainSurvivors = survivors.filter((p) => p.seat !== heroPos);
    const heroAlone =
      villainSurvivors.length === 0 ||
      villainSurvivors.every((v) => muckedSet.has(v.seat));
    if (heroAlone) {
      return pots.map((p) => [{ amount: p.amount, winners: [heroPos] }]);
    }
    const holeCount = holeCardCount(state.gameType);
    const isShown = (p: Player): boolean => {
      if (!p.cards) return false;
      for (let i = 0; i < holeCount; i++) if (!p.cards[i]) return false;
      return true;
    };
    const villainsAwaiting = villainSurvivors.filter(
      (v) => !muckedSet.has(v.seat) && !isShown(v),
    );
    if (villainsAwaiting.length > 0) return null;
    if (board1.length < 5) return null;
    if (board2 !== null && board2.length < 5) return null;
    const hero = state.players[heroPos];
    if (!isShown(hero)) return null;
    const contestants = [
      hero,
      ...villainSurvivors.filter(
        (v) => !muckedSet.has(v.seat) && isShown(v),
      ),
    ].map((p) => ({
      seat: p.seat,
      cards: (p.cards as string[]).slice(0, holeCount),
    }));
    try {
      return board2
        ? awardPotsMultiBoard(
            pots,
            contestants,
            [board1, board2],
            state.gameType,
          )
        : awardPots(pots, contestants, board1, state.gameType);
    } catch {
      return null;
    }
  }, [state, heroPos]);

  // Has the user entered anything that would be lost on navigation away?
  const isDirty = () =>
    state.phase !== "setup" ||
    state.actions.length > 0 ||
    !!state.players[state.heroPosition]?.cards?.[0] ||
    !!state.players[state.heroPosition]?.cards?.[1] ||
    state.notes.trim().length > 0 ||
    state.handName !== "New hand" ||
    state.venue.trim().length > 0;

  const handleBack = async () => {
    if (!isDirty()) {
      router.push("/dashboard");
      return;
    }
    const ok = await confirm({
      title: "Leave without saving?",
      message: "Your in-progress recording will be lost.",
      confirmLabel: "Leave",
      destructive: true,
    });
    if (ok) router.push("/dashboard");
  };

  const saveHand = () => {
    startSave(async () => {
      try {
        await buildAndSaveHand({
          state,
          resolvedAwards,
          heroPos,
          heroPosName: posNames[heroPos] ?? "",
        });
      } catch (e) {
        console.error("Failed to save hand", e);
        window.alert(
          "Couldn't save the hand — check your connection and try again.",
        );
        return;
      }
      router.push("/dashboard");
    });
  };

  const canSave =
    !savePending &&
    (state.phase === "showdown" || state.phase === "done") &&
    resolvedAwards !== null;

  const pot = derived?.totalPot ?? 0;
  const streetLabel =
    state.bombPotOn && state.phase === "preflop"
      ? "FLOP"
      : (state.phase === "showdown" || state.phase === "done"
        ? "SHOWN"
        : state.phase === "setup"
          ? "SETUP"
          : state.phase.toUpperCase());
  const activeSeat = derived?.activeSeat ?? null;
  const actionHint =
    state.phase === "setup"
      ? "Pick hero hole cards to start"
      : activeSeat !== null
        ? `${posNames[activeSeat]} to act`
        : derived?.handOver
          ? "Hand over"
          : derived?.streetClosed
            ? `Deal ${nextStreetLabel(state.phase)}`
            : "—";

  // Live committed-by-seat — feeds VerticalFelt's stack-remaining label.
  const committed = committedBySeat(state);

  // foldedSeats and checkedSeats are passed to VerticalFelt for plate
  // dimming and check-bubble rendering. checkedSeats is computed per
  // current street: a seat shows the "check" pill if its most recent
  // action on the active street was a check.
  const foldedSeats = useMemo(() => {
    const set = new Set<number>();
    for (const a of state.actions) if (a.action === "fold") set.add(a.seat);
    return set;
  }, [state.actions]);

  // Setup-phase bubbles — SB/BB (and straddle if on) for normal hands,
  // flat ante on every seat for bomb pots. Mirrors the desktop felt's
  // setupBets so the user can see who's posting before the hand begins.
  // During play, deriveStreet's bets take over and this is unused.
  const setupBets = useMemo(() => {
    if (state.phase !== "setup") return {};
    const b: Record<number, number> = {};
    if (state.bombPotOn) {
      for (let i = 0; i < N; i++) b[i] = state.bombPotAmt;
      return b;
    }
    if (N === 2) {
      b[0] = state.sb;
      b[1] = state.bb;
    } else {
      b[1] = state.sb;
      b[2] = state.bb;
      if (state.straddleOn && N >= 4) b[3] = state.straddleAmt;
    }
    return b;
  }, [
    state.phase,
    N,
    state.sb,
    state.bb,
    state.straddleOn,
    state.straddleAmt,
    state.bombPotOn,
    state.bombPotAmt,
  ]);

  const checkedSeats = useMemo(() => {
    const set = new Set<number>();
    if (state.phase === "setup") return set;
    const seatLast: Record<number, string> = {};
    for (const a of state.actions) {
      if (a.street !== state.phase) continue;
      seatLast[a.seat] = a.action;
    }
    for (const [seat, action] of Object.entries(seatLast)) {
      if (action === "check") set.add(Number(seat));
    }
    return set;
  }, [state.actions, state.phase]);

  // Picker open handlers — set the target and let the sheet render.
  const openHeroCardSlot = (slot: number) =>
    setPickerTarget({ kind: "hero", slot });
  const openBoardSlot = (slot: number, boardIdx: 0 | 1) =>
    setPickerTarget({ kind: "board", slot, boardIdx });

  // All cards currently on the felt — the picker greys these out so the
  // user can't double-pick. When the picker is targeting a *filled*
  // slot (the user tapped a card to replace it), drop that slot's
  // current card from the set so the same card stays selectable —
  // otherwise the user would be unable to keep the slot's value or
  // even re-pick it deliberately.
  const usedCards = useMemo(() => {
    const set = new Set<string>();
    for (const p of state.players) {
      for (const c of p.cards ?? []) if (c) set.add(c);
    }
    for (const c of state.board) if (c) set.add(c);
    for (const c of state.board2) if (c) set.add(c);
    if (pickerTarget) {
      let cur: string | null = null;
      if (pickerTarget.kind === "hero") {
        cur = state.players[heroPos]?.cards?.[pickerTarget.slot] ?? null;
      } else if (pickerTarget.kind === "villain") {
        cur =
          state.players[pickerTarget.seat]?.cards?.[pickerTarget.slot] ?? null;
      } else {
        cur =
          pickerTarget.boardIdx === 1
            ? state.board2[pickerTarget.slot] ?? null
            : state.board[pickerTarget.slot] ?? null;
      }
      if (cur) set.delete(cur);
    }
    return set;
  }, [state.players, state.board, state.board2, pickerTarget, heroPos]);

  // Picker pick handler. Dispatches the relevant reducer event, then
  // advances to the next empty slot in the same row if one exists.
  // When the targeted slot was already filled (user tapped a card to
  // replace it), close the picker after the dispatch instead of
  // auto-advancing — the user's intent was a single replacement, not
  // a re-walk of the whole row.
  const handlePick = (card: string) => {
    if (!pickerTarget) return;
    if (pickerTarget.kind === "hero") {
      const heroPlayer = state.players[heroPos];
      const cards = heroPlayer?.cards ?? [];
      const wasReplacing = !!cards[pickerTarget.slot];
      dispatch({ type: "setHeroCard", idx: pickerTarget.slot, card });
      if (wasReplacing) {
        setPickerTarget(null);
        return;
      }
      const next = nextEmptyAfter(cards, pickerTarget.slot, card);
      if (next === null) setPickerTarget(null);
      else setPickerTarget({ kind: "hero", slot: next });
      return;
    }
    if (pickerTarget.kind === "board") {
      const board =
        pickerTarget.boardIdx === 1 ? state.board2 : state.board;
      const wasReplacing = !!board[pickerTarget.slot];
      dispatch({
        type: "setBoard",
        idx: pickerTarget.slot,
        card,
        boardIdx: pickerTarget.boardIdx,
      });
      if (wasReplacing) {
        setPickerTarget(null);
        return;
      }
      // Auto-advance through the flop's three slots; turn/river are
      // single-card so the next-empty check naturally returns null.
      const flopRange =
        pickerTarget.slot >= 0 && pickerTarget.slot <= 2 ? [0, 2] : null;
      if (flopRange) {
        const next = nextEmptyInRange(
          board,
          flopRange[0],
          flopRange[1],
          pickerTarget.slot,
          card,
        );
        if (next === null) setPickerTarget(null);
        else
          setPickerTarget({
            kind: "board",
            slot: next,
            boardIdx: pickerTarget.boardIdx,
          });
      } else {
        setPickerTarget(null);
      }
      return;
    }
    if (pickerTarget.kind === "villain") {
      const villain = state.players[pickerTarget.seat];
      const wasReplacing = !!villain?.cards?.[pickerTarget.slot];
      dispatch({
        type: "setOppCard",
        seat: pickerTarget.seat,
        idx: pickerTarget.slot,
        card,
      });
      if (wasReplacing) {
        setPickerTarget(null);
        return;
      }
      // Auto-advance through the villain's hole-card row. We can't
      // read the post-dispatch state here, so we project what the
      // cards array will look like AFTER the dispatch settles:
      // (existing entries) + (just-picked card at pickerTarget.slot).
      // Default villains start with cards: null so we have to use the
      // game's expected hole-card count rather than (cards?.length ?? 2)
      // — otherwise PLO would only advance through 2 slots, and the
      // first pick would close the picker entirely (cards.length === 0
      // when null).
      const need = holeCardCount(state.gameType);
      const projected: (string | null)[] = Array.from({ length: need }, (_, i) => {
        if (i === pickerTarget.slot) return card;
        return villain?.cards?.[i] ?? null;
      });
      let nextSlot: number | null = null;
      for (let i = 0; i < need; i++) {
        if (i === pickerTarget.slot) continue;
        if (!projected[i]) {
          nextSlot = i;
          break;
        }
      }
      if (nextSlot === null) setPickerTarget(null);
      else
        setPickerTarget({
          kind: "villain",
          seat: pickerTarget.seat,
          slot: nextSlot,
        });
    }
  };

  const pickerTitle = (() => {
    if (!pickerTarget) return "";
    if (pickerTarget.kind === "hero") {
      const need = state.players[heroPos]?.cards?.length ?? 2;
      return `Hero card ${pickerTarget.slot + 1} of ${need}`;
    }
    if (pickerTarget.kind === "villain") {
      // Same gameType-derived count as the auto-advance path — villain
      // .cards starts as null so length-based fallback would mislabel.
      const need = holeCardCount(state.gameType);
      const label = posNames[pickerTarget.seat] ?? "Villain";
      return `${label} card ${pickerTarget.slot + 1} of ${need}`;
    }
    const boardLabel =
      pickerTarget.slot <= 2
        ? "Flop"
        : pickerTarget.slot === 3
          ? "Turn"
          : "River";
    const slotInStreet =
      pickerTarget.slot <= 2 ? `${pickerTarget.slot + 1} of 3` : "";
    const board2Tag = pickerTarget.boardIdx === 1 ? " (board 2)" : "";
    return `${boardLabel}${slotInStreet ? ` · ${slotInStreet}` : ""}${board2Tag}`;
  })();

  // Showdown helpers — used by the Showdown panel below.
  const isShowdown = state.phase === "showdown" || state.phase === "done";
  const muckedSet = useMemo(
    () => new Set(state.muckedSeats),
    [state.muckedSeats],
  );
  const villainSurvivors = useMemo(() => {
    return state.players
      .filter((p, i) => i !== heroPos)
      .filter((p) => !foldedSeats.has(p.seat));
  }, [state.players, foldedSeats, heroPos]);
  const allVillainsDecided = villainSurvivors.every((v) => {
    if (muckedSet.has(v.seat)) return true;
    return v.cards?.every(Boolean);
  });

  return (
    <div
      className="flex flex-col h-[100dvh] w-full overflow-hidden"
      style={{ background: BG, color: "oklch(0.92 0 0)" }}
    >
      {/* Header — 48pt slim row */}
      <header
        className="flex items-center shrink-0"
        style={{
          height: 48,
          padding: "0 4px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(10px)",
        }}
      >
        <button
          type="button"
          aria-label="Back"
          onClick={handleBack}
          className="flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            color: "oklch(0.715 0 0)",
            background: "transparent",
            border: 0,
            borderRadius: 10,
          }}
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          onClick={() => setRenameOpen(true)}
          aria-label="Rename hand"
          className="flex-1 text-center leading-tight"
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: "pointer",
            minWidth: 0,
          }}
        >
          <div
            className="font-semibold tracking-tight"
            style={{
              fontSize: 14,
              color: "oklch(0.98 0 0)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {state.handName || "New hand"}
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              color: "oklch(0.55 0 0)",
              letterSpacing: "0.06em",
            }}
          >
            {state.bombPotOn
              ? `Bomb $${state.bombPotAmt} · ${N}-handed`
              : `$${state.sb}/$${state.bb} · ${N}-handed`}
            {state.gameType !== "NLHE" ? ` · ${state.gameType}` : ""}
            {state.doubleBoardOn ? " · 2B" : ""}
          </div>
        </button>
        {/* Right-side header slot is intentionally empty — the gear
            moved into the meta strip's left position so it occupies
            the same place as desktop's "Stakes & seats" trigger. */}
        <div style={{ width: 40, height: 40 }} />
      </header>

      {/* Meta strip — 36pt. Left slot doubles as the settings gear
          during setup (when settings are editable) and as the street
          pill during play (settings are locked once startPlay fires,
          so the gear isn't useful mid-hand). */}
      <div
        className="flex items-center gap-2 shrink-0"
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {state.phase === "setup" ? (
          <button
            type="button"
            aria-label="Setup"
            onClick={() => setSetupOpen(true)}
            className="inline-flex items-center justify-center"
            style={{
              height: 30,
              padding: "0 10px",
              borderRadius: 8,
              background: "oklch(0.215 0 0)",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "oklch(0.92 0 0)",
              gap: 6,
            }}
          >
            <Settings size={14} />
            <span
              className="font-mono font-semibold"
              style={{ fontSize: 11, letterSpacing: "0.04em" }}
            >
              Setup
            </span>
          </button>
        ) : (
          <span
            className="inline-flex items-center font-mono font-semibold"
            style={{
              height: 26,
              padding: "0 9px",
              borderRadius: 7,
              background: "oklch(0.30 0.10 155 / 0.35)",
              border: "1px solid oklch(0.696 0.205 155 / 0.35)",
              fontSize: 11,
              color: EMERALD_BRIGHT,
              letterSpacing: "0.04em",
            }}
          >
            {streetLabel}
          </span>
        )}
        <span
          className="font-mono font-semibold"
          style={{
            fontSize: 12,
            color: "oklch(0.98 0 0)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ${pot}
        </span>
        <span className="flex-1" />
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            color: "oklch(0.715 0 0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 180,
          }}
        >
          {actionHint}
        </span>
      </div>

      {/* Felt */}
      <div className="flex-1 min-h-0 p-2">
        <VerticalFelt
          state={state}
          committed={committed}
          activeSeat={activeSeat}
          foldedSeats={foldedSeats}
          streetBets={
            state.phase === "setup" ? setupBets : derived?.bets ?? {}
          }
          checkedSeats={checkedSeats}
          streetClosed={derived?.streetClosed ?? false}
          onHeroCardSlot={
            state.phase === "setup" ? openHeroCardSlot : undefined
          }
          onBoardSlot={
            state.phase !== "setup" && state.phase !== "showdown" && state.phase !== "done"
              ? openBoardSlot
              : undefined
          }
          onVillainCardSlot={
            isShowdown
              ? (seat, slot) =>
                  setPickerTarget({ kind: "villain", seat, slot })
              : undefined
          }
        />
      </div>

      {/* Bottom region — action bar during play, showdown panel at the end */}
      <div
        className="shrink-0"
        style={{
          padding:
            "8px 10px max(10px, env(safe-area-inset-bottom)) 10px",
          background: "oklch(0.18 0 0)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          maxHeight: "50vh",
          overflowY: "auto",
        }}
      >
        {state.phase === "setup" && <SetupCTA state={state} dispatch={dispatch} />}

        {state.phase !== "setup" && !isShowdown && (
          <>
            <div
              className="flex items-center justify-between"
              style={{
                marginBottom: 6,
                fontSize: 11,
                color: "oklch(0.55 0 0)",
                fontFamily:
                  "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
              }}
            >
              <span>
                {state.actions.length === 0
                  ? "Start of hand"
                  : `Step ${state.actions.length}`}
              </span>
              <button
                type="button"
                disabled={state.actions.length === 0}
                onClick={() => dispatch({ type: "undoAction" })}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "oklch(0.715 0 0)",
                  padding: "4px 8px",
                  borderRadius: 6,
                  opacity: state.actions.length === 0 ? 0.4 : 1,
                  fontSize: 12,
                }}
              >
                ↶ Undo
              </button>
            </div>
            {derived?.streetClosed && activeSeat === null && nextDealSlot ? (
              // Between-streets gap: betting closed, no active seat, but
              // we still owe board cards. Picker auto-opens for the
              // next-to-deal slot, but if the user dismisses it the
              // action bar would otherwise show three disabled buttons —
              // dead chrome with no path forward. The CTA replaces those
              // with a single "Deal X" button that re-opens the picker.
              <button
                type="button"
                onClick={() =>
                  setPickerTarget({
                    kind: "board",
                    slot: nextDealSlot.slot,
                    boardIdx: nextDealSlot.boardIdx,
                  })
                }
                style={{
                  width: "100%",
                  height: 56,
                  borderRadius: 12,
                  background: EMERALD,
                  color: BG,
                  fontWeight: 600,
                  fontSize: 15,
                  border: 0,
                }}
              >
                Deal {nextStreetLabel(state.phase)}
                {nextDealSlot.boardIdx === 1 ? " (board 2)" : ""}
              </button>
            ) : (
              <div
                className="grid"
                style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}
              >
                <ActionButton
                  kind="fold"
                  disabled={!derived || activeSeat === null}
                  onClick={() =>
                    activeSeat !== null &&
                    dispatch({
                      type: "recordAction",
                      action: { seat: activeSeat, action: "fold" },
                    })
                  }
                  label="Fold"
                />
                <ActionButton
                  kind="cc"
                  disabled={!derived || activeSeat === null}
                  onClick={() => {
                    if (activeSeat === null || !derived) return;
                    if (derived.canCheck)
                      dispatch({
                        type: "recordAction",
                        action: { seat: activeSeat, action: "check" },
                      });
                    else
                      dispatch({
                        type: "recordAction",
                        action: { seat: activeSeat, action: "call" },
                      });
                  }}
                  label={derived?.canCheck ? "Check" : "Call"}
                  sub={
                    derived && !derived.canCheck && activeSeat !== null
                      ? `$${derived.toCall}`
                      : undefined
                  }
                />
                <ActionButton
                  kind="br"
                  disabled={!derived || activeSeat === null}
                  onClick={() => setSizerOpen(true)}
                  label={
                    derived && derived.lastBet === 0 && activeSeat !== null
                      ? "Bet"
                      : "Raise"
                  }
                />
              </div>
            )}
          </>
        )}

        {isShowdown && (
          <ShowdownPanel
            villains={villainSurvivors}
            posNames={posNames}
            muckedSet={muckedSet}
            heroAlone={villainSurvivors.every((v) => muckedSet.has(v.seat))}
            onShowVillain={(seat) =>
              setPickerTarget({ kind: "villain", seat, slot: 0 })
            }
            onMuckVillain={(seat, mucked) =>
              dispatch({ type: "setMuck", seat, mucked })
            }
            onClearVillainCards={(seat) => {
              const v = state.players[seat];
              for (const c of v?.cards ?? []) {
                if (c) dispatch({ type: "clearCard", card: c });
              }
            }}
            allDecided={allVillainsDecided}
          />
        )}

        {isShowdown && (
          <button
            type="button"
            onClick={saveHand}
            disabled={!canSave}
            style={{
              marginTop: 8,
              width: "100%",
              height: 48,
              borderRadius: 12,
              background: canSave ? EMERALD : "oklch(0.215 0 0)",
              color: canSave ? BG : "oklch(0.55 0 0)",
              fontWeight: 600,
              border: 0,
              fontSize: 14,
            }}
          >
            {savePending
              ? "Saving…"
              : resolvedAwards === null
                ? "Resolve villains to save"
                : "Save hand"}
          </button>
        )}
      </div>

      {/* Card picker — mounted at the recorder root so it can layer over
          everything (felt, action bar, setup sheet). The sheet itself
          handles backdrop tap / Esc / drag-down dismiss. */}
      <CardPickerSheet
        open={pickerTarget !== null}
        title={pickerTitle}
        used={usedCards}
        onPick={handlePick}
        onClose={() => setPickerTarget(null)}
      />

      {/* Raise sizer — modal at vh<700, drawer above. Math mirrors the
          desktop ActionBar's pot-limit clamp. */}
      {derived && activeSeat !== null && (
        <RaiseSizer
          open={sizerOpen}
          isBetMode={derived.lastBet === 0}
          pot={derived.totalPot}
          toCall={derived.toCall}
          lastBet={derived.lastBet}
          minRaise={derived.minRaise}
          allInAmount={
            (derived.bets[activeSeat] || 0) +
            Math.max(
              0,
              (state.players[activeSeat]?.stack ?? 0) -
                (committed[activeSeat] || 0),
            )
          }
          gameType={state.gameType}
          onCommit={(amount) => {
            const isBetMode = derived.lastBet === 0;
            dispatch({
              type: "recordAction",
              action: {
                seat: activeSeat,
                action: isBetMode ? "bet" : "raise",
                amount,
              },
            });
            setSizerOpen(false);
          }}
          onCancel={() => setSizerOpen(false)}
        />
      )}

      {/* Setup sheet — bottom-sheet replacement for the desktop popover */}
      <SetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        state={state}
        dispatch={dispatch}
      />

      {/* Rename sheet — opens from header title tap. Editable any
          time, including mid-hand (the desktop recorder also allows
          rename mid-hand via inline edit). */}
      <RenameSheet
        open={renameOpen}
        initial={state.handName}
        onClose={() => setRenameOpen(false)}
        onSave={(name) => {
          dispatch({ type: "setHandName", name });
          setRenameOpen(false);
        }}
      />
    </div>
  );
}

function RenameSheet({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  // Re-seed when sheet (re)opens. setState-during-render with sentinel
  // to avoid the react-hooks/set-state-in-effect rule.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(initial);
  }
  const submit = () => {
    const trimmed = draft.trim();
    onSave(trimmed || "New hand");
  };
  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Hand name"
    >
      <div
        className="flex flex-col"
        style={{ padding: "12px 14px 16px", gap: 12 }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="New hand"
          className="w-full"
          style={{
            height: 44,
            borderRadius: 10,
            background: "oklch(0.16 0 0)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "oklch(0.92 0 0)",
            fontSize: 15,
            padding: "0 12px",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={submit}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 12,
            background: EMERALD,
            color: BG,
            fontWeight: 600,
            fontSize: 14,
            border: 0,
          }}
        >
          Save
        </button>
      </div>
    </BottomSheet>
  );
}

function nextStreetLabel(phase: string): string {
  if (phase === "preflop") return "flop";
  if (phase === "flop") return "turn";
  if (phase === "turn") return "river";
  return "next";
}

// Given a card array and the slot we just filled, find the next empty
// slot index. `justPicked` is the card we just placed — the cards array
// in state hasn't been updated yet by the time this runs (dispatch is
// async-ish), so we treat that slot as filled. Returns null if every
// slot in the row is full.
function nextEmptyAfter(
  cards: (string | null)[],
  filledSlot: number,
  justPicked: string,
): number | null {
  for (let i = 0; i < cards.length; i++) {
    if (i === filledSlot) continue;
    if (!cards[i]) return i;
  }
  // Re-scan including the slot we filled — handles the case where the
  // user re-picks a slot that was already non-empty (replacing it). The
  // justPicked card now lives there; nothing else to advance to.
  void justPicked;
  return null;
}

function nextEmptyInRange(
  board: (string | null)[],
  lo: number,
  hi: number,
  filledSlot: number,
  justPicked: string,
): number | null {
  for (let i = lo; i <= hi; i++) {
    if (i === filledSlot) continue;
    if (!board[i]) return i;
  }
  void justPicked;
  return null;
}

function SetupCTA({
  state,
  dispatch,
}: {
  state: RecorderState;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
}) {
  const heroCards = state.players[state.heroPosition]?.cards ?? [];
  const need = heroCards.length;
  const filledCount = heroCards.filter(Boolean).length;
  const filled = need > 0 && filledCount === need;
  // PLO modes need 4 or 5 cards; surface the count in both states so
  // the user knows how many more to pick. Without this, the disabled
  // CTA at "Tap hero hole cards to start" was ambiguous after 2 picks
  // in PLO5 — the user thought they were done.
  const label = filled
    ? "Start hand"
    : need > 2
      ? `Pick hero hole cards (${filledCount} / ${need})`
      : filledCount === 0
        ? "Tap hero hole cards to start"
        : `Pick hero hole cards (${filledCount} / ${need})`;
  return (
    <button
      type="button"
      disabled={!filled}
      onClick={() => dispatch({ type: "startPlay" })}
      style={{
        width: "100%",
        height: 56,
        borderRadius: 12,
        background: filled ? EMERALD : "oklch(0.215 0 0)",
        color: filled ? BG : "oklch(0.55 0 0)",
        fontWeight: 600,
        fontSize: 15,
        border: 0,
      }}
    >
      {label}
    </button>
  );
}

function ShowdownPanel({
  villains,
  posNames,
  muckedSet,
  heroAlone,
  onShowVillain,
  onMuckVillain,
  onClearVillainCards,
  allDecided,
}: {
  villains: Player[];
  posNames: readonly string[];
  muckedSet: Set<number>;
  heroAlone: boolean;
  onShowVillain: (seat: number) => void;
  onMuckVillain: (seat: number, mucked: boolean) => void;
  onClearVillainCards: (seat: number) => void;
  allDecided: boolean;
}) {
  if (heroAlone) {
    return (
      <div
        style={{
          padding: "10px 4px 0",
          fontSize: 12,
          color: "oklch(0.715 0 0)",
          textAlign: "center",
        }}
      >
        Everyone else folded or mucked.
      </div>
    );
  }
  return (
    <div className="flex flex-col" style={{ gap: 6, padding: "4px 0" }}>
      <div
        className="flex items-center"
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: EMERALD_BRIGHT,
          marginBottom: 2,
        }}
      >
        Showdown
        {!allDecided && (
          <span
            className="ml-2"
            style={{
              fontSize: 10,
              color: "oklch(0.55 0 0)",
              letterSpacing: 0,
              textTransform: "none",
              fontStyle: "italic",
            }}
          >
            · resolve every villain to save
          </span>
        )}
      </div>
      {villains.map((v) => {
        const isMucked = muckedSet.has(v.seat);
        const cardsFilled = !!v.cards?.every(Boolean);
        return (
          <div
            key={v.seat}
            className="flex items-center"
            style={{
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              background: "oklch(0.215 0 0)",
              border: "1px solid rgba(255,255,255,0.08)",
              minHeight: 44,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "oklch(0.715 0 0)",
                minWidth: 36,
              }}
            >
              {posNames[v.seat]}
            </span>
            {v.name && (
              <span
                style={{
                  fontSize: 12,
                  color: "oklch(0.92 0 0)",
                  maxWidth: 88,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {v.name}
              </span>
            )}
            <span className="flex-1" />
            {cardsFilled ? (
              <>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 12,
                    color: EMERALD_BRIGHT,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {v.cards!.join(" ")}
                </span>
                <button
                  type="button"
                  onClick={() => onClearVillainCards(v.seat)}
                  style={{
                    fontSize: 11,
                    color: "oklch(0.715 0 0)",
                    background: "transparent",
                    border: 0,
                    padding: "4px 6px",
                  }}
                >
                  Edit
                </button>
              </>
            ) : isMucked ? (
              <>
                <span
                  style={{
                    fontSize: 11,
                    fontStyle: "italic",
                    color: "oklch(0.55 0 0)",
                  }}
                >
                  mucks
                </span>
                <button
                  type="button"
                  onClick={() => onMuckVillain(v.seat, false)}
                  style={{
                    fontSize: 11,
                    color: "oklch(0.715 0 0)",
                    background: "transparent",
                    border: 0,
                    padding: "4px 6px",
                  }}
                >
                  Undo
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onMuckVillain(v.seat, true)}
                  style={{
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 8,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.18)",
                    color: "oklch(0.92 0 0)",
                    fontSize: 12,
                  }}
                >
                  Muck
                </button>
                <button
                  type="button"
                  onClick={() => onShowVillain(v.seat)}
                  style={{
                    height: 32,
                    padding: "0 14px",
                    borderRadius: 8,
                    background: EMERALD,
                    color: BG,
                    fontWeight: 600,
                    border: 0,
                    fontSize: 12,
                  }}
                >
                  Show
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActionButton({
  kind,
  label,
  sub,
  disabled,
  onClick,
}: {
  kind: "fold" | "cc" | "br";
  label: string;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const styleByKind: Record<string, React.CSSProperties> = {
    fold: {
      background: "oklch(0.215 0 0)",
      border: "1px solid oklch(0.704 0.191 22.216 / 0.3)",
      color: "oklch(0.704 0.191 22.216)",
    },
    cc: {
      background: "oklch(0.215 0 0)",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "oklch(0.98 0 0)",
    },
    br: {
      background: EMERALD,
      border: 0,
      color: BG,
    },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 56,
        borderRadius: 12,
        fontWeight: 600,
        fontSize: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        opacity: disabled ? 0.4 : 1,
        ...styleByKind[kind],
      }}
    >
      <span>{label}</span>
      {sub && (
        <span
          style={{
            fontFamily:
              "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
            fontSize: 11,
            color: kind === "br" ? "rgba(0,0,0,0.7)" : "oklch(0.715 0 0)",
            fontWeight: 500,
          }}
        >
          {sub}
        </span>
      )}
    </button>
  );
}
