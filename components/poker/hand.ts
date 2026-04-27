// Saved-hand model used by Dashboard <-> Recorder <-> Replayer.

import { POSITION_NAMES } from "./lib";
import type { Action, Player, Street } from "./engine";

export type SavedHand = {
  id: string;
  name: string;
  date: string;
  stakes: string;
  loc: string;
  positions: string;
  board: string[]; // length 5, "—" for missing
  type: "SRP" | "3BP" | "4BP";
  tags: string[];
  result: number;
  fav: boolean;
  _full?: {
    players: Player[];
    actions: Action[];
    board: (string | null)[];
    sb: number;
    bb: number;
    playerCount: number;
    straddleOn: boolean;
    straddleAmt: number;
  };
};

export type ReplayStep = {
  street: Street | "showdown";
  label: string;
  pot: number;
  active?: number;
  action?: string;
  board?: string[];
  winner?: number;
};

export type ReplayHand = {
  id: string;
  stakes: { sb: number; bb: number };
  straddleOn?: boolean;
  straddleAmt?: number;
  playerCount: number;
  players: {
    seat: number;
    name: string;
    stack: number;
    pos: string;
    cards: (string | null)[] | null;
  }[];
  steps: ReplayStep[];
};

// Convert a recorded hand (from Recorder's _full payload) into the steps[] format Replayer renders.
export function recordedToHand(rec: SavedHand): ReplayHand | null {
  if (!rec || !rec._full) return null;
  const f = rec._full;
  const posNames = POSITION_NAMES[f.playerCount] || [];

  const players = f.players.map((p, i) => ({
    seat: i,
    name: p.name || `Seat ${i + 1}`,
    stack: p.stack,
    pos: posNames[i] || `S${i + 1}`,
    cards: i === 0 ? p.cards : null,
  }));
  // Reveal opponents whose hole cards were entered.
  f.players.forEach((p, i) => {
    if (i === 0) return;
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
    }
    const acts = f.actions.filter((a) => a.street === ph);
    for (const a of acts) {
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
      });
    }
  }

  // Showdown / lone winner
  const folded = new Set<number>();
  f.actions.forEach((a) => {
    if (a.action === "fold") folded.add(a.seat);
  });
  const survivors = players.filter((p) => !folded.has(p.seat));
  if (survivors.length === 1) {
    steps.push({
      street: "showdown",
      label: `${survivors[0].pos} wins $${running}`,
      pot: running,
      winner: survivors[0].seat,
    });
  } else if (survivors.length > 1) {
    steps.push({
      street: "showdown",
      label: `Showdown — pot $${running}`,
      pot: running,
    });
  }

  return {
    id: rec.id,
    stakes: { sb: f.sb, bb: f.bb },
    straddleOn: f.straddleOn,
    straddleAmt: f.straddleAmt,
    playerCount: f.playerCount,
    players,
    steps: steps.length
      ? steps
      : [{ street: "preflop", label: "No actions recorded", pot: 0 }],
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
