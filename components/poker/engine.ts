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
  // Cycle index of the hero (0=BTN, 1=SB, 2=BB, ...). The visual layer
  // always renders the hero at the bottom-center seat regardless of this value.
  heroPosition: number;
  sb: number;
  bb: number;
  straddleOn: boolean;
  straddleAmt: number;
  board: (string | null)[]; // [flop1, flop2, flop3, turn, river]
  actions: Action[];
  // Surviving villains who declined to show at showdown. Treated as folded
  // for winner determination; replayer renders them dimmed without cards.
  muckedSeats: number[];
  // Title for the saved hand — editable at the top of the recorder.
  handName: string;
  // Free-text note + game metadata, surfaced on the recorder and in the replayer.
  notes: string;
  venue: string;
  date: string; // ISO yyyy-mm-dd
  // Per-action annotations, keyed by index into `actions`. Surface in the
  // replayer beneath the action narration when the corresponding step plays.
  annotations: Record<number, string>;
};

export type Event =
  | { type: "setPlayerCount"; n: number }
  | { type: "updatePlayer"; seat: number; patch: Partial<Player> }
  | { type: "setAllStacks"; stack: number }
  | { type: "setBlinds"; sb: number; bb: number }
  | { type: "setStraddle"; on: boolean; amt?: number }
  | { type: "setHeroPosition"; position: number }
  | { type: "setHeroCard"; idx: 0 | 1; card: string }
  | { type: "setOppCard"; seat: number; idx: 0 | 1; card: string }
  | { type: "clearCard"; card: string }
  | { type: "setBoard"; idx: number; card: string }
  | { type: "setHandName"; name: string }
  | { type: "setNotes"; notes: string }
  | { type: "setVenue"; venue: string }
  | { type: "setDate"; date: string }
  | { type: "setMuck"; seat: number; mucked: boolean }
  | { type: "clearMucks" }
  | { type: "startPlay" }
  | { type: "recordAction"; action: Omit<Action, "street"> }
  | { type: "undoAction" }
  | { type: "setAnnotation"; index: number; text: string }
  | { type: "advanceStreet" }
  | { type: "rewindStreet" }
  | { type: "goShowdown" }
  | { type: "finish" }
  | { type: "loadSetup"; setup: Partial<RecorderState> }
  | { type: "resetHand" };

export function defaultPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    seat: i,
    name: i === 0 ? "Hero" : "",
    stack: 200,
    cards: i === 0 ? [null, null] : null,
  }));
}

function todayIso(): string {
  // YYYY-MM-DD in the user's local timezone — input[type=date] expects this.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function initialState(n = 6): RecorderState {
  return {
    phase: "setup",
    playerCount: n,
    players: defaultPlayers(n),
    heroPosition: 0,
    sb: 1,
    bb: 2,
    straddleOn: false,
    straddleAmt: 4,
    board: [null, null, null, null, null],
    actions: [],
    muckedSeats: [],
    handName: "New hand",
    notes: "",
    venue: "",
    date: todayIso(),
    annotations: {},
  };
}

// Persisted setup defaults (player count, blinds, straddle, starting stack).
// Loaded into a fresh recorder so the user doesn't re-enter every time.
export type SetupDefaults = {
  playerCount: number;
  sb: number;
  bb: number;
  straddleOn: boolean;
  straddleAmt: number;
  defaultStack: number;
};

export const DEFAULTS_KEY = "smh:defaults";

export function readSetupDefaults(): SetupDefaults | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SetupDefaults>;
    if (
      typeof parsed.playerCount === "number" &&
      typeof parsed.sb === "number" &&
      typeof parsed.bb === "number" &&
      typeof parsed.defaultStack === "number"
    ) {
      return {
        playerCount: parsed.playerCount,
        sb: parsed.sb,
        bb: parsed.bb,
        straddleOn: !!parsed.straddleOn,
        straddleAmt: parsed.straddleAmt ?? parsed.bb * 2,
        defaultStack: parsed.defaultStack,
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function writeSetupDefaults(d: SetupDefaults) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d));
}

