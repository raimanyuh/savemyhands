// Recorder state + reducer + derived street state.

import { POSITION_NAMES, postflopOrder, preflopOrder } from "./lib";

export type Street = "preflop" | "flop" | "turn" | "river";
export type Phase = "setup" | Street | "showdown" | "done";

export type ActionType = "fold" | "check" | "call" | "bet" | "raise";

export type Action = {
  street: Street;
  seat: number;
  action: ActionType;
  amount?: number;
};

export type Player = {
  seat: number;
  name: string;
  stack: number;
  cards: (string | null)[] | null; // [c1, c2] or null = card backs
};

export type RecorderState = {
  phase: Phase;
  playerCount: number;
  players: Player[];
  sb: number;
  bb: number;
  straddleOn: boolean;
  straddleAmt: number;
  board: (string | null)[]; // [flop1, flop2, flop3, turn, river]
  actions: Action[];
};

export type Event =
  | { type: "setPlayerCount"; n: number }
  | { type: "updatePlayer"; seat: number; patch: Partial<Player> }
  | { type: "setBlinds"; sb: number; bb: number }
  | { type: "setStraddle"; on: boolean; amt?: number }
  | { type: "setHeroCard"; idx: 0 | 1; card: string }
  | { type: "setOppCard"; seat: number; idx: 0 | 1; card: string }
  | { type: "clearCard"; card: string }
  | { type: "setBoard"; idx: number; card: string }
  | { type: "startPlay" }
  | { type: "recordAction"; action: Omit<Action, "street"> }
  | { type: "undoAction" }
  | { type: "advanceStreet" }
  | { type: "rewindStreet" }
  | { type: "goShowdown" }
  | { type: "finish" };

export function defaultPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    seat: i,
    name: i === 0 ? "Hero" : "",
    stack: 200,
    cards: i === 0 ? [null, null] : null,
  }));
}

export function initialState(n = 6): RecorderState {
  return {
    phase: "setup",
    playerCount: n,
    players: defaultPlayers(n),
    sb: 1,
    bb: 2,
    straddleOn: false,
    straddleAmt: 4,
    board: [null, null, null, null, null],
    actions: [],
  };
}

export function reducer(state: RecorderState, ev: Event): RecorderState {
  switch (ev.type) {
    case "setPlayerCount": {
      const n = ev.n;
      const players: Player[] = Array.from({ length: n }, (_, i) =>
        state.players[i] ?? {
          seat: i,
          name: i === 0 ? "Hero" : "",
          stack: 200,
          cards: i === 0 ? [null, null] : null,
        },
      );
      return { ...state, playerCount: n, players };
    }
    case "updatePlayer": {
      const players = state.players.map((p) =>
        p.seat === ev.seat ? { ...p, ...ev.patch } : p,
      );
      return { ...state, players };
    }
    case "setBlinds":
      return { ...state, sb: ev.sb, bb: ev.bb };
    case "setStraddle":
      return {
        ...state,
        straddleOn: ev.on,
        straddleAmt: ev.amt ?? state.straddleAmt,
      };
    case "setHeroCard": {
      const players = state.players.map((p) => {
        if (p.seat !== 0) return p;
        const cards = (p.cards ?? [null, null]).slice() as (string | null)[];
        cards[ev.idx] = ev.card;
        return { ...p, cards };
      });
      return { ...state, players };
    }
    case "setOppCard": {
      const players = state.players.map((p) => {
        if (p.seat !== ev.seat) return p;
        const cards = (p.cards ?? [null, null]).slice() as (string | null)[];
        cards[ev.idx] = ev.card;
        return { ...p, cards };
      });
      return { ...state, players };
    }
    case "clearCard": {
      const players = state.players.map((p) => {
        if (!p.cards) return p;
        return { ...p, cards: p.cards.map((c) => (c === ev.card ? null : c)) };
      });
      const board = state.board.map((c) => (c === ev.card ? null : c));
      return { ...state, players, board };
    }
    case "setBoard": {
      const board = state.board.slice();
      board[ev.idx] = ev.card;
      return { ...state, board };
    }
    case "startPlay":
      return { ...state, phase: "preflop" };
    case "recordAction": {
      const a: Action = { ...ev.action, street: state.phase as Street };
      return { ...state, actions: [...state.actions, a] };
    }
    case "undoAction": {
      if (!state.actions.length) return state;
      return { ...state, actions: state.actions.slice(0, -1) };
    }
    case "advanceStreet": {
      const order: Phase[] = ["preflop", "flop", "turn", "river", "showdown"];
      const i = order.indexOf(state.phase as Phase);
      const next = i >= 0 && i < order.length - 1 ? order[i + 1] : state.phase;
      return { ...state, phase: next };
    }
    case "rewindStreet": {
      const order: Phase[] = ["setup", "preflop", "flop", "turn", "river", "showdown"];
      const i = order.indexOf(state.phase as Phase);
      const prev = i > 0 ? order[i - 1] : state.phase;
      return { ...state, phase: prev };
    }
    case "goShowdown":
      return { ...state, phase: "showdown" };
    case "finish":
      return { ...state, phase: "done" };
    default:
      return state;
  }
}

