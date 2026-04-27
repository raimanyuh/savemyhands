"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Geometry ────────────────────────────────────────────────────────────────
// Seats sit on an ellipse centered at (50,50) inside the table area.
// BTN is fixed at the bottom (θ = π/2). All other seats are evenly distributed
// around the ellipse — adding/removing players just re-spaces everyone.
const RING_A = 43; // horizontal semi-axis (% of container width)
const RING_B = 38; // vertical semi-axis (% of container height)
const CX = 50;
const CY = 50;

function seatXY(i: number, total: number) {
  const theta = Math.PI / 2 + (i * 2 * Math.PI) / total;
  return {
    left: CX + RING_A * Math.cos(theta),
    top: CY + RING_B * Math.sin(theta),
  };
}

// Place a chip a fraction of the way from a seat toward table center.
function chipXY(
  seat: { left: number; top: number },
  t = 0.42,
  nudgeLeft = 0,
  nudgeTop = 0,
) {
  return {
    left: seat.left + t * (CX - seat.left) + nudgeLeft,
    top: seat.top + t * (CY - seat.top) + nudgeTop,
  };
}

// Position labels per player count, in clockwise order from BTN.
const POSITION_NAMES: Record<number, string[]> = {
  2: ["BTN/SB", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["BTN", "SB", "BB", "CO"],
  5: ["BTN", "SB", "BB", "UTG", "CO"],
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  7: ["BTN", "SB", "BB", "UTG", "UTG+1", "HJ", "CO"],
  8: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"],
  9: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "MP+1", "HJ", "CO"],
};

// ─── Pieces ──────────────────────────────────────────────────────────────────

function ChipToken({
  pos,
  amount,
}: {
  pos: { left: number; top: number };
  amount: number;
}) {
  return (
    <div
      className="absolute z-20 flex items-center justify-center rounded-full select-none pointer-events-none tabular-nums"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        transform: "translate(-50%,-50%)",
        width: 30,
        height: 30,
        background: "linear-gradient(180deg, #fafaf9 0%, #d6d3d1 100%)",
        border: "1.5px dashed #57534e",
        boxShadow:
          "0 3px 8px rgba(0,0,0,0.55), inset 0 0 0 2px #ffffff, inset 0 -2px 0 rgba(0,0,0,0.08)",
        color: "#0a0a0a",
        fontWeight: 800,
        fontSize: 10,
        letterSpacing: "0.01em",
      }}
    >
      ${amount}
    </div>
  );
}

function DealerButton({ pos }: { pos: { left: number; top: number } }) {
  return (
    <div
      className="absolute z-20 flex items-center justify-center rounded-full select-none pointer-events-none"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        transform: "translate(-50%,-50%)",
        width: 28,
        height: 28,
        background:
          "radial-gradient(circle at 32% 28%, #ffffff 0%, #f1f0ee 60%, #c2bfbb 100%)",
        color: "#0a0a0a",
        fontWeight: 900,
        fontSize: 14,
        boxShadow:
          "0 4px 10px rgba(0,0,0,0.6), inset 0 -2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        border: "1px solid rgba(0,0,0,0.2)",
        fontFamily: "var(--font-sans)",
      }}
    >
      D
    </div>
  );
}

