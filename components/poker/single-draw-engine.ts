import type { ActionType } from "./engine";
import { postflopOrder, preflopOrder } from "./lib";
import {
  applyKnownDraw,
  currentDrawSeat,
  drawDecisionToTimelineEvent,
  isDrawExchangeComplete,
  recordDrawDecision,
  startDrawExchange,
  type DrawDecision,
  type DrawExchangeState,
} from "./draw-engine";
import type { CardId, HandTimelineEvent } from "./game-format";

export type SingleDrawPhase =
  | "setup"
  | "predraw"
  | "draw"
  | "postdraw"
  | "showdown"
  | "done";
export type DrawBettingRound = "predraw" | "postdraw";

export type SingleDrawPlayer = {
  seat: number;
  name: string;
  stack: number;
  /** Current known hand. Opponents remain null until they show. */
  cards: (CardId | null)[] | null;
  /** Initial known hand, retained so replay can animate the exchange. */
  startingCards: (CardId | null)[] | null;
};

export type SingleDrawAction = {
  id: string;
  round: DrawBettingRound;
  seat: number;
  action: ActionType;
  /** Bet/raise target for this round, matching the community engine. */
  amount?: number;
};

export type SingleDrawCoreState = {
  variant: "2-7_SINGLE_DRAW";
  phase: SingleDrawPhase;
  playerCount: number;
  players: SingleDrawPlayer[];
  heroSeat: number;
  sb: number;
  bb: number;
  actions: SingleDrawAction[];
  draws: DrawDecision[];
  exchange: DrawExchangeState | null;
  muckedSeats: number[];
};

export type SingleDrawState = SingleDrawCoreState & {
  history: SingleDrawCoreState[];
};

export type DerivedDrawBetting = {
  round: DrawBettingRound;
  folded: Set<number>;
  allIn: Set<number>;
  committed: Record<number, number>;
  bets: Record<number, number>;
  lastBet: number;
  lastRaiseSize: number;
  activeSeat: number | null;
  toCall: number;
  canCheck: boolean;
  minRaise: number;
  totalPot: number;
  roundClosed: boolean;
  handOver: boolean;
  order: number[];
  playersLeft: number;
};

function blankPlayer(seat: number, heroSeat: number, stack: number): SingleDrawPlayer {
  const cards = seat === heroSeat ? Array<CardId | null>(5).fill(null) : null;
  return {
    seat,
    name: seat === heroSeat ? "Hero" : "",
    stack,
    cards,
    startingCards: cards ? [...cards] : null,
  };
}

export function initialSingleDrawState(args: {
  playerCount?: number;
  heroSeat?: number;
  sb?: number;
  bb?: number;
  stack?: number;
} = {}): SingleDrawState {
  const playerCount = args.playerCount ?? 6;
  const heroSeat = args.heroSeat ?? 0;
  const stack = args.stack ?? 200;
  if (playerCount < 2 || playerCount > 8) {
    throw new Error("Single Draw supports 2 to 8 players");
  }
  if (heroSeat < 0 || heroSeat >= playerCount) {
    throw new Error("Hero seat is outside the table");
  }
  const sb = args.sb ?? 1;
  const bb = args.bb ?? 2;
  if (sb <= 0 || bb <= 0 || sb > bb) {
    throw new Error("Blinds must be positive and the big blind must be largest");
  }
  if (stack <= 0) throw new Error("Starting stack must be positive");
  return {
    variant: "2-7_SINGLE_DRAW",
    phase: "setup",
    playerCount,
    players: Array.from({ length: playerCount }, (_, seat) =>
      blankPlayer(seat, heroSeat, stack),
    ),
    heroSeat,
    sb,
    bb,
    actions: [],
    draws: [],
    exchange: null,
    muckedSeats: [],
    history: [],
  };
}

