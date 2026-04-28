// Saved-hand model used by Dashboard <-> Recorder <-> Replayer.

import { POSITION_NAMES } from "./lib";
import { computeSidePots, totalPotFinal } from "./engine";
import type { Action, Player, Street } from "./engine";
import { awardPots } from "./hand-eval";

// Pot type, derived from the count of voluntary preflop raises:
// 0 raises → LP (limped), 1 → SRP, 2 → 3BP, 3 → 4BP, 4+ → 5BP (capped).
export type PotType = "LP" | "SRP" | "3BP" | "4BP" | "5BP";

export function derivePotType(actions: Action[]): PotType {
  let raises = 0;
  for (const a of actions) {
    if (a.street !== "preflop") continue;
    if (a.action === "raise" || a.action === "bet") raises++;
  }
  if (raises === 0) return "LP";
  if (raises === 1) return "SRP";
  if (raises === 2) return "3BP";
  if (raises === 3) return "4BP";
  return "5BP";
}

// Display-time pot type. Prefers a fresh derivation from the action log so
// older saves (which were hardcoded to "SRP") still classify correctly.
export function potTypeOf(h: SavedHand): PotType {
  if (h._full?.actions) return derivePotType(h._full.actions);
  return h.type;
}

export type SavedHand = {
  id: string;
  name: string;
  date: string;
  stakes: string;
  loc: string;
  // Hero's position only (e.g. "BTN"). Earlier saves may carry a full
  // "X vs Y" string — render code coerces those to just the hero side.
  positions: string;
  // True if more than two players reached the flop. Older rows may be
  // undefined; derive from `_full` lazily in that case.
  multiway?: boolean;
  board: string[]; // length 5, "—" for missing
  type: PotType;
  tags: string[];
  result: number;
  fav: boolean;
  notes?: string;
  // Sharing state. Hands default private (is_public = false in Postgres) and
  // become viewable by non-owners only when the owner toggles this on.
  isPublic?: boolean;
  _full?: {
    players: Player[];
    actions: Action[];
    board: (string | null)[];
    sb: number;
    bb: number;
    playerCount: number;
    heroPosition?: number;
    straddleOn: boolean;
    straddleAmt: number;
    muckedSeats?: number[];
    notes?: string;
    venue?: string;
    date?: string;
    // Annotations keyed by index into `actions`, populated in the recorder.
    annotations?: Record<number, string>;
    // Per-step equity, precomputed at save time. Keys are step indices;
    // values are { seat: equity 0..1 }. Steps where equity isn't
    // applicable (preflop, hero alone) are omitted. Older hands saved
    // before this field existed simply lack it — the replayer falls back
    // to live computation in that case.
    equityByStep?: Record<number, Record<number, number>>;
  };
};

// True if more than 2 players were still in when the flop dealt — i.e. count
// of seats that didn't fold preflop is > 2.
export function isMultiway(args: {
  playerCount: number;
  actions: Action[];
}): boolean {
  const { playerCount, actions } = args;
  let foldedPreflop = 0;
  for (const a of actions) {
    if (a.street === "preflop" && a.action === "fold") foldedPreflop += 1;
  }
  return playerCount - foldedPreflop > 2;
}

export type ReplayStep = {
  street: Street | "showdown";
  label: string;
  pot: number;
  active?: number;
  action?: string;
  board?: string[];
  winner?: number;
  // Recorder annotation tied to this action, surfaced under the narration.
  annotation?: string;
};

export type ReplayHand = {
  id: string;
  stakes: { sb: number; bb: number };
  straddleOn?: boolean;
  straddleAmt?: number;
  playerCount: number;
  // Cycle index of the hero. Used to rotate the visual layout so the hero
  // always sits at the bottom-center seat.
  heroPosition?: number;
  // Surviving villains who mucked at showdown — rendered like folded.
  muckedSeats?: number[];
  notes?: string;
  venue?: string;
  date?: string;
  players: {
    seat: number;
    name: string;
    stack: number;
    pos: string;
    cards: (string | null)[] | null;
  }[];
  steps: ReplayStep[];
  // Precomputed per-step equity (from `_full.equityByStep`). When present
  // the replayer's "Show equity" toggle is a pure lookup; otherwise it
  // falls back to runout enumeration on the fly.
  equityByStep?: Record<number, Record<number, number>>;
};

