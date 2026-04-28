"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { saveHandAction } from "@/lib/hands/actions";
import {
  Check,
  ChevronRight,
  MessageSquarePlus,
  Minus,
  Plus,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header, Shell } from "@/components/Shell";
import { POSITION_NAMES, seatXY } from "./lib";
import {
  BetBubble,
  DealerButtonChip,
  NameDisplay,
  StackDisplay,
  TableSurface,
} from "./table-pieces";
import { CardRow, CardSlot } from "./CardPicker";
import {
  committedBySeat,
  committedBySeatFinal,
  computeSidePots,
  deriveStreet,
  formatAction,
  initialStateFromDefaults,
  reducer,
  readSetupDefaults,
  totalPot,
  totalPotFinal,
  writeSetupDefaults,
} from "./engine";
import type { ActionType, Player, RecorderState } from "./engine";
import {
  derivePotType,
  isMultiway,
  recordedToHand,
  type SavedHand,
} from "./hand";
import { precomputeEquityByStep } from "./equity";
import {
  awardPots,
  determineWinner,
  seatWinnings,
  type HandScore,
  type PotAward,
} from "./hand-eval";

// Convert a cycle index (BTN=0 etc.) to a visual seat slot (0=bottom, then
// clockwise). Hero is always at visual slot 0.
function cycleToVisual(cycleIdx: number, heroPos: number, n: number): number {
  return (cycleIdx - heroPos + n) % n;
}

