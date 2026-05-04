"use client";

// Mobile sibling for the landing page's embedded sample-hand replayer.
// Uses the shared `VerticalFelt` (the same one the mobile recorder /
// replayer use) so the demo on a phone matches what real users see in
// the app, just rotated portrait. Same hand data and annotations as the
// desktop `<SampleReplay>`; layout is purpose-built for narrow viewports.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import {
  VerticalFelt,
  type FeltViewState,
} from "@/components/mobile/VerticalFelt";
import { holeCardCount } from "@/components/poker/engine";
import {
  committedThroughStep,
  computeStreetBets,
  hasFolded,
} from "@/components/poker/hand";
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

export function MobileSampleReplay() {
  const HAND = useMemo(() => getSampleReplayHand(), []);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const heroPos = HAND.heroPosition ?? 0;
  const N = HAND.playerCount || HAND.players.length;

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

  const cur = HAND.steps[step];
  const atShowdown = cur?.street === "showdown";

  const board = useMemo(() => {
    let b: string[] = [];
    for (let i = 0; i <= step; i++) {
      if (HAND.steps[i].board) b = HAND.steps[i].board!;
    }
    return b;
  }, [step, HAND]);
  const board2 = useMemo(() => {
    if (!HAND.doubleBoardOn) return [] as string[];
    let b: string[] = [];
    for (let i = 0; i <= step; i++) {
      if (HAND.steps[i].board2) b = HAND.steps[i].board2!;
    }
    return b;
  }, [step, HAND]);

  const muckedSet = useMemo(
    () => new Set(HAND.muckedSeats ?? []),
    [HAND.muckedSeats],
  );

  const foldedSeats = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i <= step; i++) {
      const s = HAND.steps[i];
      if (s.action === "fold" && s.active != null) set.add(s.active);
    }
    return set;
  }, [step, HAND.steps]);

  const checkedSeats = useMemo(() => {
    if (atShowdown) return new Set<number>();
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
    return checked;
  }, [step, atShowdown, cur?.street, HAND.steps]);

  const feltState = useMemo<FeltViewState>(() => {
    const players = HAND.players.map((p) => {
      const isHero = p.seat === heroPos;
      const isFolded = foldedSeats.has(p.seat);
      const isMucked = muckedSet.has(p.seat);
      const showCards =
        isHero || (atShowdown && !isFolded && !isMucked);
      const expected = holeCardCount(HAND.gameType ?? "NLHE");
      // VerticalFelt's renderHoleCards uses `cards: null` for "render
      // face-down backs" (pre-showdown villains) and a filled array for
      // "render face-up cards". We pad the array to `expected` length so
      // PLO villains show the right number of backs at showdown.
      let cards: (string | null)[] | null = null;
      if (showCards && p.cards) {
        cards = [...p.cards];
        while (cards.length < expected) cards.push(null);
      }
      return {
        seat: p.seat,
        name: p.name,
        stack: p.stack,
        cards,
      };
    });
    return {
      playerCount: N,
      heroPosition: heroPos,
      players,
      phase: atShowdown ? "showdown" : "preflop",
      gameType: HAND.gameType ?? "NLHE",
      doubleBoardOn: !!HAND.doubleBoardOn,
      board: padBoard(board),
      board2: HAND.doubleBoardOn ? padBoard(board2) : padBoard([]),
    };
  }, [
    HAND.players,
    HAND.gameType,
    HAND.doubleBoardOn,
    heroPos,
    foldedSeats,
    muckedSet,
    atShowdown,
    N,
    board,
    board2,
  ]);

  const committed = useMemo(
    () => committedThroughStep(HAND.steps, step, HAND),
    [step, HAND],
  );
  const streetBets = useMemo(
    () => computeStreetBets(HAND.steps, step, HAND),
    [step, HAND],
  );
  const activeSeat = useMemo(() => {
    if (atShowdown) return null;
    if (cur?.active === undefined || cur?.active === null) return null;
    if (hasFolded(HAND.steps, step, cur.active)) return null;
    return cur.active;
  }, [cur, atShowdown, step, HAND.steps]);

  const note = cur?.annotation;
  const annotatedSteps = useMemo(
    () =>
      HAND.steps
        .map((s, i) => (s.annotation ? i : -1))
        .filter((i) => i >= 0),
    [HAND],
  );

  const totalSteps = HAND.steps.length;
  const progress = totalSteps > 1 ? step / (totalSteps - 1) : 0;
  const goPrev = () => {
    setPlaying(false);
    setStep((s) => Math.max(0, s - 1));
  };
  const goNext = () => {
    setPlaying(false);
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  };
  const togglePlay = () => {
    if (step >= totalSteps - 1) setStep(0);
    setPlaying((p) => !p);
  };
  const onScrubTo = (i: number) => {
    setPlaying(false);
    setStep(i);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 460,
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

      {/* Head bar — title + URL pill stacked vertically on narrow widths */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
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
            alignSelf: "flex-start",
            padding: "5px 10px",
            borderRadius: 6,
            background: "rgba(9,9,11,0.65)",
            border: "1px solid rgba(255,255,255,0.10)",
            fontFamily: monoFont,
            fontSize: 11,
            color: "#fafaf9",
          }}
        >
          savemyhands.app/hand/
          <span style={{ color: EMERALD_BRIGHT }}>{SAMPLE_HAND_SLUG}</span>
        </span>
      </div>

      {/* Felt — portrait aspect, fills card width. */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "12px 12px 10px",
        }}
      >
        <div style={{ aspectRatio: "4 / 5", width: "100%" }}>
          <VerticalFelt
            state={feltState}
            committed={committed}
            activeSeat={activeSeat}
            foldedSeats={foldedSeats}
            streetBets={streetBets}
            checkedSeats={checkedSeats}
          />
        </div>
      </div>

      {/* Annotation slot — fixed height so foot bar buttons don't shift */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          margin: "0 12px 10px",
          minHeight: 76,
          display: "flex",
        }}
      >
        {note && (
          <div
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              background:
                "linear-gradient(180deg, oklch(0.22 0 0) 0%, oklch(0.18 0 0) 100%)",
              border: `1px solid ${EMERALD_BRIGHT.replace(")", " / 0.30)")}`,
              boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                flexShrink: 0,
                marginTop: 2,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: EMERALD,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="7"
                height="7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0e3d22"
                strokeWidth="4"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
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
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: "#e7e5e4",
                }}
              >
                {note}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Foot bar — transport + scrubber */}
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
        onScrubTo={onScrubTo}
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
    flexShrink: 0,
  };
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        padding: "10px 14px 12px",
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
          gap: 8,
          fontSize: 11,
          color: MUTED,
          minHeight: 18,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 6px",
            borderRadius: 5,
            background: "oklch(0.696 0.205 155 / 0.15)",
            border: "1px solid oklch(0.696 0.205 155 / 0.4)",
            color: "oklch(0.795 0.184 155)",
            fontSize: 9,
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
            fontSize: 11,
          }}
        >
          {actionLabel}
        </span>
      </div>

      {/* Transport row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: EMERALD_BRIGHT,
                  border: "2px solid oklch(0.18 0 0)",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute",
              left: `${progress * 100}%`,
              transform: "translate(-50%, -50%)",
              top: "50%",
              width: 11,
              height: 11,
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
            fontSize: 10,
            color: SUBTLE,
            fontVariantNumeric: "tabular-nums",
            minWidth: 38,
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

function padBoard(b: string[]): (string | null)[] {
  const padded: (string | null)[] = [...b];
  while (padded.length < 5) padded.push(null);
  return padded.slice(0, 5);
}