// Convert a recorded hand (from Recorder's _full payload) into the steps[] format Replayer renders.
export function recordedToHand(rec: SavedHand): ReplayHand | null {
  if (!rec || !rec._full) return null;
  const f = rec._full;
  const posNames = POSITION_NAMES[f.playerCount] || [];

  const heroPos = f.heroPosition ?? 0;
  const players = f.players.map((p, i) => ({
    seat: i,
    name: p.name || `Seat ${i + 1}`,
    stack: p.stack,
    pos: posNames[i] || `S${i + 1}`,
    cards: i === heroPos ? p.cards : null,
  }));
  // Reveal opponents whose hole cards were entered.
  f.players.forEach((p, i) => {
    if (i === heroPos) return;
    if (p.cards && p.cards[0] && p.cards[1]) players[i].cards = p.cards;
  });

  const fmt = (a: Action) => {
    const name = posNames[a.seat] || `S${a.seat + 1}`;
    if (a.action === "fold") return `${name} folds`;
    if (a.action === "check") return `${name} checks`;
    if (a.action === "call") return `${name} calls`;
    if (a.action === "bet") return `${name} bets $${a.amount}`;
    if (a.action === "raise") return `${name} raises to $${a.amount}`;
    return name;
  };

  const streets: Street[] = ["preflop", "flop", "turn", "river"];
  const steps: ReplayStep[] = [];
  let running = 0;
  let board: string[] = [];

  for (const ph of streets) {
    if (ph !== "preflop") {
      const acts = f.actions.filter((a) => a.street === ph);
      const has =
        ph === "flop"
          ? f.board[0] && f.board[1] && f.board[2]
          : ph === "turn"
            ? f.board[3]
            : f.board[4];
      if (acts.length === 0 && !has) continue;
      if (ph === "flop" && has) {
        board = [f.board[0]!, f.board[1]!, f.board[2]!];
        steps.push({
          street: "flop",
          label: `Flop  ${board.join(" ")}`,
          pot: running,
          board: [...board],
        });
      } else if (ph === "turn" && f.board[3]) {
        board = [...board, f.board[3]!];
        steps.push({
          street: "turn",
          label: `Turn  ${f.board[3]}`,
          pot: running,
          board: [...board],
        });
      } else if (ph === "river" && f.board[4]) {
        board = [...board, f.board[4]!];
        steps.push({
          street: "river",
          label: `River  ${f.board[4]}`,
          pot: running,
          board: [...board],
        });
      }
    }

    const streetBets: Record<number, number> = {};
    let lastBet = 0;
    if (ph === "preflop") {
      if (f.playerCount === 2) {
        streetBets[0] = f.sb;
        streetBets[1] = f.bb;
        lastBet = f.bb;
        running = f.sb + f.bb;
      } else {
        streetBets[1] = f.sb;
        streetBets[2] = f.bb;
        lastBet = f.bb;
        running = f.sb + f.bb;
        if (f.straddleOn && f.playerCount >= 4) {
          streetBets[3] = f.straddleAmt;
          lastBet = f.straddleAmt;
          running += f.straddleAmt;
        }
      }
      // Initial frame: blinds posted, no action yet. The first ← / → step
      // then plays the first action.
      steps.push({
        street: "preflop",
        label: f.straddleOn && f.playerCount >= 4 ? "Blinds + straddle posted" : "Blinds posted",
        pot: running,
      });
    }
    const annotations = f.annotations ?? {};
    const phaseActions: { a: Action; index: number }[] = [];
    f.actions.forEach((a, i) => {
      if (a.street === ph) phaseActions.push({ a, index: i });
    });
    for (const { a, index } of phaseActions) {
      const prev = streetBets[a.seat] || 0;
      let delta = 0;
      let actStr: string = a.action;
      if (a.action === "call") {
        delta = lastBet - prev;
        streetBets[a.seat] = lastBet;
      } else if (a.action === "bet") {
        delta = (a.amount ?? 0) - prev;
        streetBets[a.seat] = a.amount ?? 0;
        lastBet = a.amount ?? 0;
        actStr = `bet ${a.amount}`;
      } else if (a.action === "raise") {
        delta = (a.amount ?? 0) - prev;
        streetBets[a.seat] = a.amount ?? 0;
        lastBet = a.amount ?? 0;
        actStr = `raise ${a.amount}`;
      }
      running += Math.max(0, delta);
      steps.push({
        street: ph,
        label: fmt(a),
        pot: running,
        active: a.seat,
        action: actStr,
        annotation: annotations[index],
      });
    }
  }

  // Showdown / winner determination. The displayed pot is the
  // refund-adjusted total: when the last bet was uncalled, the bettor's
  // excess never went into the pot.
  const folded = new Set<number>();
  f.actions.forEach((a) => {
    if (a.action === "fold") folded.add(a.seat);
  });
  const survivors = players.filter((p) => !folded.has(p.seat));
  const finalPot = totalPotFinal(f);
  const muckedSet = new Set(f.muckedSeats ?? []);

  if (survivors.length === 1) {
    steps.push({
      street: "showdown",
      label: `${survivors[0].pos} wins $${finalPot}`,
      pot: finalPot,
      winner: survivors[0].seat,
    });
  } else if (survivors.length > 1) {
    // Multi-survivor at showdown — try to determine winner(s) from the
    // shown cards via per-pot eval. Falls through to a generic "Showdown"
    // label if eval can't run (incomplete board, no shown cards, etc.).
    const board5 = f.board.filter((c): c is string => Boolean(c));
    const contestants = survivors
      .filter(
        (p) =>
          !muckedSet.has(p.seat) && p.cards && p.cards[0] && p.cards[1],
      )
      .map((p) => ({
        seat: p.seat,
        cards: [p.cards![0]!, p.cards![1]!],
      }));

    let winners: number[] = [];
    if (board5.length === 5 && contestants.length > 0) {
      try {
        const pots = computeSidePots(f);
        const awards = awardPots(pots, contestants, board5);
        const set = new Set<number>();
        for (const potAwards of awards)
          for (const a of potAwards) for (const w of a.winners) set.add(w);
        winners = [...set];
      } catch {
        winners = [];
      }
    }

    const posOf = (seat: number) =>
      players.find((p) => p.seat === seat)?.pos ?? `S${seat + 1}`;

    if (winners.length === 1) {
      steps.push({
        street: "showdown",
        label: `${posOf(winners[0])} wins $${finalPot}`,
        pot: finalPot,
        winner: winners[0],
      });
    } else if (winners.length > 1) {
      steps.push({
        street: "showdown",
        label: `${winners.map(posOf).join(" & ")} split $${finalPot}`,
        pot: finalPot,
      });
    } else {
      steps.push({
        street: "showdown",
        label: `Showdown — pot $${finalPot}`,
        pot: finalPot,
      });
    }
  }

  return {
    id: rec.id,
    stakes: { sb: f.sb, bb: f.bb },
    straddleOn: f.straddleOn,
    straddleAmt: f.straddleAmt,
    playerCount: f.playerCount,
    heroPosition: heroPos,
    muckedSeats: f.muckedSeats ?? [],
    notes: f.notes ?? rec.notes,
    venue: f.venue ?? rec.loc,
    date: f.date ?? rec.date,
    players,
    steps: steps.length
      ? steps
      : [{ street: "preflop", label: "No actions recorded", pot: 0 }],
    equityByStep: f.equityByStep,
  };
}