// Inline-editable title at the top of the recorder.
function HandNameDisplay({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim() || value;
    onCommit(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="text-xl font-semibold tracking-tight bg-transparent outline-none border-b border-white/30 min-w-[220px] max-w-[420px]"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="text-xl font-semibold tracking-tight cursor-text outline-none hover:text-zinc-300 transition-colors text-left"
    >
      {value}
    </button>
  );
}

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_HOVER = "oklch(0.745 0.198 155)";
const BG = "oklch(0.145 0.008 60)";

function ActionBar({
  state,
  derived,
  dispatch,
}: {
  state: RecorderState;
  derived: NonNullable<ReturnType<typeof deriveStreet>>;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
}) {
  const { activeSeat, toCall, canCheck, minRaise, totalPot: tp, lastBet, committed, bets } =
    derived;
  const seat = activeSeat !== null ? state.players[activeSeat] : null;
  const posName =
    activeSeat !== null
      ? POSITION_NAMES[state.playerCount][activeSeat]
      : "";
  // The ActionBar is keyed by phase/seat/minRaise from the parent, so a fresh
  // mount seeds `amount` to the current minRaise without an effect.
  const [amount, setAmount] = useState(String(minRaise));

  if (!seat || activeSeat === null) return null;

  // Live remaining stack = initial stack minus everything already committed
  // across blinds + previous streets + bets so far this street.
  const seatCommitted = committed[activeSeat] || 0;
  const liveStack = Math.max(0, seat.stack - seatCommitted);
  // "Bet to X" / "Raise to X" amounts are absolute — they include what's
  // already in front of the player on this street. So all-in amount is the
  // total they could put in front of them this street.
  const seatStreetCommitted = bets[activeSeat] || 0;
  const allInAmount = seatStreetCommitted + liveStack;

  const fold = () =>
    dispatch({ type: "recordAction", action: { seat: activeSeat, action: "fold" } });
  const check = () =>
    dispatch({ type: "recordAction", action: { seat: activeSeat, action: "check" } });
  const call = () =>
    dispatch({ type: "recordAction", action: { seat: activeSeat, action: "call" } });
  const placeBet = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (lastBet === 0) {
      dispatch({
        type: "recordAction",
        action: { seat: activeSeat, action: "bet", amount: amt },
      });
    } else {
      if (amt < minRaise) return;
      dispatch({
        type: "recordAction",
        action: { seat: activeSeat, action: "raise", amount: amt },
      });
    }
  };

  const fillPot = (frac: number) => {
    const potAfter = tp + toCall;
    const target = Math.round(lastBet + frac * potAfter);
    setAmount(String(Math.min(allInAmount, Math.max(target, minRaise))));
  };
  const allIn = () => setAmount(String(allInAmount));

  const isBetMode = lastBet === 0;
  const amt = Number(amount);
  // Allow short-stack all-ins below minRaise (they're valid even if they don't
  // technically reopen action). Disallow betting more than the seat has.
  const cannotBet = isBetMode
    ? amt <= 0 || amt > allInAmount
    : amt > allInAmount || (amt < minRaise && amt !== allInAmount);

  return (
    <div
      className="rounded-2xl border border-white/10 px-5 py-4 w-full max-w-[1100px]"
      style={{
        background: "rgba(9,9,11,0.85)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
          Acting
        </span>
        <span
          className="text-[12px] font-bold uppercase tracking-[0.14em] px-2 h-6 inline-flex items-center rounded-md"
          style={{
            background: "oklch(0.696 0.205 155 / 0.18)",
            color: EMERALD_HOVER,
            border: "1px solid oklch(0.696 0.205 155 / 0.4)",
          }}
        >
          {posName}
        </span>
        <span className="text-[14px] font-medium text-zinc-100">
          {seat.name || `Seat ${activeSeat + 1}`}
        </span>
        <span className="text-[12px] text-zinc-500">·</span>
        <span className="text-[12px] tabular-nums text-zinc-400">
          stack ${liveStack.toLocaleString()}
        </span>
        <span className="text-[12px] text-zinc-500">·</span>
        <span className="text-[12px] tabular-nums text-zinc-400">
          to call ${toCall.toLocaleString()}
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="xs"
          onClick={() => dispatch({ type: "undoAction" })}
          disabled={state.actions.length === 0}
        >
          <RotateCcw /> Undo
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={fold}
          className="!border-[oklch(0.704_0.191_22.216_/_0.4)] !text-[oklch(0.704_0.191_22.216)] hover:!bg-[oklch(0.704_0.191_22.216_/_0.12)]"
        >
          Fold
        </Button>
        {canCheck ? (
          <Button variant="outline" size="lg" onClick={check}>
            Check
          </Button>
        ) : (
          <Button variant="outline" size="lg" onClick={call}>
            {toCall > liveStack ? (
              <>Call ${liveStack.toLocaleString()} (all-in)</>
            ) : (
              <>Call ${toCall.toLocaleString()}</>
            )}
          </Button>
        )}
        <span className="w-px h-7 bg-white/10 mx-1" />
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 h-9 text-sm text-center tabular-nums"
        />
        <Button
          onClick={placeBet}
          size="lg"
          disabled={cannotBet}
          style={{
            background: EMERALD,
            color: BG,
            fontWeight: 600,
            minWidth: 196,
          }}
          className="hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50 tabular-nums justify-center"
        >
          {isBetMode ? "Bet" : "Raise to"} ${Number(amount || 0).toLocaleString()}
        </Button>
        <span className="w-px h-7 bg-white/10 mx-1" />
        <Button variant="ghost" size="sm" onClick={() => fillPot(0.5)}>
          ½ pot
        </Button>
        <Button variant="ghost" size="sm" onClick={() => fillPot(0.75)}>
          ¾ pot
        </Button>
        <Button variant="ghost" size="sm" onClick={() => fillPot(1)}>
          Pot
        </Button>
        <Button variant="ghost" size="sm" onClick={allIn}>
          All-in
        </Button>
      </div>
    </div>
  );
}

function SetupBar({
  state,
  dispatch,
  onStart,
}: {
  state: RecorderState;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
  onStart: () => void;
}) {
  const { playerCount, sb, bb, straddleOn, straddleAmt, heroPosition } = state;
  const canStraddle = playerCount >= 4;
  const hero = state.players[heroPosition];
  const heroOk = !!(hero?.cards?.[0] && hero?.cards?.[1]);
  const positions = POSITION_NAMES[playerCount];

  // Stack-default editor: seeded from hero's stack (first stack you'd typically
  // adjust). "Apply to all" pushes this value to every seat.
  const [stackInput, setStackInput] = useState(String(hero?.stack ?? 200));
  const applyToAllStacks = () => {
    const n = Number(stackInput);
    if (!Number.isFinite(n) || n <= 0) return;
    dispatch({ type: "setAllStacks", stack: n });
  };

  const [savedFlash, setSavedFlash] = useState(false);
  const saveAsDefault = () => {
    const n = Number(stackInput);
    const stack = Number.isFinite(n) && n > 0 ? n : (hero?.stack ?? 200);
    writeSetupDefaults({
      playerCount,
      sb,
      bb,
      straddleOn,
      straddleAmt,
      defaultStack: stack,
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const resetToDefaults = () => {
    const d = readSetupDefaults();
    if (!d) return;
    dispatch({
      type: "loadSetup",
      setup: {
        playerCount: d.playerCount,
        sb: d.sb,
        bb: d.bb,
        straddleOn: d.straddleOn,
        straddleAmt: d.straddleAmt,
      },
    });
    dispatch({ type: "setAllStacks", stack: d.defaultStack });
    setStackInput(String(d.defaultStack));
  };

  const hasDefaults = readSetupDefaults() !== null;

  return (
    <div
      className="rounded-2xl border border-white/10 px-7 py-5 w-full max-w-[1100px]"
      style={{
        background: "rgba(9,9,11,0.7)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.4)",
      }}
    >
      <div className="flex flex-wrap items-end justify-center gap-x-12 gap-y-5">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Players
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                dispatch({ type: "setPlayerCount", n: Math.max(2, playerCount - 1) })
              }
              disabled={playerCount <= 2}
              aria-label="Remove player"
            >
              <Minus />
            </Button>
            <span className="w-20 text-center text-sm font-semibold text-zinc-100 tabular-nums">
              {playerCount}-handed
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                dispatch({ type: "setPlayerCount", n: Math.min(9, playerCount + 1) })
              }
              disabled={playerCount >= 9}
              aria-label="Add player"
            >
              <Plus />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Blinds
          </span>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              value={sb}
              min={1}
              onChange={(e) =>
                dispatch({ type: "setBlinds", sb: Number(e.target.value), bb })
              }
              className="w-16 h-9 text-sm text-center"
            />
            <span className="text-zinc-500 text-sm font-medium">/</span>
            <Input
              type="number"
              value={bb}
              min={1}
              onChange={(e) =>
                dispatch({ type: "setBlinds", sb, bb: Number(e.target.value) })
              }
              className="w-16 h-9 text-sm text-center"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Straddle
          </span>
          <div className="flex items-center gap-2 h-9">
            <button
              role="switch"
              aria-checked={straddleOn}
              disabled={!canStraddle}
              onClick={() =>
                dispatch({
                  type: "setStraddle",
                  on: !straddleOn,
                  amt: straddleAmt,
                })
              }
              className={[
                "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors outline-none cursor-pointer",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                straddleOn ? "bg-[oklch(0.696_0.205_155)]" : "bg-[oklch(0.4_0_0)]",
              ].join(" ")}
            >
              <span
                className={[
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow",
                  "translate-y-0.5 transition-transform",
                  straddleOn ? "translate-x-4" : "translate-x-0.5",
                ].join(" ")}
              />
            </button>
            {straddleOn && canStraddle && (
              <Input
                type="number"
                value={straddleAmt}
                min={1}
                onChange={(e) =>
                  dispatch({
                    type: "setStraddle",
                    on: true,
                    amt: Number(e.target.value),
                  })
                }
                className="w-16 h-9 text-sm text-center"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Stack
          </span>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              value={stackInput}
              min={1}
              onChange={(e) => setStackInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyToAllStacks();
              }}
              className="w-20 h-9 text-sm text-center"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={applyToAllStacks}
              title="Set every seat's starting stack to this value"
            >
              Apply to all
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Hero position
          </span>
          {/* Fixed-size 5x2 grid: stays the same dimensions whether N=2 or N=9
              so the SetupBar doesn't reflow when player count changes. */}
          <div
            className="grid grid-cols-5 gap-1 content-start"
            style={{ width: 266, minHeight: 60 }}
          >
            {positions.map((label, cycleIdx) => {
              const isActive = cycleIdx === heroPosition;
              return (
                <button
                  key={cycleIdx}
                  type="button"
                  onClick={() =>
                    dispatch({ type: "setHeroPosition", position: cycleIdx })
                  }
                  className={`h-7 px-1 rounded-md text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer border ${
                    isActive
                      ? "bg-[oklch(0.696_0.205_155_/_0.18)] text-[oklch(0.795_0.184_155)] border-[oklch(0.696_0.205_155_/_0.4)]"
                      : "bg-transparent text-zinc-300 border-white/10 hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Begin
          </span>
          <Button
            onClick={onStart}
            disabled={!heroOk}
            size="lg"
            style={{ background: EMERALD, color: BG, fontWeight: 600 }}
            className="hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50"
          >
            Start hand <ChevronRight />
          </Button>
        </div>
      </div>
      {!heroOk && (
        <div className="text-center text-[12px] text-zinc-500 mt-3">
          Click your two hole cards to start.
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-center gap-2 flex-wrap">
        <span className="text-[11px] text-zinc-500">
          Defaults — players, blinds, straddle, stack
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={saveAsDefault}
          title="Save this configuration as the default for new hands"
        >
          {savedFlash ? <Check /> : <Save />}
          {savedFlash ? "Saved" : "Save as default"}
        </Button>
        {hasDefaults && (
          <Button
            variant="ghost"
            size="xs"
            onClick={resetToDefaults}
            title="Reset this hand's setup to your saved default"
          >
            <RotateCcw /> Reset to default
          </Button>
        )}
      </div>
    </div>
  );
}

function ActionLog({
  state,
  derivedTotalPot,
  dispatch,
}: {
  state: RecorderState;
  derivedTotalPot: number;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
}) {
  // Editing state for the per-action annotation popover. `null` = nothing open.
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  if (!state.actions.length && state.phase === "setup") return null;

  // Group actions while preserving their original index in state.actions —
  // annotations are keyed by that index.
  const grouped = (["preflop", "flop", "turn", "river"] as const)
    .map((ph) => ({
      street: ph,
      acts: state.actions
        .map((a, i) => ({ a, i }))
        .filter(({ a }) => a.street === ph),
    }))
    .filter((g) => g.acts.length);

  const startEdit = (idx: number) => {
    setEditing(idx);
    setDraft(state.annotations[idx] ?? "");
  };
  const commit = () => {
    if (editing === null) return;
    dispatch({ type: "setAnnotation", index: editing, text: draft });
    setEditing(null);
  };
  const cancel = () => setEditing(null);

  return (
    <div className="rounded-xl border border-white/10 bg-[oklch(0.205_0_0)] px-4 py-3 w-full max-w-[1100px] max-h-[280px] overflow-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Action log
        </span>
        <span className="text-[11px] text-zinc-500 tabular-nums">
          pot ${derivedTotalPot}
        </span>
        <span className="text-[11px] text-zinc-600 ml-auto">
          Hover an action to add a thought
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {grouped.map(({ street, acts }) => (
          <div key={street} className="flex items-start gap-3">
            <span
              className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.16em] shrink-0 mt-0.5"
              style={{
                background: "oklch(1 0 0 / 0.05)",
                color: "oklch(0.708 0 0)",
                border: "1px solid oklch(1 0 0 / 0.08)",
              }}
            >
              {street}
            </span>
            <div className="flex flex-wrap gap-x-2 gap-y-1 min-w-0 flex-1">
              {acts.map(({ a, i }, k) => {
                const note = state.annotations[i];
                const isEditing = editing === i;
                return (
                  <div key={i} className="flex flex-col group min-w-0">
                    <div className="flex items-center gap-1 text-[13px] text-zinc-200 leading-snug">
                      <span>
                        {formatAction(a, state.playerCount)}
                        {k < acts.length - 1 && (
                          <span className="text-zinc-600 ml-2">·</span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(i)}
                        title={note ? "Edit thought" : "Add a thought"}
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-[oklch(0.55_0.005_60)] hover:text-[oklch(0.795_0.184_155)] hover:bg-white/5 cursor-pointer transition-opacity ${
                          note ? "opacity-100 text-[oklch(0.795_0.184_155)]" : "opacity-0 group-hover:opacity-100"
                        }`}
                        aria-label={note ? "Edit annotation" : "Add annotation"}
                      >
                        <MessageSquarePlus size={12} />
                      </button>
                    </div>
                    {note && !isEditing && (
                      <button
                        type="button"
                        onClick={() => startEdit(i)}
                        className="mt-1 text-left max-w-[420px] rounded-md border border-[oklch(0.696_0.205_155_/_0.3)] bg-[oklch(0.696_0.205_155_/_0.06)] px-2 py-1 text-[12px] text-zinc-200 leading-snug hover:bg-[oklch(0.696_0.205_155_/_0.10)] cursor-text"
                      >
                        {note}
                      </button>
                    )}
                    {isEditing && (
                      <div className="mt-1 flex flex-col gap-1.5 max-w-[420px]">
                        <textarea
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancel();
                            } else if (
                              e.key === "Enter" &&
                              (e.metaKey || e.ctrlKey)
                            ) {
                              e.preventDefault();
                              commit();
                            }
                          }}
                          placeholder="What were you thinking on this action?"
                          className="w-full min-h-[60px] rounded-md border border-input bg-background px-2 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 resize-y"
                        />
                        <div className="flex items-center gap-1.5">
                          <Button size="xs" onClick={commit}>
                            <Check /> Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={cancel}
                          >
                            <X /> Cancel
                          </Button>
                          {note && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                dispatch({
                                  type: "setAnnotation",
                                  index: i,
                                  text: "",
                                });
                                setEditing(null);
                              }}
                              className="text-[oklch(0.704_0.191_22.216)]"
                            >
                              Remove
                            </Button>
                          )}
                          <span className="text-[10px] text-zinc-600 ml-auto">
                            ⌘↵ save · esc cancel
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Recorder() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialStateFromDefaults(),
  );
  // Tracks the in-flight save so the button can disable itself while the
  // server action runs.
  const [savePending, startSave] = useTransition();
  const derived = useMemo(() => deriveStreet(state), [state]);

  // Used cards (so the picker greys out duplicates)
  const usedCards = useMemo(() => {
    const s = new Set<string>();
    state.players.forEach((p) => p.cards?.forEach((c) => c && s.add(c)));
    state.board.forEach((c) => c && s.add(c));
    return s;
  }, [state.players, state.board]);

  const N = state.playerCount;
  const heroPos = state.heroPosition;
  // Visual seat positions, indexed by visual slot (0 = bottom-center / hero).
  const visualSeatPos = Array.from({ length: N }, (_, i) => seatXY(i, N));
  // Helper: render-time visual slot for a given cycle-indexed seat.
  const visualOf = (cycleIdx: number) => cycleToVisual(cycleIdx, heroPos, N);
  const posNames = POSITION_NAMES[N];
  // Dealer button is always at cycle 0 (BTN). Bring it to its visual slot.
  const btnVisual = visualOf(0);

  const setupPot =
    state.sb +
    state.bb +
    (state.straddleOn && state.playerCount >= 4 ? state.straddleAmt : 0);
  const pot =
    state.phase === "setup"
      ? setupPot
      : derived?.totalPot ?? totalPot(state);

  // Setup-phase blind/straddle bubbles, keyed by cycle index.
  const setupBets = useMemo(() => {
    if (state.phase !== "setup") return null;
    const b: Record<number, number> = {};
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
  ]);

  const playBets = derived?.bets || {};
  // Compute folded directly from the action log so it stays accurate in setup
  // and showdown phases (deriveStreet returns null in those, which would leave
  // `folded` empty and break the showdown panel's survivor filter).
  const folded = useMemo(() => {
    const s = new Set<number>();
    for (const a of state.actions) if (a.action === "fold") s.add(a.seat);
    return s;
  }, [state.actions]);
  const activeSeat = derived?.activeSeat;
  const muckedSet = useMemo(
    () => new Set(state.muckedSeats),
    [state.muckedSeats],
  );
  // Live stacks (initial - everything committed) for every seat. derived.committed
  // is null in setup/showdown/done — fall back to a fresh compute so showdown
  // panels still show the post-hand stacks.
  const committed = useMemo(
    () => derived?.committed ?? committedBySeat(state),
    [derived, state],
  );

  const flopFilled = !!(state.board[0] && state.board[1] && state.board[2]);
  const turnFilled = !!state.board[3];
  const riverFilled = !!state.board[4];

  // Auto-advance street once cards are filled.
  useEffect(() => {
    if (!derived || !derived.streetClosed) return;
    if (state.phase === "preflop" && flopFilled) dispatch({ type: "advanceStreet" });
    else if (state.phase === "flop" && turnFilled) dispatch({ type: "advanceStreet" });
    else if (state.phase === "turn" && riverFilled) dispatch({ type: "advanceStreet" });
  }, [flopFilled, turnFilled, riverFilled, derived?.streetClosed, derived, state.phase]);

  // Hand-over → showdown
  useEffect(() => {
    if (!derived) return;
    if (derived.handOver) {
      const t = setTimeout(() => dispatch({ type: "goShowdown" }), 250);
      return () => clearTimeout(t);
    }
  }, [derived?.handOver, derived]);

  const dealCTA = (() => {
    if (!derived || !derived.streetClosed) return null;
    if (state.phase === "preflop" && !flopFilled) return { label: "Deal flop", showdown: false };
    if (state.phase === "flop" && !turnFilled) return { label: "Deal turn", showdown: false };
    if (state.phase === "turn" && !riverFilled) return { label: "Deal river", showdown: false };
    if (state.phase === "river") return { label: "Go to showdown", showdown: true };
    return null;
  })();

  const saveHand = (awards: PotAward[][] | null) => {
    // committedBySeatFinal applies the per-street uncalled-bet refund, so
    // heroPaid here is the chips hero actually parted with — not the raw
    // sum of bet/raise amounts (which double-counts re-raises and ignores
    // refunds). seatWinnings sums per-pot allocations for hero, handling
    // side pots and split-pot ties.
    const heroPaid = committedBySeatFinal(state)[heroPos] ?? 0;
    const heroWon = awards ? seatWinnings(awards, heroPos) : 0;
    const result = heroWon - heroPaid;
    const board = state.board.filter((c): c is string => Boolean(c));
    const padded: string[] = [...board];
    while (padded.length < 5) padded.push("—");

    // Render the user-chosen ISO date as "Mon DD, YY" for the dashboard column.
    // We parse as local time to avoid the off-by-one timezone shift.
    const [yy, mm, dd] = state.date.split("-").map(Number);
    const dateObj = new Date(yy, (mm || 1) - 1, dd || 1);
    const displayDate = dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "2-digit",
    });

    const newHand: Omit<SavedHand, "id"> = {
      name: state.handName.trim() || "Untitled hand",
      date: displayDate,
      stakes: `${state.sb}/${state.bb}`,
      loc: state.venue.trim() || "—",
      positions: posNames[heroPos] ?? "",
      multiway: isMultiway({
        playerCount: state.playerCount,
        actions: state.actions,
      }),
      board: padded,
      type: derivePotType(state.actions),
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

    // Precompute per-step equity now (cheap, ~10ms × step count) so the
    // replayer never recomputes. recordedToHand needs an `id` to typecheck;
    // a placeholder is fine — we only read `steps` and `players` back from it.
    try {
      const replay = recordedToHand({ ...newHand, id: "tmp" } as SavedHand);
      if (replay && newHand._full) {
        const equityByStep = precomputeEquityByStep(replay);
        if (Object.keys(equityByStep).length > 0) {
          newHand._full = { ...newHand._full, equityByStep };
        }
      }
    } catch (e) {
      // Equity precompute failures shouldn't block the save — the replayer
      // will fall back to live computation.
      console.warn("Equity precompute failed; replayer will compute live.", e);
    }

    startSave(async () => {
      try {
        await saveHandAction(newHand);
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

  const phaseLabel =
    state.phase === "setup"
      ? "draft · setup"
      : state.phase === "showdown" || state.phase === "done"
        ? "draft · showdown"
        : `draft · ${state.phase}`;

  // Has the user entered anything that would be lost on a navigation away?
  const isDirty = () =>
    state.phase !== "setup" ||
    state.actions.length > 0 ||
    !!state.players[state.heroPosition]?.cards?.[0] ||
    !!state.players[state.heroPosition]?.cards?.[1] ||
    state.notes.trim().length > 0 ||
    state.handName !== "New hand" ||
    state.venue.trim().length > 0;

  // Cancel discards the in-progress hand and re-seeds setup from defaults.
  // Stays on /record — leaving is what the back link is for.
  const handleCancel = () => {
    if (isDirty() && !window.confirm("Discard this hand and start over?"))
      return;
    dispatch({ type: "resetHand" });
  };

  // Back link → /dashboard. Confirm if there's unsaved work.
  const handleBack = () => {
    if (isDirty() && !window.confirm("Leave without saving this hand?"))
      return false;
    return true;
  };

  return (
    <Shell
      header={
        <Header
          title=""
          back="Dashboard"
          backHref="/dashboard"
          onBack={handleBack}
          right={
            <>
              <span className="text-xs font-mono text-muted-foreground">
                {phaseLabel}
              </span>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => saveHand(null)}
                disabled={
                  savePending ||
                  (state.phase !== "showdown" && state.phase !== "done")
                }
                title={
                  state.phase !== "showdown" && state.phase !== "done"
                    ? "Play through to showdown before saving"
                    : undefined
                }
                style={{ background: EMERALD, color: BG, fontWeight: 600 }}
                className="hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50"
              >
                {savePending ? "Saving…" : "Save hand"}
              </Button>
            </>
          }
        />
      }
    >
      <div className="flex-1 flex flex-col items-center px-6 py-6 gap-5 max-w-[1600px] w-full mx-auto">
        {/* Title row: editable hand name + phase hint + venue + date inline. */}
        <div className="self-stretch flex items-center gap-x-4 gap-y-2 flex-wrap">
          <HandNameDisplay
            value={state.handName}
            onCommit={(name) => dispatch({ type: "setHandName", name })}
          />
          <span className="text-sm text-muted-foreground">
            {state.phase === "setup"
              ? "· set up the table, then start the hand"
              : `· ${state.phase}`}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Venue
            </span>
            <Input
              type="text"
              placeholder="—"
              value={state.venue}
              onChange={(e) =>
                dispatch({ type: "setVenue", venue: e.target.value })
              }
              className="h-8 w-44 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Date
            </span>
            <Input
              type="date"
              value={state.date}
              onChange={(e) =>
                dispatch({ type: "setDate", date: e.target.value })
              }
              className="h-8 w-40 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <TableSurface>
          {/* Pot + board */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
            style={{ transform: "translateY(-34px)" }}
          >
            <span
              className="px-3 h-8 inline-flex items-center rounded-lg text-[18px] font-semibold tabular-nums text-white pointer-events-none"
              style={{
                background: "rgba(9,9,11,0.85)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
              }}
            >
              ${pot}
            </span>
            <CardRow
              cards={state.board}
              used={usedCards}
              disabled={state.phase === "setup"}
              autoAdvanceCount={3}
              size="md"
              ariaLabelPrefix="Board card"
              // Pulse the empty slots when we're waiting for the next street.
              highlight={
                !!derived?.streetClosed &&
                ((state.phase === "preflop" && !flopFilled) ||
                  (state.phase === "flop" && !turnFilled) ||
                  (state.phase === "turn" && !riverFilled))
              }
              onPick={(idx, card) =>
                dispatch({ type: "setBoard", idx, card })
              }
              onClear={(card) => dispatch({ type: "clearCard", card })}
            />
            <span className="text-white/15 font-medium tracking-[0.28em] uppercase text-[10px] pointer-events-none">
              savemyhands
            </span>
          </div>

          <DealerButtonChip seatPos={visualSeatPos[btnVisual]} />

          {/* Bet bubbles — positions are cycle-indexed; render at visual slot. */}
          {state.phase === "setup"
            ? Object.entries(setupBets || {}).map(([s, amt]) => {
                const cycleIdx = Number(s);
                const v = visualOf(cycleIdx);
                return (
                  <BetBubble
                    key={cycleIdx}
                    seatPos={visualSeatPos[v]}
                    amount={amt}
                    isHero={v === 0}
                  />
                );
              })
            : Object.entries(playBets).map(([s, amt]) => {
                const cycleIdx = Number(s);
                if (!amt || folded.has(cycleIdx)) return null;
                const v = visualOf(cycleIdx);
                return (
                  <BetBubble
                    key={cycleIdx}
                    seatPos={visualSeatPos[v]}
                    amount={amt}
                    isHero={v === 0}
                  />
                );
              })}

          {/* Seats — iterate VISUAL slots; map back to cycle for player data. */}
          {visualSeatPos.map((p, visualI) => {
            const cycleIdx = (heroPos + visualI) % N;
            const player: Player = state.players[cycleIdx];
            const isHero = visualI === 0;
            const isFolded = folded.has(cycleIdx);
            const isMucked = muckedSet.has(cycleIdx);
            const dimmed = isFolded || isMucked;
            const isActive =
              activeSeat === cycleIdx &&
              state.phase !== "setup" &&
              state.phase !== "showdown";
            const cards = player.cards;
            return (
              <div
                key={visualI}
                className="absolute z-10"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  transform: "translate(-50%,-50%)",
                }}
              >
                <div
                  className={`flex flex-col items-center gap-1.5 rounded-xl px-4 py-2.5 text-center border transition-all ${
                    isActive
                      ? "border-[oklch(0.696_0.205_155_/_0.6)]"
                      : "border-white/10"
                  }`}
                  style={{
                    minWidth: 100,
                    opacity: dimmed ? 0.32 : 1,
                    filter: dimmed ? "grayscale(0.6)" : "none",
                    background: isActive
                      ? "rgba(20, 60, 40, 0.85)"
                      : "rgba(9,9,11,0.85)",
                    backdropFilter: "blur(10px)",
                    boxShadow: isActive
                      ? "0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px oklch(0.696 0.205 155 / 0.4)"
                      : "0 8px 20px rgba(0,0,0,0.55)",
                  }}
                >
                  <span className="text-[12px] font-semibold text-zinc-300 leading-none tracking-[0.14em] uppercase">
                    {posNames[cycleIdx]}
                  </span>
                  <NameDisplay
                    value={player.name}
                    onCommit={(n) =>
                      dispatch({
                        type: "updatePlayer",
                        seat: cycleIdx,
                        patch: { name: n },
                      })
                    }
                    placeholder={isHero ? "Hero" : "Player"}
                  />
                  <StackDisplay
                    value={Math.max(0, player.stack - (committed[cycleIdx] || 0))}
                    onCommit={(n) =>
                      dispatch({
                        type: "updatePlayer",
                        seat: cycleIdx,
                        patch: { stack: n + (committed[cycleIdx] || 0) },
                      })
                    }
                  />
                  {(isFolded || isMucked) && (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.55_0.005_60)] leading-none">
                      {isMucked ? "Mucked" : "Folded"}
                    </span>
                  )}
                </div>
                {/* Hole cards */}
                {isHero ? (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-24"
                    style={{ opacity: isFolded ? 0.3 : 1 }}
                  >
                    <CardRow
                      cards={[cards?.[0] ?? null, cards?.[1] ?? null]}
                      used={usedCards}
                      autoAdvanceCount={2}
                      size="md"
                      ariaLabelPrefix="Hero card"
                      // Glow during setup if cards aren't filled yet — hero
                      // hole cards are required before "Start hand" works.
                      highlight={
                        state.phase === "setup" &&
                        (!cards?.[0] || !cards?.[1])
                      }
                      onPick={(idx, c) =>
                        dispatch({
                          type: "setHeroCard",
                          idx: idx as 0 | 1,
                          card: c,
                        })
                      }
                      onClear={(c) => dispatch({ type: "clearCard", card: c })}
                    />
                  </div>
                ) : (
                  !isFolded &&
                  !muckedSet.has(cycleIdx) &&
                  (() => {
                    // Villain hole cards can only be entered at showdown.
                    // Pre-showdown the slots render as locked card backs.
                    const villainEditable =
                      state.phase === "showdown" || state.phase === "done";
                    if (villainEditable) {
                      return (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 -top-14"
                          style={{ opacity: isFolded ? 0.3 : 1 }}
                        >
                          <CardRow
                            cards={[cards?.[0] ?? null, cards?.[1] ?? null]}
                            used={usedCards}
                            autoAdvanceCount={2}
                            size="sm"
                            gapClass="gap-1"
                            ariaLabelPrefix={`${posNames[cycleIdx]} card`}
                            // Glow until both cards are revealed so the user
                            // sees what's required to finish the showdown.
                            highlight={!cards?.[0] || !cards?.[1]}
                            onPick={(idx, c) =>
                              dispatch({
                                type: "setOppCard",
                                seat: cycleIdx,
                                idx: idx as 0 | 1,
                                card: c,
                              })
                            }
                            onClear={(c) =>
                              dispatch({ type: "clearCard", card: c })
                            }
                          />
                        </div>
                      );
                    }
                    return (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 -top-14 flex gap-1"
                        style={{ opacity: isFolded ? 0.3 : 1 }}
                      >
                        {[0, 1].map((j) => (
                          <CardSlot
                            key={j}
                            card="__face_down__"
                            faceDown
                            size="sm"
                            disabled
                            used={usedCards}
                            onPick={() => {}}
                          />
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })}
        </TableSurface>

        {/* Below-table area: action stuff on the left, notes on the right. */}
        <div className="self-stretch flex flex-col lg:flex-row gap-5 items-stretch">
          <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* Action log */}
        {state.phase !== "setup" && state.actions.length > 0 && (
          <ActionLog
            state={state}
            derivedTotalPot={derived?.totalPot ?? totalPot(state)}
            dispatch={dispatch}
          />
        )}

        {/* Bottom controls */}
        {state.phase === "setup" && (
          <SetupBar
            state={state}
            dispatch={dispatch}
            onStart={() => dispatch({ type: "startPlay" })}
          />
        )}

        {state.phase !== "setup" &&
          state.phase !== "showdown" &&
          state.phase !== "done" &&
          derived && (
            <>
              {derived.handOver ? null : !derived.streetClosed ? (
                <ActionBar
                  key={`${state.phase}-${derived.activeSeat}-${derived.minRaise}`}
                  derived={derived}
                  state={state}
                  dispatch={dispatch}
                />
              ) : (
                dealCTA && (
                  <div
                    className="rounded-2xl border border-[oklch(0.696_0.205_155_/_0.4)] px-5 py-4 flex items-center gap-4 flex-wrap"
                    style={{
                      background: "oklch(0.696 0.205 155 / 0.08)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    }}
                  >
                    <Check
                      size={16}
                      className="text-[oklch(0.795_0.184_155)]"
                    />
                    <span className="text-[14px] font-medium text-zinc-100">
                      Betting round complete.
                    </span>
                    {dealCTA.showdown ? (
                      <Button
                        onClick={() => dispatch({ type: "goShowdown" })}
                        size="lg"
                        style={{ background: EMERALD, color: BG, fontWeight: 600 }}
                        className="hover:!bg-[oklch(0.745_0.198_155)]"
                      >
                        Go to showdown <ChevronRight />
                      </Button>
                    ) : (
                      <span className="text-[13px] text-zinc-400">
                        Click the next board slot to {dealCTA.label.toLowerCase()}.
                      </span>
                    )}
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dispatch({ type: "undoAction" })}
                    >
                      <RotateCcw /> Undo last
                    </Button>
                  </div>
                )
              )}
            </>
          )}

        {(state.phase === "showdown" || state.phase === "done") && (() => {
          // Survivors = made it to showdown (didn't fold preflop/postflop).
          const survivors = state.players.filter((p) => !folded.has(p.seat));
          const villainSurvivors = survivors.filter(
            (p) => p.seat !== heroPos,
          );
          // Each villain is "decided" once they've either shown cards or mucked.
          const isShown = (p: Player) =>
            !!(p.cards?.[0] && p.cards?.[1]);
          const villainsAwaiting = villainSurvivors.filter(
            (v) => !muckedSet.has(v.seat) && !isShown(v),
          );

          // Hero alone if everyone else folded or mucked.
          const heroAlone =
            villainSurvivors.length === 0 ||
            villainSurvivors.every((v) => muckedSet.has(v.seat));

          let winners: number[] = [];
          let scores: Record<number, HandScore> = {};
          let evalError: string | null = null;
          let awards: PotAward[][] = [];

          const board5 = state.board.filter((c): c is string => Boolean(c));
          const heroCards = state.players[heroPos].cards;
          const heroCardsOk = !!(heroCards?.[0] && heroCards?.[1]);
          const pots = computeSidePots(state);
          const finalPot = totalPotFinal(state);

          if (heroAlone) {
            // Everyone else folded or mucked — hero wins every pot they're
            // part of. (In practice with everyone folded, hero is in every
            // pot's eligibleSeats.)
            awards = pots.map((p) => [
              { amount: p.amount, winners: [heroPos] },
            ]);
            winners = [heroPos];
          } else if (villainsAwaiting.length === 0) {
            if (board5.length < 5) {
              evalError =
                "Fill in the rest of the board to determine the winner.";
            } else if (!heroCardsOk) {
              evalError = "Hero hole cards are missing.";
            } else {
              const contestants = [
                state.players[heroPos],
                ...villainSurvivors.filter(
                  (v) => !muckedSet.has(v.seat) && isShown(v),
                ),
              ]
                .filter(isShown)
                .map((p) => ({
                  seat: p.seat,
                  cards: [p.cards![0]!, p.cards![1]!],
                }));
              try {
                awards = awardPots(pots, contestants, board5);
                // Aggregate distinct winners across pots for the summary
                // header. Per-pot winners may differ in side-pot scenarios.
                const winnerSet = new Set<number>();
                for (const potAwards of awards)
                  for (const a of potAwards)
                    for (const w of a.winners) winnerSet.add(w);
                winners = [...winnerSet];
                // Reuse determineWinner just to populate per-seat hand
                // descriptions (for the "shows X · top pair" annotation).
                scores = determineWinner(contestants, board5).scores;
              } catch (e) {
                evalError = (e as Error).message;
              }
            }
          }

          const decided =
            heroAlone || villainsAwaiting.length === 0;
          const canSave = winners.length > 0;
          const heroWonShare = seatWinnings(awards, heroPos);

          return (
            <div
              className="rounded-2xl border border-[oklch(0.696_0.205_155_/_0.4)] px-5 py-4 flex flex-col gap-3 w-full max-w-[820px]"
              style={{ background: "oklch(0.696 0.205 155 / 0.06)" }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="px-2 h-6 inline-flex items-center rounded-md text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    background: "oklch(0.696 0.205 155 / 0.18)",
                    color: EMERALD_HOVER,
                    border: "1px solid oklch(0.696 0.205 155 / 0.4)",
                  }}
                >
                  Showdown
                </span>
                <span className="text-[14px] text-zinc-200">
                  {heroAlone
                    ? "Everyone else folded or mucked."
                    : "For each villain, click their cards above to reveal — or muck."}
                </span>
                <div className="flex-1" />
                <span className="text-[14px] tabular-nums text-zinc-300">
                  Pot ${finalPot}
                </span>
              </div>

              {/* Side-pot breakdown — only render when there's more than one
                  pot so the common single-pot case stays uncluttered. */}
              {pots.length > 1 && (
                <div className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-white/10 bg-zinc-900/40 text-[12px]">
                  {pots.map((p, i) => {
                    const winnersForPot =
                      awards[i]?.[0]?.winners ?? p.eligibleSeats;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 tabular-nums"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground w-16 shrink-0">
                          {i === 0 ? "Main" : `Side ${i}`}
                        </span>
                        <span className="text-zinc-300">${p.amount}</span>
                        {decided && winnersForPot.length > 0 && (
                          <>
                            <span className="text-zinc-600">·</span>
                            <span className="text-[oklch(0.795_0.184_155)]">
                              {winnersForPot
                                .map((s) => posNames[s])
                                .join(" & ")}
                              {winnersForPot.length > 1 ? " split" : ""}
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!heroAlone && (
                <div className="flex flex-col gap-1.5">
                  {villainSurvivors.map((v) => {
                    const isMucked = muckedSet.has(v.seat);
                    const shown = isShown(v);
                    return (
                      <div
                        key={v.seat}
                        className="flex items-center gap-3 px-3 h-10 rounded-lg border border-white/10 bg-zinc-900/40"
                      >
                        <span
                          className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.14em] border"
                          style={{
                            background: "oklch(1 0 0 / 0.04)",
                            color: "oklch(0.85 0 0)",
                            borderColor: "oklch(1 0 0 / 0.1)",
                          }}
                        >
                          {posNames[v.seat]}
                        </span>
                        {v.name && (
                          <span className="text-[13px] text-zinc-200">
                            {v.name}
                          </span>
                        )}
                        <div className="flex-1" />
                        {shown ? (
                          <>
                            <span className="text-[12px] text-[oklch(0.795_0.184_155)] tabular-nums">
                              shows {v.cards![0]} {v.cards![1]}
                              {scores[v.seat] && (
                                <span className="text-zinc-400 ml-2">
                                  · {scores[v.seat].description}
                                </span>
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                if (v.cards?.[0])
                                  dispatch({
                                    type: "clearCard",
                                    card: v.cards[0],
                                  });
                                if (v.cards?.[1])
                                  dispatch({
                                    type: "clearCard",
                                    card: v.cards[1],
                                  });
                              }}
                            >
                              Edit
                            </Button>
                          </>
                        ) : isMucked ? (
                          <>
                            <span className="text-[12px] text-zinc-500">
                              mucks
                            </span>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                dispatch({
                                  type: "setMuck",
                                  seat: v.seat,
                                  mucked: false,
                                })
                              }
                            >
                              Undo
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-[11px] text-muted-foreground italic">
                              click cards above to show
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                dispatch({
                                  type: "setMuck",
                                  seat: v.seat,
                                  mucked: true,
                                })
                              }
                            >
                              Mucks
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Winner readout */}
              {decided && winners.length > 0 && (
                <div
                  className="flex items-center gap-3 flex-wrap rounded-lg border px-3 py-2"
                  style={{
                    borderColor: "oklch(0.696 0.205 155 / 0.4)",
                    background: "oklch(0.696 0.205 155 / 0.10)",
                  }}
                >
                  <span
                    className="px-2 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{
                      background: "oklch(0.696 0.205 155 / 0.22)",
                      color: EMERALD_HOVER,
                      border: "1px solid oklch(0.696 0.205 155 / 0.4)",
                    }}
                  >
                    Winner
                  </span>
                  <span className="text-[14px] font-medium text-zinc-100">
                    {winners.map((s) => posNames[s]).join(" & ")}
                    {winners.length > 1 ? " — split pot" : ""}
                  </span>
                  {scores[heroPos] && (
                    <span className="text-[12px] text-zinc-400">
                      Hero: {scores[heroPos].description}
                    </span>
                  )}
                  <div className="flex-1" />
                  {winners.includes(heroPos) ? (
                    <span className="text-[13px] tabular-nums text-[oklch(0.795_0.184_155)]">
                      Hero +${heroWonShare.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-[13px] tabular-nums text-[oklch(0.704_0.191_22.216)]">
                      Hero loses
                    </span>
                  )}
                </div>
              )}

              {evalError && (
                <div className="text-[12px] text-amber-300">{evalError}</div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch({ type: "undoAction" })}
                >
                  <RotateCcw /> Back
                </Button>
                <div className="flex-1" />
                <Button
                  onClick={() => saveHand(canSave ? awards : null)}
                  size="lg"
                  disabled={!decided || savePending}
                  style={{ background: EMERALD, color: BG, fontWeight: 600 }}
                  className="hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50"
                >
                  {savePending ? "Saving…" : "Save hand"}
                </Button>
              </div>
            </div>
          );
        })()}
          </div>

          {/* Notes — side column on wide viewports, stacked below otherwise. */}
          <div className="w-full lg:w-[320px] flex flex-col gap-1.5 lg:flex-shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Notes
            </span>
            <textarea
              value={state.notes}
              placeholder="Articulate your read, decision points, anything you want the viewer to know."
              onChange={(e) =>
                dispatch({ type: "setNotes", notes: e.target.value })
              }
              className="flex w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none flex-1 min-h-[200px]"
            />
          </div>
        </div>
      </div>
    </Shell>
  );
}

// Re-export for callers that want the action types
export type { ActionType };
