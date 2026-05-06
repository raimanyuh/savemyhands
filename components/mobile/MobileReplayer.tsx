"use client";

// Mobile replayer — sibling of components/poker/Replayer.tsx for
// viewports below 640px. Reuses the same data shape (ReplayHand) and
// the shared VerticalFelt component; only the chrome (header, dock,
// anon CTA, share sheet, annotation balloon) is parallel.
//
// Layout:
//   [48pt header — back · name · share]
//   [optional anon CTA pill — only when !isAuthenticated]
//   [felt — flex:1, paddingBottom reserved for dock]
//   [floating dock — fixed bottom: 16, transport + scrubber + counter]
//   [annotation balloon — absolute, slides up from above the dock]

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startRouteProgress } from "@/lib/route-progress";
import {
  Check,
  ChevronLeft,
  Copy,
  Globe,
  Lock,
  Share2,
  X,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/ui/toast";
import {
  setHandPublicAction,
} from "@/lib/hands/actions";
import { useAnnotationEdit } from "@/lib/replayer/use-annotation-edit";
import { VerticalFelt, type FeltViewState } from "./VerticalFelt";
import { ReplayDock } from "./ReplayDock";
import { AnnotationBalloon } from "./AnnotationBalloon";
import {
  committedThroughStep,
  computeStreetBets,
  hasFolded,
  type ReplayHand,
  type ReplayStep,
} from "@/components/poker/hand";
import type { Player } from "@/components/poker/engine";
import type { SavedHand } from "@/components/poker/hand";

const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const BG = "oklch(0.10 0 0)";

const ANON_CTA_COOKIE = "smh_anon_cta_dismissed";

export default function MobileReplayer({
  hand,
  shareUrl,
  handId,
  handName,
  isOwner = false,
  isPublic = false,
  isAuthenticated = true,
  ownerUsername,
  fullPayload,
}: {
  hand: ReplayHand;
  shareUrl?: string;
  handId?: string;
  // Display name for the header. ReplayHand doesn't carry the name
  // (it's a shape-conversion target, not the source row), so the
  // route passes it down explicitly.
  handName?: string;
  isOwner?: boolean;
  isPublic?: boolean;
  isAuthenticated?: boolean;
  ownerUsername?: string | null;
  fullPayload?: SavedHand["_full"];
}) {
  // Re-mount per hand id so transport state resets cleanly between hands.
  return (
    <MobileReplayerInner
      key={hand.id}
      hand={hand}
      shareUrl={shareUrl}
      handId={handId}
      handName={handName}
      isOwner={isOwner}
      isPublic={isPublic}
      isAuthenticated={isAuthenticated}
      ownerUsername={ownerUsername ?? null}
      fullPayload={fullPayload}
    />
  );
}

function MobileReplayerInner({
  hand: HAND,
  shareUrl,
  handId,
  handName,
  isOwner,
  isPublic,
  isAuthenticated,
  ownerUsername,
  fullPayload,
}: {
  hand: ReplayHand;
  shareUrl?: string;
  handId?: string;
  handName?: string;
  isOwner: boolean;
  isPublic: boolean;
  isAuthenticated: boolean;
  ownerUsername: string | null;
  fullPayload?: SavedHand["_full"];
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // `_full` payload mirror — see desktop Replayer for rationale. The
  // mobile replayer doesn't have a notes editor today (deferred to
  // v1.1), so the mirror only feeds the annotation hook for now, but
  // wiring it the same way keeps future features consistent.
  const [livePayload, setLivePayload] = useState(fullPayload);
  // Annotation editing — owner-only. The bottom sheet hosts the
  // textarea; the balloon's Edit button opens it.
  const { annotationOf, isStepAnnotated, saveAnnotation } =
    useAnnotationEdit({ handId, livePayload, setLivePayload });
  const [editAnnoOpen, setEditAnnoOpen] = useState(false);
  const [annoDraft, setAnnoDraft] = useState("");
  // Anon CTA dismissal — read once on mount via lazy init so the row
  // doesn't flash before the cookie check.
  const [anonDismissed, setAnonDismissed] = useState(() =>
    readAnonDismissedCookie(),
  );

  // Auto-advance — same 1.1s/step cadence as the desktop replayer.
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
  const atShowdown = cur.street === "showdown";
  const heroPos = HAND.heroPosition ?? 0;
  const N = HAND.playerCount || HAND.players.length;
  const muckedSet = useMemo(
    () => new Set(HAND.muckedSeats ?? []),
    [HAND.muckedSeats],
  );

  // Board cards visible at the current step (replayer's per-step memo).
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

  // Folded seats by current step. The sentinel for hand.players' seat
  // index is its `seat` field — but indices and seats line up in the
  // canonical save shape (cycle-indexed array).
  const foldedSeats = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i <= step; i++) {
      const s = HAND.steps[i];
      if (s.action === "fold" && s.active != null) set.add(s.active);
    }
    return set;
  }, [step, HAND.steps]);

  // Checked seats — walk back through current-street steps and grab
  // each seat's latest action. Mirrors the desktop replayer.
  const checkedSeats = useMemo(() => {
    if (atShowdown) return new Set<number>();
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
    return checked;
  }, [step, atShowdown, cur.street, HAND.steps]);

  // Synthesize a FeltViewState for the felt — the felt was authored
  // for the recorder's reducer state, but it only reads a small subset
  // (8 fields). For replay we hide villain hole cards on every step
  // except showdown; mucked / folded villains stay hidden even there.
  const feltState = useMemo<FeltViewState>(() => {
    const players: Player[] = HAND.players.map((p) => {
      const isHero = p.seat === heroPos;
      const isFolded = foldedSeats.has(p.seat);
      const isMucked = muckedSet.has(p.seat);
      // Hero is always face-up. Villains only reveal at showdown, and
      // only if they didn't fold and didn't muck. Pre-showdown, leaving
      // cards null prompts the felt to render face-down backs sized
      // off the game's hole-card count.
      const showCards =
        isHero || (atShowdown && !isFolded && !isMucked);
      return {
        seat: p.seat,
        name: p.name,
        stack: p.stack,
        cards: showCards ? (p.cards ?? null) : null,
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
  // Active seat — only set when the active player hasn't folded and
  // isn't on a showdown step. The felt pulses an emerald ring on this
  // seat's plate.
  const activeSeat = useMemo(() => {
    if (atShowdown) return null;
    if (cur.active === undefined || cur.active === null) return null;
    if (hasFolded(HAND.steps, step, cur.active)) return null;
    return cur.active;
  }, [cur.active, atShowdown, step, HAND.steps]);

  // Annotated step indices — feed to the dock's scrubber dots. Reads
  // through the override-aware helper so newly-edited annotations
  // immediately show as dots without a server roundtrip.
  const annotatedSteps = useMemo(
    () =>
      HAND.steps
        .map((s, i) => (isStepAnnotated(s) ? i : -1))
        .filter((i) => i >= 0),
    [HAND, isStepAnnotated],
  );

  const url = shareUrl ?? `savemyhands.app/hand/${HAND.id}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link manually:", url);
    }
  };

  // Owner-only public/private toggle.
  const [optimisticPublic, setOptimisticPublic] = useState(isPublic);
  const [sharePending, startShare] = useTransition();
  const togglePublic = () => {
    if (!handId) return;
    const next = !optimisticPublic;
    setOptimisticPublic(next);
    startShare(async () => {
      try {
        await setHandPublicAction(handId, next);
        if (next) {
          // Going public also copies the link.
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard blocked — toggle still succeeded
          }
        }
      } catch (e) {
        console.error("Failed to toggle share state", e);
        setOptimisticPublic(!next);
        toast.error("Couldn't update sharing — try again.");
      }
    });
  };

  const dismissAnonCta = () => {
    setAnonDismissed(true);
    if (typeof document !== "undefined") {
      const ninetyDays = 60 * 60 * 24 * 90;
      document.cookie = `${ANON_CTA_COOKIE}=1; max-age=${ninetyDays}; path=/; SameSite=Lax`;
    }
  };

  const showAnonCta = !isAuthenticated && !anonDismissed;
  const liveAnnotation = annotationOf(cur);
  const annotation =
    liveAnnotation && liveAnnotation.trim() ? liveAnnotation : null;
  const canEditAnno = isOwner && cur.actionIndex !== undefined;
  const beginEditAnno = () => {
    setAnnoDraft(annotation ?? "");
    setEditAnnoOpen(true);
  };
  const commitEditAnno = async () => {
    const idx = cur.actionIndex;
    if (idx == null) {
      setEditAnnoOpen(false);
      return;
    }
    const text = annoDraft;
    setEditAnnoOpen(false);
    setAnnoDraft("");
    await saveAnnotation(idx, text);
  };

  return (
    <div
      className="flex flex-col h-[100dvh] w-full"
      style={{ background: BG, color: "oklch(0.92 0 0)" }}
    >
      {/* Header */}
      <header
        className="flex items-center shrink-0"
        style={{
          height: 48,
          padding: "0 4px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(10px)",
        }}
      >
        <button
          type="button"
          aria-label="Back"
          onClick={() => {
            startRouteProgress();
            if (isAuthenticated) router.push("/dashboard");
            else router.back();
          }}
          className="flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            color: "oklch(0.715 0 0)",
            background: "transparent",
            border: 0,
            borderRadius: 10,
          }}
        >
          <ChevronLeft size={22} />
        </button>
        <div
          className="flex-1 text-center leading-tight"
          style={{ minWidth: 0, padding: "0 4px" }}
        >
          <div
            className="font-semibold tracking-tight"
            style={{
              fontSize: 14,
              color: "oklch(0.98 0 0)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {handName || "Hand"}
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              color: "oklch(0.55 0 0)",
              letterSpacing: "0.06em",
            }}
          >
            {HAND.bombPotOn
              ? `Bomb $${HAND.bombPotAmt}`
              : `$${HAND.stakes.sb}/$${HAND.stakes.bb}`}
            {` · ${N}-handed`}
            {HAND.gameType && HAND.gameType !== "NLHE"
              ? ` · ${HAND.gameType}`
              : ""}
            {HAND.doubleBoardOn ? " · 2B" : ""}
            {ownerUsername && !isOwner ? ` · @${ownerUsername}` : ""}
          </div>
        </div>
        <button
          type="button"
          aria-label="Share"
          onClick={() => setShareOpen(true)}
          className="flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            color: "oklch(0.92 0 0)",
            background: "transparent",
            border: 0,
            borderRadius: 10,
          }}
        >
          <Share2 size={18} />
        </button>
      </header>

      {/* Anon viewer CTA — sticky pill below header, dismissible */}
      {showAnonCta && (
        <div
          className="flex items-center shrink-0"
          style={{
            margin: "8px 12px 0",
            padding: "8px 10px 8px 14px",
            borderRadius: 10,
            background: "oklch(0.696 0.205 155 / 0.10)",
            border: "1px solid oklch(0.696 0.205 155 / 0.30)",
            gap: 8,
          }}
        >
          <Link
            href="/signup"
            className="flex-1"
            style={{
              fontSize: 13,
              color: EMERALD_BRIGHT,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Save your own hands →
          </Link>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissAnonCta}
            style={{
              width: 28,
              height: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: 0,
              color: "oklch(0.745 0.198 155 / 0.7)",
              borderRadius: 6,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Felt — flex:1, with bottom padding reserved for the floating
          dock so the dock never overlaps the hero plate. The felt
          itself uses bottomInset=96 to lift seats upward beyond what
          paddingBottom provides. */}
      <div
        className="flex-1 min-h-0 relative"
        style={{ padding: "8px 8px 0" }}
      >
        <VerticalFelt
          state={feltState}
          committed={committed}
          activeSeat={activeSeat}
          foldedSeats={foldedSeats}
          streetBets={streetBets}
          checkedSeats={checkedSeats}
          streetClosed={false}
          bottomInset={96}
        />

        {/* Annotation balloon — absolute layer above the dock */}
        <AnnotationBalloon
          step={step}
          street={cur.street}
          annotation={annotation}
          onEdit={canEditAnno ? beginEditAnno : undefined}
        />
      </div>

      {/* Floating dock — pinned to the viewport bottom so scrolling
          (rare on mobile replayer) doesn't shift it. */}
      <ReplayDock
        step={step}
        totalSteps={HAND.steps.length}
        street={cur.street}
        actionLabel={cur.label}
        playing={playing}
        annotatedSteps={annotatedSteps}
        onStepChange={setStep}
        onPlayPause={() => setPlaying((p) => !p)}
        onAddNote={
          canEditAnno && !annotation ? beginEditAnno : undefined
        }
      />

      {/* Share sheet — copy + (owner-only) public toggle */}
      <BottomSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share hand"
      >
        <div
          className="flex flex-col"
          style={{ padding: "4px 0 12px" }}
        >
          {/* URL row */}
          <div
            className="flex items-center"
            style={{
              gap: 8,
              padding: "10px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span
              className="font-mono flex-1"
              style={{
                fontSize: 11,
                color: "oklch(0.65 0 0)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {url}
            </span>
          </div>

          <SheetButton
            icon={copied ? <Check size={16} /> : <Copy size={16} />}
            label={copied ? "Copied" : "Copy link"}
            onClick={() => {
              copy();
            }}
          />

          {isOwner && handId && (
            <SheetButton
              icon={
                optimisticPublic ? (
                  <Globe size={16} />
                ) : (
                  <Lock size={16} />
                )
              }
              label={
                optimisticPublic ? "Public — anyone with the link" : "Private — only you"
              }
              sub={
                optimisticPublic
                  ? "Tap to make private"
                  : "Tap to share publicly (auto-copies link)"
              }
              disabled={sharePending}
              onClick={togglePublic}
            />
          )}
        </div>
      </BottomSheet>

      {/* Annotation edit sheet — owner-only, opens from the balloon's
          Edit button. The textarea is a sheet rather than inline so
          the keyboard doesn't push the felt around. */}
      <BottomSheet
        open={editAnnoOpen}
        onOpenChange={setEditAnnoOpen}
        title={`Note · step ${step + 1}`}
        footer={
          <div className="flex" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={() => setEditAnnoOpen(false)}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 12,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "oklch(0.85 0 0)",
                fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commitEditAnno}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 12,
                background: EMERALD_BRIGHT,
                border: 0,
                color: BG,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Save
            </button>
          </div>
        }
      >
        <div style={{ padding: "12px 14px 16px" }}>
          <textarea
            autoFocus
            value={annoDraft}
            onChange={(e) => setAnnoDraft(e.target.value)}
            placeholder="What was happening here?"
            rows={5}
            className="w-full"
            style={{
              borderRadius: 10,
              background: "oklch(0.16 0 0)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "oklch(0.92 0 0)",
              fontSize: 14,
              lineHeight: 1.5,
              padding: "10px 12px",
              outline: "none",
              resize: "vertical",
              minHeight: 120,
            }}
          />
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              color: "oklch(0.55 0 0)",
              marginTop: 8,
              letterSpacing: "0.04em",
            }}
          >
            Empty + Save deletes the note.
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────────────

function SheetButton({
  icon,
  label,
  sub,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center w-full"
      style={{
        gap: 12,
        padding: "12px 16px",
        background: "transparent",
        border: 0,
        color: "oklch(0.92 0 0)",
        fontSize: 14,
        textAlign: "left",
        minHeight: 48,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 28,
          height: 28,
          color: "oklch(0.715 0 0)",
        }}
      >
        {icon}
      </span>
      <span className="flex-1 flex flex-col" style={{ gap: 2 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {sub && (
          <span
            style={{
              fontSize: 11,
              color: "oklch(0.55 0 0)",
              fontWeight: 400,
            }}
          >
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

// Pad a board array to 5 entries with nulls so the felt renders an
// empty slot per missing card. The felt expects exactly 5 entries per
// row (length-stable layout).
function padBoard(b: string[]): (string | null)[] {
  const padded: (string | null)[] = [...b];
  while (padded.length < 5) padded.push(null);
  return padded.slice(0, 5);
}

function readAnonDismissedCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith(`${ANON_CTA_COOKIE}=1`));
}

// Type re-export so the route file compiles even if it doesn't
// directly reference ReplayStep.
export type { ReplayStep };