// Replayer helper: per-player chips committed on the CURRENT street up to and including step.
export function computeStreetBets(
  steps: ReplayStep[],
  upTo: number,
  hand: ReplayHand,
): Record<number, number> {
  let curStreet: ReplayStep["street"] | null = null;
  for (let i = 0; i <= upTo; i++) {
    if (steps[i].street && steps[i].street !== "showdown") curStreet = steps[i].street;
  }
  const bets: Record<number, number> = {};
  let lastBet = 0;

  if (curStreet === "preflop") {
    if (hand.playerCount === 2) {
      bets[0] = hand.stakes.sb;
      bets[1] = hand.stakes.bb;
      lastBet = hand.stakes.bb;
    } else {
      bets[1] = hand.stakes.sb;
      bets[2] = hand.stakes.bb;
      lastBet = hand.stakes.bb;
      if (hand.straddleOn && hand.playerCount >= 4 && hand.straddleAmt) {
        bets[3] = hand.straddleAmt;
        lastBet = hand.straddleAmt;
      }
    }
  }

  for (let i = 0; i <= upTo; i++) {
    const s = steps[i];
    if (s.street !== curStreet) continue;
    if (s.action === undefined || s.active === undefined) continue;
    const m = /(?:raise|3-bet|4-bet|bet)\s+(\d+)/.exec(s.action);
    if (m) {
      const amt = Number(m[1]);
      bets[s.active] = amt;
      lastBet = amt;
    } else if (s.action === "call") {
      bets[s.active] = lastBet;
    }
  }
  return bets;
}