// Total pot across all streets. Re-derives from blinds + action log so it
// works regardless of phase (showdown included).
export function totalPot(state: RecorderState): number {
  const { playerCount, sb, bb, straddleOn, straddleAmt, actions } = state;
  const streets: Street[] = ["preflop", "flop", "turn", "river"];
  let pot = 0;
  for (const ph of streets) {
    const streetBets: Record<number, number> = {};
    let lb = 0;
    if (ph === "preflop") {
      if (playerCount === 2) {
        streetBets[0] = sb;
        streetBets[1] = bb;
        lb = bb;
      } else {
        streetBets[1] = sb;
        streetBets[2] = bb;
        lb = bb;
        if (straddleOn && playerCount >= 4) {
          streetBets[3] = straddleAmt;
          lb = straddleAmt;
        }
      }
    }
    const acts = actions.filter((a) => a.street === ph);
    for (const a of acts) {
      if (a.action === "fold" || a.action === "check") continue;
      if (a.action === "call") {
        streetBets[a.seat] = lb;
        continue;
      }
      if (a.action === "bet" || a.action === "raise") {
        streetBets[a.seat] = a.amount ?? 0;
        lb = a.amount ?? 0;
      }
    }
    pot += Object.values(streetBets).reduce((s, v) => s + (v || 0), 0);
  }
  return pot;
}

export type DerivedStreet = {
  folded: Set<number>;
  bets: Record<number, number>;
  lastBet: number;
  lastRaiseSize: number;
  lastAggressor: number | null;
  activeSeat: number | null;
  toCall: number;
  canCheck: boolean;
  minRaise: number;
  totalPot: number;
  streetClosed: boolean;
  handOver: boolean;
  order: number[];
  playersLeft: number;
};

