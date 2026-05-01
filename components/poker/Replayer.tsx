"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Globe,
  Lock,
  Pause,
  Pencil,
  Percent,
  Play,
  RotateCcw,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header, Shell } from "@/components/Shell";
import {
  setHandPublicAction,
  updateHandDetailsAction,
} from "@/lib/hands/actions";
import type { SavedHand } from "./hand";
import { computeEquity } from "./equity";
import PlayingCard from "./PlayingCard";
import HandFan from "./HandFan";
import { seatXY } from "./lib";
import { BetBubble, DealerButtonChip, TableSurface } from "./table-pieces";
import {
  committedThroughStep,
  computeStreetBets,
  hasFolded,
  type ReplayHand,
  type ReplayStep,
} from "./hand";

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
  hand,
  shareUrl,
  handId,
  isOwner = false,
  isPublic = false,
  isAuthenticated = true,
  fullPayload,
}: {
  hand: ReplayHand;
  shareUrl?: string;
  // The DB id of the hand. Required for the Share toggle.
  handId?: string;
  isOwner?: boolean;
  isPublic?: boolean;
  // Drives both the "Dashboard ←" back link and (inversely) the anon
  // sign-up CTA. Defaults to true so the recorder/dashboard flows that
  // already gate auth upstream don't have to thread this prop.
  isAuthenticated?: boolean;
  // The original SavedHand._full payload, threaded through so owner edits to
  // notes can patch both the top-level `notes` column and `_full.notes`
  // (the read prefers _full.notes, so both must move together).
  fullPayload?: SavedHand["_full"];
}) {
  // Key by hand id so transport state (step, playing) resets cleanly per hand.
  return (
    <ReplayerInner
      key={hand.id}
      hand={hand}
      shareUrl={shareUrl}
      handId={handId}
      isOwner={isOwner}
      isPublic={isPublic}
      isAuthenticated={isAuthenticated}
      fullPayload={fullPayload}
    />
  );
}