function cloneCore(state: SingleDrawCoreState): SingleDrawCoreState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      cards: player.cards ? [...player.cards] : null,
      startingCards: player.startingCards ? [...player.startingCards] : null,
    })),
    actions: state.actions.map((action) => ({ ...action })),
    draws: state.draws.map((draw) => ({
      ...draw,
      discardIndexes: draw.discardIndexes ? [...draw.discardIndexes] : undefined,
      discardedCards: draw.discardedCards ? [...draw.discardedCards] : undefined,
      replacementCards: draw.replacementCards
        ? [...draw.replacementCards]
        : undefined,
    })),
    exchange: state.exchange
      ? {
          ...state.exchange,
          order: [...state.exchange.order],
          decisions: state.exchange.decisions.map((decision) => ({ ...decision })),
        }
      : null,
    muckedSeats: [...state.muckedSeats],
  };
}

function coreOf(state: SingleDrawState): SingleDrawCoreState {
  return cloneCore({
    variant: state.variant,
    phase: state.phase,
    playerCount: state.playerCount,
    players: state.players,
    heroSeat: state.heroSeat,
    sb: state.sb,
    bb: state.bb,
    actions: state.actions,
    draws: state.draws,
    exchange: state.exchange,
    muckedSeats: state.muckedSeats,
  });
}

function commit(
  state: SingleDrawState,
  next: SingleDrawCoreState,
): SingleDrawState {
  return { ...next, history: [...state.history, coreOf(state)] };
}

export function undoSingleDraw(state: SingleDrawState): SingleDrawState {
  const previous = state.history[state.history.length - 1];
  if (!previous) return state;
  return {
    ...cloneCore(previous),
    history: state.history.slice(0, -1),
  };
}

function completeCards(cards: (CardId | null)[] | null): CardId[] | null {
  if (!cards || cards.length !== 5 || cards.some((card) => !card)) return null;
  return cards as CardId[];
}

function assertUniqueKnownCards(players: SingleDrawPlayer[]): void {
  const seen = new Set<CardId>();
  for (const player of players) {
    for (const card of player.cards ?? []) {
      if (!card) continue;
      if (seen.has(card)) throw new Error(`Card is already in use: ${card}`);
      seen.add(card);
    }
  }
}

export function setSingleDrawStartingCards(
  state: SingleDrawState,
  seat: number,
  cards: (CardId | null)[] | null,
): SingleDrawState {
  if (state.phase !== "setup") throw new Error("Starting cards are locked");
  assertSeat(state, seat);
  if (cards && cards.length !== 5) throw new Error("A draw hand needs 5 cards");
  const players = state.players.map((player) =>
    player.seat === seat
      ? {
          ...player,
          cards: cards ? [...cards] : null,
          startingCards: cards ? [...cards] : null,
        }
      : player,
  );
  assertUniqueKnownCards(players);
  return commit(state, { ...coreOf(state), players });
}

export function updateSingleDrawPlayer(
  state: SingleDrawState,
  seat: number,
  patch: { name?: string; stack?: number },
): SingleDrawState {
  if (state.phase !== "setup") throw new Error("Player setup is locked");
  assertSeat(state, seat);
  if (patch.stack !== undefined && patch.stack <= 0) {
    throw new Error("Starting stack must be positive");
  }
  const players = state.players.map((player) =>
    player.seat === seat ? { ...player, ...patch } : player,
  );
  return commit(state, { ...coreOf(state), players });
}

export function startSingleDrawHand(state: SingleDrawState): SingleDrawState {
  if (state.phase !== "setup") throw new Error("Hand has already started");
  if (!completeCards(state.players[state.heroSeat]?.cards ?? null)) {
    throw new Error("Hero needs 5 starting cards");
  }
  return commit(state, { ...coreOf(state), phase: "predraw" });
}

function blindSeats(playerCount: number): { sb: number; bb: number } {
  return playerCount === 2 ? { sb: 0, bb: 1 } : { sb: 1, bb: 2 };
}

function assertSeat(state: SingleDrawCoreState, seat: number): void {
  if (!Number.isInteger(seat) || seat < 0 || seat >= state.playerCount) {
    throw new Error(`Seat ${seat} is outside the table`);
  }
}

