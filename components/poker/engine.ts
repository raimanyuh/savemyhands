// Recorder state + reducer + derived street state.

import { POSITION_NAMES, postflopOrder, preflopOrder } from "./lib";

export type Street = "preflop" | "flop" | "turn" | "river";
export type Phase = "setup" | Street | "showdown" | "done";

export type ActionType = "fold" | "check" | "call" | "bet" | "raise";

// Supported game types. NLHE is no-limit Hold'em (2 hole cards, best 5 of 7).
// PLO4 / PLO5 are pot-limit Omaha with 4 / 5 hole cards and the
// must-use-exactly-2-from-hand-and-3-from-board rule. Pot-limit betting
// caps raises at the pot size; the recorder's action bar enforces the
// cap, but the underlying action log is shape-identical to NLHE.
export type GameType = "NLHE" | "PLO4" | "PLO5";

export function holeCardCount(gameType: GameType): 2 | 4 | 5 {
  if (gameType === "PLO5") return 5;
  if (gameType === "PLO4") return 4;
  return 2;
}

export function isPotLimit(gameType: GameType): boolean {
  return gameType === "PLO4" || gameType === "PLO5";
}

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
  // Game variant. Default NLHE for backward-compat; switching to PLO4 /
  // PLO5 resizes each player's `cards` array, swaps to Omaha's
  // 2-from-hand + 3-from-board hand evaluator, and caps raises at pot.
  gameType: GameType;
  // Cycle index of the hero (0=BTN, 1=SB, 2=BB, ...). The visual layer
  // always renders the hero at the bottom-center seat regardless of this value.
  heroPosition: number;
  sb: number;
  bb: number;
  straddleOn: boolean;
  straddleAmt: number;
  // Bomb pot variant — every player antes a flat amount and play starts
  // directly on the flop (no preflop action). Blinds + straddle are
  // ignored when this is true. Action on the flop starts left of the
  // button via the existing postflop order. The bb still drives the
  // postflop min-bet calculation.
  bombPotOn: boolean;
  bombPotAmt: number;
  // Double board variant — every street deals two boards. The pot is
  // split evenly between the two at showdown (with quartering when one
  // board chops). Betting is shared (both boards see the same action
  // log). `board2` is unused when `doubleBoardOn` is false.
  doubleBoardOn: boolean;
  board: (string | null)[]; // [flop1, flop2, flop3, turn, river]
  board2: (string | null)[]; // same shape as `board`; only meaningful when doubleBoardOn
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
  | { type: "setBombPot"; on: boolean; amt?: number }
  | { type: "setDoubleBoard"; on: boolean }
  | { type: "setGameType"; gameType: GameType }
  | { type: "setHeroPosition"; position: number }
  | { type: "setHeroCard"; idx: number; card: string }
  | { type: "setOppCard"; seat: number; idx: number; card: string }
  | { type: "clearCard"; card: string }
  | { type: "setBoard"; idx: number; card: string; boardIdx?: 0 | 1 }
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

export function defaultPlayers(n: number, holeCount = 2): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    seat: i,
    name: i === 0 ? "Hero" : "",
    stack: 200,
    cards: i === 0 ? Array.from({ length: holeCount }, () => null) : null,
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

export function initialState(n = 6, gameType: GameType = "NLHE"): RecorderState {
  return {
    phase: "setup",
    playerCount: n,
    players: defaultPlayers(n, holeCardCount(gameType)),
    gameType,
    heroPosition: 0,
    sb: 1,
    bb: 2,
    straddleOn: false,
    straddleAmt: 4,
    bombPotOn: false,
    bombPotAmt: 10,
    doubleBoardOn: false,
    board: [null, null, null, null, null],
    board2: [null, null, null, null, null],
    actions: [],
    muckedSeats: [],
    handName: "New hand",
    notes: "",
    venue: "",
    date: todayIso(),
    annotations: {},
  };
}

