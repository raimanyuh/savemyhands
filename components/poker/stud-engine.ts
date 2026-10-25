// Stud High, Razz and Stud/8 domain. Each variant stays hidden until its
// save/replay/UI adapters are complete. Seat numbers run clockwise; unlike
// the community engine, they carry no blind/position semantics.
import type { ActionType, SidePot } from "./engine";
import type { CardId, CardVisibility, HandTimelineEvent } from "./game-format";
import { compareHands, evaluateBest, type HandScore } from "./hand-eval";
import { aceToFiveBoardScore, compareAceToFive, evaluateBestAceToFive } from "./ace-to-five-eval";
import { evaluateBestEightOrBetter } from "./eight-or-better-eval";

export const STUD_STREETS = ["third-street", "fourth-street", "fifth-street", "sixth-street", "seventh-street"] as const;
export type StudStreet = typeof STUD_STREETS[number];
export type StudPhase = "setup" | "deal" | "betting" | "showdown" | "done";
export type StudCard = { card?: CardId; visibility: CardVisibility };
export type StudLimitRules = {
  maxBets: 4 | 5;
  headsUpUncapped: boolean;
  fourthStreetBigBet: boolean;
};
export type StudPlayer = { seat: number; name: string; stack: number; cards: StudCard[] };
export type StudEngineVariant = "STUD_HIGH" | "RAZZ" | "STUD_HILO_8";
export type StudCoreState = {
  variant: StudEngineVariant;
  phase: StudPhase;
  street: StudStreet;
  playerCount: number;
  heroSeat: number;
  /** Last seat to receive cards; used only for deal order and tied boards. */
  dealerSeat: number;
  ante: number;
  bringIn: number;
  smallBet: number;
  limitRules: StudLimitRules;
  players: StudPlayer[];
  events: HandTimelineEvent[];
  shownCards: Record<number, CardId[]>;
  muckedSeats: number[];
  /** Read compatibility for histories saved before individual-only rivers. */
  sharedSeventh?: CardId;
};
export type StudState = StudCoreState & { history: StudCoreState[] };

const RANKS = "23456789TJQKA";
const SUITS = "♣♦♥♠";
const EPSILON = 1e-8;
const close = (a: number, b: number) => Math.abs(a - b) < EPSILON;
const sum = (amounts: Record<number, number>) => Object.values(amounts).reduce((a, b) => a + b, 0);

function assertCard(card: string) {
  if (!/^[2-9TJQKA][♣♦♥♠]$/u.test(card)) throw new Error(`Invalid card: ${card}`);
}
function assertSeat(state: StudCoreState, seat: number) {
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.playerCount) throw new Error("Seat is outside the table");
}
function clockwise(state: Pick<StudCoreState, "playerCount">, first: number): number[] {
  return Array.from({ length: state.playerCount }, (_, i) => (first + i) % state.playerCount);
}
function coreOf(state: StudState): StudCoreState {
  const { history, ...core } = state;
  void history;
  return structuredClone(core);
}
function commit(state: StudState, next: StudCoreState): StudState {
  return { ...next, history: [...state.history, coreOf(state)] };
}
export function undoStud(state: StudState): StudState {
  const previous = state.history.at(-1);
  return previous ? { ...structuredClone(previous), history: state.history.slice(0, -1) } : state;
}

