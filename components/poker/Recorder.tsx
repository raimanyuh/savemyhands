"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header, Shell } from "@/components/Shell";
import { POSITION_NAMES, seatXY } from "./lib";
import {
  BetBubble,
  DealerButtonChip,
  NameDisplay,
  StackDisplay,
  TableSurface,
} from "./table-pieces";
import { CardSlot } from "./CardPicker";
import {
  deriveStreet,
  formatAction,
  initialState,
  reducer,
  totalPot,
} from "./engine";
import type { Action, ActionType, Player, RecorderState } from "./engine";
import type { SavedHand } from "./hand";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_HOVER = "oklch(0.745 0.198 155)";
const BG = "oklch(0.145 0.008 60)";

function ActionBar({
  state,
  derived,
  dispatch,
}: {
  state: RecorderState;
  derived: NonNullable<ReturnType<typeof deriveStreet>>;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
}) {
  const { activeSeat, toCall, canCheck, minRaise, totalPot: tp, lastBet } = derived;
  const seat = activeSeat !== null ? state.players[activeSeat] : null;
  const posName =
    activeSeat !== null
      ? POSITION_NAMES[state.playerCount][activeSeat]
      : "";
  // The ActionBar is keyed by phase/seat/minRaise from the parent, so a fresh
  // mount seeds `amount` to the current minRaise without an effect.
  const [amount, setAmount] = useState(String(minRaise));

  if (!seat || activeSeat === null) return null;

  const fold = () =>
    dispatch({ type: "recordAction", action: { seat: activeSeat, action: "fold" } });
  const check = () =>
    dispatch({ type: "recordAction", action: { seat: activeSeat, action: "check" } });
  const call = () =>
    dispatch({ type: "recordAction", action: { seat: activeSeat, action: "call" } });
  const placeBet = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (lastBet === 0) {
      dispatch({
        type: "recordAction",
        action: { seat: activeSeat, action: "bet", amount: amt },
      });
    } else {
      if (amt < minRaise) return;
      dispatch({
        type: "recordAction",
        action: { seat: activeSeat, action: "raise", amount: amt },
      });
    }
  };

  const fillPot = (frac: number) => {
    const potAfter = tp + toCall;
    const target = Math.round(lastBet + frac * potAfter);
    setAmount(String(Math.max(target, minRaise)));
  };
  const allIn = () => setAmount(String(seat.stack));

  const isBetMode = lastBet === 0;
  const cannotBet = isBetMode ? Number(amount) <= 0 : Number(amount) < minRaise;

  return (
    <div
      className="rounded-2xl border border-white/10 px-5 py-4 w-full max-w-[1100px]"
      style={{
        background: "rgba(9,9,11,0.85)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
          Acting
        </span>
        <span
          className="text-[12px] font-bold uppercase tracking-[0.14em] px-2 h-6 inline-flex items-center rounded-md"
          style={{
            background: "oklch(0.696 0.205 155 / 0.18)",
            color: EMERALD_HOVER,
            border: "1px solid oklch(0.696 0.205 155 / 0.4)",
          }}
        >
          {posName}
        </span>
        <span className="text-[14px] font-medium text-zinc-100">
          {seat.name || `Seat ${activeSeat + 1}`}
        </span>
        <span className="text-[12px] text-zinc-500">·</span>
        <span className="text-[12px] tabular-nums text-zinc-400">
          stack ${seat.stack.toLocaleString()}
        </span>
        <span className="text-[12px] text-zinc-500">·</span>
        <span className="text-[12px] tabular-nums text-zinc-400">
          to call ${toCall.toLocaleString()}
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="xs"
          onClick={() => dispatch({ type: "undoAction" })}
          disabled={state.actions.length === 0}
        >
          <RotateCcw /> Undo
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={fold}
          className="!border-[oklch(0.704_0.191_22.216_/_0.4)] !text-[oklch(0.704_0.191_22.216)] hover:!bg-[oklch(0.704_0.191_22.216_/_0.12)]"
        >
          Fold
        </Button>
        {canCheck ? (
          <Button variant="outline" size="lg" onClick={check}>
            Check
          </Button>
        ) : (
          <Button variant="outline" size="lg" onClick={call}>
            Call ${toCall.toLocaleString()}
          </Button>
        )}
        <span className="w-px h-7 bg-white/10 mx-1" />
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 h-9 text-sm text-center tabular-nums"
        />
        <Button
          onClick={placeBet}
          size="lg"
          disabled={cannotBet}
          style={{ background: EMERALD, color: BG, fontWeight: 600 }}
          className="hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50"
        >
          {isBetMode ? "Bet" : "Raise to"} ${Number(amount || 0).toLocaleString()}
        </Button>
        <span className="w-px h-7 bg-white/10 mx-1" />
        <Button variant="ghost" size="sm" onClick={() => fillPot(0.5)}>
          ½ pot
        </Button>
        <Button variant="ghost" size="sm" onClick={() => fillPot(0.75)}>
          ¾ pot
        </Button>
        <Button variant="ghost" size="sm" onClick={() => fillPot(1)}>
          Pot
        </Button>
        <Button variant="ghost" size="sm" onClick={allIn}>
          All-in
        </Button>
      </div>
    </div>
  );
}

function SetupBar({
  state,
  dispatch,
  onStart,
}: {
  state: RecorderState;
  dispatch: React.Dispatch<Parameters<typeof reducer>[1]>;
  onStart: () => void;
}) {
  const { playerCount, sb, bb, straddleOn, straddleAmt } = state;
  const canStraddle = playerCount >= 4;
  const heroOk = !!(state.players[0].cards?.[0] && state.players[0].cards?.[1]);

  return (
    <div
      className="rounded-2xl border border-white/10 px-7 py-5 w-full max-w-[1100px]"
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
              onClick={() =>
                dispatch({ type: "setPlayerCount", n: Math.max(2, playerCount - 1) })
              }
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
              onClick={() =>
                dispatch({ type: "setPlayerCount", n: Math.min(9, playerCount + 1) })
              }
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
              value={sb}
              min={1}
              onChange={(e) =>
                dispatch({ type: "setBlinds", sb: Number(e.target.value), bb })
              }
              className="w-16 h-9 text-sm text-center"
            />
            <span className="text-zinc-500 text-sm font-medium">/</span>
            <Input
              type="number"
              value={bb}
              min={1}
              onChange={(e) =>
                dispatch({ type: "setBlinds", sb, bb: Number(e.target.value) })
              }
              className="w-16 h-9 text-sm text-center"
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
              onClick={() =>
                dispatch({
                  type: "setStraddle",
                  on: !straddleOn,
                  amt: straddleAmt,
                })
              }
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
                onChange={(e) =>
                  dispatch({
                    type: "setStraddle",
                    on: true,
                    amt: Number(e.target.value),
                  })
                }
                className="w-16 h-9 text-sm text-center"
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Begin
          </span>
          <Button
            onClick={onStart}
            disabled={!heroOk}
            size="lg"
            style={{ background: EMERALD, color: BG, fontWeight: 600 }}
            className="hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50"
          >
            Start hand <ChevronRight />
          </Button>
        </div>
      </div>
      {!heroOk && (
        <div className="text-center text-[12px] text-zinc-500 mt-3">
          Click your two hole cards to start.
        </div>
      )}
    </div>
  );
}

function ActionLog({
  state,
  derivedTotalPot,
}: {
  state: RecorderState;
  derivedTotalPot: number;
}) {
  if (!state.actions.length && state.phase === "setup") return null;
  const grouped = (["preflop", "flop", "turn", "river"] as const)
    .map((ph) => ({
      street: ph,
      acts: state.actions.filter((a) => a.street === ph),
    }))
    .filter((g) => g.acts.length);

  return (
    <div className="rounded-xl border border-white/10 bg-[oklch(0.205_0_0)] px-4 py-3 w-full max-w-[1100px] max-h-[180px] overflow-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Action log
        </span>
        <span className="text-[11px] text-zinc-500 tabular-nums">
          pot ${derivedTotalPot}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {grouped.map(({ street, acts }) => (
          <div key={street} className="flex items-start gap-3">
            <span
              className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.16em] shrink-0"
              style={{
                background: "oklch(1 0 0 / 0.05)",
                color: "oklch(0.708 0 0)",
                border: "1px solid oklch(1 0 0 / 0.08)",
              }}
            >
              {street}
            </span>
            <div className="text-[13px] text-zinc-200 leading-snug">
              {acts.map((a) => formatAction(a, state.playerCount)).join(" · ")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Recorder() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(6));
  const derived = useMemo(() => deriveStreet(state), [state]);

  // Used cards (so the picker greys out duplicates)
  const usedCards = useMemo(() => {
    const s = new Set<string>();
    state.players.forEach((p) => p.cards?.forEach((c) => c && s.add(c)));
    state.board.forEach((c) => c && s.add(c));
    return s;
  }, [state.players, state.board]);

  const seatPositions = Array.from(
    { length: state.playerCount },
    (_, i) => seatXY(i, state.playerCount),
  );
  const posNames = POSITION_NAMES[state.playerCount];
  const btnIdx = 0;

  const setupPot =
    state.sb +
    state.bb +
    (state.straddleOn && state.playerCount >= 4 ? state.straddleAmt : 0);
  const pot =
    state.phase === "setup"
      ? setupPot
      : derived?.totalPot ?? totalPot(state);

  // Setup-phase blind/straddle bubbles
  const setupBets = useMemo(() => {
    if (state.phase !== "setup") return null;
    const b: Record<number, number> = {};
    if (state.playerCount === 2) {
      b[0] = state.sb;
      b[1] = state.bb;
    } else {
      b[1] = state.sb;
      b[2] = state.bb;
      if (state.straddleOn && state.playerCount >= 4) b[3] = state.straddleAmt;
    }
    return b;
  }, [
    state.phase,
    state.playerCount,
    state.sb,
    state.bb,
    state.straddleOn,
    state.straddleAmt,
  ]);

  const playBets = derived?.bets || {};
  const folded = derived?.folded || new Set<number>();
  const activeSeat = derived?.activeSeat;

  const flopFilled = !!(state.board[0] && state.board[1] && state.board[2]);
  const turnFilled = !!state.board[3];
  const riverFilled = !!state.board[4];

  // Auto-advance street once cards are filled.
  useEffect(() => {
    if (!derived || !derived.streetClosed) return;
    if (state.phase === "preflop" && flopFilled) dispatch({ type: "advanceStreet" });
    else if (state.phase === "flop" && turnFilled) dispatch({ type: "advanceStreet" });
    else if (state.phase === "turn" && riverFilled) dispatch({ type: "advanceStreet" });
  }, [flopFilled, turnFilled, riverFilled, derived?.streetClosed, derived, state.phase]);

  // Hand-over → showdown
  useEffect(() => {
    if (!derived) return;
    if (derived.handOver) {
      const t = setTimeout(() => dispatch({ type: "goShowdown" }), 250);
      return () => clearTimeout(t);
    }
  }, [derived?.handOver, derived]);

  const dealCTA = (() => {
    if (!derived || !derived.streetClosed) return null;
    if (state.phase === "preflop" && !flopFilled) return { label: "Deal flop", showdown: false };
    if (state.phase === "flop" && !turnFilled) return { label: "Deal turn", showdown: false };
    if (state.phase === "turn" && !riverFilled) return { label: "Deal river", showdown: false };
    if (state.phase === "river") return { label: "Go to showdown", showdown: true };
    return null;
  })();

  const saveHand = (winnerSeat: number | null) => {
    const hands: SavedHand[] = JSON.parse(localStorage.getItem("smh:hands") || "[]");
    const finalPot = totalPot(state);
    const heroPaid = state.actions
      .filter(
        (a: Action) =>
          a.seat === 0 && (a.action === "call" || a.action === "bet" || a.action === "raise"),
      )
      .reduce((sum, a) => sum + (a.amount ?? 0), 0);
    const result = winnerSeat === 0 ? finalPot : -heroPaid;
    const id = Math.random().toString(36).slice(2, 8);
    const board = state.board.filter((c): c is string => Boolean(c));
    const padded: string[] = [...board];
    while (padded.length < 5) padded.push("—");

    const newHand: SavedHand = {
      id,
      name: "Untitled hand",
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "2-digit",
      }),
      stakes: `${state.sb}/${state.bb}`,
      loc: "—",
      positions: `${posNames[0]} vs others`,
      board: padded,
      type: "SRP",
      tags: [],
      result,
      fav: false,
      _full: {
        players: state.players,
        actions: state.actions,
        board: state.board,
        sb: state.sb,
        bb: state.bb,
        playerCount: state.playerCount,
        straddleOn: state.straddleOn,
        straddleAmt: state.straddleAmt,
      },
    };
    hands.unshift(newHand);
    localStorage.setItem("smh:hands", JSON.stringify(hands));
    router.push("/dashboard");
  };

  const phaseLabel =
    state.phase === "setup"
      ? "draft · setup"
      : state.phase === "showdown" || state.phase === "done"
        ? "draft · showdown"
        : `draft · ${state.phase}`;

  return (
    <Shell
      header={
        <Header
          title=""
          back="Dashboard"
          backHref="/dashboard"
          right={
            <>
              <span className="text-xs font-mono text-muted-foreground">
                {phaseLabel}
              </span>
              <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => saveHand(null)}
                disabled={state.actions.length === 0}
                style={{ background: EMERALD, color: BG, fontWeight: 600 }}
                className="hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50"
              >
                Save hand
              </Button>
            </>
          }
        />
      }
    >
      <div className="flex-1 flex flex-col items-center px-6 py-8 gap-6 max-w-[1600px] w-full mx-auto">
        <div className="flex items-center gap-3 self-start">
          <h2 className="text-xl font-semibold tracking-tight">New hand</h2>
          <span className="text-sm text-muted-foreground">
            {state.phase === "setup"
              ? "· set up the table, then start the hand"
              : `· ${state.phase}`}
          </span>
        </div>

        {/* Table */}
        <TableSurface>
          {/* Pot + board */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
            style={{ transform: "translateY(-34px)" }}
          >
            <span
              className="px-3 h-8 inline-flex items-center rounded-lg text-[18px] font-semibold tabular-nums text-white pointer-events-none"
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
                const c = state.board[i];
                return (
                  <CardSlot
                    key={i}
                    card={c}
                    size="md"
                    disabled={state.phase === "setup"}
                    used={usedCards}
                    onPick={(card) => dispatch({ type: "setBoard", idx: i, card })}
                    onClear={
                      c ? () => dispatch({ type: "clearCard", card: c }) : undefined
                    }
                    label={`Board card ${i + 1}`}
                  />
                );
              })}
            </div>
            <span className="text-white/15 font-medium tracking-[0.28em] uppercase text-[10px] pointer-events-none">
              savemyhands
            </span>
          </div>

          <DealerButtonChip seatPos={seatPositions[btnIdx]} />

          {/* Bet bubbles */}
          {state.phase === "setup"
            ? Object.entries(setupBets || {}).map(([s, amt]) => (
                <BetBubble
                  key={s}
                  seatPos={seatPositions[Number(s)]}
                  amount={amt}
                />
              ))
            : Object.entries(playBets).map(([s, amt]) => {
                const seat = Number(s);
                if (!amt || folded.has(seat)) return null;
                return (
                  <BetBubble
                    key={seat}
                    seatPos={seatPositions[seat]}
                    amount={amt}
                  />
                );
              })}

          {/* Seats */}
          {seatPositions.map((p, i) => {
            const player: Player = state.players[i];
            const isFolded = folded.has(i);
            const isActive =
              activeSeat === i &&
              state.phase !== "setup" &&
              state.phase !== "showdown";
            const cards = player.cards;
            return (
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
                    {posNames[i]}
                  </span>
                  <NameDisplay
                    value={player.name}
                    onCommit={(n) =>
                      dispatch({ type: "updatePlayer", seat: i, patch: { name: n } })
                    }
                    placeholder={i === 0 ? "Hero" : "Player"}
                  />
                  <StackDisplay
                    value={player.stack}
                    onCommit={(n) =>
                      dispatch({ type: "updatePlayer", seat: i, patch: { stack: n } })
                    }
                  />
                  {isFolded && (
                    <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.55_0.005_60)] leading-none">
                      Folded
                    </span>
                  )}
                </div>
                {/* Hole cards */}
                {i === 0 ? (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 -top-24 flex gap-1.5"
                    style={{ opacity: isFolded ? 0.3 : 1 }}
                  >
                    {[0, 1].map((j) => (
                      <CardSlot
                        key={j}
                        card={cards?.[j]}
                        size="md"
                        used={usedCards}
                        onPick={(c) =>
                          dispatch({ type: "setHeroCard", idx: j as 0 | 1, card: c })
                        }
                        onClear={
                          cards?.[j]
                            ? () => dispatch({ type: "clearCard", card: cards[j]! })
                            : undefined
                        }
                        label={`Hero card ${j + 1}`}
                      />
                    ))}
                  </div>
                ) : (
                  !isFolded && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 -top-14 flex gap-1"
                      style={{ opacity: isFolded ? 0.3 : 1 }}
                    >
                      {[0, 1].map((j) => {
                        const c = cards?.[j];
                        return c ? (
                          <CardSlot
                            key={j}
                            card={c}
                            size="sm"
                            used={usedCards}
                            onPick={(card) =>
                              dispatch({
                                type: "setOppCard",
                                seat: i,
                                idx: j as 0 | 1,
                                card,
                              })
                            }
                            onClear={() => dispatch({ type: "clearCard", card: c })}
                          />
                        ) : (
                          <CardSlot
                            key={j}
                            card={"__face_down__"}
                            faceDown
                            size="sm"
                            used={usedCards}
                            onPick={(card) =>
                              dispatch({
                                type: "setOppCard",
                                seat: i,
                                idx: j as 0 | 1,
                                card,
                              })
                            }
                            label={`Reveal ${posNames[i]}'s card ${j + 1}`}
                          />
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </TableSurface>

        {/* Action log */}
        {state.phase !== "setup" && state.actions.length > 0 && (
          <ActionLog
            state={state}
            derivedTotalPot={derived?.totalPot ?? totalPot(state)}
          />
        )}

        {/* Bottom controls */}
        {state.phase === "setup" && (
          <SetupBar
            state={state}
            dispatch={dispatch}
            onStart={() => dispatch({ type: "startPlay" })}
          />
        )}

        {state.phase !== "setup" &&
          state.phase !== "showdown" &&
          state.phase !== "done" &&
          derived && (
            <>
              {derived.handOver ? null : !derived.streetClosed ? (
                <ActionBar
                  key={`${state.phase}-${derived.activeSeat}-${derived.minRaise}`}
                  derived={derived}
                  state={state}
                  dispatch={dispatch}
                />
              ) : (
                dealCTA && (
                  <div
                    className="rounded-2xl border border-[oklch(0.696_0.205_155_/_0.4)] px-5 py-4 flex items-center gap-4 flex-wrap"
                    style={{
                      background: "oklch(0.696 0.205 155 / 0.08)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    }}
                  >
                    <Check
                      size={16}
                      className="text-[oklch(0.795_0.184_155)]"
                    />
                    <span className="text-[14px] font-medium text-zinc-100">
                      Betting round complete.
                    </span>
                    {dealCTA.showdown ? (
                      <Button
                        onClick={() => dispatch({ type: "goShowdown" })}
                        size="lg"
                        style={{ background: EMERALD, color: BG, fontWeight: 600 }}
                        className="hover:!bg-[oklch(0.745_0.198_155)]"
                      >
                        Go to showdown <ChevronRight />
                      </Button>
                    ) : (
                      <span className="text-[13px] text-zinc-400">
                        Click the next board slot to {dealCTA.label.toLowerCase()}.
                      </span>
                    )}
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dispatch({ type: "undoAction" })}
                    >
                      <RotateCcw /> Undo last
                    </Button>
                  </div>
                )
              )}
            </>
          )}

        {(state.phase === "showdown" || state.phase === "done") && (
          <div
            className="rounded-2xl border border-[oklch(0.696_0.205_155_/_0.4)] px-6 py-5 flex flex-col gap-4 w-full max-w-[820px]"
            style={{ background: "oklch(0.696 0.205 155 / 0.06)" }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="px-2 h-6 inline-flex items-center rounded-md text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  background: "oklch(0.696 0.205 155 / 0.18)",
                  color: EMERALD_HOVER,
                  border: "1px solid oklch(0.696 0.205 155 / 0.4)",
                }}
              >
                Showdown
              </span>
              <span className="text-[14px] text-zinc-200">
                {derived?.handOver
                  ? "All others folded."
                  : "Reveal opponent hands by clicking their cards above."}
              </span>
              <div className="flex-1" />
              <span className="text-[14px] tabular-nums text-zinc-300">
                Pot ${derived?.totalPot ?? totalPot(state)}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] text-zinc-400 mr-2">Winner:</span>
              {state.players
                .filter((p) => !folded.has(p.seat))
                .map((p) => (
                  <Button
                    key={p.seat}
                    variant="outline"
                    size="sm"
                    onClick={() => saveHand(p.seat)}
                  >
                    <Check /> {posNames[p.seat]} {p.name && `(${p.name})`}
                  </Button>
                ))}
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: "undoAction" })}
              >
                <RotateCcw /> Back
              </Button>
              <Button
                onClick={() => saveHand(null)}
                size="lg"
                style={{ background: EMERALD, color: BG, fontWeight: 600 }}
                className="hover:!bg-[oklch(0.745_0.198_155)]"
              >
                Save hand
              </Button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

// Re-export for callers that want the action types
export type { ActionType };