function foldedSeats(state: SingleDrawCoreState): Set<number> {
  return new Set(
    state.actions
      .filter((action) => action.action === "fold")
      .map((action) => action.seat),
  );
}

function roundCommits(
  state: SingleDrawCoreState,
  round: DrawBettingRound,
  previous: Record<number, number>,
): Record<number, number> {
  return replayBettingRound(state, round, previous).bets;
}

function replayBettingRound(
  state: SingleDrawCoreState,
  round: DrawBettingRound,
  previous: Record<number, number>,
): {
  bets: Record<number, number>;
  lastBet: number;
  lastRaiseSize: number;
  acted: Set<number>;
} {
  const bets: Record<number, number> = {};
  const stackOf = (seat: number) => state.players[seat]?.stack ?? 0;
  const cap = (seat: number, target: number) =>
    Math.min(target, Math.max(0, stackOf(seat) - (previous[seat] ?? 0)));
  let lastBet = 0;
  let lastRaiseSize = state.bb;
  const acted = new Set<number>();

  if (round === "predraw") {
    const blinds = blindSeats(state.playerCount);
    bets[blinds.sb] = cap(blinds.sb, state.sb);
    bets[blinds.bb] = cap(blinds.bb, state.bb);
    lastBet = bets[blinds.bb] ?? 0;
  }

  for (const action of state.actions) {
    if (action.round !== round) continue;
    acted.add(action.seat);
    if (action.action === "fold" || action.action === "check") continue;
    if (action.action === "call") {
      bets[action.seat] = cap(action.seat, lastBet);
      continue;
    }
    const target = cap(action.seat, action.amount ?? 0);
    bets[action.seat] = target;
    if (target > lastBet) {
      const raiseSize = target - lastBet;
      lastBet = target;
      // A short all-in changes the price but does not establish a smaller
      // legal raise size or reopen action as a full raise would.
      if (raiseSize >= lastRaiseSize) {
        lastRaiseSize = raiseSize;
        acted.clear();
        acted.add(action.seat);
      }
    }
  }
  return { bets, lastBet, lastRaiseSize, acted };
}

function sumCommits(
  state: SingleDrawCoreState,
  refundUncalled: boolean,
): Record<number, number> {
  const total: Record<number, number> = {};
  for (const round of ["predraw", "postdraw"] as const) {
    const bets = roundCommits(state, round, total);
    if (refundUncalled) applyUncalledRefund(bets);
    for (const [seat, amount] of Object.entries(bets)) {
      total[Number(seat)] = (total[Number(seat)] ?? 0) + amount;
    }
  }
  return total;
}

function applyUncalledRefund(bets: Record<number, number>): void {
  const entries = Object.entries(bets)
    .map(([seat, amount]) => ({ seat: Number(seat), amount }))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => b.amount - a.amount);
  if (!entries.length) return;
  const second = entries[1]?.amount ?? 0;
  if (entries[0].amount > second) bets[entries[0].seat] = second;
}

export function singleDrawCommittedBySeat(
  state: SingleDrawCoreState,
): Record<number, number> {
  return sumCommits(state, false);
}

export function singleDrawCommittedBySeatFinal(
  state: SingleDrawCoreState,
): Record<number, number> {
  return sumCommits(state, true);
}

export function singleDrawTotalPot(state: SingleDrawCoreState): number {
  return Object.values(singleDrawCommittedBySeat(state)).reduce(
    (sum, amount) => sum + amount,
    0,
  );
}

