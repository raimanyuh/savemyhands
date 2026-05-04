"use client";

// Shared visual pieces used across PokerTable, Recorder, and Replayer felts.

import { useEffect, useRef, useState } from "react";
import type { SeatPos } from "./lib";
import { scaled } from "./scale";

// Bet bubble: chip token + dollar pill, sitting between a seat and the pot.
// Default placement is snug against the plate (t=0.22). Only the hero seat
// (BTN at the very bottom, with full-size hole cards above it) needs a bigger
// nudge toward the pot to clear the cards.
//
// Pass `label` to render arbitrary text instead of `$amount` — e.g. "check"
// for the no-chip-committed case where a player checks but we still want the
// same chip+pill visual on the felt.
//
// Pass `onClick` to make the bubble interactive — used by the recorder so
// clicking a bubble opens the annotation editor for that action. When
// omitted, the bubble is pointer-events-none (read-only on the replayer).
//
// `hasAnnotation` styles the bubble's pill with an emerald tint so the user
// can see at a glance which actions on the felt already carry a note.
export function BetBubble({
  seatPos,
  amount = 0,
  isHero = false,
  label,
  onClick,
  hasAnnotation = false,
  t: tOverride,
}: {
  seatPos: SeatPos;
  amount?: number;
  isHero?: boolean;
  label?: string;
  onClick?: () => void;
  hasAnnotation?: boolean;
  // Optional placement override: 0 = at the seat, 1 = at the pot. Defaults
  // to the production-felt values (0.62 hero, 0.22 villain) — embedded /
  // smaller felts can pass a custom value to clear tight layouts.
  t?: number;
}) {
  const t = tOverride ?? (isHero ? 0.62 : 0.22);
  const left = seatPos.left + t * (50 - seatPos.left);
  const top = seatPos.top + t * (50 - seatPos.top);
  const interactive = onClick !== undefined;

  // Pill colors — neutral by default, emerald-tinted when an annotation
  // already exists so it stands out from inert bubbles.
  const pillStyle: React.CSSProperties = hasAnnotation
    ? {
        background: "oklch(0.30 0.10 155 / 0.95)",
        border: "1px solid oklch(0.696 0.205 155 / 0.6)",
        boxShadow:
          "0 4px 10px rgba(0,0,0,0.55), 0 0 0 1px oklch(0.696 0.205 155 / 0.25)",
      }
    : {
        background: "rgba(9,9,11,0.85)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 4px 10px rgba(0,0,0,0.55)",
      };

  const inner = (
    <>
      {/* Chip token represents chips pushed in. For non-chip actions (check)
          the caller passes a label and we drop the chip — pill only. */}
      {label === undefined && (
        <div
          className="rounded-full"
          style={{
            width: scaled(22),
            height: scaled(22),
            background: "linear-gradient(180deg, #fafaf9 0%, #d6d3d1 100%)",
            border: "1.5px dashed #57534e",
            boxShadow: "0 3px 8px rgba(0,0,0,0.55), inset 0 0 0 2px #ffffff",
          }}
        />
      )}
      <span
        className="inline-flex items-center rounded-md font-semibold tabular-nums text-white"
        style={{
          ...pillStyle,
          paddingInline: scaled(8),
          height: scaled(24),
          fontSize: scaled(12),
        }}
      >
        {label ?? `$${amount}`}
      </span>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="absolute z-20 flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.696_0.205_155_/_0.5)] rounded-md"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          transform: "translate(-50%,-50%)",
          background: "transparent",
          padding: 0,
          border: "none",
        }}
        title={hasAnnotation ? "Edit note on this action" : "Add a note to this action"}
        aria-label={hasAnnotation ? "Edit annotation" : "Add annotation"}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className="absolute z-20 flex items-center gap-1.5 pointer-events-none"
      style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%,-50%)" }}
    >
      {inner}
    </div>
  );
}

// Computes the bubble's pixel-coordinate position (as percentages of the
// table) for a given seat. Mirrors the placement math inside `BetBubble` so
// callers (e.g. the replayer's note balloon) can anchor an annotation
// connector to the bubble itself rather than the seat plate.
export function bubblePos(seatPos: SeatPos, isHero: boolean): SeatPos {
  const t = isHero ? 0.62 : 0.22;
  return {
    left: seatPos.left + t * (50 - seatPos.left),
    top: seatPos.top + t * (50 - seatPos.top),
  };
}