export function initialStateFromDefaults(): RecorderState {
  const d = readSetupDefaults();
  if (!d) return initialState(6);
  const base = initialState(d.playerCount);
  return {
    ...base,
    sb: d.sb,
    bb: d.bb,
    straddleOn: d.straddleOn,
    straddleAmt: d.straddleAmt,
    players: base.players.map((p) => ({ ...p, stack: d.defaultStack })),
  };
}

export function reducer(state: RecorderState, ev: Event): RecorderState {
  switch (ev.type) {
    case "setPlayerCount": {
      const n = ev.n;
      // Clamp hero position into the new range. If the hero's old cycle index
      // no longer exists (e.g., they were MP and we dropped to 4-handed),
      // collapse them to BTN and migrate their record.
      let heroPos = state.heroPosition;
      let players: Player[];
      if (heroPos >= n) {
        // Move hero data from old position into 0; truncate / extend array.
        const heroRecord = state.players[heroPos] ?? {
          seat: 0,
          name: "Hero",
          stack: 200,
          cards: [null, null],
        };
        players = Array.from({ length: n }, (_, i) =>
          i === 0
            ? { ...heroRecord, seat: 0 }
            : state.players[i] ?? {
                seat: i,
                name: "",
                stack: 200,
                cards: null,
              },
        );
        heroPos = 0;
      } else {
        players = Array.from({ length: n }, (_, i) =>
          state.players[i] ?? {
            seat: i,
            name: i === heroPos ? "Hero" : "",
            stack: 200,
            cards: i === heroPos ? [null, null] : null,
          },
        );
      }
      return { ...state, playerCount: n, heroPosition: heroPos, players };
    }
    case "updatePlayer": {
      const players = state.players.map((p) =>
        p.seat === ev.seat ? { ...p, ...ev.patch } : p,
      );
      return { ...state, players };
    }
    case "setAllStacks": {
      const players = state.players.map((p) => ({ ...p, stack: ev.stack }));
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
    case "setHeroPosition": {
      const old = state.heroPosition;
      const next = Math.max(0, Math.min(state.playerCount - 1, ev.position));
      if (old === next) return state;
      // Swap player records so the hero's name/stack/cards follow them to
      // their new cycle position. The "displaced" player gets the previous
      // hero slot (usually a default empty seat in setup).
      const players = state.players.slice();
      const tmp = players[old];
      players[old] = players[next];
      players[next] = tmp;
      return { ...state, heroPosition: next, players };
    }
    case "setHeroCard": {
      const heroIdx = state.heroPosition;
      const players = state.players.map((p, i) => {
        if (i !== heroIdx) return p;
        const cards = (p.cards ?? [null, null]).slice() as (string | null)[];
        cards[ev.idx] = ev.card;
        return { ...p, cards };
      });
      return { ...state, players };
    }
    case "setHandName":
      return { ...state, handName: ev.name };
    case "setMuck": {
      const set = new Set(state.muckedSeats);
      if (ev.mucked) set.add(ev.seat);
      else set.delete(ev.seat);
      return { ...state, muckedSeats: [...set] };
    }
    case "clearMucks":
      return { ...state, muckedSeats: [] };
    case "setNotes":
      return { ...state, notes: ev.notes };
    case "setVenue":
      return { ...state, venue: ev.venue };
    case "setDate":
      return { ...state, date: ev.date };
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
      // Drop the annotation tied to the removed action so indices stay aligned.
      const removedIdx = state.actions.length - 1;
      const annotations = { ...state.annotations };
      delete annotations[removedIdx];
      const newActions = state.actions.slice(0, -1);

      // Walk forward from preflop and advance through any street that's still
      // closed AND whose next-street cards remain on the board — i.e. replay
      // what the auto-advance effect would land on given this action set. Stop
      // at the first open street; that's our resolved phase.
      const streets: Street[] = ["preflop", "flop", "turn", "river"];
      let resolvedPhase: Phase = "preflop";
      for (const ph of streets) {
        const test = { ...state, actions: newActions, phase: ph };
        const d = deriveStreet(test);
        if (!d) {
          resolvedPhase = ph;
          break;
        }
        const nextFilled =
          ph === "preflop"
            ? !!(state.board[0] && state.board[1] && state.board[2])
            : ph === "flop"
              ? !!state.board[3]
              : ph === "turn"
                ? !!state.board[4]
                : false;
        if (d.streetClosed && nextFilled && ph !== "river") {
          resolvedPhase = streets[streets.indexOf(ph) + 1];
          continue;
        }
        resolvedPhase = ph;
        break;
      }

      // Clear any board cards that belong to streets we've fallen back past —
      // otherwise the felt would still show a flop/turn that nobody has acted on.
      const board = state.board.slice() as (string | null)[];
      if (resolvedPhase === "preflop") {
        for (let i = 0; i < 5; i++) board[i] = null;
      } else if (resolvedPhase === "flop") {
        board[3] = null;
        board[4] = null;
      } else if (resolvedPhase === "turn") {
        board[4] = null;
      }

      // If we rewound out of showdown, there can't be any leftover muck flags
      // that might be misapplied to the new phase.
      const muckedSeats =
        state.phase === "showdown" || state.phase === "done"
          ? []
          : state.muckedSeats;

      return {
        ...state,
        actions: newActions,
        annotations,
        phase: resolvedPhase,
        board,
        muckedSeats,
      };
    }
    case "setAnnotation": {
      const annotations = { ...state.annotations };
      const trimmed = ev.text.trim();
      if (trimmed) annotations[ev.index] = trimmed;
      else delete annotations[ev.index];
      return { ...state, annotations };
    }
    case "loadSetup": {
      // Merge a saved/default setup payload into the current state. Only used
      // pre-play to seed the recorder — after `startPlay` the action log is
      // live and shouldn't be overwritten.
      if (state.phase !== "setup") return state;
      return { ...state, ...ev.setup };
    }
    case "resetHand":
      // Wipe the current draft and re-seed from the user's saved defaults.
      // Used by Cancel — keeps the user on /record without losing their config.
      return initialStateFromDefaults();
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

// Per-seat total committed across all streets (blinds + every action).
// Used to display live stacks (initial - committed) and to detect all-in seats.
export function committedBySeat(state: RecorderState): Record<number, number> {
  const { playerCount, sb, bb, straddleOn, straddleAmt, actions } = state;
  const committed: Record<number, number> = {};
  const streets: Street[] = ["preflop", "flop", "turn", "river"];
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
    for (const [s, v] of Object.entries(streetBets)) {
      committed[Number(s)] = (committed[Number(s)] || 0) + (v || 0);
    }
  }
  return committed;
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
  allIn: Set<number>;
  // Cumulative chips committed by each seat across all streets (blinds + actions).
  committed: Record<number, number>;
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

  // Cumulative committed chips per seat — used both to display live stacks
  // and to drop all-in players out of the action loop.
  const committed = committedBySeat(state);
  const allIn = new Set<number>();
  for (const p of state.players) {
    if ((committed[p.seat] || 0) >= p.stack) allIn.add(p.seat);
  }

  const orderArr =
    phase === "preflop"
      ? preflopOrder(playerCount, straddleOn && playerCount >= 4)
      : postflopOrder(playerCount);
  // All-in seats can't act anymore — filter them out alongside folded.
  const order = orderArr.filter((s) => !folded.has(s) && !allIn.has(s));

  const needsAction = order.filter((s) => {
    const committedThisStreet = bets[s] || 0;
    if (committedThisStreet < lastBet) return true;
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
      // Resume from the seat right after lastActor in the FULL street order.
      // Using the filtered `order` here would lose lastActor's position once
      // they fold — which would silently restart the loop from the top and
      // skip seats that legitimately still need to act.
      const fullIdx = orderArr.indexOf(lastActor);
      if (fullIdx === -1) {
        activeSeat = needsAction[0];
      } else {
        const rotated = [
          ...orderArr.slice(fullIdx + 1),
          ...orderArr.slice(0, fullIdx + 1),
        ];
        activeSeat =
          rotated.find((s) => needsAction.includes(s)) ?? needsAction[0];
      }
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

  const committedThisStreet =
    activeSeat !== null ? bets[activeSeat] || 0 : 0;
  const toCall = lastBet - committedThisStreet;
  const canCheck = toCall === 0;
  const minRaise = Math.max(lastBet + Math.max(lastRaiseSize, bb), bb * 2);
  const playersLeft = playerCount - folded.size;
  const streetClosed = activeSeat === null;
  const handOver = playersLeft <= 1;

  return {
    folded,
    allIn,
    committed,
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