export function deriveSingleDrawBetting(
  state: SingleDrawCoreState,
): DerivedDrawBetting | null {
  const round =
    state.phase === "predraw"
      ? "predraw"
      : state.phase === "postdraw"
        ? "postdraw"
        : null;
  if (!round) return null;

  const folded = foldedSeats(state);
  const previous: Record<number, number> = {};
  if (round === "postdraw") {
    Object.assign(previous, roundCommits(state, "predraw", {}));
  }
  const replay = replayBettingRound(state, round, previous);
  const { bets, lastBet, lastRaiseSize, acted } = replay;
  const roundActions = state.actions.filter((action) => action.round === round);

  const committed = singleDrawCommittedBySeat(state);
  const allIn = new Set<number>();
  for (const player of state.players) {
    if ((committed[player.seat] ?? 0) >= player.stack) allIn.add(player.seat);
  }

  const order =
    round === "predraw"
      ? preflopOrder(state.playerCount, false)
      : postflopOrder(state.playerCount);
  const actionable = order.filter(
    (seat) => !folded.has(seat) && !allIn.has(seat),
  );
  let needsAction = actionable.filter(
    (seat) => (bets[seat] ?? 0) < lastBet || !acted.has(seat),
  );

  const playersLeft = state.playerCount - folded.size;
  if (playersLeft <= 1) {
    needsAction = [];
  } else if (actionable.length === 1 && (bets[actionable[0]] ?? 0) >= lastBet) {
    // There is nobody with chips left who can respond to another wager.
    needsAction = [];
  }

  let activeSeat: number | null = null;
  if (needsAction.length) {
    const lastActor = roundActions.at(-1)?.seat;
    if (lastActor === undefined) activeSeat = needsAction[0];
    else {
      const index = order.indexOf(lastActor);
      const rotated =
        index < 0
          ? order
          : [...order.slice(index + 1), ...order.slice(0, index + 1)];
      activeSeat = rotated.find((seat) => needsAction.includes(seat)) ?? needsAction[0];
    }
  }

  const activeBet = activeSeat === null ? 0 : bets[activeSeat] ?? 0;
  return {
    round,
    folded,
    allIn,
    committed,
    bets,
    lastBet,
    lastRaiseSize,
    activeSeat,
    toCall: Math.max(0, lastBet - activeBet),
    canCheck: lastBet - activeBet <= 0,
    minRaise: lastBet === 0 ? state.bb : lastBet + Math.max(lastRaiseSize, state.bb),
    totalPot: singleDrawTotalPot(state),
    roundClosed: activeSeat === null,
    handOver: playersLeft <= 1,
    order,
    playersLeft,
  };
}

export function recordSingleDrawAction(
  state: SingleDrawState,
  input: { seat: number; action: ActionType; amount?: number },
): SingleDrawState {
  const derived = deriveSingleDrawBetting(state);
  if (!derived) throw new Error("No betting round is active");
  if (derived.activeSeat !== input.seat) {
    throw new Error(`Seat ${derived.activeSeat ?? "none"} must act next`);
  }
  if (input.action === "check" && !derived.canCheck) {
    throw new Error("Cannot check while facing a bet");
  }
  if (input.action === "call" && derived.canCheck) {
    throw new Error("Nothing to call");
  }
  if (input.action === "bet" && derived.lastBet > 0) {
    throw new Error("Use raise while facing an existing bet");
  }
  if (input.action === "raise" && derived.lastBet === 0) {
    throw new Error("Use bet when no bet exists");
  }

  let amount = input.amount;
  if (input.action === "bet" || input.action === "raise") {
    if (amount === undefined || amount <= derived.lastBet) {
      throw new Error("Bet or raise must increase the current bet");
    }
    const currentRoundCommit = derived.bets[input.seat] ?? 0;
    const remaining = Math.max(
      0,
      (state.players[input.seat]?.stack ?? 0) -
        (derived.committed[input.seat] ?? 0),
    );
    const allInTarget = currentRoundCommit + remaining;
    amount = Math.min(amount, allInTarget);
    if (amount < derived.minRaise && amount !== allInTarget) {
      throw new Error(`Minimum raise is ${derived.minRaise}`);
    }
  }

  const round = derived.round;
  const roundIndex = state.actions.filter((action) => action.round === round).length;
  const action: SingleDrawAction = {
    id: `action-${round}-${roundIndex}`,
    round,
    seat: input.seat,
    action: input.action,
    ...(amount !== undefined ? { amount } : {}),
  };
  return commit(state, {
    ...coreOf(state),
    actions: [...state.actions, action],
  });
}

