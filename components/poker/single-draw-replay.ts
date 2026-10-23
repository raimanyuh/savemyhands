import { applyKnownDraw } from "./draw-engine";
import { determineDeuceToSevenWinners } from "./draw-eval";
import type { CardVisibility, HandTimelineEvent } from "./game-format";
import type { ReplayHand, ReplayStep, SavedHand } from "./hand";
import { POSITION_NAMES } from "./lib";

export type SingleDrawReplayRound =
  | "initial-deal"
  | "predraw"
  | "draw-1"
  | "draw-2"
  | "draw-3"
  | "postdraw-1"
  | "postdraw-2"
  | "postdraw-3"
  | "postdraw"
  | "showdown";

export type DrawReplayCard = {
  /** An empty slot differs from an occupied, unknown card back. */
  present: boolean;
  visibility: CardVisibility;
  card?: string;
};

export type DrawPotAward = {
  amount: number;
  eligibleSeats: number[];
  winners: number[];
};

export type SingleDrawReplayState = {
  round: SingleDrawReplayRound;
  eventId?: string;
  kind: HandTimelineEvent["type"] | "round-end" | "result";
  stage?: "discard" | "replace" | "pat" | "reshuffle";
  count?: number;
  /** Opponent indexes are animation slots only, never known card identities. */
  cardIndexes?: number[];
  cards: Record<number, DrawReplayCard[]>;
  foldedSeats: number[];
  muckedSeats: number[];
  shownSeats: number[];
  refunds?: Record<number, number>;
  resolved?: boolean;
  awards?: DrawPotAward[];
  winnings?: Record<number, number>;
};

export type SingleDrawReplayStep = ReplayStep & {
  street: SingleDrawReplayRound;
  draw: SingleDrawReplayState;
};

export type SingleDrawReplayHand = Omit<ReplayHand, "steps"> & {
  steps: SingleDrawReplayStep[];
};

/** Resolve each commitment layer independently, including folded dead money. */
function resolvePots(
  committed: Record<number, number>,
  survivors: number[],
  shown: Map<number, string[]>,
  mucked: Set<number>,
): DrawPotAward[] | null {
  if (survivors.length === 1) {
    return [{
      amount: Object.values(committed).reduce((sum, amount) => sum + amount, 0),
      eligibleSeats: [...survivors],
      winners: [...survivors],
    }];
  }
  if (!survivors.length || survivors.some((seat) => !shown.has(seat) && !mucked.has(seat))) {
    return null;
  }
  const contributors = Object.entries(committed)
    .map(([seat, amount]) => ({ seat: Number(seat), amount }))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => a.amount - b.amount);
  const pots: { amount: number; eligibleSeats: number[] }[] = [];
  let previous = 0;
  for (let i = 0; i < contributors.length; i++) {
    const level = contributors[i].amount;
    if (level === previous) continue;
    const remaining = contributors.slice(i);
    const amount = (level - previous) * remaining.length;
    const eligibleSeats = remaining.map(({ seat }) => seat).filter((seat) => survivors.includes(seat));
    const last = pots.at(-1);
    if (last && last.eligibleSeats.length === eligibleSeats.length &&
        last.eligibleSeats.every((seat) => eligibleSeats.includes(seat))) {
      last.amount += amount;
    } else {
      pots.push({ amount, eligibleSeats });
    }
    previous = level;
  }
  const awards: DrawPotAward[] = [];
  for (const pot of pots) {
    const contestants = pot.eligibleSeats
      .filter((seat) => shown.has(seat) && !mucked.has(seat))
      .map((seat) => ({ seat, cards: shown.get(seat)! }));
    // A muck concedes eligibility; it never invents a winning hidden hand.
    if (!contestants.length) return null;
    awards.push({ ...pot, winners: determineDeuceToSevenWinners(contestants).winners });
  }
  return awards.length ? awards : null;
}

/**
 * Replay the timeline alone. Final `players[*].cards` must never leak a
 * replacement or showdown reveal into earlier frames. No community engine,
 * board, or legacy action log participates in this conversion.
 */