export function initialStudState(args: {
  variant?: StudEngineVariant;
  playerCount?: number; heroSeat?: number; dealerSeat?: number; stack?: number;
  ante?: number; bringIn?: number; smallBet?: number; limitRules?: StudLimitRules;
} = {}): StudState {
  const variant = args.variant ?? "STUD_HIGH";
  if (variant !== "STUD_HIGH" && variant !== "RAZZ" && variant !== "STUD_HILO_8") throw new Error("Unsupported Stud variant");
  const playerCount = args.playerCount ?? 6;
  const heroSeat = args.heroSeat ?? 0;
  const dealerSeat = args.dealerSeat ?? playerCount - 1;
  const stack = args.stack ?? 200;
  const ante = args.ante ?? .25;
  const bringIn = args.bringIn ?? 1;
  const smallBet = args.smallBet ?? 2;
  const limitRules = args.limitRules ?? { maxBets: 4, headsUpUncapped: false, fourthStreetBigBet: true };
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 8) throw new Error("Stud supports 2 to 8 players");
  if (![heroSeat, dealerSeat].every((seat) => Number.isInteger(seat) && seat >= 0 && seat < playerCount)) throw new Error("Seat is outside the table");
  if (![stack, ante, bringIn, smallBet].every(Number.isFinite) || stack <= 0 || ante < 0 || bringIn <= 0 || bringIn > smallBet) throw new Error("Invalid Stud stakes or stack");
  if (![4, 5].includes(limitRules.maxBets)) throw new Error("Choose a four- or five-bet cap");
  return {
    variant, phase: "setup", street: "third-street", playerCount, heroSeat, dealerSeat,
    ante, bringIn, smallBet, limitRules: { ...limitRules, fourthStreetBigBet: variant === "STUD_HIGH" && limitRules.fourthStreetBigBet }, events: [], shownCards: {}, muckedSeats: [], history: [],
    players: Array.from({ length: playerCount }, (_, seat) => ({
      seat, name: seat === heroSeat ? "Hero" : "", stack,
      cards: [{ visibility: "down" }, { visibility: "down" }, { visibility: "up" }],
    })),
  };
}

/** All known cards stay dead, including folded boards and hero hole cards. */
export function unavailableStudCards(state: StudCoreState, editingSeat?: number): Set<CardId> {
  const used = new Set<CardId>();
  for (const player of state.players) {
    if (player.seat === editingSeat) continue;
    for (const card of state.shownCards[player.seat] ?? player.cards.map((slot) => slot.card)) if (card) used.add(card);
  }
  if (state.sharedSeventh) used.add(state.sharedSeventh);
  return used;
}
function assertUniqueCards(state: StudCoreState) {
  const used = new Set<CardId>();
  for (const player of state.players) for (const slot of player.cards) if (slot.card) {
    assertCard(slot.card);
    if (used.has(slot.card)) throw new Error(`Card is already in use: ${slot.card}`);
    used.add(slot.card);
  }
  if (state.sharedSeventh && used.has(state.sharedSeventh)) throw new Error(`Card is already in use: ${state.sharedSeventh}`);
}
export function setStudStartingCards(state: StudState, seat: number, cards: (CardId | null)[]): StudState {
  if (state.phase !== "setup") throw new Error("Starting cards are locked");
  assertSeat(state, seat);
  if (cards.length !== 3) throw new Error("Third street needs three card slots");
  if (seat !== state.heroSeat && (cards[0] || cards[1])) throw new Error("Opponent downcards stay unknown until showdown");
  const next = coreOf(state);
  next.players[seat].cards = cards.map((card, i) => ({ visibility: i === 2 ? "up" : "down", ...(card ? { card } : {}) }));
  assertUniqueCards(next);
  return commit(state, next);
}
export function updateStudPlayer(state: StudState, seat: number, patch: { name?: string; stack?: number }): StudState {
  if (state.phase !== "setup") throw new Error("Player setup is locked");
  assertSeat(state, seat);
  if (patch.stack !== undefined && (!Number.isFinite(patch.stack) || patch.stack <= 0)) throw new Error("Starting stack must be positive");
  const next = coreOf(state);
  next.players[seat] = { ...next.players[seat], ...patch };
  return commit(state, next);
}
export function studBringInSeat(state: StudCoreState): number | null {
  const order = clockwise(state, (state.dealerSeat + 1) % state.playerCount);
  if (state.players.some((player) => !player.cards[2]?.card)) return null;
  const ranks = state.variant === "RAZZ" ? "A23456789TJQK" : RANKS;
  const opening = [...order].sort((a, b) => {
    const ca = state.players[a].cards[2].card!;
    const cb = state.players[b].cards[2].card!;
    const comparison = ranks.indexOf(ca[0]) - ranks.indexOf(cb[0]) || SUITS.indexOf(ca[1]) - SUITS.indexOf(cb[1]);
    return state.variant === "RAZZ" ? -comparison : comparison;
  })[0];
  // An ante-all-in cannot post. Move clockwise, regardless of upcard rank.
  return clockwise(state, opening).find((seat) => state.players[seat].stack > state.ante) ?? null;
}
export function startStudHand(state: StudState, options: { complete?: boolean } = {}): StudState {
  if (state.phase !== "setup") throw new Error("The hand has already started");
  if (state.players[state.heroSeat].cards.some((slot) => !slot.card)) throw new Error("Choose all three hero cards");
  if (state.players.some((player) => !player.cards[2]?.card)) throw new Error("Choose every door card");
  assertUniqueCards(state);
  const next = coreOf(state);
  next.phase = "betting";
  const order = clockwise(state, (state.dealerSeat + 1) % state.playerCount);
  for (const seat of order) if (state.ante > 0) next.events.push({
    id: `ante-seat-${seat}`, round: "third-street", type: "forced-bet", kind: "ante", seat,
    amount: Math.min(state.ante, state.players[seat].stack),
  });
  for (let cardIndex = 0; cardIndex < 3; cardIndex++) for (const seat of order) next.events.push({
    id: `deal-third-street-seat-${seat}-card-${cardIndex}`, round: "third-street", type: "deal", seat, cardIndex,
    ...next.players[seat].cards[cardIndex],
  });
  const seat = studBringInSeat(state);
  if (seat !== null) next.events.push({
    id: "third-street-opening", round: "third-street", type: "forced-bet", seat,
    kind: options.complete ? "completion" : "bring-in",
    amount: Math.min(options.complete ? state.smallBet : state.bringIn, Math.max(0, state.players[seat].stack - state.ante)),
  });
  return commit(state, next);
}

