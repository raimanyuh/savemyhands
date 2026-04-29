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
    const sizeFromFrac = (frac: number) => {
      const potAfter = tp + toCall;
      const target = Math.round(lastBet + frac * potAfter);
      return Math.min(seat ? seat.stack - (committed[seatRef] || 0) + (bets[seatRef] || 0) : target, Math.max(target, minRaise));
    };
    const stackLeft = seat ? Math.max(0, seat.stack - (committed[seatRef] || 0)) : 0;
    const allIn = (bets[seatRef] || 0) + stackLeft;
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
        setAmount(String(sizeFromFrac(1.25)));
      } else if (k === "a") {
        e.preventDefault();
        setAmount(String(allIn));
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
      if (amt < minRaise && amt !== allInAmount) return;
      dispatch({
        type: "recordAction",
        action: { seat: activeSeat, action: "raise", amount: amt },
      });
    }
  };

  // Resolve a sizing fraction to a clamped chip amount.
  const sizeFor = (frac: number) => {
    const potAfter = tp + toCall;
    const target = Math.round(lastBet + frac * potAfter);
    return Math.min(allInAmount, Math.max(target, minRaise));
  };
  const chips: { id: string; label: string; amount: number }[] = [
    { id: "half", label: "½ pot", amount: sizeFor(0.5) },
    { id: "twothird", label: "⅔ pot", amount: sizeFor(2 / 3) },
    { id: "pot", label: "Pot", amount: sizeFor(1) },
    { id: "overpot", label: "1.25×", amount: sizeFor(1.25) },
    { id: "allin", label: "All-in", amount: allInAmount },
  ];

  const isBetMode = lastBet === 0;
  const amt = Number(amount);
  // Allow short-stack all-ins below minRaise (they're valid even if they don't
  // technically reopen action). Disallow betting more than the seat has.
  const cannotBet = isBetMode
    ? amt <= 0 || amt > allInAmount
    : amt > allInAmount || (amt < minRaise && amt !== allInAmount);

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
  // up to the player's all-in.
  const sliderMin = isBetMode ? Math.max(state.bb, 1) : Math.max(minRaise, 1);
  const sliderMax = Math.max(sliderMin, allInAmount);
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

function StreetPill({ phase }: { phase: RecorderState["phase"] }) {
  const label =
    phase === "showdown" || phase === "done"
      ? "showdown"
      : phase === "setup"
        ? "setup"
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
  const { playerCount, sb, bb, straddleOn, straddleAmt, heroPosition } = state;
  const canStraddle = playerCount >= 4;
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
      className="absolute left-0 top-9 z-50 w-[440px] rounded-xl flex flex-col gap-3.5 p-4"
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

      {/* Blinds */}
      <div className="flex items-center gap-3.5">
        <span className="w-[88px] text-[11px] font-medium text-zinc-300">
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
            className="w-16 h-8 text-sm text-center"
          />
          <span className="text-zinc-500 text-sm font-medium">/</span>
          <Input
            type="number"
            value={bb}
            min={1}
            onChange={(e) =>
              dispatch({ type: "setBlinds", sb, bb: Number(e.target.value) })
            }
            className="w-16 h-8 text-sm text-center"
          />
        </div>
      </div>

      {/* Straddle */}
      <div className="flex items-center gap-3.5">
        <span className="w-[88px] text-[11px] font-medium text-zinc-300">
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
              className="w-16 h-8 text-sm text-center"
            />
          ) : !canStraddle ? (
            <span className="text-[10.5px] italic text-zinc-500">
              requires 4+ players
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

  // Live config summary in the button.
  const summary = (
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
  );

  return (
    <div
      className="self-stretch flex items-center gap-2.5 text-[12px] relative"
      style={{ minHeight: 36 }}
    >
      <div ref={wrapperRef} className="relative">
        <button
          type="button"
          onClick={() => setPopoverOpen(!popoverOpen)}
          className="h-[30px] px-3 rounded-md text-[11.5px] cursor-pointer inline-flex items-center gap-2 transition-colors"
          style={
            popoverOpen
              ? {
                  background: "oklch(0.696 0.205 155 / 0.12)",
                  border: "1px solid oklch(0.696 0.205 155 / 0.4)",
                  color: "oklch(0.85 0.184 155)",
                }
              : {
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
          {popoverOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
        {popoverOpen && (
          <SetupPopover
            state={state}
            dispatch={dispatch}
            onClose={() => setPopoverOpen(false)}
          />
        )}
      </div>
      <span className="text-zinc-600">·</span>
      <StreetPill phase={state.phase} />
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
        <div ref={logWrapperRef} className="relative">
          <button
            type="button"
            onClick={() => setLogOpen(!logOpen)}
            className="h-[30px] px-3 rounded-md text-[11.5px] cursor-pointer inline-flex items-center gap-1.5 transition-colors"
            style={
              logOpen
                ? {
                    background: "oklch(0.696 0.205 155 / 0.18)",
                    border: "1px solid oklch(0.696 0.205 155 / 0.5)",
                    color: "oklch(0.85 0.184 155)",
                  }
                : {
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
              className="absolute right-0 top-9 z-50 rounded-xl"
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
          size="sm"
          style={{ background: EMERALD, color: BG, fontWeight: 600 }}
          className="hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50"
        >
          Start hand <ChevronRight />
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
            stays on the controls. */}
        <div
          className="self-stretch flex flex-col items-center transition-opacity"
          style={{ opacity: setupPopoverOpen ? 0.55 : 1 }}
        >
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

          {/* Check bubbles — for each seat whose most recent action on the
              current street is `check`, render the same chip+pill visual as
              a bet bubble but with "check" text. Resets between streets the
              same way bet bubbles do, since the source loop is scoped to
              actions on the current street. */}
          {checkedSeats.size > 0 &&
            Array.from(checkedSeats).map((cycleIdx) => {
              if (folded.has(cycleIdx)) return null;
              const v = visualOf(cycleIdx);
              return (
                <BetBubble
                  key={`check-${cycleIdx}`}
                  seatPos={visualSeatPos[v]}
                  isHero={v === 0}
                  label="check"
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
        </div>

        {/* Below-table area: action stuff on the left, notes on the right. */}
        <div className="self-stretch flex flex-col lg:flex-row gap-5 items-stretch">
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
