"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pause,
  Play,
  RotateCcw,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header, Shell } from "@/components/Shell";
import PlayingCard from "./PlayingCard";
import { seatXY } from "./lib";
import { BetBubble, DealerButtonChip, TableSurface } from "./table-pieces";
import {
  computeStreetBets,
  hasFolded,
  type ReplayHand,
  type ReplayStep,
} from "./hand";

const SAMPLE_HAND: ReplayHand = {
  id: "b2m1xy",
  stakes: { sb: 2, bb: 5 },
  playerCount: 6,
  players: [
    { seat: 0, name: "Hero", stack: 1250, pos: "BTN", cards: ["A♠", "A♣"] },
    { seat: 1, name: "Reg1", stack: 800, pos: "SB", cards: null },
    { seat: 2, name: "Whale", stack: 2400, pos: "BB", cards: null },
    { seat: 3, name: "Loose", stack: 600, pos: "UTG", cards: null },
    { seat: 4, name: "Tight", stack: 1100, pos: "MP", cards: null },
    { seat: 5, name: "Random", stack: 540, pos: "CO", cards: null },
  ],
  steps: [
    { street: "preflop", label: "UTG raises to $15", pot: 22, active: 3, action: "raise 15" },
    { street: "preflop", label: "MP folds", pot: 22, active: 4, action: "fold" },
    { street: "preflop", label: "CO folds", pot: 22, active: 5, action: "fold" },
    { street: "preflop", label: "BTN 3-bets to $45", pot: 67, active: 0, action: "raise 45" },
    { street: "preflop", label: "SB folds", pot: 67, active: 1, action: "fold" },
    { street: "preflop", label: "BB calls $40", pot: 107, active: 2, action: "call" },
    { street: "preflop", label: "UTG calls $30", pot: 137, active: 3, action: "call" },
    { street: "flop", label: "Flop  K♠ 7♦ 2♣", pot: 137, board: ["K♠", "7♦", "2♣"] },
    { street: "flop", label: "BB checks", pot: 137, active: 2, action: "check" },
    { street: "flop", label: "UTG bets $80", pot: 217, active: 3, action: "bet 80" },
    { street: "flop", label: "BTN raises to $220", pot: 437, active: 0, action: "raise 220" },
    { street: "flop", label: "BB folds", pot: 437, active: 2, action: "fold" },
    { street: "flop", label: "UTG calls $140", pot: 577, active: 3, action: "call" },
    { street: "turn", label: "Turn  Q♥", pot: 577, board: ["K♠", "7♦", "2♣", "Q♥"] },
    { street: "turn", label: "UTG checks", pot: 577, active: 3, action: "check" },
    { street: "turn", label: "BTN bets $400", pot: 977, active: 0, action: "bet 400" },
    { street: "turn", label: "UTG folds", pot: 977, active: 3, action: "fold" },
    { street: "showdown", label: "Hero wins $977", pot: 977, winner: 0 },
  ],
};

function StreetPill({ street }: { street: ReplayStep["street"] }) {
  return (
    <span
      className="px-2.5 h-6 inline-flex items-center rounded-md text-[10px] font-semibold uppercase tracking-[0.18em] border bg-[oklch(0.696_0.205_155_/_0.15)] text-[oklch(0.795_0.184_155)] border-[oklch(0.696_0.205_155_/_0.4)]"
    >
      {street}
    </span>
  );
}

export default function Replayer({
  hand: handProp,
  shareUrl,
}: {
  hand?: ReplayHand | null;
  shareUrl?: string;
}) {
  const HAND = handProp || SAMPLE_HAND;
  // Key by hand id so transport state (step, playing) resets cleanly per hand.
  return <ReplayerInner key={HAND.id} hand={HAND} shareUrl={shareUrl} />;
}