export function advanceSingleDrawPhase(state: SingleDrawState): SingleDrawState {
  if (state.phase === "predraw" || state.phase === "postdraw") {
    const derived = deriveSingleDrawBetting(state)!;
    if (!derived.roundClosed) throw new Error("Betting round is still open");
    if (derived.handOver) {
      return commit(state, { ...coreOf(state), phase: "done" });
    }
    if (state.phase === "postdraw") {
      return commit(state, { ...coreOf(state), phase: "showdown" });
    }
    const order = postflopOrder(state.playerCount).filter(
      (seat) => !derived.folded.has(seat),
    );
    return commit(state, {
      ...coreOf(state),
      phase: "draw",
      exchange: startDrawExchange({
        variant: "2-7_SINGLE_DRAW",
        round: 1,
        order,
      }),
    });
  }

  if (state.phase === "draw") {
    if (!state.exchange || !isDrawExchangeComplete(state.exchange)) {
      throw new Error("Every remaining player must declare a draw");
    }
    const folded = foldedSeats(state);
    const committed = singleDrawCommittedBySeat(state);
    const canBet = state.players.filter(
      (player) =>
        !folded.has(player.seat) &&
        (committed[player.seat] ?? 0) < player.stack,
    );
    return commit(state, {
      ...coreOf(state),
      phase: canBet.length >= 2 ? "postdraw" : "showdown",
      exchange: null,
    });
  }

  if (state.phase === "showdown") {
    return commit(state, { ...coreOf(state), phase: "done" });
  }
  throw new Error(`Cannot advance from ${state.phase}`);
}

export function recordSingleDrawDecision(
  state: SingleDrawState,
  input: {
    seat: number;
    count: number;
    discardIndexes?: number[];
    replacementCards?: CardId[];
  },
): SingleDrawState {
  if (state.phase !== "draw" || !state.exchange) {
    throw new Error("No draw exchange is active");
  }
  if (currentDrawSeat(state.exchange) !== input.seat) {
    throw new Error(`Seat ${currentDrawSeat(state.exchange)} must draw next`);
  }

  let players = state.players;
  let discardedCards: CardId[] | undefined;
  if (input.seat === state.heroSeat) {
    const cards = completeCards(state.players[input.seat]?.cards ?? null);
    if (!cards) throw new Error("Hero needs a complete hand before drawing");
    const indexes = input.discardIndexes ?? [];
    const replacements = input.replacementCards ?? [];
    if (indexes.length !== input.count || replacements.length !== input.count) {
      throw new Error("Hero draw needs exact discard slots and replacements");
    }
    const otherKnownCards = state.players.flatMap((player) =>
      player.seat === input.seat ? [] : (player.cards ?? []).filter(Boolean),
    ) as CardId[];
    const result = applyKnownDraw({
      cards,
      discardIndexes: indexes,
      replacementCards: replacements,
      unavailableCards: otherKnownCards,
    });
    discardedCards = result.discardedCards;
    players = state.players.map((player) =>
      player.seat === input.seat ? { ...player, cards: result.cards } : player,
    );
  } else if (input.discardIndexes || input.replacementCards) {
    throw new Error("Opponent draws record a public count only");
  }

  const exchange = recordDrawDecision(state.exchange, {
    seat: input.seat,
    count: input.count,
    ...(input.discardIndexes
      ? { discardIndexes: [...input.discardIndexes] }
      : {}),
    ...(discardedCards ? { discardedCards } : {}),
    ...(input.replacementCards
      ? { replacementCards: [...input.replacementCards] }
      : {}),
  });
  const decision = exchange.decisions.at(-1)!;
  return commit(state, {
    ...coreOf(state),
    players,
    exchange,
    draws: [...state.draws, decision],
  });
}