// Persisted setup defaults (player count, blinds, straddle, bomb pot,
// starting stack). Loaded into a fresh recorder so the user doesn't
// re-enter every time.
export type SetupDefaults = {
  playerCount: number;
  sb: number;
  bb: number;
  straddleOn: boolean;
  straddleAmt: number;
  bombPotOn: boolean;
  bombPotAmt: number;
  doubleBoardOn: boolean;
  gameType: GameType;
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
        bombPotOn: !!parsed.bombPotOn,
        bombPotAmt: parsed.bombPotAmt ?? 10,
        doubleBoardOn: !!parsed.doubleBoardOn,
        gameType:
          parsed.gameType === "PLO4" ||
          parsed.gameType === "PLO5" ||
          parsed.gameType === "NLHE"
            ? parsed.gameType
            : "NLHE",
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
  // initialState seeds players[i].cards with the right hole-card count
  // for the saved game type; the spread + stack patch below keep that.
  const base = initialState(d.playerCount, d.gameType);
  return {
    ...base,
    sb: d.sb,
    bb: d.bb,
    straddleOn: d.straddleOn,
    straddleAmt: d.straddleAmt,
    bombPotOn: d.bombPotOn,
    bombPotAmt: d.bombPotAmt,
    doubleBoardOn: d.doubleBoardOn,
    gameType: d.gameType,
    players: base.players.map((p) => ({ ...p, stack: d.defaultStack })),
  };
}