export function deriveStreet(state: RecorderState): DerivedStreet | null {
  const { phase, playerCount, sb, bb, straddleOn, straddleAmt, actions } = state;
  if (phase === "setup" || phase === "showdown" || phase === "done") return null;

  const folded = new Set<number>();
  for (const a of actions) if (a.action === "fold") folded.add(a.seat);

  const streetActions = actions.filter((a) => a.street === phase);

  const bets: Record<number, number> = {};
  let lastBet = 0;
  let lastRaiseSize = 0;
  let lastAggressor: number | null = null;

  if (phase === "preflop") {
    if (playerCount === 2) {
      bets[0] = sb;
      bets[1] = bb;
      lastBet = bb;
      lastRaiseSize = bb;
    } else {
      bets[1] = sb;
      bets[2] = bb;
      lastBet = bb;
      lastRaiseSize = bb;
      if (straddleOn && playerCount >= 4) {
        bets[3] = straddleAmt;
        lastBet = straddleAmt;
        lastRaiseSize = straddleAmt - bb;
      }
    }
  }

  const actedThisStreet = new Set<number>();
  for (const a of streetActions) {
    actedThisStreet.add(a.seat);
    if (a.action === "fold" || a.action === "check") continue;
    if (a.action === "call") {
      bets[a.seat] = lastBet;
      continue;
    }
    if (a.action === "bet" || a.action === "raise") {
      const newAmt = a.amount ?? 0;
      lastRaiseSize = newAmt - lastBet;
      bets[a.seat] = newAmt;
      lastBet = newAmt;
      lastAggressor = a.seat;
      actedThisStreet.clear();
      actedThisStreet.add(a.seat);
    }
  }

  const orderArr =
    phase === "preflop"
      ? preflopOrder(playerCount, straddleOn && playerCount >= 4)
      : postflopOrder(playerCount);
  const order = orderArr.filter((s) => !folded.has(s));

  const needsAction = order.filter((s) => {
    const committed = bets[s] || 0;
    if (committed < lastBet) return true;
    if (!actedThisStreet.has(s)) return true;
    return false;
  });

  let activeSeat: number | null = null;
  if (needsAction.length > 0) {
    const lastActor =
      streetActions.length > 0
        ? streetActions[streetActions.length - 1].seat
        : null;
    if (lastActor === null) {
      activeSeat = needsAction[0];
    } else {
      const idx = order.indexOf(lastActor);
      const rotated = [...order.slice(idx + 1), ...order.slice(0, idx + 1)];
      activeSeat = rotated.find((s) => needsAction.includes(s)) ?? needsAction[0];
    }
  }

  // Rebuild totalPot across streets for display.
  const streets: Street[] = ["preflop", "flop", "turn", "river"];
  let totalPotSum = 0;
  for (const ph of streets) {
    if (streets.indexOf(ph) > streets.indexOf(phase as Street)) break;
    const streetBetsAll: Record<number, number> = {};
    let lb = 0;
    if (ph === "preflop") {
      if (playerCount === 2) {
        streetBetsAll[0] = sb;
        streetBetsAll[1] = bb;
        lb = bb;
      } else {
        streetBetsAll[1] = sb;
        streetBetsAll[2] = bb;
        lb = bb;
        if (straddleOn && playerCount >= 4) {
          streetBetsAll[3] = straddleAmt;
          lb = straddleAmt;
        }
      }
    }
    const acts = actions.filter((a) => a.street === ph);
    for (const a of acts) {
      if (a.action === "fold" || a.action === "check") continue;
      if (a.action === "call") {
        streetBetsAll[a.seat] = lb;
        continue;
      }
      if (a.action === "bet" || a.action === "raise") {
        streetBetsAll[a.seat] = a.amount ?? 0;
        lb = a.amount ?? 0;
      }
    }
    totalPotSum += Object.values(streetBetsAll).reduce(
      (s, v) => s + (v || 0),
      0,
    );
  }

  const committed = activeSeat !== null ? bets[activeSeat] || 0 : 0;
  const toCall = lastBet - committed;
  const canCheck = toCall === 0;
  const minRaise = Math.max(lastBet + Math.max(lastRaiseSize, bb), bb * 2);
  const playersLeft = playerCount - folded.size;
  const streetClosed = activeSeat === null;
  const handOver = playersLeft <= 1;

  return {
    folded,
    bets,
    lastBet,
    lastRaiseSize,
    lastAggressor,
    activeSeat,
    toCall,
    canCheck,
    minRaise,
    totalPot: totalPotSum,
    streetClosed,
    handOver,
    order: orderArr,
    playersLeft,
  };
}

// Format an action for the action log.
export function formatAction(a: Action, playerCount: number): string {
  const name = POSITION_NAMES[playerCount]?.[a.seat] ?? `Seat ${a.seat + 1}`;
  if (a.action === "fold") return `${name} folds`;
  if (a.action === "check") return `${name} checks`;
  if (a.action === "call") return `${name} calls`;
  if (a.action === "bet") return `${name} bets $${a.amount}`;
  if (a.action === "raise") return `${name} raises to $${a.amount}`;
  return name;
}
