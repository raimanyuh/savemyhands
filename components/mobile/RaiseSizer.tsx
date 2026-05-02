"use client";

// Bet/raise sizer for the mobile recorder. Two presentations of the
// same controls: a full-screen modal at vh < 700, an inline drawer
// above the action bar at vh >= 700. Per the design handoff, the
// drawer wins UX above iPhone-SE-class heights but the modal is
// strictly better when vertical space is tight.
//
// Math (chip set, slider clamp, pot-limit cap) mirrors the desktop
// ActionBar in components/poker/Recorder.tsx — keep these two in sync.
// PLO drops the 1.25× chip and renames All-in to Max with a
// pot-ceiling cap; NLHE keeps the full chip set capped at all-in.

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { GameType } from "@/components/poker/engine";
import { isPotLimit } from "@/components/poker/engine";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const BG = "oklch(0.145 0 0)";

// Threshold from the design brief — drawer above, modal at or below.
const VH_DRAWER_MIN = 700;

function getInnerHeight(): number {
  if (typeof window === "undefined") return 800;
  return window.innerHeight;
}

function subscribeResize(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

function useViewportHeight(): number {
  return useSyncExternalStore(
    subscribeResize,
    getInnerHeight,
    () => 800,
  );
}

export type RaiseSizerProps = {
  open: boolean;
  // Used to label the confirm button ("Bet to $X" vs "Raise to $X")
  // and to clamp the slider min.
  isBetMode: boolean;
  // Pot before the active seat acts.
  pot: number;
  // Chips the active seat owes to call (0 in bet mode).
  toCall: number;
  // Highest bet on the current street (for raise math).
  lastBet: number;
  // Minimum legal raise total (already includes lastBet).
  minRaise: number;
  // What "all-in" amounts to for the active seat, accounting for chips
  // already in front of them this street.
  allInAmount: number;
  gameType: GameType;
  // Fires when the user confirms. The caller dispatches the actual
  // recordAction event.
  onCommit: (amount: number) => void;
  onCancel: () => void;
};

export function RaiseSizer(props: RaiseSizerProps) {
  const vh = useViewportHeight();
  const useModal = vh < VH_DRAWER_MIN;
  if (!props.open) return null;
  return useModal ? <ModalSizer {...props} /> : <DrawerSizer {...props} />;
}

// Shared internals — the sizing math, the chip set, the slider, the
// preset row, and the confirm button. Differs only in container chrome
// between modal and drawer.
function useSizerControls(props: RaiseSizerProps) {
  const { isBetMode, pot, toCall, lastBet, minRaise, allInAmount, gameType } =
    props;
  const potLimit = isPotLimit(gameType);
  const potCapRaiseTo = lastBet + (pot + toCall);
  const maxAllowed = potLimit
    ? Math.min(allInAmount, potCapRaiseTo)
    : allInAmount;

  const sizeFor = (frac: number) => {
    const potAfter = pot + toCall;
    const target = Math.round(lastBet + frac * potAfter);
    return Math.min(maxAllowed, Math.max(target, minRaise));
  };

  const chips: { id: string; label: string; amount: number }[] = potLimit
    ? [
        { id: "half", label: "½ pot", amount: sizeFor(0.5) },
        { id: "twothird", label: "⅔ pot", amount: sizeFor(2 / 3) },
        { id: "pot", label: "Pot", amount: sizeFor(1) },
        { id: "max", label: "Max", amount: maxAllowed },
      ]
    : [
        { id: "half", label: "½ pot", amount: sizeFor(0.5) },
        { id: "twothird", label: "⅔ pot", amount: sizeFor(2 / 3) },
        { id: "pot", label: "Pot", amount: sizeFor(1) },
        { id: "overpot", label: "1.25×", amount: sizeFor(1.25) },
        { id: "allin", label: "All-in", amount: allInAmount },
      ];

  const sliderMin = isBetMode
    ? Math.max(1, Math.min(minRaise, maxAllowed))
    : Math.max(minRaise, 1);
  const sliderMax = Math.max(sliderMin, maxAllowed);

  // Initial amount = minRaise clamped to the legal range. Re-seeded
  // each time the sheet opens via the open prop being passed to the
  // parent's render gate.
  const [amount, setAmount] = useState(() =>
    String(Math.min(maxAllowed, Math.max(minRaise, sliderMin))),
  );

  // When the underlying inputs change between opens (different active
  // seat), reset the displayed amount. Setup-during-render with sentinel.
  const [lastSeed, setLastSeed] = useState({ minRaise, maxAllowed });
  if (
    lastSeed.minRaise !== minRaise ||
    lastSeed.maxAllowed !== maxAllowed
  ) {
    setLastSeed({ minRaise, maxAllowed });
    setAmount(String(Math.min(maxAllowed, Math.max(minRaise, sliderMin))));
  }

  const amt = Number(amount);
  const cannotCommit = isBetMode
    ? amt <= 0 || amt > maxAllowed
    : amt > maxAllowed || (amt < minRaise && amt !== maxAllowed);

  // Pot-multiplier readout under the big amount (e.g. "1.50× pot").
  const potAfter = pot + toCall;
  const multiplier = potAfter > 0 ? (amt - lastBet) / potAfter : 0;

  return {
    amount,
    setAmount,
    amt,
    chips,
    sliderMin,
    sliderMax,
    maxAllowed,
    multiplier,
    cannotCommit,
  };
}

function AmountReadout({
  amount,
  multiplier,
  size = "lg",
}: {
  amount: string;
  multiplier: number;
  size?: "lg" | "md";
}) {
  return (
    <div className="text-center">
      <div
        className="font-semibold"
        style={{
          fontSize: size === "lg" ? 56 : 36,
          color: "white",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        ${amount}
      </div>
      <div
        className="font-mono"
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "oklch(0.55 0 0)",
          letterSpacing: "0.04em",
        }}
      >
        {multiplier.toFixed(2)}× pot
      </div>
    </div>
  );
}

function ChipRow({
  chips,
  amount,
  onPick,
}: {
  chips: { id: string; label: string; amount: number }[];
  amount: string;
  onPick: (n: number) => void;
}) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${chips.length}, 1fr)`,
        gap: 6,
      }}
    >
      {chips.map((c) => {
        const active = String(c.amount) === amount;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.amount)}
            style={{
              minHeight: 44,
              padding: "6px 4px",
              borderRadius: 9,
              background: active
                ? "oklch(0.30 0.10 155 / 0.45)"
                : "oklch(0.215 0 0)",
              border: active
                ? `1px solid ${EMERALD}`
                : "1px solid rgba(255,255,255,0.12)",
              color: active ? EMERALD_BRIGHT : "oklch(0.92 0 0)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span>{c.label}</span>
            <span
              className="font-mono"
              style={{
                fontSize: 10,
                color: active ? EMERALD_BRIGHT : "oklch(0.715 0 0)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              ${c.amount}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Slider({
  amount,
  setAmount,
  min,
  max,
}: {
  amount: string;
  setAmount: (v: string) => void;
  min: number;
  max: number;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={Number(amount) || min}
      onChange={(e) => setAmount(e.target.value)}
      style={{
        width: "100%",
        accentColor: EMERALD_BRIGHT,
      }}
    />
  );
}

function ConfirmButton({
  isBetMode,
  amount,
  disabled,
  onClick,
}: {
  isBetMode: boolean;
  amount: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        height: 56,
        borderRadius: 12,
        background: disabled ? "oklch(0.215 0 0)" : EMERALD,
        color: disabled ? "oklch(0.55 0 0)" : BG,
        fontWeight: 600,
        fontSize: 15,
        border: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {isBetMode ? "Bet to" : "Raise to"} ${amount}
    </button>
  );
}

function ModalSizer(props: RaiseSizerProps) {
  const ctrl = useSizerControls(props);

  // Esc to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[450] flex flex-col"
      style={{
        background: BG,
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }}
    >
      {/* Header — Cancel left, title center */}
      <div
        className="flex items-center"
        style={{
          height: 48,
          padding: "0 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button
          type="button"
          onClick={props.onCancel}
          style={{
            background: "transparent",
            border: 0,
            color: "oklch(0.715 0 0)",
            fontSize: 14,
            padding: "8px 12px",
            marginLeft: -8,
            borderRadius: 8,
          }}
        >
          ← Cancel
        </button>
        <div
          className="flex-1 text-center font-semibold"
          style={{ fontSize: 14 }}
        >
          {props.isBetMode ? "Bet" : "Raise"}
        </div>
        {/* Symmetry spacer */}
        <div style={{ width: 80 }} />
      </div>

      <div
        className="flex-1 flex flex-col justify-center"
        style={{ padding: "24px 16px", gap: 32 }}
      >
        <AmountReadout
          amount={ctrl.amount}
          multiplier={ctrl.multiplier}
          size="lg"
        />
        <Slider
          amount={ctrl.amount}
          setAmount={ctrl.setAmount}
          min={ctrl.sliderMin}
          max={ctrl.sliderMax}
        />
        <ChipRow
          chips={ctrl.chips}
          amount={ctrl.amount}
          onPick={(n) => ctrl.setAmount(String(n))}
        />
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <ConfirmButton
          isBetMode={props.isBetMode}
          amount={ctrl.amount}
          disabled={ctrl.cannotCommit}
          onClick={() => props.onCommit(ctrl.amt)}
        />
      </div>
    </div>,
    document.body,
  );
}

function DrawerSizer(props: RaiseSizerProps) {
  const ctrl = useSizerControls(props);

  // Esc to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        props.onCancel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <Backdrop onClick={props.onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full"
        style={{
          background: "var(--popover)",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTop: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
          padding: "12px 14px max(12px, env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={props.onCancel}
            style={{
              background: "transparent",
              border: 0,
              color: "oklch(0.715 0 0)",
              fontSize: 13,
              padding: "4px 0",
            }}
          >
            Cancel
          </button>
          <div
            className="font-semibold"
            style={{ fontSize: 13, color: "oklch(0.92 0 0)" }}
          >
            {props.isBetMode ? "Bet" : "Raise"}
          </div>
          <div style={{ width: 50 }} />
        </div>
        <AmountReadout
          amount={ctrl.amount}
          multiplier={ctrl.multiplier}
          size="md"
        />
        <Slider
          amount={ctrl.amount}
          setAmount={ctrl.setAmount}
          min={ctrl.sliderMin}
          max={ctrl.sliderMax}
        />
        <ChipRow
          chips={ctrl.chips}
          amount={ctrl.amount}
          onPick={(n) => ctrl.setAmount(String(n))}
        />
        <ConfirmButton
          isBetMode={props.isBetMode}
          amount={ctrl.amount}
          disabled={ctrl.cannotCommit}
          onClick={() => props.onCommit(ctrl.amt)}
        />
      </div>
    </Backdrop>,
    document.body,
  );
}

function Backdrop({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[450] flex items-end"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
