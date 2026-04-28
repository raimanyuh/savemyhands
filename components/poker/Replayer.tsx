"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe,
  Lock,
  Pause,
  Percent,
  Play,
  RotateCcw,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header, Shell } from "@/components/Shell";
import { setHandPublicAction } from "@/lib/hands/actions";
import { computeEquity } from "./equity";
import PlayingCard from "./PlayingCard";
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
}: {
  hand: ReplayHand;
  shareUrl?: string;
  handId?: string;
  isOwner: boolean;
  isPublic: boolean;
  isAuthenticated: boolean;
}) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  // Off by default to preserve the "watch it like a real hand" feel —
  // turning it on reveals every villain who showed at showdown plus a
  // per-seat equity badge at the current step's board.
  const [showEquity, setShowEquity] = useState(false);

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [HAND.steps.length]);

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
  const pot = HAND.steps[step].pot;
  const street = HAND.steps[step].street;

  // Equity is precomputed at save time and stored on the hand. For older
  // hands that predate that field, we fall back to runout enumeration on
  // the fly — same approach as before, just rarely hit now.
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
  const equityByStep =
    HAND.equityByStep?.[step] ?? liveEquity.get(step) ?? {};

  const playerCount = HAND.playerCount || HAND.players.length;
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
                    color: "oklch(0.145 0.008 60)",
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
                        <PlayingCard key={j} faceDown size="sm" />
                      ),
                    )}
                  </div>
                )}
                {/* Villain cards revealed at showdown. */}
                {villainShown && p.cards && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-14 flex gap-1">
                    {p.cards.map((c, j) =>
                      c ? (
                        <PlayingCard
                          key={j}
                          rank={c.slice(0, -1)}
                          suit={c.slice(-1)}
                          size="sm"
                        />
                      ) : (
                        <PlayingCard key={j} faceDown size="sm" />
                      ),
                    )}
                  </div>
                )}
                {/* Card backs — non-hero, not folded, not mucked, not yet revealed. */}
                {!isHero && !isFolded && !isMucked && !villainShown && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-14 flex gap-1">
                    {[0, 1].map((j) => (
                      <PlayingCard key={j} faceDown size="sm" />
                    ))}
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

          {/* Dealer button — BTN is cycle 0, render at its visual slot. */}
          <DealerButtonChip seatPos={visualSeatPos[visualOf(0)]} />
        </TableSurface>

        {/* Action log + transport */}
        <div className="flex flex-col gap-3 w-full max-w-[820px]">
          <div className="flex flex-col gap-2">
            <div className="rounded-xl border border-white/10 bg-[oklch(0.205_0_0)] px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <StreetPill street={street} />
                <span className="text-base font-medium truncate">
                  {cur.label}
                </span>
              </div>
              <div className="text-sm text-muted-foreground tabular-nums shrink-0">
                {step + 1} / {HAND.steps.length}
              </div>
            </div>
            {cur.annotation && (
              <div
                className="rounded-xl border px-4 py-3 flex items-start gap-3"
                style={{
                  borderColor: "oklch(0.696 0.205 155 / 0.4)",
                  background: "oklch(0.696 0.205 155 / 0.06)",
                }}
              >
                <span
                  className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.18em] shrink-0 mt-0.5"
                  style={{
                    background: "oklch(0.696 0.205 155 / 0.18)",
                    color: "oklch(0.795 0.184 155)",
                    border: "1px solid oklch(0.696 0.205 155 / 0.4)",
                  }}
                >
                  Note
                </span>
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-zinc-100">
                  {cur.annotation}
                </p>
              </div>
            )}
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

        {/* Hand info — venue / date / notes from the recorder. */}
        {(HAND.notes || HAND.venue || HAND.date) && (
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
            {HAND.notes && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Notes
                </span>
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-zinc-200">
                  {HAND.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
