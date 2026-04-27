"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  POSITION_NAMES,
  chipXY,
  seatXY,
} from "./lib";
import {
  BetBubble,
  DealerButtonChip,
  NameDisplay,
  StackDisplay,
  TableSurface,
} from "./table-pieces";

// Setup-only poker table — used as an inline preview. The full recording flow
// lives in <Recorder/>, which mounts a similar felt with the action machinery.
export default function PokerTable() {
  const [playerCount, setPlayerCount] = useState(9);
  const [stacks, setStacks] = useState<Record<number, number>>(
    () => Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i, 200])),
  );
  const [names, setNames] = useState<Record<number, string>>(
    () => Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i, i === 0 ? "Hero" : ""])),
  );
  const [sbAmount, setSbAmount] = useState(1);
  const [bbAmount, setBbAmount] = useState(2);
  const [straddleOn, setStraddleOn] = useState(false);
  const [straddleAmt, setStraddleAmt] = useState(4);

  const posNames = POSITION_NAMES[playerCount];
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

  // Heads-up nudge so SB chip sits clear of the dealer button.
  void chipXY; // (chipXY isn't needed here — bubbles take care of placement)

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-[1600px]">
      <TableSurface>
        {/* Pot + wordmark */}
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

        <DealerButtonChip seatPos={seatPositions[btnIdx]} />
        <BetBubble seatPos={seatPositions[sbIdx]} amount={sbAmount} />
        <BetBubble seatPos={seatPositions[bbIdx]} amount={bbAmount} />
        {stradIdx !== null && (
          <BetBubble seatPos={seatPositions[stradIdx]} amount={straddleAmt} />
        )}

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
              className="flex flex-col items-center gap-1.5 rounded-xl px-4 py-2.5 text-center border border-white/10"
              style={{
                minWidth: 100,
                background: "rgba(9,9,11,0.85)",
                backdropFilter: "blur(10px)",
                boxShadow:
                  "0 8px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <span className="text-[12px] font-semibold text-zinc-300 leading-none tracking-[0.14em] uppercase">
                {posNames[i]}
              </span>
              <NameDisplay
                value={names[i] ?? ""}
                onCommit={(n) => setNames((prev) => ({ ...prev, [i]: n }))}
                placeholder={i === 0 ? "Hero" : "Player"}
              />
              <StackDisplay
                value={stacks[i]}
                onCommit={(n) => setStacks((prev) => ({ ...prev, [i]: n }))}
              />
            </div>
          </div>
        ))}
      </TableSurface>

      {/* Controls */}
      <div
        className="rounded-2xl border border-white/10 px-7 py-5"
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

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
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

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Straddle
            </span>
            <div className="flex items-center gap-2 h-9">
              <button
                role="switch"
                aria-checked={straddleOn}
                disabled={!canStraddle}
                onClick={() => setStraddleOn((v) => !v)}
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