export function hasFolded(steps: ReplayStep[], upTo: number, seat: number): boolean {
  for (let i = 0; i <= upTo; i++) {
    if (steps[i].action === "fold" && steps[i].active === seat) return true;
  }
  return false;
}

// Cumulative chips committed by each seat through step `upTo` (inclusive).
// Used to display live stacks in the replayer.
export function committedThroughStep(
  steps: ReplayStep[],
  upTo: number,
  hand: ReplayHand,
): Record<number, number> {
  const total: Record<number, number> = {};
  // Walk through each street segment we've passed (or are inside).
  let curStreet: ReplayStep["street"] | null = null;
  const streetSegments: { street: ReplayStep["street"]; lastIdx: number }[] = [];
  for (let i = 0; i <= upTo; i++) {
    if (steps[i].street !== curStreet) {
      curStreet = steps[i].street;
      streetSegments.push({ street: curStreet, lastIdx: i });
    } else {
      streetSegments[streetSegments.length - 1].lastIdx = i;
    }
  }

  for (const { street, lastIdx } of streetSegments) {
    if (street === "showdown") continue;
    const streetBets: Record<number, number> = {};
    let lastBet = 0;
    if (street === "preflop") {
      if (hand.playerCount === 2) {
        streetBets[0] = hand.stakes.sb;
        streetBets[1] = hand.stakes.bb;
        lastBet = hand.stakes.bb;
      } else {
        streetBets[1] = hand.stakes.sb;
        streetBets[2] = hand.stakes.bb;
        lastBet = hand.stakes.bb;
        if (hand.straddleOn && hand.playerCount >= 4 && hand.straddleAmt) {
          streetBets[3] = hand.straddleAmt;
          lastBet = hand.straddleAmt;
        }
      }
    }
    for (let i = 0; i <= lastIdx; i++) {
      const s = steps[i];
      if (s.street !== street) continue;
      if (s.action === undefined || s.active === undefined) continue;
      const m = /(?:raise|3-bet|4-bet|bet)\s+(\d+)/.exec(s.action);
      if (m) {
        const amt = Number(m[1]);
        streetBets[s.active] = amt;
        lastBet = amt;
      } else if (s.action === "call") {
        streetBets[s.active] = lastBet;
      }
    }
    for (const [s, v] of Object.entries(streetBets)) {
      total[Number(s)] = (total[Number(s)] || 0) + (v || 0);
    }
  }
  return total;
}