function foldedBefore(state: StudCoreState, street?: StudStreet): Set<number> {
  const index = street ? STUD_STREETS.indexOf(street) : STUD_STREETS.length;
  return new Set(state.events.flatMap((event) => event.type === "action" && event.action === "fold" && STUD_STREETS.indexOf(event.round as StudStreet) < index ? [event.seat] : []));
}
/** High boards prefer pairs/trips/quads, while Razz prefers unpaired low
 * boards with aces low. Equal boards use deal order, never suit. */
export function studBoardScore(cards: CardId[], variant: StudEngineVariant = "STUD_HIGH"): number[] {
  if (variant === "RAZZ") return aceToFiveBoardScore(cards);
  const counts = new Map<number, number>();
  for (const card of cards) {
    assertCard(card);
    const rank = RANKS.indexOf(card[0]) + 2;
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const category = groups[0]?.[1] === 4 ? 7 : groups[0]?.[1] === 3 ? groups[1]?.[1] === 2 ? 6 : 3
    : groups[0]?.[1] === 2 ? groups[1]?.[1] === 2 ? 2 : 1 : 0;
  return [category, ...groups.map(([rank]) => rank)];
}
function compareBoard(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
}
function boardAt(state: StudCoreState, seat: number, street: StudStreet): CardId[] {
  const count = Math.min(6, STUD_STREETS.indexOf(street) + 3);
  const cards = state.players[seat].cards.slice(2, count).flatMap((slot) => slot.card ? [slot.card] : []);
  if (street === "seventh-street" && state.sharedSeventh) cards.push(state.sharedSeventh);
  return cards;
}
export function studFirstToAct(state: StudCoreState, street = state.street): number | null {
  if (street === "third-street") {
    const opening = state.events.find((event) => event.type === "forced-bet" && event.kind !== "ante");
    return opening && "seat" in opening ? (opening.seat + 1) % state.playerCount : null;
  }
  const folded = foldedBefore(state, street);
  const order = clockwise(state, (state.dealerSeat + 1) % state.playerCount).filter((seat) => !folded.has(seat));
  return order.reduce<number | null>((best, seat) => {
    if (best === null) return seat;
    const comparison = compareBoard(studBoardScore(boardAt(state, seat, street), state.variant), studBoardScore(boardAt(state, best, street), state.variant));
    const better = state.variant === "RAZZ" ? comparison < 0 : comparison > 0;
    return better ? seat : best;
  }, null);
}
function fourthBigBetAvailable(state: StudCoreState, street: StudStreet): boolean {
  const folded = foldedBefore(state, street);
  return state.variant === "STUD_HIGH" && street === "fourth-street" && state.limitRules.fourthStreetBigBet && state.players.some((player) =>
    !folded.has(player.seat) && studBoardScore(boardAt(state, player.seat, street))[0] > 0);
}

function refundUncalled(bets: Record<number, number>): Record<number, number> {
  const sorted = Object.entries(bets).sort((a, b) => b[1] - a[1]);
  const refunds: Record<number, number> = {};
  if (sorted.length && sorted[0][1] > (sorted[1]?.[1] ?? 0)) {
    const seat = Number(sorted[0][0]);
    refunds[seat] = bets[seat] - (sorted[1]?.[1] ?? 0);
    bets[seat] -= refunds[seat];
  }
  return refunds;
}
function replayRound(state: StudCoreState, street: StudStreet, previous: Record<number, number>) {
  const bets: Record<number, number> = {};
  const acted = new Set<number>();
  const actedAtBet: Record<number, number> = {};
  let lastBet = 0;
  let fullTarget = 0;
  let betCount = 0;
  let unit = state.smallBet * (STUD_STREETS.indexOf(street) >= 2 ? 2 : 1);
  let lastActor: number | undefined;
  const cap = (seat: number, target: number) => Math.min(target, Math.max(0, state.players[seat].stack - (previous[seat] ?? 0)));
  for (const event of state.events) {
    if (event.round !== street) continue;
    if (event.type === "forced-bet" && event.kind !== "ante") {
      bets[event.seat] = cap(event.seat, event.amount);
      const canContest = state.players.filter((player) => player.stack > (previous[player.seat] ?? 0) + (bets[player.seat] ?? 0)).length >= 2;
      lastBet = canContest ? Math.max(event.amount, state.bringIn) : event.amount;
      if ((event.kind === "completion" && event.amount >= unit / 2 - EPSILON) || close(event.amount, unit)) { fullTarget = event.amount; betCount = 1; }
      // Posting the bring-in is the opening action, not a blind with a
      // later option. Calls around the table close third street.
      acted.add(event.seat);
      actedAtBet[event.seat] = lastBet;
      continue;
    }
    if (event.type !== "action") continue;
    const seat = event.seat;
    lastActor = seat;
    acted.add(seat);
    actedAtBet[seat] = lastBet;
    if (event.action === "fold" || event.action === "check") continue;
    if (event.action === "call") { bets[seat] = cap(seat, lastBet); continue; }
    const target = cap(seat, event.amount ?? 0);
    bets[seat] = target;
    const chosenUnit = event.limitBet ?? unit;
    // A short all-in that fits the smaller increment still plays at that
    // increment. An actual wager beyond it establishes the big-bet level.
    if (target - fullTarget > unit + EPSILON) unit = Math.max(unit, chosenUnit);
    if (target - fullTarget >= unit / 2 - EPSILON) {
      fullTarget = target;
      betCount++;
      acted.clear();
      acted.add(seat);
    }
    lastBet = Math.max(lastBet, target);
    actedAtBet[seat] = lastBet;
  }
  return { bets, lastBet, fullTarget, betCount, unit, acted, actedAtBet, lastActor };
}
/** Antes are dead money and are never refunded as an uncalled wager. */
export function studAccounting(state: StudCoreState, final = false) {
  const committed: Record<number, number> = {};
  const refunds: Partial<Record<StudStreet, Record<number, number>>> = {};
  for (const event of state.events) if (event.type === "forced-bet" && event.kind === "ante") committed[event.seat] = event.amount;
  for (const street of STUD_STREETS) {
    const { bets } = replayRound(state, street, committed);
    if (final || state.phase !== "betting" || street !== state.street) refunds[street] = refundUncalled(bets);
    for (const [seat, amount] of Object.entries(bets)) committed[Number(seat)] = (committed[Number(seat)] ?? 0) + amount;
  }
  return { committed, refunds, totalPot: sum(committed) };
}
export function deriveStudBetting(state: StudCoreState) {
  if (state.phase !== "betting") return null;
  const street = state.street;
  const previous: Record<number, number> = {};
  for (const event of state.events) if (event.type === "forced-bet" && event.kind === "ante") previous[event.seat] = event.amount;
  for (const earlier of STUD_STREETS) {
    if (earlier === street) break;
    const { bets } = replayRound(state, earlier, previous);
    refundUncalled(bets);
    for (const [seat, amount] of Object.entries(bets)) previous[Number(seat)] = (previous[Number(seat)] ?? 0) + amount;
  }
  const replay = replayRound(state, street, previous);
  const { bets, lastBet, fullTarget, unit, betCount, acted, actedAtBet, lastActor } = replay;
  const { committed, totalPot } = studAccounting(state);
  const folded = foldedBefore(state);
  const allIn = new Set(state.players.filter((player) => (committed[player.seat] ?? 0) >= player.stack - EPSILON).map((player) => player.seat));
  const order = clockwise(state, studFirstToAct(state) ?? 0);
  const actionable = order.filter((seat) => !folded.has(seat) && !allIn.has(seat));
  let needsAction = actionable.filter((seat) => (bets[seat] ?? 0) < lastBet - EPSILON || !acted.has(seat));
  const playersLeft = state.playerCount - folded.size;
  if (playersLeft <= 1 || actionable.length === 1 && (bets[actionable[0]] ?? 0) >= lastBet - EPSILON) needsAction = [];
  const rotation = lastActor === undefined ? order : clockwise(state, (lastActor + 1) % state.playerCount);
  const activeSeat = rotation.find((seat) => needsAction.includes(seat)) ?? null;
  const startFolded = foldedBefore(state, street);
  const forced = state.events.find((event) => event.round === street && event.type === "forced-bet" && event.kind !== "ante");
  const couldBetAtStart = state.players.filter((player) => !startFolded.has(player.seat) && player.stack > (previous[player.seat] ?? 0) + (forced && "seat" in forced && forced.seat === player.seat && forced.type === "forced-bet" ? forced.amount : 0) + EPSILON).length;
  const raiseCapped = !(state.limitRules.headsUpUncapped && couldBetAtStart === 2) && betCount >= state.limitRules.maxBets;
  const canRaise = activeSeat !== null && actionable.length > 1 && !raiseCapped && (!acted.has(activeSeat) || lastBet - (actedAtBet[activeSeat] ?? lastBet) >= unit / 2 - EPSILON);
  const minRaise = fullTarget + unit;
  const bigBetTarget = fourthBigBetAvailable(state, street) && unit < state.smallBet * 2 ? fullTarget + state.smallBet * 2 : undefined;
  const allInTarget = activeSeat === null ? 0 : (bets[activeSeat] ?? 0) + Math.max(0, state.players[activeSeat].stack - (committed[activeSeat] ?? 0));
  const legalRaiseTargets = canRaise ? [...new Set([minRaise, ...(bigBetTarget !== undefined ? [bigBetTarget] : [])].map((target) => Math.min(target, allInTarget)))].filter((target) => target > lastBet + EPSILON) : [];
  return {
    street, activeSeat, order, bets, committed, totalPot, lastBet, limitBet: unit, betCount, raiseCapped,
    folded, allIn, playersLeft, handOver: playersLeft <= 1, roundClosed: activeSeat === null,
    toCall: activeSeat === null ? 0 : Math.max(0, lastBet - (bets[activeSeat] ?? 0)),
    canCheck: activeSeat !== null && (bets[activeSeat] ?? 0) >= lastBet - EPSILON,
    canRaise: canRaise && legalRaiseTargets.length > 0, canComplete: street === "third-street" && fullTarget === 0 && lastBet > 0,
    minRaise, bigBetTarget, legalRaiseTargets, allInTarget,
  };
}

export function recordStudAction(state: StudState, input: { seat: number; action: ActionType; amount?: number; bigBet?: boolean }): StudState {
  const betting = deriveStudBetting(state);
  if (!betting || betting.activeSeat !== input.seat) throw new Error(`Seat ${betting?.activeSeat ?? "none"} must act next`);
  if (input.action === "check" && !betting.canCheck) throw new Error("Cannot check while facing a bet");
  if (input.action === "call" && betting.canCheck) throw new Error("Nothing to call");
  if (input.action === "bet" && betting.lastBet > 0) throw new Error("Use raise while facing a bet");
  if (input.action === "raise" && betting.lastBet === 0) throw new Error("Use bet when no bet exists");
  let amount: number | undefined;
  let limitBet: number | undefined;
  if (input.action === "bet" || input.action === "raise") {
    if (!betting.canRaise) throw new Error(betting.raiseCapped ? "Betting is capped" : "Betting has not reopened, or no opponent can respond");
    if (input.bigBet && betting.bigBetTarget === undefined) throw new Error("The fourth-street big bet is unavailable");
    const target = input.bigBet ? betting.bigBetTarget! : betting.minRaise;
    amount = Math.min(target, betting.allInTarget);
    if (input.amount === undefined || !Number.isFinite(input.amount) || !close(input.amount, amount)) throw new Error(`Fixed-limit wager must be to ${amount}`);
    limitBet = input.bigBet ? state.smallBet * 2 : betting.limitBet;
  }
  const next = coreOf(state);
  next.events.push({
    id: `action-${state.street}-${state.events.filter((event) => event.round === state.street && event.type === "action").length}`,
    round: state.street, type: "action", seat: input.seat, action: input.action,
    ...(amount !== undefined ? { amount, limitBet } : {}),
  });
  return commit(state, next);
}

export function pendingStudDealSeat(state: StudCoreState): number | null {
  if (state.phase !== "deal" || state.sharedSeventh) return null;
  const count = STUD_STREETS.indexOf(state.street) + 3;
  const folded = foldedBefore(state);
  return clockwise(state, (state.dealerSeat + 1) % state.playerCount).find((seat) => !folded.has(seat) && state.players[seat].cards.length < count) ?? null;
}
export function recordStudDeal(state: StudState, input: { seat: number; card?: CardId }): StudState {
  if (state.phase !== "deal" || pendingStudDealSeat(state) !== input.seat) throw new Error("Deal to the next live seat first");
  const visibility = state.street === "seventh-street" ? "down" : "up";
  if ((visibility === "up" || input.seat === state.heroSeat) && !input.card) throw new Error("This dealt card must be known");
  if (visibility === "down" && input.seat !== state.heroSeat && input.card) throw new Error("Opponent downcards stay unknown until showdown");
  if (input.card) {
    assertCard(input.card);
    if (unavailableStudCards(state).has(input.card)) throw new Error(`Card is already in use: ${input.card}`);
  }
  // Record individual cards without inferring deck exhaustion or reshuffles.
  // Anonymous downcards carry no invented identities; known cards stay unique.
  const next = coreOf(state);
  const cardIndex = next.players[input.seat].cards.length;
  const slot: StudCard = { visibility, ...(input.card ? { card: input.card } : {}) };
  next.players[input.seat].cards.push(slot);
  next.events.push({ id: `deal-${state.street}-seat-${input.seat}-card-${cardIndex}`, round: state.street, type: "deal", seat: input.seat, cardIndex, ...slot });
  return commit(state, next);
}
/** Legacy replay restoration only. New recorder flows deal individual rivers.
 * Keep the original shared event so existing saves do not change their result. */
export function restoreLegacyStudSharedSeventh(state: StudState, card: CardId): StudState {
  if (state.variant === "STUD_HILO_8") throw new Error("Stud/8 requires individual seventh cards");
  if (state.phase !== "deal" || state.street !== "seventh-street" || state.sharedSeventh || state.players.some((player) => player.cards.length > 6)) throw new Error("Record a shared seventh card before individual river cards");
  assertCard(card);
  if (unavailableStudCards(state).has(card)) throw new Error(`Card is already in use: ${card}`);
  const next = coreOf(state);
  next.sharedSeventh = card;
  next.events.push({ id: "deal-seventh-street-shared", round: "seventh-street", type: "shared-deal", card, cardIndex: 6, visibility: "up" });
  return commit(state, next);
}
export function advanceStudPhase(state: StudState): StudState {
  const next = coreOf(state);
  if (state.phase === "betting") {
    const betting = deriveStudBetting(state)!;
    if (!betting.roundClosed) throw new Error("Finish betting before dealing");
    if (betting.handOver) next.phase = "done";
    else if (state.street === "seventh-street") next.phase = "showdown";
    else { next.phase = "deal"; next.street = STUD_STREETS[STUD_STREETS.indexOf(state.street) + 1]; }
  } else if (state.phase === "deal") {
    if (!state.sharedSeventh && pendingStudDealSeat(state) !== null) throw new Error("Finish dealing this street");
    next.phase = "betting";
  } else throw new Error("No street can advance");
  return commit(state, next);
}

function showdownSeat(state: StudCoreState, seat: number) {
  assertSeat(state, seat);
  if (state.phase !== "showdown" || foldedBefore(state).has(seat)) throw new Error("Only a live showdown hand can show or muck");
}
export function setStudShownCards(state: StudState, seat: number, cards: CardId[]): StudState {
  showdownSeat(state, seat);
  const expected = state.sharedSeventh ? 6 : 7;
  if (cards.length !== expected) throw new Error(`Show all ${expected} personal cards in their original slots`);
  const used = unavailableStudCards(state, seat);
  const seen = new Set<CardId>();
  cards.forEach((card, index) => {
    assertCard(card);
    if (used.has(card) || seen.has(card)) throw new Error(`Card is already in use: ${card}`);
    if (state.players[seat].cards[index]?.card && state.players[seat].cards[index].card !== card) throw new Error("Shown cards must match the dealt slots");
    seen.add(card);
  });
  const next = coreOf(state);
  next.shownCards[seat] = [...cards];
  next.muckedSeats = next.muckedSeats.filter((mucked) => mucked !== seat);
  return commit(state, next);
}
export function setStudMucked(state: StudState, seat: number, mucked = true): StudState {
  showdownSeat(state, seat);
  const next = coreOf(state);
  delete next.shownCards[seat];
  next.muckedSeats = next.muckedSeats.filter((other) => other !== seat);
  if (mucked) next.muckedSeats.push(seat);
  return commit(state, next);
}

export type StudPotAward = SidePot & {
  winners: number[];
  /** Contested Stud/8 pots name each awarded portion. Without a qualifying
   * low, the high portion is the whole pot. Uncontested pots need no split. */
  portion?: "high" | "low";
};
function winningSeats(eligible: number[], showing: Map<number, HandScore>, compare: (a: HandScore, b: HandScore) => number): number[] {
  const seats = eligible.filter((seat) => showing.has(seat));
  if (!seats.length) return [];
  const best = seats.reduce((a, b) => compare(showing.get(a)!, showing.get(b)!) >= 0 ? a : b);
  return seats.filter((seat) => compare(showing.get(seat)!, showing.get(best)!) === 0);
}
export function studResult(state: StudCoreState): {
  resolved: boolean; committed: Record<number, number>; totalPot: number;
  awards: StudPotAward[]; winnings: Record<number, number>;
} {
  const { committed, totalPot } = studAccounting(state, true);
  const folded = foldedBefore(state);
  const survivors = state.players.filter((player) => !folded.has(player.seat));
  const showing = new Map<number, HandScore>();
  const lowShowing = new Map<number, HandScore>();
  const evaluate = state.variant === "RAZZ" ? evaluateBestAceToFive : evaluateBest;
  const compare = state.variant === "RAZZ" ? compareAceToFive : compareHands;
  for (const player of survivors) {
    if (state.muckedSeats.includes(player.seat)) continue;
    const cards = state.shownCards[player.seat] ?? (player.seat === state.heroSeat ? player.cards.flatMap((slot) => slot.card ? [slot.card] : []) : []);
    if (cards.length === (state.sharedSeventh ? 6 : 7)) {
      const holding = [...cards, ...(state.sharedSeventh ? [state.sharedSeventh] : [])];
      showing.set(player.seat, evaluate(holding));
      if (state.variant === "STUD_HILO_8") {
        const low = evaluateBestEightOrBetter(holding);
        if (low) lowShowing.set(player.seat, low);
      }
    }
  }
  const levels = [...new Set(Object.values(committed).filter((amount) => amount > 0))].sort((a, b) => a - b);
  const pots: SidePot[] = [];
  let previous = 0;
  for (const level of levels) {
    const contributors = state.players.filter((player) => (committed[player.seat] ?? 0) >= level - EPSILON);
    const eligibleSeats = contributors.filter((player) => !folded.has(player.seat)).map((player) => player.seat);
    const amount = (level - previous) * contributors.length;
    previous = level;
    const last = pots.at(-1);
    if (last && last.eligibleSeats.join() === eligibleSeats.join()) last.amount += amount;
    else pots.push({ amount, eligibleSeats });
  }
  const awards = pots.flatMap<StudPotAward>((pot) => {
    if (survivors.length === 1) return [{ ...pot, winners: [survivors[0].seat] }];
    const winners = winningSeats(pot.eligibleSeats, showing, compare);
    if (state.variant !== "STUD_HILO_8") return [{ ...pot, winners }];
    const lowWinners = winningSeats(pot.eligibleSeats, lowShowing, compareAceToFive);
    if (!lowWinners.length) return [{ ...pot, winners, portion: "high" }];
    return [
      { ...pot, amount: pot.amount / 2, winners, portion: "high" },
      { ...pot, amount: pot.amount / 2, winners: lowWinners, portion: "low" },
    ];
  });
  const resolved = (state.phase === "showdown" || state.phase === "done") &&
    (survivors.length === 1 || survivors.every((player) => showing.has(player.seat) || state.muckedSeats.includes(player.seat))) && awards.every((pot) => pot.winners.length > 0);
  const winnings: Record<number, number> = {};
  if (resolved) for (const award of awards) for (const seat of award.winners) winnings[seat] = (winnings[seat] ?? 0) + award.amount / award.winners.length;
  return { resolved, committed, totalPot, awards, winnings };
}
export function buildStudTimeline(state: StudCoreState): HandTimelineEvent[] {
  const events = structuredClone(state.events);
  if (state.phase !== "showdown" || foldedBefore(state).size === state.playerCount - 1) return events;
  for (const player of state.players) {
    if (foldedBefore(state).has(player.seat)) continue;
    if (state.muckedSeats.includes(player.seat)) events.push({ id: `muck-seat-${player.seat}`, round: "showdown", type: "muck", seat: player.seat });
    else {
      const cards = state.shownCards[player.seat] ?? (player.seat === state.heroSeat ? player.cards.flatMap((slot) => slot.card ? [slot.card] : []) : undefined);
      if (cards) events.push({ id: `show-seat-${player.seat}`, round: "showdown", type: "show", seat: player.seat, cards: [...cards] });
    }
  }
  return events;
}
