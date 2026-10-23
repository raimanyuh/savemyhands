import type { RecorderState } from "./engine";
import {
  initialSingleDrawState,
  type DerivedDrawBetting,
  type SingleDrawState,
  type DrawLimitRules,
  unavailableDrawCards,
  buildSingleDrawTimeline,
} from "./single-draw-engine";
import type { DrawVariant } from "./game-format";

export type SingleDrawDraft = {
  state: SingleDrawState;
  name: string;
  date: string;
  venue: string;
  notes: string;
};

export function singleDrawDraftFromCommunity(source: RecorderState): SingleDrawDraft {
  const playerCount = Math.min(8, source.playerCount);
  const heroSeat = Math.min(source.heroPosition, playerCount - 1);
  const state = initialSingleDrawState({ playerCount, heroSeat, sb: source.sb, bb: source.bb });
  state.players = state.players.map((player) => ({
    ...player,
    name: source.players[player.seat === heroSeat ? source.heroPosition : player.seat]?.name ?? player.name,
    stack: source.players[player.seat === heroSeat ? source.heroPosition : player.seat]?.stack ?? player.stack,
  }));
  return { state, name: source.handName, date: source.date, venue: source.venue, notes: source.notes };
}

/** Setup changes preserve names, stacks and the hero's five-card holding. */
export function changeSingleDrawSetup(
  state: SingleDrawState,
  patch: { playerCount?: number; heroSeat?: number; sb?: number; bb?: number; variant?: DrawVariant; limitRules?: DrawLimitRules },
): SingleDrawState {
  if (state.phase !== "setup") throw new Error("Setup is locked during play");
  const playerCount = patch.playerCount ?? state.playerCount;
  const heroSeat = Math.min(patch.heroSeat ?? state.heroSeat, playerCount - 1);
  const next = initialSingleDrawState({ playerCount, heroSeat, sb: patch.sb ?? state.sb, bb: patch.bb ?? state.bb,
    variant: patch.variant ?? state.variant, limitRules: patch.limitRules ?? state.limitRules });
  const oldHero = state.players[state.heroSeat];
  next.players = next.players.map((player) => {
    const previous = player.seat === heroSeat ? oldHero
      : player.seat === state.heroSeat ? state.players[heroSeat] : state.players[player.seat];
    return {
      ...player, name: previous?.name ?? player.name, stack: previous?.stack ?? player.stack,
      cards: player.seat === heroSeat && oldHero.cards ? [...oldHero.cards] : null,
      startingCards: player.seat === heroSeat && oldHero.startingCards ? [...oldHero.startingCards] : null,
    };
  });
  return next;
}

/** Discarded cards stay unavailable, including while entering showdown hands. */
export function knownSingleDrawCards(state: SingleDrawState, editingSeat?: number, reshuffleBefore = false): Set<string> {
  return unavailableDrawCards(state, editingSeat, reshuffleBefore);
}

export function singleDrawSizing(state: SingleDrawState, betting: DerivedDrawBetting) {
  const seat = betting.activeSeat;
  const remaining = seat === null ? 0 : Math.max(0,
    state.players[seat].stack - (betting.committed[seat] ?? 0));
  const allIn = seat === null ? 0 : (betting.bets[seat] ?? 0) + remaining;
  const maximum = betting.limitBet ? Math.min(allIn, betting.minRaise) : allIn;
  return {
    minimum: Math.min(betting.minRaise, maximum),
    maximum,
    call: Math.min(betting.toCall, remaining),
    canRaise: seat !== null && maximum > betting.lastBet && betting.canRaise,
  };
}

export function drawRoundLabel(round: string, state?: SingleDrawState): string {
  if (/^(third|fourth|fifth|sixth|seventh)-street$/.test(round)) return round[0].toUpperCase() + round.slice(1).replace("-", " ");
  if (state?.variant === "2-7_TRIPLE_DRAW") {
    if (round === "draw") return `Draw ${state.drawNumber} of 3`;
    if (round === "postdraw") return `After draw ${state.drawNumber}`;
  }
  if (/^draw-[123]$/.test(round)) return `Draw ${round.slice(-1)}`;
  if (/^postdraw-[123]$/.test(round)) return `After draw ${round.slice(-1)}`;
  return ({ "initial-deal": "Deal", setup: "Setup", predraw: "Predraw", draw: "Draw",
    "draw-1": "Draw", postdraw: "Postdraw", showdown: "Showdown", done: "Result" } as Record<string, string>)[round] ?? round;
}

export function drawGameLabel(variant: DrawVariant): string {
  return variant === "2-7_TRIPLE_DRAW" ? "2–7 Triple Draw" : "2–7 Single Draw";
}

export function nextDrawPhaseLabel(state: SingleDrawState, handOver: boolean): string {
  if (handOver) return "Confirm result";
  if (state.phase === "predraw") return state.variant === "2-7_TRIPLE_DRAW" ? "Go to draw 1" : "Go to draw";
  if (state.variant === "2-7_TRIPLE_DRAW" && state.drawNumber < 3) return `Go to draw ${state.drawNumber + 1}`;
  return "Go to showdown";
}

export function drawStakesLabel(state: Pick<SingleDrawState, "variant" | "sb" | "bb">): string {
  return state.variant === "2-7_TRIPLE_DRAW" ? `$${state.bb}/$${state.bb * 2} limit` : `$${state.sb}/$${state.bb}`;
}

export function drawLogEntries(state: SingleDrawState) {
  return buildSingleDrawTimeline(state).flatMap((event) => event.type === "action" || event.type === "draw" ? [{
    id: event.id, round: event.round, seat: event.seat,
    label: event.type === "draw" ? `${event.reshuffleBefore ? "Reshuffle · " : ""}${event.count ? `draws ${event.count}` : "stands pat"}`
      : `${event.action}${event.amount !== undefined ? ` $${event.amount}` : ""}`,
  }] : []);
}