function StackDisplay({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0) onCommit(Math.round(n));
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
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
        className="w-16 bg-transparent text-emerald-400 text-[12px] font-semibold leading-none text-center outline-none border-b border-emerald-400/60 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
      className="text-emerald-400 hover:text-emerald-300 text-[12px] font-semibold leading-none tabular-nums transition-colors cursor-text outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-sm"
    >
      ${value.toLocaleString()}
    </button>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PokerTable() {
  const [playerCount, setPlayerCount] = useState(9);
  const [stacks, setStacks] = useState<Record<number, number>>(
    () => Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i, 200])),
  );
  const [sbAmount, setSbAmount] = useState(1);
  const [bbAmount, setBbAmount] = useState(2);
  const [straddleOn, setStraddleOn] = useState(false);
  const [straddleAmt, setStraddleAmt] = useState(4);

  const posNames = POSITION_NAMES[playerCount];

  // Indices are positions clockwise from BTN: 0 = BTN, 1 = SB (or BTN/SB heads-up), 2 = BB, 3 = straddle.
  const seatPositions = Array.from({ length: playerCount }, (_, i) =>
    seatXY(i, playerCount),
  );

  const btnIdx = 0;
  const sbIdx = playerCount === 2 ? 0 : 1;
  const bbIdx = playerCount === 2 ? 1 : 2;
  const canStraddle = playerCount >= 4;
  const showStraddle = straddleOn && canStraddle;
  const stradIdx = showStraddle ? 3 : null;

  const pot = sbAmount + bbAmount + (showStraddle ? straddleAmt : 0);

  const btnChip = chipXY(seatPositions[btnIdx]);
  // Heads-up: BTN and SB share a seat — nudge SB chip away from D.
  const sbChip = chipXY(
    seatPositions[sbIdx],
    0.42,
    playerCount === 2 ? -3 : 0,
    playerCount === 2 ? 1.5 : 0,
  );
  const bbChip = chipXY(seatPositions[bbIdx]);
  const stradChip =
    stradIdx !== null ? chipXY(seatPositions[stradIdx]) : null;

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-[1280px]">
      {/* ── Table ── */}
      <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
        {/* Wood rail */}
        <div
          className="absolute inset-0 rounded-[50%]"
          style={{
            background:
              "linear-gradient(180deg, #4a2511 0%, #2c1505 55%, #190a02 100%)",
            boxShadow:
              "0 18px 64px rgba(0,0,0,0.7), 0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Felt */}
          <div
            className="absolute rounded-[50%]"
            style={{
              top: "14px",
              right: "14px",
              bottom: "14px",
              left: "14px",
              background:
                "radial-gradient(ellipse at 50% 30%, #1f7a47 0%, #0e3d22 65%, #082818 100%)",
              boxShadow:
                "inset 0 0 100px rgba(0,0,0,0.55), inset 0 2px 6px rgba(0,0,0,0.45)",
            }}
          />
        </div>

        {/* Center: pot + wordmark */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none z-10">
          <span
            className="text-white/90 font-semibold tabular-nums"
            style={{ fontSize: "clamp(16px, 1.9vw, 28px)" }}
          >
            ${pot}
          </span>
          <span
            className="text-white/15 font-medium tracking-[0.28em] uppercase"
            style={{ fontSize: "clamp(7px, 0.85vw, 11px)" }}
          >
            savemyhands
          </span>
        </div>

        {/* Chips */}
        <DealerButton pos={btnChip} />
        <ChipToken pos={sbChip} amount={sbAmount} />
        <ChipToken pos={bbChip} amount={bbAmount} />
        {stradChip && <ChipToken pos={stradChip} amount={straddleAmt} />}

        {/* Seats */}
        {seatPositions.map((p, i) => (
          <div
            key={i}
            className="absolute z-10"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              transform: "translate(-50%,-50%)",
            }}
          >
            <div
              className="flex flex-col items-center gap-1 rounded-xl px-3.5 py-2 text-center border border-white/10 bg-zinc-950/85 backdrop-blur-md"
              style={{
                minWidth: 80,
                boxShadow:
                  "0 8px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <span className="text-[10px] font-semibold text-zinc-300 leading-none tracking-[0.14em] uppercase">
                {posNames[i]}
              </span>
              <StackDisplay
                value={stacks[i]}
                onCommit={(n) =>
                  setStacks((prev) => ({ ...prev, [i]: n }))
                }
              />
            </div>
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="rounded-2xl border border-white/10 bg-zinc-950/70 backdrop-blur-md px-7 py-5 shadow-xl shadow-black/40">
        <div className="flex flex-wrap items-end justify-center gap-x-12 gap-y-5">
          {/* Players */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.22em]">
              Players
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setPlayerCount((c) => Math.max(2, c - 1))}
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
                onClick={() => setPlayerCount((c) => Math.min(9, c + 1))}
                disabled={playerCount >= 9}
                aria-label="Add player"
              >
                <Plus />
              </Button>
            </div>
          </div>

          {/* Blinds */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.22em]">
              Blinds
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={sbAmount}
                min={1}
                onChange={(e) => setSbAmount(Number(e.target.value))}
                className="w-16 h-9 text-sm text-center"
                aria-label="Small blind"
              />
              <span className="text-zinc-500 text-sm font-medium">/</span>
              <Input
                type="number"
                value={bbAmount}
                min={1}
                onChange={(e) => setBbAmount(Number(e.target.value))}
                className="w-16 h-9 text-sm text-center"
                aria-label="Big blind"
              />
            </div>
          </div>

          {/* Straddle */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.22em]">
              Straddle
            </span>
            <div className="flex items-center gap-2 h-9">
              <button
                role="switch"
                aria-checked={straddleOn}
                disabled={!canStraddle}
                onClick={() => setStraddleOn((v) => !v)}
                className={[
                  "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                  "disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
                  straddleOn ? "bg-emerald-500" : "bg-zinc-700",
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
                  onChange={(e) => setStraddleAmt(Number(e.target.value))}
                  className="w-16 h-9 text-sm text-center"
                  aria-label="Straddle amount"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
