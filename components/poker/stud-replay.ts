import type { CardVisibility, HandTimelineEvent } from "./game-format";
import type { ReplayHand, ReplayStep, SavedHand } from "./hand";
import {
  advanceStudPhase, deriveStudBetting, initialStudState, pendingStudDealSeat,
  recordStudAction, recordStudDeal, recordStudSharedSeventh, setStudMucked,
  setStudShownCards, setStudStartingCards, startStudHand, studAccounting,
  studFirstToAct, studResult, updateStudPlayer,
  type StudPotAward, type StudState, type StudStreet,
} from "./stud-engine";

export type StudReplayRound = StudStreet | "showdown";
export type StudReplayCard = {
  present: boolean;
  /** Physical deal orientation stays down for hero's own hole cards. */
  visibility: CardVisibility;
  /** Hero can see their own downcards; others turn over only when shown. */
  faceUp: boolean;
  card?: string;
};
export type StudReplayState = {
  round: StudReplayRound;
  kind: HandTimelineEvent["type"] | "round-end" | "result";
  eventId?: string;
  cardIndex?: number;
  cards: Record<number, StudReplayCard[]>;
  sharedCard?: StudReplayCard;
  foldedSeats: number[];
  muckedSeats: number[];
  shownSeats: number[];
  firstToAct: number | null;
  nextToAct: number | null;
  limitBet?: number;
  refunds?: Record<number, number>;
  resolved?: boolean;
  awards?: StudPotAward[];
  winnings?: Record<number, number>;
};
export type StudReplayStep = ReplayStep & { street: StudReplayRound; stud: StudReplayState };
export type StudReplayHand = Omit<ReplayHand, "steps"> & { steps: StudReplayStep[] };

const sameAmount = (a: number, b: number) => Number.isFinite(a) && Math.abs(a - b) < 1e-8;
const withoutHistory = (state: StudState): StudState => ({ ...state, history: [] });
export function studRoundLabel(round: StudReplayRound): string {
  return round === "showdown" ? "Showdown" : `${round[0].toUpperCase()}${round.slice(1).replace("-", " ")}`;
}

/** Validate the initial deal against the domain's canonical ante/deal/
 * bring-in sequence. Stored opponent downcard values are ignored even if
 * a payload accidentally contains them. Final players[*].cards is unused. */
function initialTimeline(rec: SavedHand) {
  const full = rec._full!;
  const rules = full.studRules!;
  let ready = initialStudState({
    playerCount: full.playerCount, heroSeat: full.heroPosition ?? 0, dealerSeat: rules.dealerSeat,
    ante: rules.ante, bringIn: rules.bringIn, smallBet: rules.smallBet,
    limitRules: { maxBets: rules.maxBets, headsUpUncapped: rules.headsUpUncapped, fourthStreetBigBet: rules.fourthStreetBigBet },
  });
  if (full.players.length !== ready.playerCount) throw new Error("Stud player count does not match its seats");
  for (let seat = 0; seat < ready.playerCount; seat++) {
    const player = full.players[seat];
    if (player.seat !== seat) throw new Error("Stud players must be in clockwise seat order");
    ready = updateStudPlayer(ready, seat, { name: player.name, stack: player.stack });
  }
  const prefixLength = (rules.ante > 0 ? ready.playerCount : 0) + ready.playerCount * 3;
  const prefix = full.timeline!.slice(0, prefixLength);
  for (let seat = 0; seat < ready.playerCount; seat++) {
    const cards = [0, 1, 2].map((index) => {
      const event = prefix.find((event) => event.type === "deal" && event.seat === seat && event.cardIndex === index);
      return event?.type === "deal" && (seat === ready.heroSeat || index === 2) ? event.card ?? null : null;
    });
    ready = setStudStartingCards(ready, seat, cards);
  }
  const opening = full.timeline![prefixLength];
  const started = withoutHistory(startStudHand(ready, { complete: opening?.type === "forced-bet" && opening.kind === "completion" }));
  for (let index = 0; index < started.events.length; index++) {
    const expected = started.events[index];
    const actual = full.timeline![index];
    if (!actual || actual.round !== expected.round || actual.type !== expected.type ||
        !("seat" in actual) || !("seat" in expected) || actual.seat !== expected.seat) throw new Error("Invalid Stud initial sequence");
    if (expected.type === "forced-bet" && (actual.type !== "forced-bet" || actual.kind !== expected.kind || !sameAmount(actual.amount, expected.amount))) throw new Error("Invalid Stud forced bet");
    if (expected.type === "deal" && (actual.type !== "deal" || actual.cardIndex !== expected.cardIndex || actual.visibility !== expected.visibility ||
        ((actual.seat === ready.heroSeat || actual.visibility === "up") && actual.card !== expected.card))) throw new Error("Invalid Stud initial card slot");
  }
  return { started, prefixLength: started.events.length };
}

/** Replay from the timeline alone, using the recorder engine for betting,
 * refunds, all-in caps and final awards. Each emitted frame owns its cards. */
