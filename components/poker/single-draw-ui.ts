import type { RecorderState } from "./engine";
import {
  initialSingleDrawState,
  type DerivedDrawBetting,
  type SingleDrawState,
} from "./single-draw-engine";

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
  patch: { playerCount?: number; heroSeat?: number; sb?: number; bb?: number },
): SingleDrawState {
  if (state.phase !== "setup") throw new Error("Setup is locked during play");
  const playerCount = patch.playerCount ?? state.playerCount;
  const heroSeat = Math.min(patch.heroSeat ?? state.heroSeat, playerCount - 1);
  const next = initialSingleDrawState({ playerCount, heroSeat, sb: patch.sb ?? state.sb, bb: patch.bb ?? state.bb });
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
export function knownSingleDrawCards(state: SingleDrawState, editingSeat?: number): Set<string> {
  const used = new Set<string>();
  for (const player of state.players) {
    if (player.seat === editingSeat) continue;
    for (const card of [...(player.startingCards ?? []), ...(player.cards ?? [])]) if (card) used.add(card);
  }
  for (const draw of state.draws) {
    for (const card of draw.discardedCards ?? []) used.add(card);
    if (draw.seat !== editingSeat) for (const card of draw.replacementCards ?? []) used.add(card);
  }
  return used;
}

export function singleDrawSizing(state: SingleDrawState, betting: DerivedDrawBetting) {
  const seat = betting.activeSeat;
  const remaining = seat === null ? 0 : Math.max(0,
    state.players[seat].stack - (betting.committed[seat] ?? 0));
  const maximum = seat === null ? 0 : (betting.bets[seat] ?? 0) + remaining;
  return {
    minimum: Math.min(betting.minRaise, maximum),
    maximum,
    call: Math.min(betting.toCall, remaining),
    canRaise: seat !== null && maximum > betting.lastBet && betting.canRaise,
  };
}

export function drawRoundLabel(round: string): string {
  return ({ "initial-deal": "Deal", setup: "Setup", predraw: "Predraw", draw: "Draw",
    "draw-1": "Draw", postdraw: "Postdraw", showdown: "Showdown", done: "Result" } as Record<string, string>)[round] ?? round;
}
