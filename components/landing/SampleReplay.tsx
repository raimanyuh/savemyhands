"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import PlayingCard from "@/components/poker/PlayingCard";
import HandFan from "@/components/poker/HandFan";
import { seatXY } from "@/components/poker/lib";
import {
  BetBubble,
  DealerButtonChip,
  TableSurface,
} from "@/components/poker/table-pieces";
import {
  committedThroughStep,
  computeStreetBets,
  hasFolded,
} from "@/components/poker/hand";
import { holeCardCount } from "@/components/poker/engine";
import {
  SAMPLE_HAND_SLUG,
  SAMPLE_HAND_TITLE,
  getSampleReplayHand,
} from "./sample-hand";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const MUTED = "oklch(0.715 0 0)";
const SUBTLE = "oklch(0.556 0 0)";

const monoFont = "var(--font-geist-mono), ui-monospace, monospace";

export function SampleReplay() {
  const HAND = useMemo(() => getSampleReplayHand(), []);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const playerCount = HAND.playerCount;
  const heroPos = HAND.heroPosition ?? 0;
  const holeCount = holeCardCount(HAND.gameType ?? "NLHE");
  const useHandFan = HAND.gameType === "PLO4" || HAND.gameType === "PLO5";

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
    }, 1200);
    return () => clearTimeout(t);
  }, [playing, step, HAND]);

  const visualOf = (cycleIdx: number) =>
    (cycleIdx - heroPos + playerCount) % playerCount;
  const visualSeatPos = useMemo(
    () =>
      Array.from({ length: playerCount }, (_, i) => seatXY(i, playerCount)),
    [playerCount],
  );

  const cur = HAND.steps[step];
  const board = useMemo(() => {
    let b: string[] = [];
    for (let i = 0; i <= step; i++) {
      if (HAND.steps[i].board) b = HAND.steps[i].board!;
    }
    return b;
  }, [step, HAND]);
  const board2 = useMemo(() => {
    let b: string[] = [];
    for (let i = 0; i <= step; i++) {
      if (HAND.steps[i].board2) b = HAND.steps[i].board2!;
    }
    return b;
  }, [step, HAND]);

  const streetBets = useMemo(
    () => computeStreetBets(HAND.steps, step, HAND),
    [HAND, step],
  );
  const committed = useMemo(
    () => committedThroughStep(HAND.steps, step, HAND),
    [HAND, step],
  );
  const pot = cur?.pot ?? 0;
  const note = cur?.annotation;

  const annotatedSteps = useMemo(
    () =>
      HAND.steps
        .map((s, i) => (s.annotation ? i : -1))
        .filter((i) => i >= 0),
    [HAND],
  );

  const goPrev = () => {
    setPlaying(false);
    setStep((s) => Math.max(0, s - 1));
  };
  const goNext = () => {
    setPlaying(false);
    setStep((s) => Math.min(HAND.steps.length - 1, s + 1));
  };
  const togglePlay = () => {
    if (step >= HAND.steps.length - 1) setStep(0);
    setPlaying((p) => !p);
  };

  const totalSteps = HAND.steps.length;
  const progress = totalSteps > 1 ? step / (totalSteps - 1) : 0;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 960,
        margin: "0 auto",
        borderRadius: 18,
        background:
          "linear-gradient(180deg, oklch(0.215 0 0 / 0.55) 0%, oklch(0.18 0 0 / 0.35) 100%)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 70% 45% at 50% -5%, oklch(0.42 0.12 155 / 0.18) 0%, transparent 65%)",
        }}
      />

      {/* Head bar */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#fafaf9",
            letterSpacing: "-0.005em",
          }}
        >
          {SAMPLE_HAND_TITLE}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "7px 12px",
            borderRadius: 8,
            background: "rgba(9,9,11,0.65)",
            border: "1px solid rgba(255,255,255,0.10)",
            fontFamily: monoFont,
            fontSize: 12,
            color: "#fafaf9",
          }}
        >
          savemyhands.app/hand/
          <span style={{ color: EMERALD_BRIGHT }}>{SAMPLE_HAND_SLUG}</span>
        </span>
      </div>

      {/* Felt */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "20px 24px 18px",
        }}
      >
        <TableSurface>
          {/* Pot + boards */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 z-10 pointer-events-none"
            style={{
              transform: `translateY(${HAND.doubleBoardOn ? -56 : -32}px)`,
            }}
          >
            <span
              className="px-3 h-7 inline-flex items-center rounded-lg text-[14px] font-semibold tabular-nums text-white"
              style={{
                background: "rgba(9,9,11,0.85)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
              }}
            >
              ${pot}
            </span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => {
                const c = board[i];
                if (!c)
                  return <div key={i} style={{ width: 44, height: 62 }} />;
                return (
                  <PlayingCard
                    key={i}
                    rank={c.slice(0, -1)}
                    suit={c.slice(-1)}
                    size="sm"
                  />
                );
              })}
            </div>
            {HAND.doubleBoardOn && (
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => {
                  const c = board2[i];
                  if (!c)
                    return <div key={i} style={{ width: 44, height: 62 }} />;
                  return (
                    <PlayingCard
                      key={i}
                      rank={c.slice(0, -1)}
                      suit={c.slice(-1)}
                      size="sm"
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Seats */}
          {visualSeatPos.map((pos, visualI) => {
            const i = (heroPos + visualI) % playerCount;
            const p = HAND.players[i];
            const isHero = visualI === 0;
            const isFolded = hasFolded(HAND.steps, step, i);
            const atShowdown = cur?.street === "showdown";
            const isActive =
              cur?.active === i && cur?.action !== "fold" && !isFolded;
            const villainShown =
              !isHero &&
              !isFolded &&
              atShowdown &&
              !!(p.cards && p.cards[0] && p.cards[1]);
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
                  className={`flex flex-col items-center gap-1 rounded-xl px-4 py-2.5 text-center border transition-all ${
                    isActive
                      ? "border-[oklch(0.696_0.205_155_/_0.6)]"
                      : "border-white/10"
                  }`}
                  style={{
                    minWidth: 96,
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
                  <span className="text-[11px] font-semibold text-zinc-300 leading-none tracking-[0.14em] uppercase">
                    {p.pos}
                  </span>
                  <span className="text-[13px] font-medium leading-none">
                    {p.name}
                  </span>
                  <span
                    className={`text-[13px] font-semibold leading-none tabular-nums ${
                      isFolded
                        ? "text-[oklch(0.55_0_0)]"
                        : "text-[oklch(0.745_0.198_155)]"
                    }`}
                  >
                    ${Math.max(0, p.stack - (committed[i] || 0)).toLocaleString()}
                  </span>
                  {isFolded && (
                    <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.55_0_0)] leading-none">
                      Folded
                    </span>
                  )}
                </div>
                {/* Hero hole cards — face up. */}
                {p.cards && isHero && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{
                      top: -78,
                      opacity: isFolded ? 0.3 : 1,
                      filter: isFolded ? "grayscale(0.7)" : "none",
                    }}
                  >
                    <HandFan
                      cards={p.cards}
                      size="sm"
                      fan={useHandFan}
                      faceDown={false}
                    />
                  </div>
                )}
                {/* Villain cards revealed at showdown. */}
                {villainShown && p.cards && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ top: -56 }}
                  >
                    <HandFan
                      cards={p.cards}
                      size="sm"
                      fan={useHandFan}
                      faceDown={false}
                    />
                  </div>
                )}
                {/* Card backs — non-hero, not folded, not yet revealed. */}
                {!isHero && !isFolded && !villainShown && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ top: -56 }}
                  >
                    <HandFan
                      cards={Array.from({ length: holeCount }, () => null)}
                      size="sm"
                      fan={useHandFan}
                      faceDown
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Bet bubbles — wider t-spread on the embedded felt so they
              clear the bigger seat plates and don't crowd the boards. */}
          {Object.entries(streetBets).map(([seatStr, amt]) => {
            const cycleIdx = Number(seatStr);
            if (!amt || hasFolded(HAND.steps, step, cycleIdx)) return null;
            const v = visualOf(cycleIdx);
            const isHero = v === 0;
            return (
              <BetBubble
                key={cycleIdx}
                seatPos={visualSeatPos[v]}
                amount={amt}
                isHero={isHero}
                t={isHero ? 0.72 : 0.3}
              />
            );
          })}

          {/* Check bubbles — most recent action on the current street. */}
          {(() => {
            if (cur?.street === "showdown") return null;
            const checked = new Set<number>();
            const seen = new Set<number>();
            for (let i = step; i >= 0; i--) {
              const s = HAND.steps[i];
              if (s.street !== cur?.street) break;
              if (s.active === undefined || s.active === null) continue;
              if (seen.has(s.active)) continue;
              seen.add(s.active);
              if (s.action === "check") checked.add(s.active);
            }
            return Array.from(checked).map((cycleIdx) => {
              if (hasFolded(HAND.steps, step, cycleIdx)) return null;
              const v = visualOf(cycleIdx);
              const isHero = v === 0;
              return (
                <BetBubble
                  key={`check-${cycleIdx}`}
                  seatPos={visualSeatPos[v]}
                  isHero={isHero}
                  label="check"
                  t={isHero ? 0.72 : 0.3}
                />
              );
            });
          })()}

          {/* Dealer button — BTN cycle 0 → render at its visual slot. */}
          <DealerButtonChip seatPos={visualSeatPos[visualOf(0)]} />
        </TableSurface>
      </div>

      {/* Annotation slot — fixed height so toggling annotations across
          steps never shifts the foot bar (transport buttons stay put). */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "0 24px 12px",
          minHeight: 88,
          display: "flex",
        }}
      >
        {note && (
          <div
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 12,
              background:
                "linear-gradient(180deg, oklch(0.22 0 0) 0%, oklch(0.18 0 0) 100%)",
              border: `1px solid ${EMERALD_BRIGHT.replace(")", " / 0.30)")}`,
              boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                flexShrink: 0,
                marginTop: 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: EMERALD,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0e3d22"
                strokeWidth="4"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: EMERALD_BRIGHT,
                }}
              >
                note
              </span>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#e7e5e4",
                }}
              >
                {note}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Foot bar — transport + scrubber + step counter */}
      <FootBar
        playing={playing}
        onTogglePlay={togglePlay}
        onPrev={goPrev}
        onNext={goNext}
        atStart={step === 0}
        atEnd={step >= totalSteps - 1}
        progress={progress}
        step={step}
        totalSteps={totalSteps}
        annotatedSteps={annotatedSteps}
        onScrubTo={(i) => {
          setPlaying(false);
          setStep(i);
        }}
        streetLabel={cur?.street ?? ""}
        actionLabel={cur?.label ?? ""}
      />
    </div>
  );
}