// Dealer "D" chip — sits at a small angular offset from the BTN seat so bets don't cover it.
export function DealerButtonChip({ seatPos }: { seatPos: SeatPos }) {
  const dx = seatPos.left - 50;
  const dy = seatPos.top - 50;
  const cos = Math.cos(0.32);
  const sin = Math.sin(0.32);
  const nx = dx * cos - dy * sin;
  const ny = dx * sin + dy * cos;
  const left = 50 + nx * 0.78;
  const top = 50 + ny * 0.78;
  return (
    <div
      className="absolute z-30 flex items-center justify-center rounded-full pointer-events-none"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: "translate(-50%,-50%)",
        width: scaled(28),
        height: scaled(28),
        background: "radial-gradient(circle at 32% 28%, #ffffff 0%, #f1f0ee 60%, #c2bfbb 100%)",
        color: "#0a0a0a",
        fontWeight: 900,
        fontSize: scaled(14),
        boxShadow:
          "0 4px 10px rgba(0,0,0,0.6), inset 0 -2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        border: "1px solid rgba(0,0,0,0.2)",
      }}
    >
      D
    </div>
  );
}

// Editable nickname (middle row of seat plate). Click to type, Enter/blur to save.
export function NameDisplay({
  value,
  onCommit,
  placeholder = "Player",
}: {
  value: string;
  onCommit: (n: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = () => {
    onCommit(draft.trim().slice(0, 12));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(value || "");
            setEditing(false);
          }
        }}
        className="w-20 bg-transparent text-zinc-100 font-medium leading-none text-center outline-none border-b border-white/30"
        style={{ fontSize: scaled(14) }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value || "");
        setEditing(true);
      }}
      className={`font-medium leading-none cursor-text outline-none ${
        value ? "text-zinc-100" : "text-zinc-500 italic"
      }`}
      style={{ fontSize: scaled(14) }}
    >
      {value || placeholder}
    </button>
  );
}

// Editable stack value. Same pattern as NameDisplay; numeric.
export function StackDisplay({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0) onCommit(Math.round(n));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="w-20 bg-transparent text-[oklch(0.745_0.198_155)] font-semibold leading-none text-center outline-none border-b border-[oklch(0.745_0.198_155_/_0.6)] tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        style={{ fontSize: scaled(15) }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      className="text-[oklch(0.745_0.198_155)] hover:text-[oklch(0.795_0.184_155)] font-semibold leading-none tabular-nums cursor-text outline-none"
      style={{ fontSize: scaled(15) }}
    >
      ${value.toLocaleString()}
    </button>
  );
}

// Felt + wood rail container — drop the contents inside to render on the table.
//
// Doubles as a CSS container so children can scale relative to the felt's
// own width via `var(--smh-u)`. The unit is unitless: at design width
// (1280px) it resolves to 1.0; smaller felts scale down, larger felts up,
// clamped so things stay legible at extremes. See `scale.ts` for the
// helper used by callers.
export function TableSurface({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full"
      style={
        {
          aspectRatio: "2 / 1",
          containerType: "inline-size",
          "--smh-u": "clamp(0.65, calc(100cqi / 1280px), 1.5)",
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0 rounded-[50%]"
        style={{
          background: "linear-gradient(180deg, #4a2511 0%, #2c1505 55%, #190a02 100%)",
          boxShadow:
            "0 18px 64px rgba(0,0,0,0.7), 0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="absolute rounded-[50%]"
          style={{
            top: 14,
            right: 14,
            bottom: 14,
            left: 14,
            background:
              "radial-gradient(ellipse at 50% 30%, #1f7a47 0%, #0e3d22 65%, #082818 100%)",
            boxShadow:
              "inset 0 0 100px rgba(0,0,0,0.55), inset 0 2px 6px rgba(0,0,0,0.45)",
          }}
        />
      </div>
      {children}
    </div>
  );
}