function ReplayerInner({
  hand: HAND,
  shareUrl,
  handId,
  isOwner,
  isPublic,
  isAuthenticated,
  fullPayload,
}: {
  hand: ReplayHand;
  shareUrl?: string;
  handId?: string;
  isOwner: boolean;
  isPublic: boolean;
  isAuthenticated: boolean;
  fullPayload?: SavedHand["_full"];
}) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  // Off by default to preserve the "watch it like a real hand" feel —
  // turning it on reveals every villain who showed at showdown plus a
  // per-seat equity badge at the current step's board.
  const [showEquity, setShowEquity] = useState(false);
  // Action-log popover (opened via the Log button on the floating dock).
  const [logOpen, setLogOpen] = useState(false);

  // Step indices that have an annotation, used to draw markers on the
  // scrubber and to power "[" / "]" jump-to-annotation shortcuts.
  const annotatedSteps = useMemo(
    () =>
      HAND.steps
        .map((s, i) => (s.annotation && s.annotation.trim() ? i : -1))
        .filter((i) => i >= 0),
    [HAND],
  );

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

  // Arrow keys / Space drive the transport. Skip when typing in a field so
  // text input still works.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setStep((s) => Math.min(HAND.steps.length - 1, s + 1));
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "Home") {
        e.preventDefault();
        setStep(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setStep(HAND.steps.length - 1);
      } else if (e.key === "[") {
        // Jump to the previous annotated step.
        e.preventDefault();
        setStep((s) => {
          const prev = annotatedSteps.filter((i) => i < s).pop();
          return prev ?? s;
        });
      } else if (e.key === "]") {
        // Jump to the next annotated step.
        e.preventDefault();
        setStep((s) => {
          const next = annotatedSteps.find((i) => i > s);
          return next ?? s;
        });
      } else if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        setLogOpen((v) => !v);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setLogOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [HAND.steps.length, annotatedSteps]);

  const cur = HAND.steps[step];
  // Memoize `board` so downstream useMemo deps don't see a fresh array
  // reference every render (it'd retrigger the equity computation).
  const board = useMemo(() => {
    let b: string[] = [];
    for (let i = 0; i <= step; i++) {
      if (HAND.steps[i].board) b = HAND.steps[i].board!;
    }
    return b;
  }, [step, HAND]);
  // Same memo for the second board on double-board hands. Stays empty
  // for single-board hands so the second row never renders.
  const board2 = useMemo(() => {
    if (!HAND.doubleBoardOn) return [] as string[];
    let b: string[] = [];
    for (let i = 0; i <= step; i++) {
      if (HAND.steps[i].board2) b = HAND.steps[i].board2!;
    }
    return b;
  }, [step, HAND]);
  const pot = HAND.steps[step].pot;
  const street = HAND.steps[step].street;

  // Equity is precomputed at save time and stored on the hand. For older
  // hands that predate that field, we fall back to runout enumeration on
  // the fly — same approach as before, just rarely hit now.
  // For double-board hands we run the same pass twice (once per board)
  // so the showdown overlay can render two badges per seat.
  const liveEquity = useMemo(() => {
    const map = new Map<number, Record<number, number>>();
    if (!showEquity || HAND.equityByStep) return map;
    for (let s = 0; s < HAND.steps.length; s++) {
      let stepBoard: string[] = [];
      for (let i = 0; i <= s; i++) {
        if (HAND.steps[i].board) stepBoard = HAND.steps[i].board!;
      }
      const contestants = HAND.players
        .filter(
          (p) =>
            !!(p.cards?.[0] && p.cards?.[1]) &&
            !hasFolded(HAND.steps, s, p.seat),
        )
        .map((p) => ({
          seat: p.seat,
          cards: [p.cards![0]!, p.cards![1]!] as [string, string],
        }));
      map.set(s, computeEquity(contestants, stepBoard));
    }
    return map;
  }, [showEquity, HAND]);
  const liveEquity2 = useMemo(() => {
    const map = new Map<number, Record<number, number>>();
    if (!showEquity || !HAND.doubleBoardOn || HAND.equityByStep2) return map;
    for (let s = 0; s < HAND.steps.length; s++) {
      let stepBoard: string[] = [];
      for (let i = 0; i <= s; i++) {
        if (HAND.steps[i].board2) stepBoard = HAND.steps[i].board2!;
      }
      const contestants = HAND.players
        .filter(
          (p) =>
            !!(p.cards?.[0] && p.cards?.[1]) &&
            !hasFolded(HAND.steps, s, p.seat),
        )
        .map((p) => ({
          seat: p.seat,
          cards: [p.cards![0]!, p.cards![1]!] as [string, string],
        }));
      map.set(s, computeEquity(contestants, stepBoard));
    }
    return map;
  }, [showEquity, HAND]);
  const equityByStep =
    HAND.equityByStep?.[step] ?? liveEquity.get(step) ?? {};
  const equityByStep2 = HAND.doubleBoardOn
    ? HAND.equityByStep2?.[step] ?? liveEquity2.get(step) ?? {}
    : null;

  const playerCount = HAND.playerCount || HAND.players.length;
  // Hole-card count for the rendered hand (2 NLHE / 4 PLO4 / 5 PLO5).
  // Drives both the hero-card fan and the villain face-down card-back
  // count. Falls back to 2 for older saves without `gameType`.
  const holeCount =
    HAND.gameType === "PLO5" ? 5 : HAND.gameType === "PLO4" ? 4 : 2;
  const useHandFan = holeCount > 2;
  const heroPos = HAND.heroPosition ?? 0;
  // Visual seat positions, indexed by visual slot (0 = bottom-center / hero).
  const visualSeatPos = Array.from({ length: playerCount }, (_, i) =>
    seatXY(i, playerCount),
  );
  const visualOf = (cycleIdx: number) =>
    (cycleIdx - heroPos + playerCount) % playerCount;
  const streetBets = computeStreetBets(HAND.steps, step, HAND);
  const committed = committedThroughStep(HAND.steps, step, HAND);

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

  // Share toggle (owner-only). Optimistic local state so the UI updates
  // immediately; revert if the server action throws.
  const [sharePending, startShare] = useTransition();
  const [optimisticPublic, setOptimisticPublic] = useState(isPublic);
  const togglePublic = () => {
    if (!handId) return;
    const next = !optimisticPublic;
    setOptimisticPublic(next);
    startShare(async () => {
      try {
        await setHandPublicAction(handId, next);
        // On going public, copy the link so the user can paste right away.
        if (next) {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — toggle still succeeded */
          }
        }
      } catch (e) {
        console.error("Failed to toggle share state", e);
        setOptimisticPublic(!next);
        window.alert("Couldn't update sharing — try again.");
      }
    });
  };

  // Notes editing (owner-only). The displayed value lives in local state so
  // edits feel instant; the server roundtrip mirrors the change in both the
  // top-level `notes` column and `_full.notes` so the next read is consistent.
  // The outer Replayer keys on hand.id, so switching hands remounts this
  // component and re-seeds notesValue from the new HAND.
  const [notesValue, setNotesValue] = useState(HAND.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [, startNotesSave] = useTransition();
  const beginEditNotes = () => {
    setNotesDraft(notesValue);
    setEditingNotes(true);
  };
  const cancelEditNotes = () => {
    setEditingNotes(false);
    setNotesDraft("");
  };
  const saveNotes = () => {
    if (!handId) return;
    const trimmed = notesDraft.trim();
    const previous = notesValue;
    setNotesValue(trimmed);
    setEditingNotes(false);
    startNotesSave(async () => {
      try {
        const patch: Parameters<typeof updateHandDetailsAction>[1] = {
          notes: trimmed || undefined,
        };
        if (fullPayload) {
          patch._full = { ...fullPayload, notes: trimmed || undefined };
        }
        await updateHandDetailsAction(handId, patch);
      } catch (e) {
        console.error("Failed to save notes", e);
        setNotesValue(previous);
        window.alert("Couldn't save those notes — try again.");
      }
    });
  };

  return (
    <Shell
      header={
        <Header
          title=""
          back={isAuthenticated ? "Dashboard" : undefined}
          backHref={isAuthenticated ? "/dashboard" : undefined}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEquity((v) => !v)}
                aria-pressed={showEquity}
                title={
                  showEquity
                    ? "Hide per-player equity (re-hides villain cards)"
                    : "Show per-player equity (reveals villain hole cards)"
                }
              >
                <Percent />
                {showEquity ? "Hide equity" : "Show equity"}
              </Button>
              {isOwner && handId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePublic}
                  disabled={sharePending}
                  title={
                    optimisticPublic
                      ? "Currently public — click to make private"
                      : "Currently private — click to share publicly"
                  }
                >
                  {optimisticPublic ? (
                    <>
                      <Globe /> Public
                    </>
                  ) : (
                    <>
                      <Lock /> Private
                    </>
                  )}
                </Button>
              )}
              {!isAuthenticated && (
                <Button
                  asChild
                  size="sm"
                  style={{
                    background: "oklch(0.696 0.205 155)",
                    color: "oklch(0.145 0 0)",
                    fontWeight: 600,
                  }}
                  className="hover:!bg-[oklch(0.745_0.198_155)]"
                >
                  <Link href="/signup">
                    <UserPlus /> Save your own hands
                  </Link>
                </Button>
              )}
            </>
          }
        />
      }
    >
      <div className="flex-1 flex flex-col items-center px-6 py-5 gap-4 max-w-[1600px] w-full mx-auto">
        <div className="flex items-center gap-3 self-start">
          <h2 className="text-xl font-semibold tracking-tight">
            {HAND.bombPotOn
              ? `Bomb pot $${HAND.bombPotAmt} NLHE`
              : `$${HAND.stakes.sb}/$${HAND.stakes.bb} NLHE`}
          </h2>
          <span className="text-sm text-muted-foreground">
            · {playerCount}-handed
          </span>
        </div>

        {/* Table — capped by viewport height so the floating dock at the
            bottom never overlaps the felt. The dock takes ~80px and the
            chrome above (header + back link + paddings) is ~200px. */}
        <div
          className="w-full flex flex-col items-center"
          style={{ maxWidth: "calc((100vh - 280px) * 2)" }}
        >
        <TableSurface>
          {/* Pot + board(s). Stack a second row when this is a double-
              board hand and shift the whole stack up so hero cards still
              get clearance, mirroring the recorder. */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 pointer-events-none"
            style={{
              transform: `translateY(${HAND.doubleBoardOn ? -56 : -34}px)`,
            }}
          >
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
            {HAND.doubleBoardOn && (
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => {
                  const c = board2[i];
                  if (!c)
                    return <div key={i} style={{ width: 56, height: 80 }} />;
                  return (
                    <PlayingCard
                      key={i}
                      rank={c.slice(0, -1)}
                      suit={c.slice(-1)}
                    />
                  );
                })}
              </div>
            )}
            <span className="text-white/15 font-medium tracking-[0.28em] uppercase text-[10px]">
              savemyhands
            </span>
          </div>

          {/* Seats — iterate VISUAL slots; map back to cycle for player data. */}
          {(() => {
            const muckedSet = new Set(HAND.muckedSeats ?? []);
            const atShowdown = cur.street === "showdown";
            return visualSeatPos.map((pos, visualI) => {
            const i = (heroPos + visualI) % playerCount;
            const p = HAND.players[i];
            const isHero = visualI === 0;
            const isFolded = hasFolded(HAND.steps, step, i);
            // Mucking is a showdown-only outcome. Pre-showdown the player was
            // active in the hand and should render normally — only flag them
            // as mucked once the replay reaches the showdown step.
            const isMucked = !isFolded && atShowdown && muckedSet.has(i);
            const isActive = cur.active === i && cur.action !== "fold" && !isFolded;
            // Villain hole cards reveal at showdown by default. The
            // "Show equity" toggle also reveals them mid-hand so the user
            // can see what the equity numbers are based on.
            const villainShown =
              !isHero &&
              !isFolded &&
              !isMucked &&
              (atShowdown || showEquity) &&
              !!(p.cards && p.cards[0] && p.cards[1]);
            const showSeatEquity =
              showEquity &&
              !isFolded &&
              !isMucked &&
              equityByStep[i] !== undefined;
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
                    opacity: isFolded || isMucked ? 0.32 : 1,
                    filter:
                      isFolded || isMucked ? "grayscale(0.6)" : "none",
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
                      isFolded || isMucked
                        ? "text-[oklch(0.715_0.012_60)]"
                        : "text-[oklch(0.745_0.198_155)]"
                    }`}
                  >
                    ${Math.max(0, p.stack - (committed[i] || 0)).toLocaleString()}
                  </span>
                  {showSeatEquity && (
                    equityByStep2 && equityByStep2[i] !== undefined ? (
                      // Double-board: stack two badges so the user can
                      // see equity per board separately.
                      <span className="flex gap-1">
                        <span
                          className="px-1.5 h-4 inline-flex items-center rounded text-[10px] font-semibold tabular-nums leading-none"
                          style={{
                            background: "oklch(0.696 0.205 155 / 0.18)",
                            color: "oklch(0.795 0.184 155)",
                            border: "1px solid oklch(0.696 0.205 155 / 0.4)",
                          }}
                          title="Equity on board 1, all-in to river"
                        >
                          {(equityByStep[i] * 100).toFixed(0)}%
                        </span>
                        <span
                          className="px-1.5 h-4 inline-flex items-center rounded text-[10px] font-semibold tabular-nums leading-none"
                          style={{
                            background: "oklch(0.696 0.205 155 / 0.18)",
                            color: "oklch(0.795 0.184 155)",
                            border: "1px solid oklch(0.696 0.205 155 / 0.4)",
                          }}
                          title="Equity on board 2, all-in to river"
                        >
                          {(equityByStep2[i] * 100).toFixed(0)}%
                        </span>
                      </span>
                    ) : (
                      <span
                        className="px-1.5 h-4 inline-flex items-center rounded text-[10px] font-semibold tabular-nums leading-none"
                        style={{
                          background: "oklch(0.696 0.205 155 / 0.18)",
                          color: "oklch(0.795 0.184 155)",
                          border: "1px solid oklch(0.696 0.205 155 / 0.4)",
                        }}
                        title="Equity at this board, all-in to river"
                      >
                        {(equityByStep[i] * 100).toFixed(0)}%
                      </span>
                    )
                  )}
                  {(isFolded || isMucked) && (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.55_0.005_60)] leading-none">
                      {isMucked ? "Mucked" : "Folded"}
                    </span>
                  )}
                </div>
                {/* Hero hole cards — always face up. */}
                {p.cards && isHero && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-24"
                    style={{
                      opacity: isFolded ? 0.3 : 1,
                      filter: isFolded ? "grayscale(0.7)" : "none",
                    }}
                  >
                    <HandFan
                      cards={p.cards}
                      size="md"
                      fan={useHandFan}
                      faceDown={false}
                    />
                  </div>
                )}
                {/* Villain cards revealed at showdown. */}
                {villainShown && p.cards && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-14">
                    <HandFan
                      cards={p.cards}
                      size="sm"
                      fan={useHandFan}
                      faceDown={false}
                    />
                  </div>
                )}
                {/* Card backs — non-hero, not folded, not mucked, not yet revealed. */}
                {!isHero && !isFolded && !isMucked && !villainShown && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-14">
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
          });
          })()}

          {/* Bet bubbles — render at visual slot, hero flag from visual=0. */}
          {(() => {
            const muckedSet = new Set(HAND.muckedSeats ?? []);
            const atShowdownStep = cur.street === "showdown";
            return Object.entries(streetBets).map(([seatStr, amt]) => {
              const cycleIdx = Number(seatStr);
              // Mucked status only applies at showdown; their pre-showdown bets
              // are legitimate and should still render.
              if (
                !amt ||
                hasFolded(HAND.steps, step, cycleIdx) ||
                (atShowdownStep && muckedSet.has(cycleIdx))
              )
                return null;
              const v = visualOf(cycleIdx);
              return (
                <BetBubble
                  key={cycleIdx}
                  seatPos={visualSeatPos[v]}
                  amount={amt}
                  isHero={v === 0}
                />
              );
            });
          })()}

          {/* Check bubbles — same chip+pill visual as a bet bubble, but with
              "check" text. Walks back through the steps on the current street
              to find each seat's most recent action; renders for those whose
              latest is `check`. Resets between streets like bet bubbles do
              (the loop only considers the current-street window). */}
          {(() => {
            if (cur.street === "showdown") return null;
            const checked = new Set<number>();
            const seen = new Set<number>();
            for (let i = step; i >= 0; i--) {
              const s = HAND.steps[i];
              if (s.street !== cur.street) break;
              if (s.active === undefined || s.active === null) continue;
              if (seen.has(s.active)) continue;
              seen.add(s.active);
              if (s.action === "check") checked.add(s.active);
            }
            return Array.from(checked).map((cycleIdx) => {
              if (hasFolded(HAND.steps, step, cycleIdx)) return null;
              const v = visualOf(cycleIdx);
              return (
                <BetBubble
                  key={`check-${cycleIdx}`}
                  seatPos={visualSeatPos[v]}
                  isHero={v === 0}
                  label="check"
                />
              );
            });
          })()}

          {/* Dealer button — BTN is cycle 0, render at its visual slot. */}
          <DealerButtonChip seatPos={visualSeatPos[visualOf(0)]} />

          {/* Per-seat overlays — anchored note balloon when the current step
              carries an annotation. Rides the same coordinate system as bet
              bubbles so it shifts with the table, never with page flow. The
              earlier action-pill chip is gone; "what just happened" reads
              from the chip+pill bet/check bubbles plus the dock summary. */}
          {(() => {
            if (cur.active === undefined || cur.active === null) return null;
            const seatCycle = cur.active;
            if (hasFolded(HAND.steps, step, seatCycle)) return null;
            const v = visualOf(seatCycle);
            const pos = visualSeatPos[v];
            const onLeft = pos.left < 50;
            const note = cur.annotation;
            if (!note) return null;
            const balloonWidth = 280;
            return (
              <>
                {/* Connector — short dashed line from seat-side balloon edge
                    to seat plate edge. Drawn as a stub on the balloon side;
                    precise enough that the balloon reads as anchored to the
                    seat without per-pixel math. */}
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    transform: onLeft
                      ? "translate(-100%,-50%)"
                      : "translate(0,-50%)",
                    width: 56,
                    height: 0,
                    borderTop: "1.5px dashed oklch(0.696 0.205 155 / 0.55)",
                  }}
                />
                <div
                  className="absolute z-30"
                  style={{
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    transform: onLeft
                      ? `translate(calc(-100% - 56px),-50%)`
                      : `translate(56px,-50%)`,
                    width: balloonWidth,
                  }}
                >
                  <div
                    className="rounded-xl"
                    style={{
                      background: "oklch(0.196 0.030 155)",
                      borderTop: "1px solid oklch(0.696 0.205 155 / 0.3)",
                      borderRight: "1px solid oklch(0.696 0.205 155 / 0.3)",
                      borderBottom: "1px solid oklch(0.696 0.205 155 / 0.3)",
                      borderLeft: "3px solid oklch(0.696 0.205 155)",
                      padding: "12px 14px",
                      boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-[9.5px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: "oklch(0.795 0.184 155)" }}
                      >
                        Note
                      </span>
                    </div>
                    <p
                      className="text-[12.5px] leading-snug whitespace-pre-wrap"
                      style={{ color: "oklch(0.92 0.05 155)" }}
                    >
                      {note}
                    </p>
                  </div>
                </div>
              </>
            );
          })()}
        </TableSurface>
        </div>

        {/* The big "BTN bets $30" card and the always-rendered note row used
            to live here. The dock at the bottom of the viewport now carries
            the action summary + transport; the action pill near the active
            seat and the seat-anchored note balloon (added next) replace the
            inline cards. Removing the reserved row stops the layout from
            shifting when scrubbing across annotated/non-annotated steps. */}

        {/* Hand info — venue / date / notes from the recorder. Owners always
            see the panel (with an Add notes affordance) even when empty so
            they can edit during a review session. */}
        {(notesValue || HAND.venue || HAND.date || isOwner) && (
          <div className="rounded-xl border border-white/10 bg-[oklch(0.205_0_0)] px-5 py-4 w-full max-w-[820px] flex flex-col gap-3">
            {(HAND.venue || HAND.date) && (
              <div className="flex items-center gap-4 text-[12px] text-muted-foreground tabular-nums flex-wrap">
                {HAND.venue && (
                  <span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] mr-1.5">
                      Venue
                    </span>
                    <span className="text-zinc-200">{HAND.venue}</span>
                  </span>
                )}
                {HAND.date && (
                  <span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] mr-1.5">
                      Date
                    </span>
                    <span className="text-zinc-200">{HAND.date}</span>
                  </span>
                )}
              </div>
            )}
            {(notesValue || isOwner) && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Notes
                  </span>
                  {isOwner && !editingNotes && (
                    <button
                      onClick={beginEditNotes}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title={notesValue ? "Edit notes" : "Add notes"}
                      aria-label={notesValue ? "Edit notes" : "Add notes"}
                    >
                      <Pencil size={12} />
                      {notesValue ? "Edit" : "Add notes"}
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      autoFocus
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEditNotes();
                        } else if (
                          (e.metaKey || e.ctrlKey) &&
                          e.key === "Enter"
                        ) {
                          e.preventDefault();
                          saveNotes();
                        }
                      }}
                      placeholder="Articulate your read, decision points, anything you want the viewer to know."
                      className="flex w-full min-h-[120px] rounded-lg border border-input bg-transparent px-3 py-2 text-[14px] leading-relaxed shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 resize-y"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditNotes}
                      >
                        <X /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveNotes}
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
                ) : notesValue ? (
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-zinc-200">
                    {notesValue}
                  </p>
                ) : (
                  <p className="text-[13px] italic text-muted-foreground">
                    No notes yet.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {/* Bottom padding so the fixed dock never overlaps the notes panel. */}
        <div style={{ height: 96 }} aria-hidden />
      </div>

      {/* Floating media-player dock. Fixed to the viewport so scrolling /
          annotated steps don't shift it. */}
      <div
        className="fixed left-1/2 z-40 flex items-center gap-3.5"
        style={{
          bottom: 24,
          transform: "translateX(-50%)",
          padding: "10px 16px",
          borderRadius: 14,
          background: "rgba(15,15,18,0.92)",
          border: "1px solid oklch(1 0 0 / 0.12)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
          backdropFilter: "blur(14px)",
          maxWidth: 820,
          width: "calc(100% - 48px)",
        }}
      >
        {/* Action summary — quiet, no card chrome. */}
        <div className="flex items-center gap-2 min-w-0 max-w-[260px]">
          <StreetPill street={street} />
          <span className="text-[13px] text-zinc-200 truncate">
            {cur.label}
          </span>
        </div>

        {/* Transport */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              // Skip back to the first step of the current street.
              let target = 0;
              for (let i = step; i >= 0; i--) {
                if (HAND.steps[i].street !== street) {
                  target = i + 1;
                  break;
                }
              }
              setStep(target);
            }}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-zinc-300 hover:text-white hover:bg-white/8 cursor-pointer"
            aria-label="Restart street"
            title="Skip back to start of street"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-zinc-300 hover:text-white hover:bg-white/8 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous step"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="w-10 h-10 rounded-full inline-flex items-center justify-center cursor-pointer"
            style={{
              background: "oklch(0.696 0.205 155)",
              color: "oklch(0.145 0 0)",
              boxShadow: "0 4px 12px oklch(0.696 0.205 155 / 0.35)",
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={() =>
              setStep((s) => Math.min(HAND.steps.length - 1, s + 1))
            }
            disabled={step === HAND.steps.length - 1}
            className="w-8 h-8 inline-flex items-center justify-center rounded-md text-zinc-300 hover:text-white hover:bg-white/8 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next step"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Inline scrubber with markers at every annotated step. */}
        <div className="flex-1 relative h-7 flex items-center min-w-[160px]">
          <div
            className="absolute left-0 right-0 rounded"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: 3,
              background: "oklch(1 0 0 / 0.08)",
            }}
          />
          <div
            className="absolute left-0 rounded"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: 3,
              width: `${HAND.steps.length > 1 ? (step / (HAND.steps.length - 1)) * 100 : 0}%`,
              background: "oklch(0.696 0.205 155)",
            }}
          />
          {annotatedSteps.map((i) => {
            const pct =
              HAND.steps.length > 1 ? (i / (HAND.steps.length - 1)) * 100 : 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                title={
                  HAND.steps[i].annotation || "Annotated step"
                }
                aria-label={`Jump to annotated step ${i + 1}`}
                className="absolute cursor-pointer"
                style={{
                  left: `${pct}%`,
                  top: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: "oklch(0.795 0.184 155)",
                  boxShadow: "0 0 0 2px rgba(15,15,18,0.92)",
                  border: "none",
                  padding: 0,
                }}
              />
            );
          })}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${HAND.steps.length > 1 ? (step / (HAND.steps.length - 1)) * 100 : 0}%`,
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#fafafa",
              border: "2px solid oklch(0.696 0.205 155)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
            }}
          />
          <input
            type="range"
            min={0}
            max={HAND.steps.length - 1}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
            aria-label="Replay scrubber"
          />
        </div>

        {/* Step counter */}
        <span className="text-[11px] text-zinc-400 tabular-nums shrink-0 text-center w-[52px]">
          {step + 1} / {HAND.steps.length}
        </span>

        {/* Log popover trigger — the popover itself ships in the next pass. */}
        <button
          type="button"
          onClick={() => setLogOpen((v) => !v)}
          className="h-7 px-2.5 rounded-md text-[11px] cursor-pointer inline-flex items-center gap-1 shrink-0"
          style={
            logOpen
              ? {
                  background: "oklch(0.696 0.205 155 / 0.18)",
                  border: "1px solid oklch(0.696 0.205 155 / 0.5)",
                  color: "oklch(0.85 0.184 155)",
                }
              : {
                  background: "oklch(1 0 0 / 0.04)",
                  border: "1px solid oklch(1 0 0 / 0.12)",
                  color: "#e4e4e7",
                }
          }
          aria-expanded={logOpen}
          aria-label="Toggle action log"
        >
          Log
          {logOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </button>
      </div>

      {/* Log popover — sits above the dock when open. Lists every step
          grouped by street; annotated rows have a small emerald dot, the
          current step is highlighted, and any row jumps the scrubber. */}
      {logOpen && (
        <div
          className="fixed left-1/2 z-50"
          style={{
            bottom: 96,
            transform: "translateX(-50%)",
            width: 460,
            maxHeight: 320,
            background: "rgba(9,9,11,0.94)",
            border: "1px solid oklch(1 0 0 / 0.10)",
            borderRadius: 14,
            padding: "10px 12px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
            backdropFilter: "blur(14px)",
            overflowY: "auto",
          }}
          role="dialog"
          aria-label="Action log"
        >
          {(() => {
            const groups: { street: ReplayStep["street"]; items: { i: number; s: ReplayStep }[] }[] = [];
            HAND.steps.forEach((s, i) => {
              const last = groups[groups.length - 1];
              if (last && last.street === s.street) {
                last.items.push({ i, s });
              } else {
                groups.push({ street: s.street, items: [{ i, s }] });
              }
            });
            return groups.map((g) => (
              <div key={g.street} className="flex flex-col gap-0.5 mb-1.5 last:mb-0">
                <div
                  className="text-[9.5px] font-bold uppercase tracking-[0.18em] px-1 pt-1 pb-1"
                  style={{ color: "oklch(0.55 0 0)" }}
                >
                  {g.street}
                </div>
                {g.items.map(({ i, s }) => {
                  const active = i === step;
                  const annotated = !!(s.annotation && s.annotation.trim());
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setStep(i)}
                      className="flex items-center gap-2 px-2 h-7 rounded-md text-left cursor-pointer"
                      style={{
                        background: active
                          ? "oklch(0.696 0.205 155 / 0.18)"
                          : "transparent",
                        border: active
                          ? "1px solid oklch(0.696 0.205 155 / 0.4)"
                          : "1px solid transparent",
                        color: active ? "oklch(0.92 0.05 155)" : "#e4e4e7",
                      }}
                    >
                      <span className="flex-1 text-[12px] truncate">
                        {s.label}
                      </span>
                      <span
                        className="text-[10.5px] tabular-nums"
                        style={{ color: "oklch(0.55 0 0)" }}
                      >
                        ${s.pot}
                      </span>
                      {annotated && (
                        <span
                          aria-hidden
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "oklch(0.795 0.184 155)",
                            display: "inline-block",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ));
          })()}
        </div>
      )}
    </Shell>
  );
}
