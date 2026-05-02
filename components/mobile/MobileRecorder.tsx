"use client";

// Mobile recorder — sibling of components/poker/Recorder.tsx for
// viewports below 640px. Reuses the same reducer, derivations, and
// save pipeline; only the UI is parallel.
//
// This file is the shell + orchestration. UI sub-pieces (vertical felt,
// card picker sheet, raise sizer, setup sheet, showdown panel) live
// in adjacent files under components/mobile/ and get composed here.
//
// Build order matters — until a sub-piece lands, its placeholder lives
// inline so the route compiles and the layout is testable end-to-end.

import {
  useEffect,
  useMemo,
  useReducer,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { POSITION_NAMES } from "@/components/poker/lib";
import {
  committedBySeat,
  computeSidePots,
  deriveStreet,
  holeCardCount,
  initialStateFromDefaults,
  reducer,
} from "@/components/poker/engine";
import type { Player } from "@/components/poker/engine";
import {
  awardPots,
  awardPotsMultiBoard,
  type PotAward,
} from "@/components/poker/hand-eval";
import { buildAndSaveHand } from "@/lib/recorder/save-hand";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const BG = "oklch(0.145 0 0)";

export default function MobileRecorder() {
  const router = useRouter();
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => initialStateFromDefaults(),
  );
  const [savePending, startSave] = useTransition();
  const [setupOpen, setSetupOpen] = useState(false);

  const N = state.playerCount;
  const heroPos = state.heroPosition;
  const posNames = POSITION_NAMES[N];

  const derived = useMemo(() => deriveStreet(state), [state]);

  // Board-completion flags drive both auto-advance and the deal CTAs.
  // Mirrored from Recorder.tsx so the mobile shell behaves identically.
  const board1FlopFilled =
    !!(state.board[0] && state.board[1] && state.board[2]);
  const board2FlopFilled =
    !!(state.board2[0] && state.board2[1] && state.board2[2]);
  const board1TurnFilled = !!state.board[3];
  const board2TurnFilled = !!state.board2[3];
  const board1RiverFilled = !!state.board[4];
  const board2RiverFilled = !!state.board2[4];
  const flopFilled =
    board1FlopFilled && (!state.doubleBoardOn || board2FlopFilled);
  const turnFilled =
    board1TurnFilled && (!state.doubleBoardOn || board2TurnFilled);
  const riverFilled =
    board1RiverFilled && (!state.doubleBoardOn || board2RiverFilled);

  // Auto-advance once a street's board is complete and betting closed.
  useEffect(() => {
    if (!derived || !derived.streetClosed) return;
    if (state.phase === "preflop" && flopFilled)
      dispatch({ type: "advanceStreet" });
    else if (state.phase === "flop" && turnFilled)
      dispatch({ type: "advanceStreet" });
    else if (state.phase === "turn" && riverFilled)
      dispatch({ type: "advanceStreet" });
  }, [
    flopFilled,
    turnFilled,
    riverFilled,
    derived?.streetClosed,
    derived,
    state.phase,
  ]);

  // Hand-over → showdown after a short pause so the last action's bubble
  // gets a moment on screen before the panel takes over.
  useEffect(() => {
    if (!derived) return;
    if (derived.handOver) {
      const t = setTimeout(() => dispatch({ type: "goShowdown" }), 250);
      return () => clearTimeout(t);
    }
  }, [derived?.handOver, derived]);

  // resolvedAwards: per-pot allocation when showdown is fully resolved.
  // Returns null if any villain hasn't shown/mucked, the board is
  // incomplete, or hero hasn't been shown — the Save button reads this
  // null to gate the save action. Logic mirrors Recorder.tsx so both
  // surfaces gate saves identically.
  const resolvedAwards = useMemo<PotAward[][] | null>(() => {
    if (state.phase !== "showdown" && state.phase !== "done") return null;
    const board1 = state.board.filter((c): c is string => Boolean(c));
    const board2 = state.doubleBoardOn
      ? state.board2.filter((c): c is string => Boolean(c))
      : null;
    const folded = new Set<number>();
    for (const a of state.actions) if (a.action === "fold") folded.add(a.seat);
    const muckedSet = new Set(state.muckedSeats);
    const pots = computeSidePots(state);
    const survivors = state.players.filter((p) => !folded.has(p.seat));
    const villainSurvivors = survivors.filter((p) => p.seat !== heroPos);
    const heroAlone =
      villainSurvivors.length === 0 ||
      villainSurvivors.every((v) => muckedSet.has(v.seat));
    if (heroAlone) {
      return pots.map((p) => [{ amount: p.amount, winners: [heroPos] }]);
    }
    const holeCount = holeCardCount(state.gameType);
    const isShown = (p: Player): boolean => {
      if (!p.cards) return false;
      for (let i = 0; i < holeCount; i++) if (!p.cards[i]) return false;
      return true;
    };
    const villainsAwaiting = villainSurvivors.filter(
      (v) => !muckedSet.has(v.seat) && !isShown(v),
    );
    if (villainsAwaiting.length > 0) return null;
    if (board1.length < 5) return null;
    if (board2 !== null && board2.length < 5) return null;
    const hero = state.players[heroPos];
    if (!isShown(hero)) return null;
    const contestants = [
      hero,
      ...villainSurvivors.filter(
        (v) => !muckedSet.has(v.seat) && isShown(v),
      ),
    ].map((p) => ({
      seat: p.seat,
      cards: (p.cards as string[]).slice(0, holeCount),
    }));
    try {
      return board2
        ? awardPotsMultiBoard(
            pots,
            contestants,
            [board1, board2],
            state.gameType,
          )
        : awardPots(pots, contestants, board1, state.gameType);
    } catch {
      return null;
    }
  }, [state, heroPos]);

  // Has the user entered anything that would be lost on navigation away?
  const isDirty = () =>
    state.phase !== "setup" ||
    state.actions.length > 0 ||
    !!state.players[state.heroPosition]?.cards?.[0] ||
    !!state.players[state.heroPosition]?.cards?.[1] ||
    state.notes.trim().length > 0 ||
    state.handName !== "New hand" ||
    state.venue.trim().length > 0;

  const handleBack = async () => {
    if (!isDirty()) {
      router.push("/dashboard");
      return;
    }
    const ok = await confirm({
      title: "Leave without saving?",
      message: "Your in-progress recording will be lost.",
      confirmLabel: "Leave",
      destructive: true,
    });
    if (ok) router.push("/dashboard");
  };

  const saveHand = () => {
    startSave(async () => {
      try {
        await buildAndSaveHand({
          state,
          resolvedAwards,
          heroPos,
          heroPosName: posNames[heroPos] ?? "",
        });
      } catch (e) {
        console.error("Failed to save hand", e);
        window.alert(
          "Couldn't save the hand — check your connection and try again.",
        );
        return;
      }
      router.push("/dashboard");
    });
  };

  const canSave =
    !savePending &&
    (state.phase === "showdown" || state.phase === "done") &&
    resolvedAwards !== null;

  const pot = derived?.totalPot ?? 0;
  const streetLabel =
    state.bombPotOn && state.phase === "preflop"
      ? "FLOP"
      : (state.phase === "showdown" || state.phase === "done"
        ? "SHOWN"
        : state.phase === "setup"
          ? "SETUP"
          : state.phase.toUpperCase());
  const activeSeat = derived?.activeSeat ?? null;
  const actionHint =
    state.phase === "setup"
      ? "Pick hero hole cards to start"
      : activeSeat !== null
        ? `${posNames[activeSeat]} to act`
        : derived?.handOver
          ? "Hand over"
          : derived?.streetClosed
            ? `Deal ${nextStreetLabel(state.phase)}`
            : "—";

  // Live committed-by-seat — feeds the (placeholder) felt's stack labels
  // once the felt component lands. Computed here so the placeholder can
  // surface the current pot for sanity-checking during the build-out.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const committed = committedBySeat(state);

  return (
    <div
      className="flex flex-col h-[100dvh] w-full overflow-hidden"
      style={{ background: BG, color: "oklch(0.92 0 0)" }}
    >
      {/* Header — 48pt slim row */}
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
          onClick={handleBack}
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
        <div className="flex-1 text-center leading-tight">
          <div
            className="font-semibold tracking-tight"
            style={{ fontSize: 14, color: "oklch(0.98 0 0)" }}
          >
            {state.handName || "New hand"}
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              color: "oklch(0.55 0 0)",
              letterSpacing: "0.06em",
            }}
          >
            {state.bombPotOn
              ? `Bomb $${state.bombPotAmt} · ${N}-handed`
              : `$${state.sb}/$${state.bb} · ${N}-handed`}
            {state.gameType !== "NLHE" ? ` · ${state.gameType}` : ""}
            {state.doubleBoardOn ? " · 2B" : ""}
          </div>
        </div>
        <button
          type="button"
          aria-label="Setup"
          onClick={() => setSetupOpen(true)}
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
          <Settings size={20} />
        </button>
      </header>

      {/* Meta strip — 36pt */}
      <div
        className="flex items-center gap-2 shrink-0"
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span
          className="inline-flex items-center font-mono font-semibold"
          style={{
            height: 26,
            padding: "0 9px",
            borderRadius: 7,
            background:
              state.phase === "setup"
                ? "oklch(0.215 0 0)"
                : "oklch(0.30 0.10 155 / 0.35)",
            border: `1px solid ${
              state.phase === "setup"
                ? "rgba(255,255,255,0.12)"
                : "oklch(0.696 0.205 155 / 0.35)"
            }`,
            fontSize: 11,
            color:
              state.phase === "setup"
                ? "oklch(0.92 0 0)"
                : EMERALD_BRIGHT,
            letterSpacing: "0.04em",
          }}
        >
          {streetLabel}
        </span>
        <span
          className="font-mono font-semibold"
          style={{
            fontSize: 12,
            color: "oklch(0.98 0 0)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          ${pot}
        </span>
        <span className="flex-1" />
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            color: "oklch(0.715 0 0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 180,
          }}
        >
          {actionHint}
        </span>
      </div>

      {/* Felt — placeholder until VerticalFelt lands */}
      <div className="flex-1 min-h-0 p-2 flex items-stretch">
        <div
          className="flex-1 flex items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse 70% 95% at 50% 50%, var(--smh-mobile-felt-top) 0%, var(--smh-mobile-felt-bottom) 100%)",
            borderRadius: 24,
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="text-center font-mono"
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.1em",
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.6 }}>POT</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "oklch(0.98 0 0)",
                fontVariantNumeric: "tabular-nums",
                marginTop: 2,
              }}
            >
              ${pot}
            </div>
            <div
              style={{
                fontSize: 9,
                marginTop: 12,
                opacity: 0.5,
                letterSpacing: "0.18em",
              }}
            >
              FELT · COMING NEXT
            </div>
          </div>
        </div>
      </div>

      {/* Action bar — fixed-height 56pt buttons + step counter */}
      <div
        className="shrink-0"
        style={{
          padding:
            "8px 10px max(10px, env(safe-area-inset-bottom)) 10px",
          background: "oklch(0.18 0 0)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{
            marginBottom: 6,
            fontSize: 11,
            color: "oklch(0.55 0 0)",
            fontFamily:
              "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
          }}
        >
          <span>
            {state.actions.length === 0
              ? state.phase === "setup"
                ? "Setup"
                : "Start of hand"
              : `Step ${state.actions.length}`}
          </span>
          <button
            type="button"
            disabled={state.actions.length === 0}
            onClick={() => dispatch({ type: "undoAction" })}
            style={{
              background: "transparent",
              border: 0,
              color: "oklch(0.715 0 0)",
              padding: "4px 8px",
              borderRadius: 6,
              opacity: state.actions.length === 0 ? 0.4 : 1,
              fontSize: 12,
            }}
          >
            ↶ Undo
          </button>
        </div>
        <div
          className="grid"
          style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}
        >
          <ActionButton
            kind="fold"
            disabled={!derived || activeSeat === null}
            onClick={() =>
              activeSeat !== null &&
              dispatch({
                type: "recordAction",
                action: { seat: activeSeat, action: "fold" },
              })
            }
            label="Fold"
          />
          <ActionButton
            kind="cc"
            disabled={!derived || activeSeat === null}
            onClick={() => {
              if (activeSeat === null || !derived) return;
              if (derived.canCheck)
                dispatch({
                  type: "recordAction",
                  action: { seat: activeSeat, action: "check" },
                });
              else
                dispatch({
                  type: "recordAction",
                  action: { seat: activeSeat, action: "call" },
                });
            }}
            label={derived?.canCheck ? "Check" : "Call"}
            sub={
              derived && !derived.canCheck && activeSeat !== null
                ? `$${derived.toCall}`
                : undefined
            }
          />
          <ActionButton
            kind="br"
            disabled={!derived || activeSeat === null}
            onClick={() =>
              window.alert(
                "Raise sizer comes in the next iteration — for now use desktop to enter raises.",
              )
            }
            label={
              derived && derived.lastBet === 0 && activeSeat !== null
                ? "Bet"
                : "Raise"
            }
          />
        </div>
        {(state.phase === "showdown" || state.phase === "done") && (
          <button
            type="button"
            onClick={saveHand}
            disabled={!canSave}
            style={{
              marginTop: 8,
              width: "100%",
              height: 48,
              borderRadius: 12,
              background: canSave ? EMERALD : "oklch(0.215 0 0)",
              color: canSave ? BG : "oklch(0.55 0 0)",
              fontWeight: 600,
              border: 0,
              fontSize: 14,
            }}
          >
            {savePending
              ? "Saving…"
              : resolvedAwards === null
                ? "Resolve villains to save"
                : "Save hand"}
          </button>
        )}
      </div>

      {/* Setup sheet placeholder — real bottom sheet lands next iteration */}
      {setupOpen && (
        <div
          className="fixed inset-0 z-[400] flex items-end"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setSetupOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full"
            style={{
              background: "var(--popover)",
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 16,
              minHeight: 200,
            }}
          >
            <div
              className="font-semibold mb-3"
              style={{ fontSize: 14 }}
            >
              Setup (placeholder)
            </div>
            <p
              style={{
                fontSize: 12,
                color: "oklch(0.715 0 0)",
                lineHeight: 1.5,
              }}
            >
              The full mobile setup sheet (game type, players, blinds,
              straddle, bomb pot, double board, hero position, default
              stack, save/load defaults) lands in the next iteration of
              this PR. Use the desktop recorder for full configuration in
              the meantime — settings round-trip cleanly.
            </p>
            <button
              type="button"
              onClick={() => setSetupOpen(false)}
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 10,
                background: EMERALD,
                color: BG,
                fontWeight: 600,
                border: 0,
                fontSize: 13,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function nextStreetLabel(phase: string): string {
  if (phase === "preflop") return "flop";
  if (phase === "flop") return "turn";
  if (phase === "turn") return "river";
  return "next";
}

function ActionButton({
  kind,
  label,
  sub,
  disabled,
  onClick,
}: {
  kind: "fold" | "cc" | "br";
  label: string;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const styleByKind: Record<string, React.CSSProperties> = {
    fold: {
      background: "oklch(0.215 0 0)",
      border: "1px solid oklch(0.704 0.191 22.216 / 0.3)",
      color: "oklch(0.704 0.191 22.216)",
    },
    cc: {
      background: "oklch(0.215 0 0)",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "oklch(0.98 0 0)",
    },
    br: {
      background: EMERALD,
      border: 0,
      color: BG,
    },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 56,
        borderRadius: 12,
        fontWeight: 600,
        fontSize: 14,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        opacity: disabled ? 0.4 : 1,
        ...styleByKind[kind],
      }}
    >
      <span>{label}</span>
      {sub && (
        <span
          style={{
            fontFamily:
              "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
            fontSize: 11,
            color: kind === "br" ? "rgba(0,0,0,0.7)" : "oklch(0.715 0 0)",
            fontWeight: 500,
          }}
        >
          {sub}
        </span>
      )}
    </button>
  );
}