export function setSingleDrawShownCards(
  state: SingleDrawState,
  seat: number,
  cards: CardId[],
): SingleDrawState {
  if (state.phase !== "showdown" && state.phase !== "done") {
    throw new Error("Cards can only be shown at showdown");
  }
  assertSeat(state, seat);
  if (cards.length !== 5 || new Set(cards).size !== 5) {
    throw new Error("A shown draw hand must contain 5 unique cards");
  }
  const unavailable = new Set<CardId>();
  for (const player of state.players) {
    if (player.seat === seat) continue;
    for (const card of player.cards ?? []) if (card) unavailable.add(card);
  }
  for (const draw of state.draws) {
    for (const card of draw.discardedCards ?? []) unavailable.add(card);
    if (draw.seat !== seat) {
      for (const card of draw.replacementCards ?? []) unavailable.add(card);
    }
  }
  const conflict = cards.find((card) => unavailable.has(card));
  if (conflict) throw new Error(`Card is already in use: ${conflict}`);
  const players = state.players.map((player) =>
    player.seat === seat ? { ...player, cards: [...cards] } : player,
  );
  assertUniqueKnownCards(players);
  return commit(state, { ...coreOf(state), players });
}

export function setSingleDrawMucked(
  state: SingleDrawState,
  seat: number,
  mucked: boolean,
): SingleDrawState {
  if (state.phase !== "showdown" && state.phase !== "done") {
    throw new Error("Muck decisions belong to showdown");
  }
  assertSeat(state, seat);
  const muckedSeats = new Set(state.muckedSeats);
  if (mucked) muckedSeats.add(seat);
  else muckedSeats.delete(seat);
  return commit(state, {
    ...coreOf(state),
    muckedSeats: [...muckedSeats],
  });
}

export function buildSingleDrawTimeline(
  state: SingleDrawCoreState,
): HandTimelineEvent[] {
  const events: HandTimelineEvent[] = [];
  for (const player of state.players) {
    for (let cardIndex = 0; cardIndex < 5; cardIndex++) {
      events.push({
        id: `deal-initial-seat-${player.seat}-card-${cardIndex}`,
        type: "deal",
        round: "initial-deal",
        seat: player.seat,
        card: player.startingCards?.[cardIndex] ?? undefined,
        cardIndex,
        visibility: "down",
      });
    }
  }
  const blinds = blindSeats(state.playerCount);
  events.push(
    {
      id: "forced-small-blind",
      type: "forced-bet",
      round: "predraw",
      seat: blinds.sb,
      kind: "small-blind",
      amount: state.sb,
    },
    {
      id: "forced-big-blind",
      type: "forced-bet",
      round: "predraw",
      seat: blinds.bb,
      kind: "big-blind",
      amount: state.bb,
    },
  );
  const actionEvent = (action: SingleDrawAction): HandTimelineEvent => ({
    id: action.id,
    type: "action",
    round: action.round,
    seat: action.seat,
    action: action.action,
    ...(action.amount !== undefined ? { amount: action.amount } : {}),
  });
  events.push(
    ...state.actions.filter((action) => action.round === "predraw").map(actionEvent),
    ...state.draws.map(drawDecisionToTimelineEvent),
    ...state.actions.filter((action) => action.round === "postdraw").map(actionEvent),
  );
  const folded = foldedSeats(state);
  for (const player of state.players) {
    if (folded.has(player.seat)) continue;
    if (state.muckedSeats.includes(player.seat)) {
      events.push({
        id: `muck-seat-${player.seat}`,
        type: "muck",
        round: "showdown",
        seat: player.seat,
      });
      continue;
    }
    const cards = completeCards(player.cards);
    if (cards) {
      events.push({
        id: `show-seat-${player.seat}`,
        type: "show",
        round: "showdown",
        seat: player.seat,
        cards: [...cards],
      });
    }
  }
  return events;
}
