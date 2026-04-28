"use client";

// Shared visual pieces used across PokerTable, Recorder, and Replayer felts.

import { useEffect, useRef, useState } from "react";
import type { SeatPos } from "./lib";

// Bet bubble: chip token + dollar pill, sitting between a seat and the pot.
// Default placement is snug against the plate (t=0.22). Only the hero seat
// (BTN at the very bottom, with full-size hole cards above it) needs a bigger
// nudge toward the pot to clear the cards.
export function BetBubble({
  seatPos,
  amount,
  isHero = false,
}: {
  seatPos: SeatPos;
  amount: number;
  isHero?: boolean;
}) {
  const t = isHero ? 0.62 : 0.22;
  const left = seatPos.left + t * (50 - seatPos.left);
  const top = seatPos.top + t * (50 - seatPos.top);
  return (
    <div
      className="absolute z-20 flex items-center gap-1.5 pointer-events-none"
      style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%,-50%)" }}
    >
      <div
        className="rounded-full"
        style={{
          width: 22,
          height: 22,
          background: "linear-gradient(180deg, #fafaf9 0%, #d6d3d1 100%)",
          border: "1.5px dashed #57534e",
          boxShadow: "0 3px 8px rgba(0,0,0,0.55), inset 0 0 0 2px #ffffff",
        }}
      />
      <span
        className="px-2 h-6 inline-flex items-center rounded-md text-[12px] font-semibold tabular-nums text-white"
        style={{
          background: "rgba(9,9,11,0.85)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.55)",
        }}
      >
        ${amount}
      </span>
    </div>
  );
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
        width: 28,
        height: 28,
        background: "radial-gradient(circle at 32% 28%, #ffffff 0%, #f1f0ee 60%, #c2bfbb 100%)",
        color: "#0a0a0a",
        fontWeight: 900,
        fontSize: 14,
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
        className="w-20 bg-transparent text-zinc-100 text-[14px] font-medium leading-none text-center outline-none border-b border-white/30"
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
      className={`text-[14px] font-medium leading-none cursor-text outline-none ${
        value ? "text-zinc-100" : "text-zinc-500 italic"
      }`}
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
        className="w-20 bg-transparent text-[oklch(0.745_0.198_155)] text-[15px] font-semibold leading-none text-center outline-none border-b border-[oklch(0.745_0.198_155_/_0.6)] tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
      className="text-[oklch(0.745_0.198_155)] hover:text-[oklch(0.795_0.184_155)] text-[15px] font-semibold leading-none tabular-nums cursor-text outline-none"
    >
      ${value.toLocaleString()}
    </button>
  );
}

// Felt + wood rail container — drop the contents inside to render on the table.
export function TableSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
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