export function reducer(state: RecorderState, ev: Event): RecorderState {
  switch (ev.type) {
    case "setPlayerCount": {
      const n = ev.n;
      const holeCount = holeCardCount(state.gameType);
      const emptyHole = (): (string | null)[] =>
        Array.from({ length: holeCount }, () => null);
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
          cards: emptyHole(),
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
            cards: i === heroPos ? emptyHole() : null,
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
    case "setBombPot":
      return {
        ...state,
        bombPotOn: ev.on,
        bombPotAmt: ev.amt ?? state.bombPotAmt,
      };
    case "setGameType": {
      // Switching games resizes every player's hole-card array. Existing
      // cards survive when extending (NLHE → PLO4 pads with nulls);
      // truncating (PLO5 → NLHE) drops the extra slots so the user has
      // to re-pick. Action log + board are independent of game type and
      // stay put — but switching mid-hand is unusual; the popover only
      // exposes the dropdown during setup.
      const newCount = holeCardCount(ev.gameType);
      const players = state.players.map((p) => {
        if (!p.cards) return p;
        const next = p.cards.slice(0, newCount) as (string | null)[];
        while (next.length < newCount) next.push(null);
        return { ...p, cards: next };
      });
      return { ...state, gameType: ev.gameType, players };
    }
    case "setDoubleBoard":
      // Toggling off blanks the second board so we don't carry stale
      // cards into a future single-board hand started from the same
      // setup screen.
      return {
        ...state,
        doubleBoardOn: ev.on,
        board2: ev.on ? state.board2 : [null, null, null, null, null],
      };
    case "setHeroPosition": {
      const old = state.heroPosition;
      const next = Math.max(0, Math.min(state.playerCount - 1, ev.position));
      if (old === next) return state;
      // Swap player records so the hero's name/stack/cards follow them to
      // their new cycle position. The "displaced" player gets the previous
      // hero slot (usually a default empty seat in setup). Each player's
      // `seat` field must track its array index — the engine treats array
      // index as cycle index everywhere, and downstream code (survivors
      // filter at showdown, the `updatePlayer` reducer's `p.seat === ev.seat`
      // match) reads `p.seat` directly. Without this fixup, after a swap
      // `players[i].seat !== i` and the showdown panel mis-classifies hero
      // as a villain (with hero's old cycle position as the label).
      const players = state.players.slice();
      const oldRecord = players[old];
      const nextRecord = players[next];
      players[old] = { ...nextRecord, seat: old };
      players[next] = { ...oldRecord, seat: next };
      return { ...state, heroPosition: next, players };
    }
    case "setHeroCard": {
      const heroIdx = state.heroPosition;
      const need = holeCardCount(state.gameType);
      const players = state.players.map((p, i) => {
        if (i !== heroIdx) return p;
        // Pad to the current game's hole-card count so a stale 2-slot
        // record can still take a PLO5 5th-card pick (defensive — the
        // `setGameType` reducer already resizes, but a missing field on
        // a loaded payload could land here).
        const cards = (
          p.cards ?? Array.from({ length: need }, () => null)
        ).slice() as (string | null)[];
        while (cards.length < need) cards.push(null);
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
      const need = holeCardCount(state.gameType);
      const players = state.players.map((p) => {
        if (p.seat !== ev.seat) return p;
        const cards = (
          p.cards ?? Array.from({ length: need }, () => null)
        ).slice() as (string | null)[];
        while (cards.length < need) cards.push(null);
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
      const board2 = state.board2.map((c) => (c === ev.card ? null : c));
      return { ...state, players, board, board2 };
    }
    case "setBoard": {
      // boardIdx defaults to 0 (the primary board) so existing callers
      // that don't know about double board keep working.
      const which = ev.boardIdx === 1 ? "board2" : "board";
      const next = state[which].slice();
      next[ev.idx] = ev.card;
      return { ...state, [which]: next };
    }
    case "startPlay":
      // Always start at preflop. Bomb pots stay in preflop only long
      // enough for the auto-closed `deriveStreet` (no actions needed
      // since antes are dead) to trigger the existing "Deal flop" CTA
      // + picker auto-open. Once the user enters the flop cards, the
      // standard auto-advance effect bumps phase to flop and action
      // begins on SB. Going straight to "flop" here would skip the
      // card-entry gate and prompt for action against an empty board.
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
      // at the first open street; that's our resolved phase. Bomb pots skip
      // preflop entirely (no actions ever land there).
      const streets: Street[] = state.bombPotOn
        ? ["flop", "turn", "river"]
        : ["preflop", "flop", "turn", "river"];
      let resolvedPhase: Phase = state.bombPotOn ? "flop" : "preflop";
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

      // Clear any board cards that belong to streets we've fallen back
      // past — otherwise the felt would still show a flop/turn that
      // nobody has acted on. Mirror the cleanup across both boards in
      // double-board mode so they stay in lockstep.
      const clearFromIdx = (b: (string | null)[], from: number) => {
        const next = b.slice() as (string | null)[];
        for (let i = from; i < 5; i++) next[i] = null;
        return next;
      };
      let clearStart: number | null = null;
      if (resolvedPhase === "preflop") clearStart = 0;
      else if (resolvedPhase === "flop") clearStart = 3;
      else if (resolvedPhase === "turn") clearStart = 4;
      const board =
        clearStart !== null ? clearFromIdx(state.board, clearStart) : state.board;
      const board2 =
        state.doubleBoardOn && clearStart !== null
          ? clearFromIdx(state.board2, clearStart)
          : state.board2;

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
        board2,
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
      // live and shouldn't be overwritten. If the merged setup changes
      // gameType, resize each player's hole-card array to match — same
      // logic as `setGameType` so the loaded defaults stay coherent.
      if (state.phase !== "setup") return state;
      const merged: RecorderState = { ...state, ...ev.setup };
      if (ev.setup.gameType && ev.setup.gameType !== state.gameType) {
        const newCount = holeCardCount(merged.gameType);
        merged.players = merged.players.map((p) => {
          if (!p.cards) return p;
          const next = p.cards.slice(0, newCount) as (string | null)[];
          while (next.length < newCount) next.push(null);
          return { ...p, cards: next };
        });
      }
      return merged;
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

// Subset of RecorderState the chip-math helpers actually read. The recorder's
// full state satisfies this, and so does a saved hand's `_full` payload — so
// hand.ts can call these without constructing a synthetic RecorderState.
// `players` is included so per-seat commits can be capped at remaining stack
// (short-stack calls & all-ins-for-less).
export type CommitState = Pick<
  RecorderState,
  | "playerCount"
  | "sb"
  | "bb"
  | "straddleOn"
  | "straddleAmt"
  | "actions"
  | "players"
> & {
  // Optional so older saved-hand `_full` payloads (which predate the
  // bomb-pot feature) round-trip through committedBySeat / computeSidePots
  // without TS forcing every caller to fill these in.
  bombPotOn?: boolean;
  bombPotAmt?: number;
};

const STREETS: Street[] = ["preflop", "flop", "turn", "river"];

// Per-seat chips committed on a single street (blinds + actions, no refund).
// `prevTotal` is the cumulative commits from prior streets, used to compute
// each seat's max contribution on this street (`stack - prevTotal`).
//
// Why the cap matters: when a short stack clicks "Call $1500" but only has
// $800 behind, the action log records `{action: "call"}` without an amount.
// Without this cap, downstream math would treat them as having committed
// $1500 — over-counting the pot and miscomputing side pots. We also keep
// `lb` from dropping if a player goes all-in for less than the current bet
// (their short-stack shove doesn't lower what later seats need to match).
function streetCommits(
  s: CommitState,
  street: Street,
  prevTotal: Record<number, number>,
): Record<number, number> {
  const { playerCount, sb, bb, straddleOn, straddleAmt, bombPotOn, bombPotAmt, actions, players } = s;
  const bets: Record<number, number> = {};
  let lb = 0;

  const stackOf = (seat: number): number =>
    players[seat]?.stack ?? Number.POSITIVE_INFINITY;
  const cap = (seat: number, target: number): number =>
    Math.min(target, Math.max(0, stackOf(seat) - (prevTotal[seat] || 0)));

  if (street === "preflop") {
    if (bombPotOn) {
      // Bomb pot: every seat antes the flat amount, no SB/BB/straddle.
      // Antes are dead money — they go in the pot but don't form a bet
      // to call (lb stays 0), so the flop opens with action checked to
      // the first seat left of the button.
      const ante = bombPotAmt ?? 0;
      for (let i = 0; i < playerCount; i++) {
        bets[i] = cap(i, ante);
      }
    } else if (playerCount === 2) {
      bets[0] = cap(0, sb);
      bets[1] = cap(1, bb);
      lb = bets[1];
    } else {
      bets[1] = cap(1, sb);
      bets[2] = cap(2, bb);
      lb = bets[2];
      if (straddleOn && playerCount >= 4) {
        bets[3] = cap(3, straddleAmt);
        if (bets[3] > lb) lb = bets[3];
      }
    }
  }
  for (const a of actions) {
    if (a.street !== street) continue;
    if (a.action === "fold" || a.action === "check") continue;
    if (a.action === "call") {
      bets[a.seat] = cap(a.seat, lb);
      continue;
    }
    if (a.action === "bet" || a.action === "raise") {
      const capped = cap(a.seat, a.amount ?? 0);
      bets[a.seat] = capped;
      // A real raise advances `lb`; a short-stack all-in for less than the
      // current bet doesn't lower it for downstream callers.
      if (capped >= lb) lb = capped;
    }
  }
  return bets;
}

// Cap the highest contributor at the second-highest. Models the "uncalled
// bet returned" rule: when a bet/raise outpaces every other contribution on
// a street, the excess never gets matched and is returned to the bettor.
// Mutates in place. No-op if zero or one contributor or top == second.
function applyUncalledRefund(bets: Record<number, number>): void {
  const entries = Object.entries(bets).filter(([, v]) => v > 0);
  if (entries.length === 0) return;
  entries.sort((a, b) => b[1] - a[1]);
  const [topSeat, topAmt] = entries[0];
  const secondAmt = entries.length > 1 ? entries[1][1] : 0;
  if (topAmt > secondAmt) {
    bets[Number(topSeat)] = secondAmt;
  }
}

function sumStreetCommits(
  state: CommitState,
  withRefund: boolean,
): Record<number, number> {
  const total: Record<number, number> = {};
  for (const street of STREETS) {
    // Pass `total` as prevTotal so each street caps to remaining stack.
    const bets = streetCommits(state, street, total);
    if (withRefund) applyUncalledRefund(bets);
    for (const [s, v] of Object.entries(bets)) {
      total[Number(s)] = (total[Number(s)] || 0) + (v || 0);
    }
  }
  return total;
}

// Per-seat total committed across all streets (blinds + every action).
// "Raw" — no uncalled-bet refund. Used to display live stacks during a hand
// and for action-bar pot-sizing math (which assumes everyone calls).
export function committedBySeat(state: CommitState): Record<number, number> {
  return sumStreetCommits(state, false);
}

// Per-seat total committed *after* applying the uncalled-bet refund per
// street. Used for hero-result calculation and for the showdown / replayer
// pot display.
export function committedBySeatFinal(
  state: CommitState,
): Record<number, number> {
  return sumStreetCommits(state, true);
}

// Total pot across all streets, raw. Re-derives from blinds + action log so
// it works regardless of phase (showdown included).
export function totalPot(state: CommitState): number {
  return Object.values(committedBySeat(state)).reduce((s, v) => s + v, 0);
}

// Total pot after uncalled-bet refunds. Use this for displayed pot at
// showdown and for hero's net result.
export function totalPotFinal(state: CommitState): number {
  return Object.values(committedBySeatFinal(state)).reduce((s, v) => s + v, 0);
}

// A single pot in a side-pot decomposition. Folded seats contribute their
// chips but are excluded from `eligibleSeats` because they can't win.
export type SidePot = {
  amount: number;
  eligibleSeats: number[];
};

// Decompose the (refund-adjusted) commits into main + side pots. Layered by
// commitment level: each layer caps at the next-shortest contributor's
// total. Result is in low-to-high order — index 0 is the main pot, eligible
// to the most seats; later entries are side pots eligible to fewer seats.
//
// For single-pot scenarios (everyone matched), returns a single entry whose
// total equals `totalPotFinal(state)`. The caller can render that as one
// pot without special-casing.
//
// Layers that share an eligibility set are merged so dead money from
// folded blinds (or anyone who folded after committing less than the
// shortest all-in) rolls into the main pot instead of becoming its own
// "side pot". Eligibility shrinks monotonically going up the layers, so
// consecutive merging is sufficient — once a seat drops out it doesn't
// reappear.
export function computeSidePots(state: CommitState): SidePot[] {
  const finalCommits = committedBySeatFinal(state);
  const folded = new Set<number>();
  for (const a of state.actions) {
    if (a.action === "fold") folded.add(a.seat);
  }

  const contributors = Object.entries(finalCommits)
    .map(([s, a]) => ({ seat: Number(s), amt: a }))
    .filter((c) => c.amt > 0)
    .sort((a, b) => a.amt - b.amt);

  const layers: SidePot[] = [];
  let prevLevel = 0;
  for (let i = 0; i < contributors.length; i++) {
    const level = contributors[i].amt;
    if (level <= prevLevel) continue;
    const layerAmt = level - prevLevel;
    const remaining = contributors.slice(i);
    const potAmount = layerAmt * remaining.length;
    const eligibleSeats = remaining
      .map((c) => c.seat)
      .filter((s) => !folded.has(s));
    layers.push({ amount: potAmount, eligibleSeats });
    prevLevel = level;
  }

  const merged: SidePot[] = [];
  for (const layer of layers) {
    const last = merged[merged.length - 1];
    if (last && sameSeatSet(last.eligibleSeats, layer.eligibleSeats)) {
      last.amount += layer.amount;
    } else {
      merged.push({ amount: layer.amount, eligibleSeats: layer.eligibleSeats });
    }
  }
  return merged;
}

function sameSeatSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  for (const s of b) if (!set.has(s)) return false;
  return true;
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
  const { phase, playerCount, sb, bb, straddleOn, straddleAmt, bombPotOn, bombPotAmt, actions } = state;
  if (phase === "setup" || phase === "showdown" || phase === "done") return null;

  const folded = new Set<number>();
  for (const a of actions) if (a.action === "fold") folded.add(a.seat);

  const streetActions = actions.filter((a) => a.street === phase);

  // Cumulative commits across all streets earlier than the current one.
  // Used to cap this street's contributions at the seat's remaining stack
  // (so a short-stack "call" can't commit more than they have left).
  const prevStreetTotal: Record<number, number> = {};
  const phaseIdx = STREETS.indexOf(phase as Street);
  for (let i = 0; i < phaseIdx; i++) {
    const earlier = streetCommits(state, STREETS[i], prevStreetTotal);
    for (const [k, v] of Object.entries(earlier)) {
      prevStreetTotal[Number(k)] = (prevStreetTotal[Number(k)] || 0) + v;
    }
  }
  const stackOf = (seat: number): number =>
    state.players[seat]?.stack ?? Number.POSITIVE_INFINITY;
  const cap = (seat: number, target: number): number =>
    Math.min(
      target,
      Math.max(0, stackOf(seat) - (prevStreetTotal[seat] || 0)),
    );

  const bets: Record<number, number> = {};
  let lastBet = 0;
  let lastRaiseSize = 0;
  let lastAggressor: number | null = null;

  if (phase === "preflop") {
    if (bombPotOn) {
      // Bomb pot: every seat antes the flat amount; lastBet stays 0 so
      // there's nothing to call. The recorder skips this phase entirely
      // (`startPlay` jumps to "flop" when bombPotOn), so this branch is
      // mostly defensive — but mirroring `streetCommits` keeps the bet
      // bubbles + pot correct if anything ever lands here.
      const ante = bombPotAmt ?? 0;
      for (let i = 0; i < playerCount; i++) {
        bets[i] = cap(i, ante);
      }
      lastRaiseSize = bb;
    } else if (playerCount === 2) {
      bets[0] = cap(0, sb);
      bets[1] = cap(1, bb);
      lastBet = bets[1];
      lastRaiseSize = bb;
    } else {
      bets[1] = cap(1, sb);
      bets[2] = cap(2, bb);
      lastBet = bets[2];
      lastRaiseSize = bb;
      if (straddleOn && playerCount >= 4) {
        bets[3] = cap(3, straddleAmt);
        if (bets[3] > lastBet) {
          lastRaiseSize = bets[3] - lastBet;
          lastBet = bets[3];
        }
      }
    }
  }

  const actedThisStreet = new Set<number>();
  if (bombPotOn && phase === "preflop") {
    // Antes post automatically — nobody owes an action on preflop.
    for (let i = 0; i < playerCount; i++) actedThisStreet.add(i);
  }
  for (const a of streetActions) {
    actedThisStreet.add(a.seat);
    if (a.action === "fold" || a.action === "check") continue;
    if (a.action === "call") {
      bets[a.seat] = cap(a.seat, lastBet);
      continue;
    }
    if (a.action === "bet" || a.action === "raise") {
      const capped = cap(a.seat, a.amount ?? 0);
      bets[a.seat] = capped;
      // Only treat as a "real" raise (one that reopens action and resets
      // who has acted) when the seat actually puts in more than the
      // current bet. A short-stack shove for less is just a side-pot
      // contribution; it doesn't change what later seats need to match.
      if (capped >= lastBet) {
        lastRaiseSize = capped - lastBet;
        lastBet = capped;
        lastAggressor = a.seat;
        actedThisStreet.clear();
        actedThisStreet.add(a.seat);
      }
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

  // Live (raw) pot for the action bar's pot-sizing helpers. `totalPot`
  // walks blinds + actions through every street with the same stack-aware
  // caps as the rest of the math, so a short-stack call doesn't inflate
  // the displayed pot.
  const totalPotSum = totalPot(state);

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
