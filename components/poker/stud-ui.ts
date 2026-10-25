import type { RecorderState } from "./engine";
import {
  STUD_STREETS, buildStudTimeline, deriveStudBetting, initialStudState,
  setStudStartingCards, updateStudPlayer, type StudLimitRules, type StudState,
} from "./stud-engine";
import type { StudReplayCard } from "./stud-replay";

export type StudDraft = { state: StudState; name: string; date: string; venue: string; notes: string };
export type StudSetupPatch = {
  playerCount?: number; heroSeat?: number; dealerSeat?: number;
  ante?: number; bringIn?: number; smallBet?: number; limitRules?: StudLimitRules;
};
export function studDraftFromCommunity(source: RecorderState): StudDraft {
  const playerCount = Math.min(8, source.playerCount);
  const heroSeat = Math.min(source.heroPosition, playerCount - 1);
  const state = initialStudState({ playerCount, heroSeat, smallBet: source.bb, bringIn: source.bb / 2, ante: source.bb / 8 });
  state.players = state.players.map((player) => ({ ...player,
    name: source.players[player.seat === heroSeat ? source.heroPosition : player.seat]?.name ?? player.name,
    stack: source.players[player.seat === heroSeat ? source.heroPosition : player.seat]?.stack ?? player.stack,
  }));
  return { state, name: source.handName, date: source.date, venue: source.venue, notes: source.notes };
}
/** Move the hero's three-card holding/profile together, retaining door
 * cards at all other seats. One setup edit is one undo operation. */
export function changeStudSetup(state: StudState, patch: StudSetupPatch): StudState {
  if (state.phase !== "setup") throw new Error("Setup is locked during play");
  const playerCount = patch.playerCount ?? state.playerCount;
  const heroSeat = Math.min(patch.heroSeat ?? state.heroSeat, playerCount - 1);
  let next = initialStudState({ variant: state.variant, playerCount, heroSeat, dealerSeat: Math.min(patch.dealerSeat ?? state.dealerSeat, playerCount - 1),
    ante: patch.ante ?? state.ante, bringIn: patch.bringIn ?? state.bringIn, smallBet: patch.smallBet ?? state.smallBet,
    limitRules: patch.limitRules ?? state.limitRules,
  });
  if (next.playerCount === state.playerCount && next.heroSeat === state.heroSeat && next.dealerSeat === state.dealerSeat &&
      next.ante === state.ante && next.bringIn === state.bringIn && next.smallBet === state.smallBet &&
      next.limitRules.maxBets === state.limitRules.maxBets && next.limitRules.headsUpUncapped === state.limitRules.headsUpUncapped &&
      next.limitRules.fourthStreetBigBet === state.limitRules.fourthStreetBigBet) return state;
  for (let seat = 0; seat < playerCount; seat++) {
    const source = seat === heroSeat ? state.players[state.heroSeat] : seat === state.heroSeat ? state.players[heroSeat] : state.players[seat];
    if (!source) continue;
    next = updateStudPlayer(next, seat, { name: source.name, stack: source.stack });
    next = setStudStartingCards(next, seat, source.cards.map((slot) => slot.card ?? null));
  }
  const { history, ...core } = structuredClone(state);
  return { ...next, history: [...history, core] };
}
export function missingStudSetupSeats(state: StudState): number[] {
  return state.players.filter((player) => player.seat === state.heroSeat ? player.cards.some((slot) => !slot.card) : !player.cards[2].card).map((player) => player.seat);
}
export function studSizing(state: StudState, betting: NonNullable<ReturnType<typeof deriveStudBetting>>) {
  const remaining = betting.activeSeat === null ? 0 : Math.max(0, state.players[betting.activeSeat].stack - (betting.committed[betting.activeSeat] ?? 0));
  const minimum = Math.min(betting.minRaise, betting.allInTarget);
  const bigTarget = betting.bigBetTarget === undefined ? undefined : Math.min(betting.bigBetTarget, betting.allInTarget);
  return { call: Math.min(betting.toCall, remaining), minimum,
    bigTarget: bigTarget !== minimum ? bigTarget : undefined,
    canRaise: betting.canRaise && minimum > betting.lastBet,
  };
}
export function studRecorderCards(state: StudState): Record<number, StudReplayCard[]> {
  const finished = state.phase === "showdown" || state.phase === "done";
  return Object.fromEntries(state.players.map((player) => [player.seat, Array.from({ length: 7 }, (_, index) => {
    const dealt = player.cards[index];
    const visibility = dealt?.visibility ?? (index < 2 || index === 6 ? "down" : "up");
    if (!dealt || state.muckedSeats.includes(player.seat)) return { present: false, visibility, faceUp: false };
    const card = finished && state.shownCards[player.seat]?.[index] ||
      (player.seat === state.heroSeat || visibility === "up" ? dealt.card : undefined);
    return { present: state.phase !== "setup" || !!card || visibility === "down" && player.seat !== state.heroSeat,
      visibility, faceUp: !!card, ...(card ? { card } : {}) };
  })]));
}
export function nextStudPhaseLabel(state: StudState, handOver: boolean): string {
  if (handOver) return "Confirm result";
  if (state.street === "seventh-street") return "Go to showdown";
  return `Deal ${STUD_STREETS[STUD_STREETS.indexOf(state.street) + 1].replace("-", " ")}`;
}
export function studStakesLabel(state: Pick<StudState, "smallBet" | "ante" | "bringIn">): string {
  return `$${state.smallBet}/$${state.smallBet * 2} FL · $${state.ante} ante · $${state.bringIn} bring-in`;
}
export function studLogEntries(state: StudState) {
  return buildStudTimeline(state).map((event) => ({ id: event.id, round: event.round,
    seat: "seat" in event ? event.seat : undefined,
    label: event.type === "deal" ? event.visibility === "up" ? `dealt ${event.card}` : "dealt a downcard"
      : event.type === "shared-deal" ? `Shared seventh card ${event.card}`
      : event.type === "forced-bet" ? `${event.kind} $${event.amount}`
      : event.type === "action" ? `${event.action}${event.amount !== undefined ? ` to $${event.amount}` : ""}`
      : event.type === "show" ? "shows" : "mucks",
  }));
}