function ReplayerInner({
  hand: HAND,
  shareUrl,
}: {
  hand: ReplayHand;
  shareUrl?: string;
}) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setStep((s) => {
        if (s >= HAND.steps.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 1100);
    return () => clearTimeout(t);
  }, [playing, step, HAND]);

  const cur = HAND.steps[step];
  let board: string[] = [];
  for (let i = 0; i <= step; i++) {
    if (HAND.steps[i].board) board = HAND.steps[i].board!;
  }
  const pot = HAND.steps[step].pot;
  const street = HAND.steps[step].street;

  const playerCount = HAND.playerCount || HAND.players.length;
  const seatPositions = Array.from({ length: playerCount }, (_, i) =>
    seatXY(i, playerCount),
  );
  const streetBets = computeStreetBets(HAND.steps, step, HAND);

  const url = shareUrl ?? `savemyhands.app/hand/${HAND.id}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Shell
      header={
        <Header
          title=""
          back="Dashboard"
          backHref="/dashboard"
          right={
            <>
              <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
                {url.split("/hand/")[0]}/hand/
                <span className="text-foreground">{HAND.id}</span>
              </span>
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? (
                  <>
                    <Check /> Copied
                  </>
                ) : (
                  <>
                    <Copy /> Copy link
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm">
                <Share2 /> Share
              </Button>
            </>
          }
        />
      }
    >
      <div className="flex-1 flex flex-col items-center px-6 py-8 gap-6 max-w-[1600px] w-full mx-auto">
        <div className="flex items-center gap-3 self-start">
          <h2 className="text-xl font-semibold tracking-tight">
            ${HAND.stakes.sb}/${HAND.stakes.bb} NLHE
          </h2>
          <span className="text-sm text-muted-foreground">
            · {playerCount}-handed
          </span>
        </div>

        {/* Table */}
        <TableSurface>
          {/* Pot + board */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
            <span
              className="px-3 h-8 inline-flex items-center rounded-lg text-[18px] font-semibold tabular-nums text-white"
              style={{
                background: "rgba(9,9,11,0.85)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
              }}
            >
              ${pot}
            </span>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => {
                const c = board[i];
                if (!c) return <div key={i} style={{ width: 56, height: 80 }} />;
                return (
                  <PlayingCard
                    key={i}
                    rank={c.slice(0, -1)}
                    suit={c.slice(-1)}
                  />
                );
              })}
            </div>
            <span className="text-white/15 font-medium tracking-[0.28em] uppercase text-[10px]">
              savemyhands
            </span>
          </div>

          {/* Seats */}
          {HAND.players.map((p, i) => {
            const pos = seatPositions[i];
            const isFolded = hasFolded(HAND.steps, step, i);
            const isActive = cur.active === i && cur.action !== "fold" && !isFolded;
            return (
              <div
                key={i}
                className="absolute z-10"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
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
                    opacity: isFolded ? 0.32 : 1,
                    filter: isFolded ? "grayscale(0.6)" : "none",
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
                    {p.pos}
                  </span>
                  <span className="text-[14px] font-medium leading-none">
                    {p.name}
                  </span>
                  <span
                    className={`text-[15px] font-semibold leading-none tabular-nums ${
                      isFolded
                        ? "text-[oklch(0.715_0.012_60)]"
                        : "text-[oklch(0.745_0.198_155)]"
                    }`}
                  >
                    ${p.stack.toLocaleString()}
                  </span>
                  {isFolded && (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.55_0.005_60)] leading-none">
                      Folded
                    </span>
                  )}
                </div>
                {/* Hero hole cards */}
                {p.cards && i === 0 && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-24 flex gap-1.5"
                    style={{
                      opacity: isFolded ? 0.3 : 1,
                      filter: isFolded ? "grayscale(0.7)" : "none",
                    }}
                  >
                    {p.cards.map((c, j) =>
                      c ? (
                        <PlayingCard
                          key={j}
                          rank={c.slice(0, -1)}
                          suit={c.slice(-1)}
                        />
                      ) : (
                        <PlayingCard key={j} faceDown />
                      ),
                    )}
                  </div>
                )}
                {/* Opponent card backs */}
                {!p.cards && !isFolded && i !== 0 && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-14 flex gap-1">
                    {[0, 1].map((j) => (
                      <div
                        key={j}
                        style={{
                          width: 36,
                          height: 52,
                          borderRadius: 4,
                          background:
                            "linear-gradient(135deg, #6b1722 0%, #2a0608 100%)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Bet bubbles */}
          {Object.entries(streetBets).map(([seatStr, amt]) => {
            const seat = Number(seatStr);
            if (!amt || hasFolded(HAND.steps, step, seat)) return null;
            return (
              <BetBubble
                key={seat}
                seatPos={seatPositions[seat]}
                amount={amt}
              />
            );
          })}

          <DealerButtonChip seatPos={seatPositions[0]} />
        </TableSurface>

        {/* Action log + transport */}
        <div className="flex flex-col gap-3 w-full max-w-[820px]">
          <div className="rounded-xl border border-white/10 bg-[oklch(0.205_0_0)] px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <StreetPill street={street} />
              <span className="text-base font-medium truncate">{cur.label}</span>
            </div>
            <div className="text-sm text-muted-foreground tabular-nums shrink-0">
              {step + 1} / {HAND.steps.length}
            </div>
          </div>

          <div className="flex items-center gap-3 justify-center">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setStep(0)}
              aria-label="Restart"
            >
              <RotateCcw />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              aria-label="Previous"
            >
              <ChevronLeft />
            </Button>
            <Button
              onClick={() => setPlaying(!playing)}
              size="lg"
              className="px-5"
            >
              {playing ? (
                <>
                  <Pause /> Pause
                </>
              ) : (
                <>
                  <Play /> Play
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setStep((s) => Math.min(HAND.steps.length - 1, s + 1))
              }
              disabled={step === HAND.steps.length - 1}
              aria-label="Next"
            >
              <ChevronRight />
            </Button>
            <input
              type="range"
              min={0}
              max={HAND.steps.length - 1}
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              className="flex-1 max-w-[280px] accent-[oklch(0.696_0.205_155)]"
            />
          </div>
        </div>
      </div>
    </Shell>
  );
}