export function studToReplay(rec: SavedHand): StudReplayHand | null {
  const full = rec._full;
  if (!full || full.schemaVersion !== 2 || full.game?.family !== "stud" ||
      full.game.variant !== "STUD_HIGH" || full.game.bettingStructure !== "FL" || !full.studRules || !full.timeline?.length) return null;
  const { started, prefixLength } = initialTimeline(rec);
  let state: StudState = { ...started, events: [], history: [] };
  let round: StudReplayRound = "third-street";
  let initialComplete = false;
  const heroSeat = state.heroSeat;
  const cards: Record<number, StudReplayCard[]> = Object.fromEntries(state.players.map((player) => [player.seat,
    Array.from({ length: 7 }, (_, index) => ({ present: false, visibility: index < 2 || index === 6 ? "down" : "up", faceUp: false })),
  ]));
  const shown = new Set<number>();
  const mucked = new Set<number>();
  const folded = new Set<number>();
  const eventIds = new Set<string>();
  const steps: StudReplayStep[] = [];
  let sharedCard: StudReplayCard | undefined;
  const posOf = (seat: number) => `S${seat + 1}`;
  const emit = (label: string, detail: Pick<StudReplayState, "kind"> & Partial<StudReplayState>, extra: Partial<Pick<ReplayStep, "active" | "action" | "winner" | "pot" | "streetBetsAfter" | "committedAfter">> = {}) => {
    const ledger = studAccounting(state);
    const betting = initialComplete ? deriveStudBetting(state) : null;
    steps.push({
      street: round, label, pot: ledger.totalPot, streetBetsAfter: { ...(betting?.bets ?? {}) }, committedAfter: { ...ledger.committed },
      ...extra,
      stud: {
        round, firstToAct: initialComplete && state.phase !== "deal" ? studFirstToAct(state) : null, nextToAct: betting?.activeSeat ?? null,
        limitBet: betting?.limitBet,
        cards: Object.fromEntries(Object.entries(cards).map(([seat, slots]) => [seat, slots.map((slot) => ({ ...slot }))])),
        sharedCard: sharedCard ? { ...sharedCard } : undefined,
        foldedSeats: [...folded], shownSeats: [...shown], muckedSeats: [...mucked], ...structuredClone(detail),
      },
    });
  };
  const closeBetting = () => {
    if (state.phase !== "betting") throw new Error("Stud street ended before its deal was complete");
    const betting = deriveStudBetting(state)!;
    if (!betting.roundClosed) throw new Error("Stud street ended with betting still open");
    const final = studAccounting(state, true);
    const refunds = final.refunds[state.street] ?? {};
    const bets = Object.fromEntries(Object.entries(betting.bets).map(([seat, amount]) => [seat, amount - (refunds[Number(seat)] ?? 0)]));
    emit(Object.entries(refunds).map(([seat, amount]) => `${posOf(Number(seat))} refunded $${amount}`).join(" · ") || `${studRoundLabel(round)} betting complete`,
      { kind: "round-end", refunds, nextToAct: null }, { pot: final.totalPot, streetBetsAfter: bets, committedAfter: { ...final.committed } });
    state = withoutHistory(advanceStudPhase(state));
  };
  const recordDealtSlot = (event: Extract<HandTimelineEvent, { type: "deal" }>) => {
    const card = event.seat === heroSeat || event.visibility === "up" ? event.card : undefined;
    cards[event.seat][event.cardIndex] = { present: true, visibility: event.visibility, faceUp: !!card, ...(card ? { card } : {}) };
  };

  for (let index = 0; index < full.timeline.length; index++) {
    const event = full.timeline[index];
    if (typeof event.id !== "string" || !event.id || eventIds.has(event.id)) throw new Error("Stud timeline event ids must be unique");
    eventIds.add(event.id);
    if (event.type !== "shared-deal" && (!Number.isInteger(event.seat) || event.seat < 0 || event.seat >= state.playerCount)) throw new Error("Invalid Stud timeline seat");
    const detail = { kind: event.type, eventId: event.id };
    if (index < prefixLength) {
      // Canonical events strip hidden identities and validate every opening.
      state.events.push({ ...started.events[index], id: event.id });
      initialComplete = index === prefixLength - 1;
      if (event.type === "deal") {
        recordDealtSlot(event);
        emit(`${posOf(event.seat)} dealt ${event.visibility === "up" ? "an upcard" : "a downcard"}`, { ...detail, cardIndex: event.cardIndex }, { active: event.seat });
      } else if (event.type === "forced-bet") {
        const label = event.kind === "ante" ? `antes $${event.amount}` : event.kind === "completion" ? `opens for $${event.amount}` : `brings in $${event.amount}`;
        emit(`${posOf(event.seat)} ${label}`, detail, { active: event.seat });
      }
      continue;
    }
    if (event.round !== round) {
      closeBetting();
      const expected = state.phase === "showdown" ? "showdown" : state.street;
      if (state.phase === "done" || event.round !== expected) throw new Error("Invalid Stud street order");
      round = event.round as StudReplayRound;
    }
    if (event.type === "deal") {
      const expectedIndex = state.players[event.seat].cards.length;
      const expectedVisibility = state.street === "seventh-street" ? "down" : "up";
      if (event.cardIndex !== expectedIndex || event.visibility !== expectedVisibility) throw new Error("Invalid Stud deal slot or visibility");
      const card = event.seat === heroSeat || event.visibility === "up" ? event.card : undefined;
      state = withoutHistory(recordStudDeal(state, { seat: event.seat, ...(card ? { card } : {}) }));
      state.events[state.events.length - 1].id = event.id;
      recordDealtSlot(event);
      if (pendingStudDealSeat(state) === null) state = withoutHistory(advanceStudPhase(state));
      emit(`${posOf(event.seat)} dealt ${event.visibility === "up" ? "an upcard" : "a downcard"}`, { ...detail, cardIndex: event.cardIndex }, { active: event.seat });
    } else if (event.type === "shared-deal") {
      if (event.cardIndex !== 6 || event.visibility !== "up") throw new Error("Invalid shared Stud card");
      state = withoutHistory(recordStudSharedSeventh(state, event.card));
      state.events[state.events.length - 1].id = event.id;
      sharedCard = { present: true, visibility: "up", faceUp: true, card: event.card };
      state = withoutHistory(advanceStudPhase(state));
      emit("Shared seventh card dealt", { ...detail, cardIndex: 6 });
    } else if (event.type === "action") {
      if (!["fold", "check", "call", "bet", "raise"].includes(event.action)) throw new Error("Invalid Stud action");
      const before = deriveStudBetting(state);
      const bigBet = event.limitBet === state.smallBet * 2 && before?.bigBetTarget !== undefined;
      state = withoutHistory(recordStudAction(state, { seat: event.seat, action: event.action, amount: event.amount, bigBet }));
      const canonical = state.events.at(-1)!;
      if (event.limitBet !== undefined && (canonical.type !== "action" || !sameAmount(event.limitBet, canonical.limitBet ?? 0))) throw new Error("Invalid Stud limit increment");
      canonical.id = event.id;
      if (event.action === "fold") folded.add(event.seat);
      const after = deriveStudBetting(state)!;
      const delta = (after.committed[event.seat] ?? 0) - (before?.committed[event.seat] ?? 0);
      const verb = event.action === "fold" ? "folds" : event.action === "check" ? "checks" : event.action === "call" ? `calls $${delta}`
        : before?.canComplete ? `completes to $${event.amount}` : event.action === "bet" ? `bets $${event.amount}` : `raises to $${event.amount}`;
      emit(`${posOf(event.seat)} ${verb}`, detail, { active: event.seat, action: event.action === "bet" || event.action === "raise" ? `${event.action} ${event.amount}` : event.action });
    } else if (event.type === "show" || event.type === "muck") {
      if (round !== "showdown" || shown.has(event.seat) || mucked.has(event.seat)) throw new Error("Invalid Stud showdown decision");
      if (event.type === "show") {
        state = withoutHistory(setStudShownCards(state, event.seat, event.cards));
        shown.add(event.seat);
        event.cards.forEach((card, cardIndex) => { cards[event.seat][cardIndex] = { ...cards[event.seat][cardIndex], present: true, faceUp: true, card }; });
      } else {
        state = withoutHistory(setStudMucked(state, event.seat));
        mucked.add(event.seat);
        cards[event.seat] = cards[event.seat].map((slot) => ({ present: false, faceUp: false, visibility: slot.visibility }));
      }
      emit(`${posOf(event.seat)} ${event.type === "show" ? "shows" : "mucks"}`, detail, { active: event.seat });
    } else throw new Error("Unexpected event in a Stud hand");
  }
  if (state.phase === "betting") closeBetting();
  if (state.phase !== "showdown" && state.phase !== "done") throw new Error("Stud timeline ended before the hand finished");
  // A known hero hand still needs its show event; final player metadata is
  // never evidence that a hand was tabled. Domain callers auto-show hero.
  if (state.phase === "showdown" && state.players.some((player) => !folded.has(player.seat) && !shown.has(player.seat) && !mucked.has(player.seat))) throw new Error("Every live Stud hand must show or muck");
  const result = studResult(state);
  round = "showdown";
  const winners = Object.keys(result.winnings).map(Number);
  emit(result.resolved ? winners.map((seat) => `${posOf(seat)} wins $${result.winnings[seat]}`).join(" · ") : "Stud showdown — unresolved",
    { kind: "result", resolved: result.resolved, awards: result.awards, winnings: result.winnings, nextToAct: null },
    { pot: result.totalPot, committedAfter: { ...result.committed }, streetBetsAfter: {}, ...(winners.length === 1 ? { winner: winners[0] } : {}) });
  return {
    id: rec.id, schemaVersion: 2, game: full.game, stakes: { sb: 0, bb: 0 }, studRules: { ...full.studRules },
    playerCount: state.playerCount, heroPosition: heroSeat, muckedSeats: [...mucked], notes: full.notes ?? rec.notes, venue: full.venue ?? rec.loc, date: full.date ?? rec.date,
    players: state.players.map((player) => ({ seat: player.seat, name: player.name || `Seat ${player.seat + 1}`, stack: player.stack, pos: posOf(player.seat), cards: null })), steps,
  };
}