export function singleDrawToReplay(rec: SavedHand): SingleDrawReplayHand | null {
  const f = rec._full;
  if (!f || f.schemaVersion !== 2 || f.game?.family !== "draw" || !f.timeline?.length ||
      !((f.game.variant === "2-7_SINGLE_DRAW" && f.game.bettingStructure === "NL") ||
        (f.game.variant === "2-7_TRIPLE_DRAW" && f.game.bettingStructure === "FL"))) return null;

  const heroSeat = f.heroPosition ?? 0;
  const posNames = POSITION_NAMES[f.playerCount] ?? [];
  const posOf = (seat: number) => posNames[seat] ?? `S${seat + 1}`;
  const cards: Record<number, DrawReplayCard[]> = {};
  const committed: Record<number, number> = {};
  const folded = new Set<number>();
  const mucked = new Set<number>();
  const shown = new Map<number, string[]>();
  const knownCards = new Set<string>();
  const discards: { round: number; cards: string[] }[] = [];
  const steps: SingleDrawReplayStep[] = [];
  for (let seat = 0; seat < f.playerCount; seat++) {
    cards[seat] = Array.from({ length: 5 }, () => ({ present: false, visibility: "down" }));
  }
  let round: SingleDrawReplayRound = "initial-deal";
  let bets: Record<number, number> = {};
  let lastBet = 0;
  const pot = () => Object.values(committed).reduce((sum, amount) => sum + amount, 0);

  const emit = (
    label: string,
    detail: Pick<SingleDrawReplayState, "kind"> & Partial<SingleDrawReplayState>,
    extra: Partial<ReplayStep> = {},
  ) => {
    steps.push({
      ...extra,
      street: round,
      label,
      pot: pot(),
      streetBetsAfter: { ...bets },
      committedAfter: { ...committed },
      draw: {
        ...detail,
        round,
        cards: Object.fromEntries(Object.entries(cards).map(([seat, slots]) =>
          [seat, slots.map((slot) => ({ ...slot }))])),
        foldedSeats: [...folded],
        muckedSeats: [...mucked],
        shownSeats: [...shown.keys()],
      },
    });
  };

  const closeBetting = () => {
    if (round !== "predraw" && !round.startsWith("postdraw")) return;
    const amounts = Object.entries(bets).sort((a, b) => b[1] - a[1]);
    const refunds: Record<number, number> = {};
    const highest = amounts[0];
    if (highest && highest[1] > (amounts[1]?.[1] ?? 0)) {
      const seat = Number(highest[0]);
      const refund = highest[1] - (amounts[1]?.[1] ?? 0);
      refunds[seat] = refund;
      bets[seat] -= refund;
      committed[seat] -= refund;
    }
    const refundLabel = Object.entries(refunds)
      .map(([seat, amount]) => `${posOf(Number(seat))} refunded $${amount}`).join(" · ");
    emit(refundLabel || `${round === "predraw" ? "Predraw" : round === "postdraw" ? "Postdraw" : `After draw ${round.slice(-1)}`} betting complete`,
      { kind: "round-end", refunds });
  };

  const eventIds = new Set<string>();
  for (const event of f.timeline) {
    if (eventIds.has(event.id)) throw new Error(`Duplicate timeline event: ${event.id}`);
    eventIds.add(event.id);
    if (!Number.isInteger(event.seat) || event.seat < 0 || event.seat >= f.playerCount) {
      throw new Error(`Invalid timeline seat: ${event.seat}`);
    }
    const rounds = f.game.variant === "2-7_TRIPLE_DRAW"
      ? ["initial-deal", "predraw", "draw-1", "postdraw-1", "draw-2", "postdraw-2", "draw-3", "postdraw-3", "showdown"]
      : ["initial-deal", "predraw", "draw-1", "postdraw", "showdown"];
    if (!rounds.includes(event.round)) {
      throw new Error(`Invalid draw round: ${event.round}`);
    }
    if (event.round !== round) {
      closeBetting();
      round = event.round as SingleDrawReplayRound;
      bets = {};
      lastBet = 0;
    }
    const seat = event.seat;
    const name = posOf(seat);
    const detail = { kind: event.type, eventId: event.id };
    if (event.type === "deal") {
      if (!Number.isInteger(event.cardIndex) || event.cardIndex < 0 || event.cardIndex >= 5) {
        throw new Error("Invalid deal slot");
      }
      const card = seat === heroSeat || event.visibility === "up" ? event.card : undefined;
      if (card && knownCards.has(card)) throw new Error(`Card is already in use: ${card}`);
      if (card) knownCards.add(card);
      cards[seat][event.cardIndex] = {
        present: true,
        visibility: seat === heroSeat ? "up" : event.visibility,
        ...(card ? { card } : {}),
      };
      emit(`${name} dealt a card`, detail, { active: seat });
    } else if (event.type === "forced-bet" || event.type === "action") {
      const previous = bets[seat] ?? 0;
      const remaining = Math.max(0, f.players[seat].stack - (committed[seat] ?? 0));
      let target = previous;
      if (event.type === "forced-bet") target += Math.min(event.amount, remaining);
      else if (event.action === "call") target = Math.min(lastBet, previous + remaining);
      else if (event.action === "bet" || event.action === "raise") {
        target = Math.min(event.amount ?? 0, previous + remaining);
      } else if (event.action === "fold") folded.add(seat);
      const delta = Math.max(0, target - previous);
      if (delta > 0 || event.type === "forced-bet") {
        bets[seat] = previous + delta;
        committed[seat] = (committed[seat] ?? 0) + delta;
      }
      // Match the recorder's short-blind price, including a BB below the SB.
      if (event.type === "forced-bet" && event.kind === "big-blind") {
        const sbSeat = f.playerCount === 2 ? 0 : 1;
        const bbSeat = f.playerCount === 2 ? 1 : 2;
        const ableToBet = f.players.filter((player, index) => player.stack >
          (index === sbSeat ? f.sb : index === bbSeat ? f.bb : 0)).length;
        lastBet = f.game.variant === "2-7_TRIPLE_DRAW" ? ableToBet >= 2 ? f.bb : Math.max(...Object.values(bets)) : bets[seat] ?? 0;
      } else lastBet = Math.max(lastBet, bets[seat] ?? 0);
      if (event.type === "forced-bet") {
        emit(`${name} posts ${event.kind === "small-blind" ? "small" : "big"} blind $${delta}`,
          detail, { active: seat });
      } else {
        const label = event.action === "fold" ? `${name} folds`
          : event.action === "check" ? `${name} checks`
          : event.action === "call" ? `${name} calls $${delta}`
          : event.action === "bet" ? `${name} bets $${bets[seat]}`
          : `${name} raises to $${bets[seat]}`;
        const action = event.action === "bet" || event.action === "raise"
          ? `${event.action} ${bets[seat]}` : event.action;
        emit(label, detail, { active: seat, action });
      }
    } else if (event.type === "draw") {
      if (!round.startsWith("draw-")) throw new Error("Draw decision belongs to a draw round");
      if (!Number.isInteger(event.count) || event.count < 0 || event.count > 5) {
        throw new Error("Invalid draw count");
      }
      if (event.count === 0) {
        if (event.reshuffleBefore) throw new Error("A pat decision cannot include a reshuffle");
        emit(`${name} stands pat`, { ...detail, stage: "pat", count: 0, cardIndexes: [] }, { active: seat });
        continue;
      }
      let indexes: number[];
      let replacements: string[] | undefined;
      const number = Number(round.slice(-1));
      if (event.reshuffleBefore) {
        if (f.game.variant !== "2-7_TRIPLE_DRAW") throw new Error("Reshuffle markers require Triple Draw");
        const held = new Set(Object.entries(cards).flatMap(([seat, slots]) => folded.has(Number(seat)) ? [] : slots.flatMap((slot) => slot.card ? [slot.card] : [])));
        for (const previous of discards) if (previous.round < number) {
          for (const card of previous.cards) if (!held.has(card)) knownCards.delete(card);
        }
        for (const foldedSeat of folded) for (const slot of cards[foldedSeat]) {
          if (slot.card && !held.has(slot.card)) knownCards.delete(slot.card);
        }
        emit("Deck reshuffled — previous draws recycled", { ...detail, stage: "reshuffle" });
      }
      if (seat === heroSeat) {
        const current = cards[seat].map((slot) => slot.present ? slot.card : undefined);
        if (current.some((card) => !card) || event.discardIndexes?.length !== event.count ||
            event.replacementCards?.length !== event.count) {
          throw new Error("Hero draw needs exact discard slots and replacements");
        }
        const result = applyKnownDraw({
          cards: current as string[],
          discardIndexes: event.discardIndexes,
          replacementCards: event.replacementCards,
          unavailableCards: knownCards,
        });
        if (event.discardedCards && event.discardedCards.some((card, i) => card !== result.discardedCards[i])) {
          throw new Error("Discarded cards do not match their slots");
        }
        indexes = [...event.discardIndexes];
        replacements = [...event.replacementCards];
        discards.push({ round: number, cards: result.discardedCards });
      } else {
        // Animate anonymous backs only; count is the sole public information.
        indexes = Array.from({ length: event.count }, (_, i) => 5 - event.count + i);
      }
      for (const index of indexes) cards[seat][index] = { present: false, visibility: "down" };
      emit(`${name} discards ${event.count}`, { ...detail, stage: "discard", count: event.count, cardIndexes: [...indexes] }, { active: seat });
      indexes.forEach((index, i) => {
        const card = replacements?.[i];
        if (card) knownCards.add(card);
        cards[seat][index] = {
          present: true,
          visibility: seat === heroSeat ? "up" : "down",
          ...(card ? { card } : {}),
        };
      });
      emit(`${name} draws ${event.count}`, { ...detail, stage: "replace", count: event.count, cardIndexes: [...indexes] }, { active: seat });
    } else if (event.type === "show") {
      if (round !== "showdown" || folded.has(seat) || mucked.has(seat)) {
        throw new Error("Only a live hand can show at showdown");
      }
      if (event.cards.length !== 5 || new Set(event.cards).size !== 5) {
        throw new Error("A shown draw hand needs 5 unique cards");
      }
      const ownCards = new Set(cards[seat].flatMap((slot) => slot.card ? [slot.card] : []));
      if (event.cards.some((card) => knownCards.has(card) && !ownCards.has(card))) {
        throw new Error("Shown cards conflict with dealt or discarded cards");
      }
      if (seat === heroSeat && event.cards.some((card, i) => card !== cards[seat][i].card)) {
        throw new Error("Hero shown cards do not match the recorded draw");
      }
      event.cards.forEach((card) => knownCards.add(card));
      shown.set(seat, [...event.cards]);
      cards[seat] = event.cards.map((card) => ({ present: true, visibility: "up", card }));
      emit(`${name} shows`, detail, { active: seat });
    } else {
      if (round !== "showdown" || folded.has(seat)) throw new Error("Muck belongs to a live showdown hand");
      mucked.add(seat);
      shown.delete(seat);
      cards[seat] = cards[seat].map(() => ({ present: false, visibility: "down" }));
      emit(`${name} mucks`, detail, { active: seat });
    }
  }
  closeBetting();
  round = "showdown";
  bets = {};
  const survivors = f.players.map((_, seat) => seat).filter((seat) => !folded.has(seat));
  const awards = resolvePots(committed, survivors, shown, mucked);
  const winnings: Record<number, number> = {};
  for (const award of awards ?? []) {
    for (const seat of award.winners) {
      // No denomination/odd-chip rule is recorded, so preserve exact shares.
      winnings[seat] = (winnings[seat] ?? 0) + award.amount / award.winners.length;
    }
  }
  const winners = Object.keys(winnings).map(Number);
  const label = awards
    ? winners.map((seat) => `${posOf(seat)} wins $${winnings[seat]}`).join(" · ")
    : `Showdown — pot $${pot()} (unresolved)`;
  emit(label, { kind: "result", resolved: awards !== null, awards: awards ?? undefined, winnings },
    winners.length === 1 ? { winner: winners[0] } : {});

  return {
    id: rec.id,
    schemaVersion: 2,
    game: f.game,
    stakes: { sb: f.sb, bb: f.bb },
    playerCount: f.playerCount,
    heroPosition: heroSeat,
    muckedSeats: [...mucked],
    notes: f.notes ?? rec.notes,
    venue: f.venue ?? rec.loc,
    date: f.date ?? rec.date,
    // Keep static cards empty: each step owns its current card state.
    players: f.players.map((player, seat) => ({
      seat, name: player.name || `Seat ${seat + 1}`, stack: player.stack,
      pos: posOf(seat), cards: null,
    })),
    steps,
  };
}