function FootBar({
  playing,
  onTogglePlay,
  onPrev,
  onNext,
  atStart,
  atEnd,
  progress,
  step,
  totalSteps,
  annotatedSteps,
  onScrubTo,
  streetLabel,
  actionLabel,
}: {
  playing: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  atStart: boolean;
  atEnd: boolean;
  progress: number;
  step: number;
  totalSteps: number;
  annotatedSteps: number[];
  onScrubTo: (i: number) => void;
  streetLabel: string;
  actionLabel: string;
}) {
  const transportBtn: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(9,9,11,0.6)",
    color: "#fafaf9",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        padding: "12px 18px 14px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(9,9,11,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Action label row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
          color: MUTED,
          minHeight: 18,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 8px",
            borderRadius: 6,
            background: "oklch(0.696 0.205 155 / 0.15)",
            border: "1px solid oklch(0.696 0.205 155 / 0.4)",
            color: "oklch(0.795 0.184 155)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {streetLabel || "—"}
        </span>
        <span
          style={{
            color: "#fafaf9",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
            fontFamily: monoFont,
          }}
        >
          {actionLabel}
        </span>
      </div>

      {/* Transport row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={atStart}
          aria-label="Previous step"
          style={{
            ...transportBtn,
            opacity: atStart ? 0.4 : 1,
            cursor: atStart ? "default" : "pointer",
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            ...transportBtn,
            background: EMERALD,
            color: "oklch(0.145 0 0)",
            borderColor: EMERALD,
          }}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={atEnd}
          aria-label="Next step"
          style={{
            ...transportBtn,
            opacity: atEnd ? 0.4 : 1,
            cursor: atEnd ? "default" : "pointer",
          }}
        >
          <ChevronRight size={16} />
        </button>

        {/* Scrubber */}
        <div
          style={{
            position: "relative",
            flex: 1,
            height: 24,
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(
              0,
              Math.min(1, (e.clientX - rect.left) / rect.width),
            );
            const target = Math.round(ratio * (totalSteps - 1));
            onScrubTo(target);
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              width: `${progress * 100}%`,
              height: 4,
              borderRadius: 2,
              background: EMERALD_BRIGHT,
            }}
          />
          {/* Annotation dots */}
          {annotatedSteps.map((i) => {
            const left = totalSteps > 1 ? (i / (totalSteps - 1)) * 100 : 0;
            return (
              <button
                type="button"
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  onScrubTo(i);
                }}
                aria-label={`Jump to annotated step ${i + 1}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  transform: "translate(-50%, -50%)",
                  top: "50%",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: EMERALD_BRIGHT,
                  border: "2px solid oklch(0.18 0 0)",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            );
          })}
          {/* Thumb */}
          <div
            style={{
              position: "absolute",
              left: `${progress * 100}%`,
              transform: "translate(-50%, -50%)",
              top: "50%",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#fafaf9",
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
              pointerEvents: "none",
            }}
          />
        </div>

        <span
          style={{
            fontFamily: monoFont,
            fontSize: 11,
            color: SUBTLE,
            fontVariantNumeric: "tabular-nums",
            minWidth: 44,
            textAlign: "right",
          }}
        >
          <span style={{ color: EMERALD_BRIGHT }}>
            {String(step + 1).padStart(2, "0")}
          </span>{" "}
          / {String(totalSteps).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
