"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveHandAction } from "@/lib/hands/actions";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MessageSquarePlus,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Settings,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Header, Shell } from "@/components/Shell";
import { POSITION_NAMES, seatXY } from "./lib";
import {
  BetBubble,
  DealerButtonChip,
  NameDisplay,
  StackDisplay,
  TableSurface,
} from "./table-pieces";
import { CardRow } from "./CardPicker";
import HandFan from "./HandFan";
import {
  committedBySeat,
  committedBySeatFinal,
  computeSidePots,
  deriveStreet,
  formatAction,
  holeCardCount,
  initialStateFromDefaults,
  isPotLimit,
  reducer,
  readSetupDefaults,
  totalPot,
  totalPotFinal,
  writeSetupDefaults,
} from "./engine";
import type { ActionType, GameType, Player, RecorderState } from "./engine";
import {
  derivePotType,
  isMultiway,
  recordedToHand,
  type SavedHand,
} from "./hand";
import { precomputeEquityByStep } from "./equity";
import {
  awardPots,
  awardPotsMultiBoard,
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

// The action-log index of `cycleIdx`'s most recent action on the current
// street. Used to map a click on a bet/check bubble back to the action it
// represents so the annotation editor knows which step to attach the note to.
// Returns null when the seat hasn't acted on this street yet (which is also
// when the bubble isn't rendered, so this is mostly a defensive guard).
function lastActionIdxForSeat(
  actions: { seat: number; street: string }[],
  cycleIdx: number,
  street: string,
): number | null {
  for (let i = actions.length - 1; i >= 0; i--) {
    if (actions[i].seat === cycleIdx && actions[i].street === street) {
      return i;
    }
  }
  return null;
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
const BG = "oklch(0.145 0 0)";

// Tiny kbd hint shown next to the action buttons. Standalone so styling stays
// consistent across Fold / Check / Bet.
function Kbd({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "rose" | "dark";
}) {
  const palette =
    tone === "rose"
      ? {
          background: "oklch(0.704 0.191 22.216 / 0.15)",
          borderColor: "oklch(0.704 0.191 22.216 / 0.3)",
          color: "oklch(0.78 0.191 22.216)",
        }
      : tone === "dark"
        ? {
            background: "oklch(0.145 0 0 / 0.25)",
            borderColor: "oklch(0.145 0 0 / 0.3)",
            color: "oklch(0.145 0 0)",
          }
        : {
            background: "oklch(1 0 0 / 0.06)",
            borderColor: "oklch(1 0 0 / 0.16)",
            color: "oklch(0.78 0 0)",
          };
  return (
    <kbd
      style={{
        ...palette,
        height: 18,
        minWidth: 18,
        padding: "0 5px",
        borderRadius: 4,
        borderWidth: 1,
        borderStyle: "solid",
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </kbd>
  );
}

// Annotation editor modal. Opened by clicking a bet/check bubble on the
// felt; saves the typed note to `state.annotations[index]` via the reducer.
// Mirrors the same shadcn-flavored modal pattern used by the Dashboard's
// EditDetailsModal so the visual feel stays consistent.
function AnnotationModal({
  initial,
  actionLabel,
  onSave,
  onClose,
}: {
  initial: string;
  // The formatted action ("BTN raises to $24") shown in the modal header so
  // the user knows which step they're annotating.
  actionLabel: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commit = () => {
    onSave(draft);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-xl border border-white/10 flex flex-col"
        style={{
          background: "oklch(0.205 0 0)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight shrink-0">
              Note
            </h3>
            <span className="text-[12px] text-muted-foreground truncate">
              {actionLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commit();
              }
            }}
            placeholder="What were you thinking on this action?"
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-2.5 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 resize-y"
          />
          <span className="text-[11px] text-muted-foreground">
            ⌘↵ save · esc cancel · save empty to remove
          </span>
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={commit}
            style={{
              background: "oklch(0.696 0.205 155)",
              color: "oklch(0.145 0 0)",
              fontWeight: 600,
            }}
            className="hover:!bg-[oklch(0.745_0.198_155)]"
          >
            <Check /> Save
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

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
  // Sizing drawer collapses for screen real estate; opens by default on every
  // new acting turn (the parent re-keys, so this also resets across turns).
  const [drawerOpen, setDrawerOpen] = useState(true);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcuts. Declared before the early return so hook order is
  // stable; the handler itself bails out if there's no active seat. Skips
  // when typing in any input/textarea.
  useEffect(() => {
    if (activeSeat === null) return;
    const seatRef = activeSeat;
    // PLO caps every chip value at pot-sized; NLHE allows up to all-in.
    const potLimit = isPotLimit(state.gameType);
    const stackLeft = seat ? Math.max(0, seat.stack - (committed[seatRef] || 0)) : 0;
    const allIn = (bets[seatRef] || 0) + stackLeft;
    const potCapRaiseTo = lastBet + (tp + toCall);
    const maxAllowed = potLimit ? Math.min(allIn, potCapRaiseTo) : allIn;
    const sizeFromFrac = (frac: number) => {
      const potAfter = tp + toCall;
      const target = Math.round(lastBet + frac * potAfter);
      return Math.min(maxAllowed, Math.max(target, minRaise));
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        !!target?.isContentEditable;
      if (inField) return;
      const k = e.key.toLowerCase();
      if (k === "f") {
        e.preventDefault();
        dispatch({
          type: "recordAction",
          action: { seat: seatRef, action: "fold" },
        });
      } else if (k === "c") {
        e.preventDefault();
        dispatch({
          type: "recordAction",
          action: {
            seat: seatRef,
            action: canCheck ? "check" : "call",
          },
        });
      } else if (k === "r" || k === "b") {
        e.preventDefault();
        setDrawerOpen(true);
        // Defer focus until the drawer's input is rendered.
        setTimeout(() => {
          amountInputRef.current?.focus();
          amountInputRef.current?.select();
        }, 0);
      } else if (k === "1") {
        e.preventDefault();
        setAmount(String(sizeFromFrac(0.5)));
      } else if (k === "2") {
        e.preventDefault();
        setAmount(String(sizeFromFrac(2 / 3)));
      } else if (k === "3") {
        e.preventDefault();
        setAmount(String(sizeFromFrac(1)));
      } else if (k === "4") {
        e.preventDefault();
        // 1.25× pot is illegal in PLO — fall back to pot-sized so the
        // shortcut never produces an invalid amount.
        setAmount(String(potLimit ? sizeFromFrac(1) : sizeFromFrac(1.25)));
      } else if (k === "a") {
        e.preventDefault();
        // PLO caps "all-in" at pot-sized; NLHE shoves to actual stack.
        setAmount(String(maxAllowed));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activeSeat,
    canCheck,
    dispatch,
    seat,
    committed,
    bets,
    tp,
    toCall,
    lastBet,
    minRaise,
    state.gameType,
  ]);

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
  // Pot-limit cap. PLO max bet/raise = lastBet + (potBeforeYourCall +
  // amountToCall). Below pot-cap means PLO; NLHE just uses all-in.
  // Effective max = min(allInAmount, potCap) so a short stack can still
  // shove for less than pot.
  const potLimit = isPotLimit(state.gameType);
  const potCapRaiseTo = lastBet + (tp + toCall);
  const maxAllowed = potLimit
    ? Math.min(allInAmount, potCapRaiseTo)
    : allInAmount;

  const fold = () =>
    dispatch({ type: "recordAction", action: { seat: activeSeat, action: "fold" } });
  const check = () =>
    dispatch({ type: "recordAction", action: { seat: activeSeat, action: "check" } });
  const call = () =>
    dispatch({ type: "recordAction", action: { seat: activeSeat, action: "call" } });
  const placeBet = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    // Pot-limit clamp: refuse anything above the pot ceiling. NLHE has
    // no upper bound below stack; the slider/input UI prevents typing
    // past it but a stale amount value could still slip through here.
    if (amt > maxAllowed) return;
    if (lastBet === 0) {
      dispatch({
        type: "recordAction",
        action: { seat: activeSeat, action: "bet", amount: amt },
      });
    } else {
      if (amt < minRaise && amt !== maxAllowed) return;
      dispatch({
        type: "recordAction",
        action: { seat: activeSeat, action: "raise", amount: amt },
      });
    }
  };

  // Resolve a sizing fraction to a clamped chip amount. The cap is
  // game-dependent: NLHE allows up to all-in, PLO caps at pot-sized.
  const sizeFor = (frac: number) => {
    const potAfter = tp + toCall;
    const target = Math.round(lastBet + frac * potAfter);
    return Math.min(maxAllowed, Math.max(target, minRaise));
  };
  // Chip set adapts to game type. PLO removes the 1.25× over-pot chip
  // (illegal in pot-limit) and the All-in chip is capped at the pot
  // ceiling — clicking it shoves only when the seat's stack is at or
  // below the pot-sized raise.
  const chips: { id: string; label: string; amount: number }[] = potLimit
    ? [
        { id: "half", label: "½ pot", amount: sizeFor(0.5) },
        { id: "twothird", label: "⅔ pot", amount: sizeFor(2 / 3) },
        { id: "pot", label: "Pot", amount: sizeFor(1) },
        { id: "allin", label: "Max", amount: maxAllowed },
      ]
    : [
        { id: "half", label: "½ pot", amount: sizeFor(0.5) },
        { id: "twothird", label: "⅔ pot", amount: sizeFor(2 / 3) },
        { id: "pot", label: "Pot", amount: sizeFor(1) },
        { id: "overpot", label: "1.25×", amount: sizeFor(1.25) },
        { id: "allin", label: "All-in", amount: allInAmount },
      ];

  const isBetMode = lastBet === 0;
  const amt = Number(amount);
  // Allow short-stack all-ins below minRaise (they're valid even if they don't
  // technically reopen action). Disallow betting more than the seat has —
  // and in PLO, more than the pot ceiling.
  const cannotBet = isBetMode
    ? amt <= 0 || amt > maxAllowed
    : amt > maxAllowed || (amt < minRaise && amt !== maxAllowed);

  // Bet button is "open the drawer" while collapsed, "commit" while open. The
  // chevron flips to telegraph which mode it's in.
  const onBetClick = () => {
    if (!drawerOpen) {
      setDrawerOpen(true);
      return;
    }
    placeBet();
  };

  // Slider range: from minRaise (or street's call amount when betting from $0)
  // up to whichever cap the game enforces (all-in for NLHE, pot for PLO).
  const sliderMin = isBetMode ? Math.max(state.bb, 1) : Math.max(minRaise, 1);
  const sliderMax = Math.max(sliderMin, maxAllowed);
  const sliderVal = Math.min(sliderMax, Math.max(sliderMin, Number.isFinite(amt) ? amt : sliderMin));

  return (
    <div
      className="rounded-2xl border border-white/10 w-full max-w-[1100px] overflow-hidden"
      style={{
        background: "rgba(15,15,18,0.88)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
      }}
    >
      {drawerOpen && (
        <div
          className="px-[18px] py-[14px] border-b border-white/8 flex flex-col gap-2.5"
          style={{ background: "oklch(0.165 0 0)" }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Bet sizing
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="text-[11px] text-zinc-500 hover:text-zinc-200 inline-flex items-center gap-1 cursor-pointer"
              aria-label="Collapse bet sizing"
            >
              <ChevronDown size={12} /> Collapse
            </button>
          </div>
          <div className="flex gap-1.5">
            {chips.map((c) => {
              const active = String(c.amount) === amount;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAmount(String(c.amount))}
                  className="flex-1 h-[50px] rounded-lg flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
                  style={
                    active
                      ? {
                          background: "oklch(0.696 0.205 155 / 0.18)",
                          border: "1px solid oklch(0.696 0.205 155 / 0.5)",
                          color: "oklch(0.85 0.184 155)",
                        }
                      : {
                          background: "oklch(1 0 0 / 0.04)",
                          border: "1px solid oklch(1 0 0 / 0.10)",
                          color: "#e4e4e7",
                        }
                  }
                >
                  <span className="text-[12px] font-semibold">{c.label}</span>
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ opacity: 0.75 }}
                  >
                    ${c.amount.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-[11px] text-zinc-500 tabular-nums"
              style={{ minWidth: 36 }}
            >
              ${sliderMin.toLocaleString()}
            </span>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              value={sliderVal}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 accent-[oklch(0.696_0.205_155)]"
            />
            <span
              className="text-[11px] text-zinc-500 tabular-nums text-right"
              style={{ minWidth: 56 }}
            >
              ${sliderMax.toLocaleString()}
            </span>
            <Input
              ref={amountInputRef}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  placeBet();
                }
              }}
              className="w-24 h-8 text-sm text-center tabular-nums"
            />
          </div>
        </div>
      )}
      <div className="px-[18px] py-3 flex items-center gap-2.5">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.16em] px-1.5 h-5 inline-flex items-center rounded"
            style={{
              background: "oklch(0.696 0.205 155 / 0.18)",
              color: "oklch(0.795 0.184 155)",
              border: "1px solid oklch(0.696 0.205 155 / 0.4)",
            }}
          >
            {posName}
          </span>
          <span className="text-[13px] font-medium text-zinc-100">
            {seat.name || `Seat ${activeSeat + 1}`}
          </span>
          <span className="text-[11px] text-zinc-500 tabular-nums">
            ${liveStack.toLocaleString()}
          </span>
        </div>
        <div className="flex-1 flex justify-center gap-2">
          <button
            type="button"
            onClick={fold}
            className="rounded-lg cursor-pointer inline-flex items-center justify-center gap-2 transition-colors"
            style={{
              width: 130,
              height: 48,
              background: "oklch(0.704 0.191 22.216 / 0.12)",
              border: "1px solid oklch(0.704 0.191 22.216 / 0.4)",
              color: "oklch(0.78 0.191 22.216)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Fold <Kbd tone="rose">F</Kbd>
          </button>
          {canCheck ? (
            <button
              type="button"
              onClick={check}
              className="rounded-lg cursor-pointer inline-flex items-center justify-center gap-2 transition-colors"
              style={{
                width: 130,
                height: 48,
                background: "oklch(1 0 0 / 0.06)",
                border: "1px solid oklch(1 0 0 / 0.15)",
                color: "#f4f4f5",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Check <Kbd>C</Kbd>
            </button>
          ) : (
            <button
              type="button"
              onClick={call}
              className="rounded-lg cursor-pointer inline-flex items-center justify-center gap-2 transition-colors tabular-nums"
              style={{
                width: 130,
                height: 48,
                background: "oklch(1 0 0 / 0.06)",
                border: "1px solid oklch(1 0 0 / 0.15)",
                color: "#f4f4f5",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Call ${Math.min(toCall, liveStack).toLocaleString()}
              {toCall > liveStack ? <span className="text-[10px] text-zinc-400">all-in</span> : null}
              <Kbd>C</Kbd>
            </button>
          )}
          <button
            type="button"
            onClick={onBetClick}
            disabled={drawerOpen && cannotBet}
            className="rounded-lg cursor-pointer inline-flex items-center justify-center gap-2 transition-colors tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              width: 200,
              height: 48,
              background: EMERALD,
              border: "none",
              color: BG,
              fontSize: 14,
              fontWeight: 700,
              boxShadow: "0 6px 18px oklch(0.696 0.205 155 / 0.3)",
            }}
          >
            {drawerOpen
              ? `${isBetMode ? "Bet" : "Raise to"} $${(Number.isFinite(amt) ? amt : 0).toLocaleString()}`
              : isBetMode
                ? "Bet"
                : "Raise"}
            {drawerOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            <Kbd tone="dark">R</Kbd>
          </button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "undoAction" })}
          disabled={state.actions.length === 0}
          title="Undo last action (Cmd/Ctrl-Z)"
        >
          <RotateCcw /> Undo
        </Button>
      </div>
    </div>
  );
}

// ─── Meta strip + Stakes & seats popover ───────────────────────────────────
//
// Replaces the old <SetupBar>. A single-line strip above the table with the
// live config summary, street pill, pot, and contextual hint. Clicking the
// "⚙ Stakes & seats" button opens a popover with every setup control.
//
// Note: the handoff doesn't list hero-position in the popover, but the existing
// recorder needs somewhere to set it during setup — added as an extra row so
// no functionality is lost.

// Numeric input that lets the user blank the field while typing without
// snapping back to "0" on every keystroke. The committed value updates
// only on blur (or Enter); empty / non-numeric values fall back to 0.
// `key={value}` remounts when the parent updates the value externally
// (e.g., loadDefaults) so the visible text re-syncs.
function NumericInput({
  value,
  onCommit,
  className,
  ...rest
}: {
  value: number;
  onCommit: (n: number) => void;
} & Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "type" | "onChange" | "onBlur"
>) {
  return (
    <Input
      key={value}
      type="number"
      defaultValue={value}
      onBlur={(e) => {
        const raw = e.currentTarget.value;
        const n = raw === "" ? 0 : Number(raw);
        onCommit(Number.isFinite(n) ? n : 0);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={className}
      {...rest}
    />
  );
}

function StreetPill({
  phase,
  bombPotOn = false,
}: {
  phase: RecorderState["phase"];
  bombPotOn?: boolean;
}) {
  const label =
    phase === "showdown" || phase === "done"
      ? "showdown"
      : phase === "setup"
        ? "setup"
        : // Bomb pots auto-close preflop and immediately gate on flop
          // card entry — show "flop" so the pill matches what the user
          // is actually doing (entering the flop), not a phase that
          // never sees any action.
          bombPotOn && phase === "preflop"
          ? "flop"
          : phase;
  return (
    <span
      className="px-2 h-5 inline-flex items-center rounded text-[9.5px] font-bold uppercase tracking-[0.18em]"
      style={{
        background: "oklch(0.696 0.205 155 / 0.18)",
        color: "oklch(0.795 0.184 155)",
        border: "1px solid oklch(0.696 0.205 155 / 0.4)",
      }}
    >
      {label}
    </span>
  );
}

function SetupPopover({
  state,
  dispatch,
  onClose,
}: {
  state: RecorderState;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
  onClose: () => void;
}) {
  const { playerCount, sb, bb, straddleOn, straddleAmt, bombPotOn, bombPotAmt, doubleBoardOn, gameType, heroPosition } = state;
  const canStraddle = playerCount >= 4 && !bombPotOn;
  const positions = POSITION_NAMES[playerCount];
  const hero = state.players[heroPosition];

  // Stack input + apply-to-all flag are local UI. Reset the flag any time
  // the input changes — the label only sticks while the field is unedited.
  const [stackInput, setStackInput] = useState(String(hero?.stack ?? 200));
  const [appliedToAll, setAppliedToAll] = useState(false);
  const updateStack = (v: string) => {
    setStackInput(v);
    setAppliedToAll(false);
  };
  const applyToAll = () => {
    const n = Number(stackInput);
    if (!Number.isFinite(n) || n <= 0) return;
    dispatch({ type: "setAllStacks", stack: n });
    setAppliedToAll(true);
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
      bombPotOn,
      bombPotAmt,
      doubleBoardOn,
      gameType,
      defaultStack: stack,
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const loadDefaults = () => {
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
        bombPotOn: d.bombPotOn,
        bombPotAmt: d.bombPotAmt,
        doubleBoardOn: d.doubleBoardOn,
        gameType: d.gameType,
      },
    });
    dispatch({ type: "setAllStacks", stack: d.defaultStack });
    setStackInput(String(d.defaultStack));
    setAppliedToAll(true);
  };

  const hasDefaults = readSetupDefaults() !== null;

  // Esc closes; outside click handled by the parent overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute left-0 top-11 z-50 w-[440px] rounded-xl flex flex-col gap-3.5 p-4"
      style={{
        background: "rgba(15,15,18,0.97)",
        border: "1px solid oklch(1 0 0 / 0.12)",
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.5)",
        backdropFilter: "blur(14px)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Stakes &amp; seats
        </span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Game — Hold'em vs Pot-Limit Omaha. Switching mid-setup
          resizes hero's hole-card slots; the table refreshes so the user
          can immediately enter the right number of cards. */}
      <div className="flex items-center gap-3.5">
        <span className="w-[88px] text-[11px] font-medium text-zinc-300">
          Game
        </span>
        <div className="flex items-center gap-1.5">
          {(
            [
              { value: "NLHE" as GameType, label: "Hold'em" },
              { value: "PLO4" as GameType, label: "PLO4" },
              { value: "PLO5" as GameType, label: "PLO5" },
            ]
          ).map((opt) => {
            const active = gameType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  dispatch({ type: "setGameType", gameType: opt.value })
                }
                className="h-7 px-2.5 rounded-md text-[11.5px] font-medium cursor-pointer transition-colors"
                style={
                  active
                    ? {
                        background: "oklch(0.696 0.205 155 / 0.18)",
                        border: "1px solid oklch(0.696 0.205 155 / 0.5)",
                        color: "oklch(0.85 0.184 155)",
                      }
                    : {
                        background: "oklch(1 0 0 / 0.04)",
                        border: "1px solid oklch(1 0 0 / 0.10)",
                        color: "#e4e4e7",
                      }
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Players */}
      <div className="flex items-center gap-3.5">
        <span className="w-[88px] text-[11px] font-medium text-zinc-300">
          Players
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() =>
              dispatch({
                type: "setPlayerCount",
                n: Math.max(2, playerCount - 1),
              })
            }
            disabled={playerCount <= 2}
            aria-label="Remove player"
          >
            <Minus />
          </Button>
          <span className="w-20 text-center text-[13px] font-semibold text-zinc-100 tabular-nums">
            {playerCount}-handed
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() =>
              dispatch({
                type: "setPlayerCount",
                n: Math.min(9, playerCount + 1),
              })
            }
            disabled={playerCount >= 9}
            aria-label="Add player"
          >
            <Plus />
          </Button>
        </div>
      </div>

      {/* Blinds — disabled in bomb pot mode (no blinds posted, just antes) */}
      <div className="flex items-center gap-3.5">
        <span
          className={`w-[88px] text-[11px] font-medium ${
            bombPotOn ? "text-zinc-500" : "text-zinc-300"
          }`}
        >
          Blinds
        </span>
        <div className="flex items-center gap-1.5">
          <NumericInput
            value={sb}
            min={1}
            disabled={bombPotOn}
            onCommit={(n) => dispatch({ type: "setBlinds", sb: n, bb })}
            className="w-16 h-8 text-sm text-center disabled:opacity-40"
          />
          <span className="text-zinc-500 text-sm font-medium">/</span>
          <NumericInput
            value={bb}
            min={1}
            disabled={bombPotOn}
            onCommit={(n) => dispatch({ type: "setBlinds", sb, bb: n })}
            className="w-16 h-8 text-sm text-center disabled:opacity-40"
          />
          {bombPotOn && (
            <span className="ml-1 text-[10.5px] italic text-zinc-500">
              no blinds in bomb pots
            </span>
          )}
        </div>
      </div>

      {/* Straddle — disabled in bomb pot mode */}
      <div className="flex items-center gap-3.5">
        <span
          className={`w-[88px] text-[11px] font-medium ${
            bombPotOn ? "text-zinc-500" : "text-zinc-300"
          }`}
        >
          Straddle
        </span>
        <div className="flex items-center gap-2 h-8">
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
              straddleOn
                ? "bg-[oklch(0.696_0.205_155)]"
                : "bg-[oklch(0.4_0_0)]",
            ].join(" ")}
            aria-label="Toggle straddle"
          >
            <span
              className={[
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow",
                "translate-y-0.5 transition-transform",
                straddleOn ? "translate-x-4" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
          {straddleOn && canStraddle ? (
            <NumericInput
              value={straddleAmt}
              min={1}
              onCommit={(n) =>
                dispatch({ type: "setStraddle", on: true, amt: n })
              }
              className="w-16 h-8 text-sm text-center"
            />
          ) : bombPotOn ? (
            <span className="text-[10.5px] italic text-zinc-500">
              no straddle in bomb pots
            </span>
          ) : !canStraddle ? (
            <span className="text-[10.5px] italic text-zinc-500">
              requires 4+ players
            </span>
          ) : null}
        </div>
      </div>

      {/* Bomb pot — every player antes a flat amount and play opens
          on the flop with no preflop action. */}
      <div className="flex items-center gap-3.5">
        <span className="w-[88px] text-[11px] font-medium text-zinc-300">
          Bomb pot
        </span>
        <div className="flex items-center gap-2 h-8">
          <button
            role="switch"
            aria-checked={bombPotOn}
            onClick={() =>
              dispatch({
                type: "setBombPot",
                on: !bombPotOn,
                amt: bombPotAmt,
              })
            }
            className={[
              "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors outline-none cursor-pointer",
              bombPotOn
                ? "bg-[oklch(0.696_0.205_155)]"
                : "bg-[oklch(0.4_0_0)]",
            ].join(" ")}
            aria-label="Toggle bomb pot"
          >
            <span
              className={[
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow",
                "translate-y-0.5 transition-transform",
                bombPotOn ? "translate-x-4" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
          {bombPotOn ? (
            <>
              <span className="text-[12px] text-zinc-500">$</span>
              <NumericInput
                value={bombPotAmt}
                min={1}
                onCommit={(n) =>
                  dispatch({ type: "setBombPot", on: true, amt: n })
                }
                className="w-16 h-8 text-sm text-center"
                aria-label="Ante per player"
              />
              <span className="text-[10.5px] italic text-zinc-500">
                ante per player
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Double board — deals two boards every street; pot splits
          evenly between them at showdown (with quartering on chops). */}
      <div className="flex items-center gap-3.5">
        <span className="w-[88px] text-[11px] font-medium text-zinc-300">
          Double board
        </span>
        <div className="flex items-center gap-2 h-8">
          <button
            role="switch"
            aria-checked={doubleBoardOn}
            onClick={() =>
              dispatch({ type: "setDoubleBoard", on: !doubleBoardOn })
            }
            className={[
              "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors outline-none cursor-pointer",
              doubleBoardOn
                ? "bg-[oklch(0.696_0.205_155)]"
                : "bg-[oklch(0.4_0_0)]",
            ].join(" ")}
            aria-label="Toggle double board"
          >
            <span
              className={[
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow",
                "translate-y-0.5 transition-transform",
                doubleBoardOn ? "translate-x-4" : "translate-x-0.5",
              ].join(" ")}
            />
          </button>
          {doubleBoardOn ? (
            <span className="text-[10.5px] italic text-zinc-500">
              two boards · split pot
            </span>
          ) : null}
        </div>
      </div>

      {/* Stack — with apply-to-all */}
      <div className="flex items-center gap-3.5">
        <span className="w-[88px] text-[11px] font-medium text-zinc-300">
          Stack
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-zinc-500">$</span>
          <Input
            type="number"
            value={stackInput}
            min={1}
            onChange={(e) => updateStack(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyToAll();
            }}
            className="w-20 h-8 text-sm text-center"
          />
          <button
            onClick={applyToAll}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5"
            style={
              appliedToAll
                ? {
                    background: "oklch(0.696 0.205 155 / 0.18)",
                    border: "1px solid oklch(0.696 0.205 155 / 0.5)",
                    color: "oklch(0.85 0.184 155)",
                  }
                : {
                    background: "oklch(1 0 0 / 0.06)",
                    border: "1px solid oklch(1 0 0 / 0.14)",
                    color: "#e4e4e7",
                  }
            }
          >
            {appliedToAll ? <Check size={12} /> : null}
            {appliedToAll ? "Applied to all" : "Apply to all"}
          </button>
        </div>
      </div>

      {/* Hero position — extra row vs. handoff so the recorder doesn't lose
          the ability to set it during setup. Only meaningful before play. */}
      {state.phase === "setup" && (
        <div className="flex items-start gap-3.5">
          <span className="w-[88px] text-[11px] font-medium text-zinc-300 mt-1">
            Hero
          </span>
          <div className="grid grid-cols-5 gap-1 flex-1">
            {positions.map((label, cycleIdx) => {
              const isActive = cycleIdx === heroPosition;
              return (
                <button
                  key={cycleIdx}
                  type="button"
                  onClick={() =>
                    dispatch({ type: "setHeroPosition", position: cycleIdx })
                  }
                  className={[
                    "h-7 px-1 rounded-md text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer border",
                    isActive
                      ? "bg-[oklch(0.696_0.205_155_/_0.18)] text-[oklch(0.795_0.184_155)] border-[oklch(0.696_0.205_155_/_0.4)]"
                      : "bg-transparent text-zinc-300 border-white/10 hover:bg-white/5",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Default save/load row */}
      <div className="mt-1 pt-3.5 border-t border-white/8 flex items-center gap-2">
        <button
          onClick={loadDefaults}
          disabled={!hasDefaults}
          className="flex-1 h-[30px] px-2.5 rounded-md text-[11.5px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
          style={{
            background: "oklch(1 0 0 / 0.04)",
            border: "1px solid oklch(1 0 0 / 0.10)",
            color: "#e4e4e7",
          }}
        >
          <RotateCcw size={11} /> Load my default
        </button>
        <button
          onClick={saveAsDefault}
          className="flex-1 h-[30px] px-2.5 rounded-md text-[11.5px] font-medium cursor-pointer inline-flex items-center justify-center gap-1.5"
          style={{
            background: "oklch(0.696 0.205 155 / 0.10)",
            border: "1px solid oklch(0.696 0.205 155 / 0.35)",
            color: "oklch(0.85 0.184 155)",
          }}
        >
          {savedFlash ? <Check size={11} /> : <Save size={11} />}
          {savedFlash ? "Saved" : "Save as default"}
        </button>
      </div>
      <p className="text-[10.5px] leading-relaxed text-zinc-500 -mt-1">
        Defaults apply to every new hand. Edit venue &amp; date from the
        dashboard after saving.
      </p>
    </div>
  );
}

function MetaStrip({
  state,
  derived,
  dispatch,
  pot,
  onStart,
  popoverOpen,
  setPopoverOpen,
  logOpen,
  setLogOpen,
}: {
  state: RecorderState;
  derived: ReturnType<typeof deriveStreet>;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
  pot: number;
  onStart: () => void;
  // Lifted to the parent so the table can dim when the popover opens.
  popoverOpen: boolean;
  setPopoverOpen: (v: boolean) => void;
  // Lifted to the parent so the log popover can use the parent's data.
  logOpen: boolean;
  setLogOpen: (v: boolean) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const logWrapperRef = useRef<HTMLDivElement | null>(null);
  // Close on outside mousedown — separate handlers so the log and stakes
  // popovers can independently open/close.
  useEffect(() => {
    if (!popoverOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [popoverOpen, setPopoverOpen]);
  useEffect(() => {
    if (!logOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!logWrapperRef.current) return;
      if (!logWrapperRef.current.contains(e.target as Node)) {
        setLogOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [logOpen, setLogOpen]);
  useEffect(() => {
    if (!logOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLogOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [logOpen, setLogOpen]);

  const hero = state.players[state.heroPosition];
  const heroOk = !!(hero?.cards?.[0] && hero?.cards?.[1]);

  // Action hint — quiet Geist Mono copy showing "[last action] → [active] to act".
  const lastAction = state.actions[state.actions.length - 1];
  const activeSeat = derived?.activeSeat;
  const posNames = POSITION_NAMES[state.playerCount];
  const lastText = lastAction
    ? formatAction(lastAction, state.playerCount)
    : null;
  const activeText =
    activeSeat !== undefined && activeSeat !== null
      ? `${posNames[activeSeat]} to act`
      : null;
  const hint = (() => {
    if (state.phase === "setup") {
      return heroOk
        ? "Click Start hand when you're ready."
        : "Pick your two hole cards to start.";
    }
    if (state.phase === "showdown" || state.phase === "done") {
      return "Reveal opponent hands and confirm the result.";
    }
    if (lastText && activeText) return `${lastText} → ${activeText}`;
    if (activeText) return `${activeText}`;
    return "";
  })();

  // Game-type chip prefixes the summary for non-NLHE so the variant is
  // always visible. NLHE keeps the original layout (no extra chip).
  const gameLabel =
    state.gameType === "PLO5"
      ? "PLO5"
      : state.gameType === "PLO4"
        ? "PLO4"
        : null;

  // Live config summary in the button.
  const summary = (
    <>
      {gameLabel && (
        <>
          <span
            className="font-medium"
            style={{ color: "oklch(0.795 0.184 155)" }}
          >
            {gameLabel}
          </span>
          <span className="text-zinc-600">·</span>
        </>
      )}
      {state.bombPotOn ? (
        <>
          <span
            className="font-medium"
            style={{ color: "oklch(0.795 0.184 155)" }}
          >
            Bomb pot ${state.bombPotAmt}
          </span>
          <span className="text-zinc-600">·</span>
          <span>{state.playerCount}-max</span>
        </>
      ) : (
        <>
          <span className="font-medium tabular-nums">
            ${state.sb}/${state.bb}
          </span>
          <span className="text-zinc-600">·</span>
          <span>{state.playerCount}-max</span>
          {state.straddleOn && state.playerCount >= 4 && (
            <>
              <span className="text-zinc-600">·</span>
              <span style={{ color: "oklch(0.795 0.184 155)" }}>
                straddle ${state.straddleAmt}
              </span>
            </>
          )}
        </>
      )}
    </>
  );

  return (
    <div
      className="self-stretch flex items-center gap-2.5 text-[12px] relative z-20"
      style={{ minHeight: 40 }}
    >
      <div ref={wrapperRef} className="relative flex items-center">
        {(() => {
          // Stakes / seats / game type are setup-only — once a hand
          // starts the table is committed, and toggling, say, bomb pot
          // mid-hand or resizing players' cards would silently break
          // every downstream calculation. Render the trigger as a
          // read-only summary chip outside setup; only setup gets the
          // popover trigger + chevron.
          const editable = state.phase === "setup";
          if (!editable) {
            return (
              <span
                className="px-3 rounded-md text-[11.5px] inline-flex items-center gap-2"
                style={{
                  height: 40,
                  background: "oklch(1 0 0 / 0.03)",
                  border: "1px solid oklch(1 0 0 / 0.08)",
                  color: "oklch(0.7 0 0)",
                }}
                title="Stakes & seats are locked once the hand starts"
              >
                <Settings size={12} />
                <span className="font-medium">Stakes &amp; seats</span>
                {summary}
              </span>
            );
          }
          return (
            <>
              <button
                type="button"
                onClick={() => setPopoverOpen(!popoverOpen)}
                className="px-3 rounded-md text-[11.5px] cursor-pointer inline-flex items-center gap-2 transition-colors"
                style={
                  popoverOpen
                    ? {
                        height: 40,
                        background: "oklch(0.696 0.205 155 / 0.12)",
                        border: "1px solid oklch(0.696 0.205 155 / 0.4)",
                        color: "oklch(0.85 0.184 155)",
                      }
                    : {
                        height: 40,
                        background: "oklch(1 0 0 / 0.04)",
                        border: "1px solid oklch(1 0 0 / 0.10)",
                        color: "oklch(0.85 0 0)",
                      }
                }
                aria-expanded={popoverOpen}
              >
                <Settings size={12} />
                <span className="font-medium">Stakes &amp; seats</span>
                {summary}
                {popoverOpen ? (
                  <ChevronUp size={11} />
                ) : (
                  <ChevronDown size={11} />
                )}
              </button>
              {popoverOpen && (
                <SetupPopover
                  state={state}
                  dispatch={dispatch}
                  onClose={() => setPopoverOpen(false)}
                />
              )}
            </>
          );
        })()}
      </div>
      <span className="text-zinc-600">·</span>
      <StreetPill phase={state.phase} bombPotOn={state.bombPotOn} />
      <span
        className="text-zinc-400 tabular-nums"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        pot ${pot}
      </span>
      <div className="flex-1" />
      {state.phase !== "setup" && hint && (
        <span
          className="text-[11px] text-zinc-500 truncate max-w-[440px]"
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          }}
        >
          {hint}
        </span>
      )}
      {state.phase === "setup" && hint && (
        <span className="text-[11px] text-zinc-500">{hint}</span>
      )}
      {/* Log button — only meaningful once actions exist. The log itself
          renders from inside this wrapper as a popover anchored beneath. */}
      {state.actions.length > 0 && (
        <div ref={logWrapperRef} className="relative flex items-center">
          <button
            type="button"
            onClick={() => setLogOpen(!logOpen)}
            className="px-3 rounded-md text-[11.5px] cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            style={
              logOpen
                ? {
                    height: 40,
                    background: "oklch(0.696 0.205 155 / 0.18)",
                    border: "1px solid oklch(0.696 0.205 155 / 0.5)",
                    color: "oklch(0.85 0.184 155)",
                  }
                : {
                    height: 40,
                    background: "oklch(1 0 0 / 0.04)",
                    border: "1px solid oklch(1 0 0 / 0.10)",
                    color: "oklch(0.85 0 0)",
                  }
            }
            aria-expanded={logOpen}
            aria-label="Toggle action log"
          >
            <span className="font-medium">Log</span>
            <span className="tabular-nums" style={{ opacity: 0.7 }}>
              {state.actions.length}
            </span>
            {logOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {logOpen && (
            <div
              className="absolute right-0 top-11 z-50 rounded-xl"
              style={{
                width: 520,
                maxHeight: 420,
                overflowY: "auto",
                background: "rgba(15,15,18,0.97)",
                border: "1px solid oklch(1 0 0 / 0.12)",
                boxShadow:
                  "0 24px 60px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.5)",
                backdropFilter: "blur(14px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <ActionLog
                state={state}
                derivedTotalPot={derived?.totalPot ?? totalPot(state)}
                dispatch={dispatch}
                inPopover
              />
            </div>
          )}
        </div>
      )}
      {state.phase === "setup" && (
        <Button
          onClick={onStart}
          disabled={!heroOk}
          size="lg"
          style={{
            height: 40,
            background: EMERALD,
            color: BG,
            fontWeight: 600,
          }}
          className="hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50"
          title={heroOk ? "Press Space or Enter to start" : undefined}
        >
          Start hand
          {heroOk && <Kbd tone="dark">Space</Kbd>}
          <ChevronRight />
        </Button>
      )}
    </div>
  );
}


function ActionLog({
  state,
  derivedTotalPot,
  dispatch,
  inPopover = false,
}: {
  state: RecorderState;
  derivedTotalPot: number;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
  // When rendered inside the meta-strip Log popover, drop the outer card
  // chrome (the popover provides background + border + scroll).
  inPopover?: boolean;
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
    <div
      className={
        inPopover
          ? "px-4 py-3 w-full"
          : "rounded-xl border border-white/10 bg-[oklch(0.205_0_0)] px-4 py-3 w-full max-w-[1100px] max-h-[140px] overflow-y-auto"
      }
    >
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
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialStateFromDefaults(),
  );
  // Tracks the in-flight save so the button can disable itself while the
  // server action runs.
  const [savePending, startSave] = useTransition();
  const derived = useMemo(() => deriveStreet(state), [state]);
  // Stakes & seats popover open state — lifted here so the table can dim
  // (per the handoff) while the popover is in front of it.
  const [setupPopoverOpen, setSetupPopoverOpen] = useState(false);
  // Action-log popover; lifted so the inline log below the table can be
  // removed entirely (the popover replaces it).
  const [logOpen, setLogOpen] = useState(false);
  // Annotation editor modal — `null` = closed, otherwise the index in
  // state.actions whose annotation is being edited. Opens when the user
  // clicks a bet/check bubble on the felt.
  const [annotateIdx, setAnnotateIdx] = useState<number | null>(null);

  // Cmd/Ctrl-Z undo, available across phases (the per-action shortcuts live
  // inside ActionBar). Skips when typing in any field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      dispatch({ type: "undoAction" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  // Space (or Enter) starts the hand from setup once hero hole cards are
  // filled — closes the loop on the keyboard-only flow. The picker
  // intercepts these keys when it's open (capture phase), so this only
  // fires when the user is actually back at the meta-strip level.
  useEffect(() => {
    if (state.phase !== "setup") return;
    const heroCards = state.players[state.heroPosition]?.cards;
    if (!heroCards?.[0] || !heroCards?.[1]) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      // Don't hijack a focused button — Space/Enter on it should activate
      // that button, not start the hand. The user can always click an
      // empty area first to clear focus.
      if (tag === "BUTTON") return;
      e.preventDefault();
      dispatch({ type: "startPlay" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, state.players, state.heroPosition, dispatch]);

  // Used cards (so the picker greys out duplicates). Aggregates both
  // boards in double-board mode so a card on board 1 can't be re-picked
  // for board 2 (or vice versa).
  const usedCards = useMemo(() => {
    const s = new Set<string>();
    state.players.forEach((p) => p.cards?.forEach((c) => c && s.add(c)));
    state.board.forEach((c) => c && s.add(c));
    state.board2.forEach((c) => c && s.add(c));
    return s;
  }, [state.players, state.board, state.board2]);

  const N = state.playerCount;
  // Hole-card count for the current game (2 NLHE / 4 PLO4 / 5 PLO5).
  // Drives the hero + villain card-row sizing below.
  const heroHoleCount = holeCardCount(state.gameType);
  const heroPos = state.heroPosition;
  // Visual seat positions, indexed by visual slot (0 = bottom-center / hero).
  const visualSeatPos = Array.from({ length: N }, (_, i) => seatXY(i, N));
  // Helper: render-time visual slot for a given cycle-indexed seat.
  const visualOf = (cycleIdx: number) => cycleToVisual(cycleIdx, heroPos, N);
  const posNames = POSITION_NAMES[N];
  // Dealer button is always at cycle 0 (BTN). Bring it to its visual slot.
  const btnVisual = visualOf(0);

  const setupPot = state.bombPotOn
    ? state.bombPotAmt * N
    : state.sb +
      state.bb +
      (state.straddleOn && state.playerCount >= 4 ? state.straddleAmt : 0);
  const pot =
    state.phase === "setup"
      ? setupPot
      : derived?.totalPot ?? totalPot(state);

  // Setup-phase chip bubbles. For a normal hand: SB/BB (+ straddle) at
  // their respective seats. For a bomb pot: every seat shows the flat
  // ante so the user can see at a glance that everyone's contributing.
  const setupBets = useMemo(() => {
    if (state.phase !== "setup") return null;
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

  const playBets = derived?.bets || {};
  // Compute folded directly from the action log so it stays accurate in setup
  // and showdown phases (deriveStreet returns null in those, which would leave
  // `folded` empty and break the showdown panel's survivor filter).
  const folded = useMemo(() => {
    const s = new Set<number>();
    for (const a of state.actions) if (a.action === "fold") s.add(a.seat);
    return s;
  }, [state.actions]);
  // Seats whose most recent action on the *current* street is `check`. The
  // check bubble persists until that seat acts again or the street rolls over,
  // matching how bet bubbles behave.
  const checkedSeats = useMemo(() => {
    const result = new Set<number>();
    if (
      state.phase === "setup" ||
      state.phase === "showdown" ||
      state.phase === "done"
    ) {
      return result;
    }
    const street = state.phase;
    const seen = new Set<number>();
    for (let i = state.actions.length - 1; i >= 0; i--) {
      const a = state.actions[i];
      if (a.street !== street) continue;
      if (seen.has(a.seat)) continue;
      seen.add(a.seat);
      if (a.action === "check") result.add(a.seat);
    }
    return result;
  }, [state.actions, state.phase]);
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

  // Pot awards resolved from current state. Single source of truth for both
  // the showdown panel's display and `saveHand`'s persisted hero result. Is
  // null when the hand isn't resolvable yet (pre-showdown, undecided villain,
  // incomplete board, missing hero cards). The header Save button used to
  // bypass this and persist `result = -heroPaid` for every hand at showdown,
  // which is why hero-wins were showing as losses on /dashboard.
  const resolvedAwards = useMemo<PotAward[][] | null>(() => {
    if (state.phase !== "showdown" && state.phase !== "done") return null;
    const board1 = state.board.filter((c): c is string => Boolean(c));
    const board2 = state.doubleBoardOn
      ? state.board2.filter((c): c is string => Boolean(c))
      : null;
    const pots = computeSidePots(state);
    const survivors = state.players.filter((p) => !folded.has(p.seat));
    const villainSurvivors = survivors.filter((p) => p.seat !== heroPos);
    const heroAlone =
      villainSurvivors.length === 0 ||
      villainSurvivors.every((v) => muckedSet.has(v.seat));
    if (heroAlone) {
      return pots.map((p) => [{ amount: p.amount, winners: [heroPos] }]);
    }
    // Omaha needs all 4 / 5 hole cards; Hold'em needs 2. `isShown` gates
    // on the right count for the current game type.
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
        ? awardPotsMultiBoard(pots, contestants, [board1, board2], state.gameType)
        : awardPots(pots, contestants, board1, state.gameType);
    } catch {
      return null;
    }
  }, [state, folded, muckedSet, heroPos]);

  // Per-board street fill flags — track each board independently so we
  // can chain the auto-open picker from board 1 to board 2 within the
  // same street.
  const board1FlopFilled = !!(state.board[0] && state.board[1] && state.board[2]);
  const board2FlopFilled = !!(state.board2[0] && state.board2[1] && state.board2[2]);
  const board1TurnFilled = !!state.board[3];
  const board2TurnFilled = !!state.board2[3];
  const board1RiverFilled = !!state.board[4];
  const board2RiverFilled = !!state.board2[4];
  // A street is "filled" only when every active board has its cards.
  // For single-board hands the second-board flags are ignored.
  const flopFilled =
    board1FlopFilled && (!state.doubleBoardOn || board2FlopFilled);
  const turnFilled =
    board1TurnFilled && (!state.doubleBoardOn || board2TurnFilled);
  const riverFilled =
    board1RiverFilled && (!state.doubleBoardOn || board2RiverFilled);

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

  const saveHand = () => {
    // committedBySeatFinal applies the per-street uncalled-bet refund, so
    // heroPaid here is the chips hero actually parted with — not the raw
    // sum of bet/raise amounts (which double-counts re-raises and ignores
    // refunds). seatWinnings sums per-pot allocations for hero, handling
    // side pots and split-pot ties.
    //
    // Awards come from the `resolvedAwards` memo so both Save buttons
    // (header + showdown panel) get the same per-pot resolution. The
    // header button used to call this with `awards=null`, which silently
    // saved every hand as `result = -heroPaid` regardless of who actually
    // won — that's the dashboard / replayer mismatch users were hitting.
    const awards = resolvedAwards;
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

    startSave(async () => {
      // Yield a frame before the heavy equity enumeration so React commits
      // the `savePending` transition first — the button paints "Saving…"
      // and turns disabled before the main thread locks. Without this the
      // INP between click and next paint was several hundred ms on
      // multiway / PLO / double-board hands (tracked as a Vercel INP
      // alert). The yield itself is one microtask + a 0ms timeout, well
      // under any user-perceivable threshold.
      await new Promise((r) => setTimeout(r, 0));

      // Precompute per-step equity (recordedToHand needs an `id` to
      // typecheck; a placeholder is fine — we only read `steps` and
      // `players` back from it). Double-board runs the pass twice (once
      // per board) so the replayer renders two badges per seat.
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
            newHand._full = { ...newHand._full, ...patch };
          }
        }
      } catch (e) {
        // Equity precompute failures shouldn't block the save — the
        // replayer will fall back to live computation.
        console.warn("Equity precompute failed; replayer will compute live.", e);
      }

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

  // Back link → /dashboard. Confirm if there's unsaved work. Returns a
  // promise the caller can await before navigating away.
  const handleBack = async () => {
    if (isDirty()) {
      const ok = await confirm({
        title: "Leave without saving?",
        message: "Your in-progress recording will be lost.",
        confirmLabel: "Leave",
        destructive: true,
      });
      if (!ok) return false;
    }
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
              <Button
                size="sm"
                onClick={() => saveHand()}
                disabled={
                  savePending ||
                  (state.phase !== "showdown" && state.phase !== "done") ||
                  resolvedAwards === null
                }
                title={
                  state.phase !== "showdown" && state.phase !== "done"
                    ? "Play through to showdown before saving"
                    : resolvedAwards === null
                      ? "Resolve every villain (show or muck) before saving"
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
      <div className="flex-1 flex flex-col items-center px-6 py-4 gap-3 max-w-[1600px] w-full mx-auto">
        {/* Title row: just the editable hand name. The phase pill, pot, and
            action hint live in the meta strip below; venue & date moved out
            of the recorder entirely (they're editable from /dashboard). */}
        <div className="self-stretch">
          <HandNameDisplay
            value={state.handName}
            onCommit={(name) => dispatch({ type: "setHandName", name })}
          />
        </div>

        {/* Meta strip — Stakes & seats popover trigger, street pill, pot,
            action hint, and the Start hand CTA during setup. */}
        <MetaStrip
          state={state}
          derived={derived}
          dispatch={dispatch}
          pot={pot}
          onStart={() => dispatch({ type: "startPlay" })}
          popoverOpen={setupPopoverOpen}
          setPopoverOpen={setSetupPopoverOpen}
          logOpen={logOpen}
          setLogOpen={setLogOpen}
        />

        {/* Table — dims to 55% while the setup popover is open so focus
            stays on the controls. The inner cap keeps the table from
            outgrowing the available vertical space; the 440px chrome
            estimate reserves room for the header + meta strip + the
            below-table row (action bar with drawer open ≈ 217, including
            the Fold/Call/Raise row that the user must always see) +
            paddings. Felt is `aspect-ratio: 2/1` so the height follows.
            On shorter viewports the table shrinks proportionally so the
            action bar never gets pushed off-screen. */}
        <div
          className="self-stretch flex justify-center transition-opacity"
          style={{ opacity: setupPopoverOpen ? 0.55 : 1 }}
        >
        <div
          className="w-full flex flex-col items-center"
          style={{ maxWidth: "calc((100vh - 440px) * 2)" }}
        >
        <TableSurface>
          {/* Pot + board(s). The translateY nudge shifts the stack up to
              keep clearance from the hero hole cards at the bottom; we
              nudge further when a second board is present so both boards
              sit visually above the hero. */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
            style={{
              transform: `translateY(${state.doubleBoardOn ? -56 : -34}px)`,
            }}
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
              // Skip when the hand is already over (everyone folded) — those
              // streets won't be played, so we shouldn't pulse or auto-open.
              // Board 1's pulse only fires when board 1 itself is the next
              // empty slot for the current street.
              highlight={
                !!derived?.streetClosed &&
                !derived?.handOver &&
                ((state.phase === "preflop" && !board1FlopFilled) ||
                  (state.phase === "flop" && !board1TurnFilled) ||
                  (state.phase === "turn" && !board1RiverFilled))
              }
              // Mouseless flow: pop the picker open the moment a betting
              // round closes, so the user types the next street's cards
              // without reaching for the mouse.
              autoOpenOnHighlight
              onPick={(idx, card) =>
                dispatch({ type: "setBoard", idx, card, boardIdx: 0 })
              }
              onClear={(card) => dispatch({ type: "clearCard", card })}
            />
            {state.doubleBoardOn && (
              <CardRow
                cards={state.board2}
                used={usedCards}
                disabled={state.phase === "setup"}
                autoAdvanceCount={3}
                size="md"
                ariaLabelPrefix="Second board card"
                // Board 2 highlights only after board 1 has caught up
                // for the same street — that sequencing keeps the picker
                // chain "board 1 then board 2" without juggling state.
                highlight={
                  !!derived?.streetClosed &&
                  !derived?.handOver &&
                  ((state.phase === "preflop" &&
                    board1FlopFilled &&
                    !board2FlopFilled) ||
                    (state.phase === "flop" &&
                      board1TurnFilled &&
                      !board2TurnFilled) ||
                    (state.phase === "turn" &&
                      board1RiverFilled &&
                      !board2RiverFilled))
                }
                autoOpenOnHighlight
                onPick={(idx, card) =>
                  dispatch({ type: "setBoard", idx, card, boardIdx: 1 })
                }
                onClear={(card) => dispatch({ type: "clearCard", card })}
              />
            )}
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
                const street =
                  state.phase === "showdown" || state.phase === "done"
                    ? "river"
                    : state.phase;
                const idx = lastActionIdxForSeat(
                  state.actions,
                  cycleIdx,
                  street,
                );
                return (
                  <BetBubble
                    key={cycleIdx}
                    seatPos={visualSeatPos[v]}
                    amount={amt}
                    isHero={v === 0}
                    onClick={
                      idx !== null ? () => setAnnotateIdx(idx) : undefined
                    }
                    hasAnnotation={
                      idx !== null && !!state.annotations[idx]?.trim()
                    }
                  />
                );
              })}

          {/* Check bubbles — for each seat whose most recent action on the
              current street is `check`, render the same chip+pill visual as
              a bet bubble but with "check" text. Resets between streets the
              same way bet bubbles do, since the source loop is scoped to
              actions on the current street. */}
          {checkedSeats.size > 0 &&
            Array.from(checkedSeats).map((cycleIdx) => {
              if (folded.has(cycleIdx)) return null;
              const v = visualOf(cycleIdx);
              const street =
                state.phase === "showdown" || state.phase === "done"
                  ? "river"
                  : state.phase;
              const idx = lastActionIdxForSeat(
                state.actions,
                cycleIdx,
                street,
              );
              return (
                <BetBubble
                  key={`check-${cycleIdx}`}
                  seatPos={visualSeatPos[v]}
                  isHero={v === 0}
                  label="check"
                  onClick={
                    idx !== null ? () => setAnnotateIdx(idx) : undefined
                  }
                  hasAnnotation={
                    idx !== null && !!state.annotations[idx]?.trim()
                  }
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
                      // Re-key on hole-card count so toggling NLHE → PLO
                      // remounts the row. Otherwise the `animate-pulse`
                      // animations on previously-mounted slots stay out
                      // of phase with the freshly-mounted ones.
                      key={`hero-${heroHoleCount}`}
                      cards={Array.from(
                        { length: heroHoleCount },
                        (_, i) => cards?.[i] ?? null,
                      )}
                      used={usedCards}
                      autoAdvanceCount={heroHoleCount}
                      size="md"
                      ariaLabelPrefix="Hero card"
                      fan={heroHoleCount > 2}
                      // Glow during setup if cards aren't filled yet — hero
                      // hole cards are required before "Start hand" works.
                      highlight={
                        state.phase === "setup" &&
                        Array.from(
                          { length: heroHoleCount },
                          (_, i) => !cards?.[i],
                        ).some(Boolean)
                      }
                      onPick={(idx, c) =>
                        dispatch({
                          type: "setHeroCard",
                          idx,
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
                            key={`villain-${cycleIdx}-${heroHoleCount}`}
                            cards={Array.from(
                              { length: heroHoleCount },
                              (_, i) => cards?.[i] ?? null,
                            )}
                            used={usedCards}
                            autoAdvanceCount={heroHoleCount}
                            size="sm"
                            gapClass="gap-1"
                            ariaLabelPrefix={`${posNames[cycleIdx]} card`}
                            fan={heroHoleCount > 2}
                            // Glow until all cards are revealed so the user
                            // sees what's required to finish the showdown.
                            highlight={Array.from(
                              { length: heroHoleCount },
                              (_, i) => !cards?.[i],
                            ).some(Boolean)}
                            onPick={(idx, c) =>
                              dispatch({
                                type: "setOppCard",
                                seat: cycleIdx,
                                idx,
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
                        className="absolute left-1/2 -translate-x-1/2 -top-14"
                        style={{ opacity: isFolded ? 0.3 : 1 }}
                      >
                        <HandFan
                          cards={Array.from(
                            { length: heroHoleCount },
                            () => null,
                          )}
                          size="sm"
                          fan={heroHoleCount > 2}
                          faceDown
                        />
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })}
        </TableSurface>
        </div>
        </div>

        {/* Below-table area: action stuff on the left, notes on the right. */}
        <div className="self-stretch flex flex-col lg:flex-row gap-3 items-stretch">
          <div className="flex-1 flex flex-col gap-4 min-w-0">

        {/* The inline action-log card moved into the meta strip's Log popover
            so the bet-sizing drawer can fit above the fold. Trigger lives in
            <MetaStrip>; popover content reuses the same <ActionLog>. */}

        {/* Bottom controls — Setup config moved into the meta strip + popover
            above the table. Only the action bar / deal CTA / showdown panel
            render below the table now. */}

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
                  // Thin ~36px strip — replaced the heavy emerald banner. The
                  // pulse-cue lives on the board slots themselves (see CardRow
                  // `highlight` prop), so this row only needs the inline call
                  // to action.
                  <div
                    className="rounded-lg border border-white/10 px-4 flex items-center gap-3 w-full max-w-[1100px]"
                    style={{
                      height: 36,
                      background: "rgba(15,15,18,0.6)",
                    }}
                  >
                    <span className="text-[12px] text-zinc-300">
                      {dealCTA.showdown
                        ? "Betting closed — go to showdown."
                        : `Click the ${dealCTA.label.toLowerCase()} above to continue.`}
                    </span>
                    <div className="flex-1" />
                    {dealCTA.showdown ? (
                      <Button
                        onClick={() => dispatch({ type: "goShowdown" })}
                        size="sm"
                        style={{ background: EMERALD, color: BG, fontWeight: 600 }}
                        className="hover:!bg-[oklch(0.745_0.198_155)]"
                      >
                        Go to showdown <ChevronRight />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="xs"
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
          // Game-aware "shown" check — Omaha needs the full 4 / 5 cards.
          const showHoleCount = holeCardCount(state.gameType);
          const isShown = (p: Player): boolean => {
            if (!p.cards) return false;
            for (let i = 0; i < showHoleCount; i++)
              if (!p.cards[i]) return false;
            return true;
          };
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

          const board1Full = state.board.filter((c): c is string => Boolean(c));
          const board2Full = state.doubleBoardOn
            ? state.board2.filter((c): c is string => Boolean(c))
            : null;
          const heroCardsOk = isShown(state.players[heroPos]);
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
            const boardsIncomplete =
              board1Full.length < 5 ||
              (board2Full !== null && board2Full.length < 5);
            if (boardsIncomplete) {
              evalError = state.doubleBoardOn
                ? "Fill in both boards to determine the winners."
                : "Fill in the rest of the board to determine the winner.";
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
                  cards: (p.cards as string[]).slice(0, showHoleCount),
                }));
              try {
                awards = board2Full
                  ? awardPotsMultiBoard(
                      pots,
                      contestants,
                      [board1Full, board2Full],
                      state.gameType,
                    )
                  : awardPots(pots, contestants, board1Full, state.gameType);
                // Aggregate distinct winners across pots for the summary
                // header. Per-pot winners may differ in side-pot scenarios
                // and per-board winners differ in double-board hands.
                const winnerSet = new Set<number>();
                for (const potAwards of awards)
                  for (const a of potAwards)
                    for (const w of a.winners) winnerSet.add(w);
                winners = [...winnerSet];
                // Reuse determineWinner just to populate per-seat hand
                // descriptions (for the "shows X · top pair" annotation).
                // For double board, prefer board 1's descriptions — board 2
                // is shown via the additional render layer below.
                scores = determineWinner(
                  contestants,
                  board1Full,
                  state.gameType,
                ).scores;
              } catch (e) {
                evalError = (e as Error).message;
              }
            }
          }

          const decided =
            heroAlone || villainsAwaiting.length === 0;
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
                  onClick={() => saveHand()}
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
              className="flex w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none flex-1 min-h-[80px]"
            />
          </div>
        </div>
      </div>
      {annotateIdx !== null && state.actions[annotateIdx] && (
        <AnnotationModal
          initial={state.annotations[annotateIdx] ?? ""}
          actionLabel={formatAction(state.actions[annotateIdx], state.playerCount)}
          onSave={(text) =>
            dispatch({ type: "setAnnotation", index: annotateIdx, text })
          }
          onClose={() => setAnnotateIdx(null)}
        />
      )}
    </Shell>
  );
}

// Re-export for callers that want the action types
export type { ActionType };
