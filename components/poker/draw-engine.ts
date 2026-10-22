import type { CardId, DrawVariant, HandTimelineEvent } from "./game-format";

export type DrawNumber = 1 | 2 | 3;

export type DrawDecision = {
  round: DrawNumber;
  seat: number;
  count: number;
  discardIndexes?: number[];
  discardedCards?: CardId[];
  replacementCards?: CardId[];
};

export type DrawExchangeState = {
  variant: DrawVariant;
  round: DrawNumber;
  order: number[];
  cursor: number;
  decisions: DrawDecision[];
};

export function drawCountForVariant(variant: DrawVariant): 1 | 3 {
  return variant === "2-7_TRIPLE_DRAW" ? 3 : 1;
}

export function startDrawExchange(args: {
  variant: DrawVariant;
  round: DrawNumber;
  order: number[];
}): DrawExchangeState {
  if (args.round > drawCountForVariant(args.variant)) {
    throw new Error(`${args.variant} does not have draw ${args.round}`);
  }
  if (new Set(args.order).size !== args.order.length) {
    throw new Error("Draw order contains a duplicate seat");
  }
  return {
    variant: args.variant,
    round: args.round,
    order: [...args.order],
    cursor: 0,
    decisions: [],
  };
}

export function currentDrawSeat(state: DrawExchangeState): number | null {
  return state.order[state.cursor] ?? null;
}

export function isDrawExchangeComplete(state: DrawExchangeState): boolean {
  return currentDrawSeat(state) === null;
}

function validateDrawCount(count: number): void {
  if (!Number.isInteger(count) || count < 0 || count > 5) {
    throw new Error("Draw count must be an integer from 0 to 5");
  }
}

export function recordDrawDecision(
  state: DrawExchangeState,
  input: Omit<DrawDecision, "round">,
): DrawExchangeState {
  const expectedSeat = currentDrawSeat(state);
  if (expectedSeat === null) throw new Error("Draw exchange is already complete");
  if (input.seat !== expectedSeat) {
    throw new Error(`Seat ${expectedSeat} must draw next`);
  }
  validateDrawCount(input.count);

  const discardedCount = input.discardedCards?.length;
  const replacementCount = input.replacementCards?.length;
  const discardIndexCount = input.discardIndexes?.length;
  if (discardIndexCount !== undefined && discardIndexCount !== input.count) {
    throw new Error("Discard-index count does not match the declared draw");
  }
  if (discardedCount !== undefined && discardedCount !== input.count) {
    throw new Error("Discarded-card count does not match the declared draw");
  }
  if (replacementCount !== undefined && replacementCount !== input.count) {
    throw new Error("Replacement-card count does not match the declared draw");
  }
  if (
    input.count === 0 &&
    (discardIndexCount || discardedCount || replacementCount)
  ) {
    throw new Error("A player standing pat cannot exchange cards");
  }

  const decision: DrawDecision = {
    round: state.round,
    seat: input.seat,
    count: input.count,
    ...(input.discardIndexes
      ? { discardIndexes: [...input.discardIndexes] }
      : {}),
    ...(input.discardedCards
      ? { discardedCards: [...input.discardedCards] }
      : {}),
    ...(input.replacementCards
      ? { replacementCards: [...input.replacementCards] }
      : {}),
  };

  return {
    ...state,
    cursor: state.cursor + 1,
    decisions: [...state.decisions, decision],
  };
}

export type KnownDrawResult = {
  cards: CardId[];
  discardedCards: CardId[];
};

export function applyKnownDraw(args: {
  cards: CardId[];
  discardIndexes: number[];
  replacementCards: CardId[];
  unavailableCards?: Iterable<CardId>;
}): KnownDrawResult {
  const { cards, discardIndexes, replacementCards } = args;
  if (cards.length !== 5) throw new Error("A draw hand must contain 5 cards");
  if (new Set(cards).size !== cards.length) {
    throw new Error("Current draw hand contains duplicate cards");
  }
  if (new Set(discardIndexes).size !== discardIndexes.length) {
    throw new Error("A card slot cannot be discarded twice");
  }
  for (const index of discardIndexes) {
    if (!Number.isInteger(index) || index < 0 || index >= cards.length) {
      throw new Error(`Invalid discard index: ${index}`);
    }
  }
  if (replacementCards.length !== discardIndexes.length) {
    throw new Error("Replacement count must match discarded-card count");
  }
  if (new Set(replacementCards).size !== replacementCards.length) {
    throw new Error("Replacement cards contain a duplicate");
  }

  const discardedSet = new Set(discardIndexes);
  const keptCards = cards.filter((_, index) => !discardedSet.has(index));
  const unavailable = new Set(args.unavailableCards ?? []);
  for (const card of keptCards) unavailable.add(card);
  for (const card of replacementCards) {
    if (unavailable.has(card)) {
      throw new Error(`Replacement card is already unavailable: ${card}`);
    }
    unavailable.add(card);
  }

  const nextCards = [...cards];
  const discardedCards: CardId[] = [];
  discardIndexes.forEach((cardIndex, replacementIndex) => {
    discardedCards.push(cards[cardIndex]);
    nextCards[cardIndex] = replacementCards[replacementIndex];
  });
  return { cards: nextCards, discardedCards };
}

export function drawDecisionToTimelineEvent(
  decision: DrawDecision,
): HandTimelineEvent {
  return {
    id: `draw-${decision.round}-seat-${decision.seat}`,
    type: "draw",
    round: `draw-${decision.round}`,
    seat: decision.seat,
    count: decision.count,
    ...(decision.discardIndexes
      ? { discardIndexes: [...decision.discardIndexes] }
      : {}),
    ...(decision.discardedCards
      ? { discardedCards: [...decision.discardedCards] }
      : {}),
    ...(decision.replacementCards
      ? { replacementCards: [...decision.replacementCards] }
      : {}),
  };
}
