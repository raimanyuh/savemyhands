// Saved-hand model used by Dashboard <-> Recorder <-> Replayer.

import { POSITION_NAMES } from "./lib";
import { computeSidePots, totalPotFinal } from "./engine";
import type { Action, Player, Street } from "./engine";
import { awardPots, determineWinner } from "./hand-eval";

// Pot type, derived from the count of voluntary preflop raises:
// 0 raises → LP (limped), 1 → SRP, 2 → 3BP, 3 → 4BP, 4+ → 5BP (capped).
// BP (bomb pot) is its own category — no preflop action exists, every
// player just antes — so it's set explicitly at save time rather than
// counted from `actions`.
export type PotType = "BP" | "LP" | "SRP" | "3BP" | "4BP" | "5BP";

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

// Display-time pot type. Bomb pots get the dedicated BP label; otherwise
// derive fresh from the action log (older saves were hardcoded to "SRP",
// so re-deriving is what makes existing rows classify correctly).
export function potTypeOf(h: SavedHand): PotType {
  if (h._full?.bombPotOn) return "BP";
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
    // Bomb pot variant: every player antes a flat amount and play opens
    // on the flop with no preflop action. Both fields optional so older
    // saves (pre-feature) round-trip cleanly as standard hands.
    bombPotOn?: boolean;
    bombPotAmt?: number;
    // Double board variant. When true, `board2` carries the second
    // board (same shape as `board`). Both fields optional so older
    // saves round-trip cleanly as standard single-board hands.
    doubleBoardOn?: boolean;
    board2?: (string | null)[];
    // Game variant. Optional so older NLHE saves round-trip cleanly.
    // For PLO hands every player carries 4 (PLO4) or 5 (PLO5) hole
    // cards in `players[*].cards`, and the showdown / equity paths use
    // the must-use-2-from-hand evaluator.
    gameType?: "NLHE" | "PLO4" | "PLO5";
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
    // Parallel equity map for the second board on double-board hands.
    // Same shape as `equityByStep`.
    equityByStep2?: Record<number, Record<number, number>>;
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
  // Second board for double-board hands. Same length progression as
  // `board` (3 → 4 → 5 cards across flop / turn / river). Undefined for
  // single-board hands.
  board2?: string[];
  winner?: number;
  // Recorder annotation tied to this action, surfaced under the narration.
  annotation?: string;
  // Per-seat chips committed on the CURRENT street through this step, with
  // each commit capped at the seat's remaining stack. Drives the bet/check
  // bubble amounts. A board-reveal step resets to {} (new street).
  streetBetsAfter?: Record<number, number>;
  // Per-seat chips committed across ALL streets through this step, again
  // stack-capped. Drives the live stack display in the replayer.
  committedAfter?: Record<number, number>;
};

export type ReplayHand = {
  id: string;
  stakes: { sb: number; bb: number };
  straddleOn?: boolean;
  straddleAmt?: number;
  // Bomb pot variant — drives the header label ("Bomb pot $X" instead of
  // "$sb/$bb") and any future game-type-specific replayer behavior.
  bombPotOn?: boolean;
  bombPotAmt?: number;
  // Double-board variant — replayer renders two board rows stacked,
  // showdown labels become per-board, equity is computed per board.
  doubleBoardOn?: boolean;
  // Game variant for showdown / equity dispatch. Defaults to NLHE.
  gameType?: "NLHE" | "PLO4" | "PLO5";
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
  // Parallel map for the second board on double-board hands.
  equityByStep2?: Record<number, Record<number, number>>;
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
  // Parallel progressive state for the second board. Stays an empty
  // array (and is omitted from emitted steps) when the hand is single-
  // board. The label / step `board2` field are only set when this is
  // populated.
  const hasBoard2 = !!f.doubleBoardOn && Array.isArray(f.board2);
  let board2: string[] = [];
  const fmtBoardLabel = (label: string, b1: string[], b2: string[]) =>
    hasBoard2 ? `${label}  ${b1.join(" ")}  /  ${b2.join(" ")}` : `${label}  ${b1.join(" ")}`;

  // Cumulative chips committed across all PRIOR streets, per seat. Used to
  // cap each new street's commits at the seat's remaining stack — mirrors
  // engine.ts `streetCommits`. Without this, a short-stack call on the flop
  // visually matches the full bet (e.g. $1500) instead of just the seat's
  // remaining stack ($630), and the running pot inflates.
  const prevStreetTotal: Record<number, number> = {};
  const stackOf = (seat: number): number =>
    f.players[seat]?.stack ?? Number.POSITIVE_INFINITY;
  // Snapshot of streetBets + prevStreetTotal merged. Embedded in each step
  // so the replayer can do a pure lookup instead of re-deriving caps.
  const mergeCommitted = (
    streetBets: Record<number, number>,
  ): Record<number, number> => {
    const out: Record<number, number> = { ...prevStreetTotal };
    for (const [k, v] of Object.entries(streetBets)) {
      out[Number(k)] = (out[Number(k)] || 0) + v;
    }
    return out;
  };

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
      const b2 = hasBoard2 ? (f.board2 as (string | null)[]) : null;
      if (ph === "flop" && has) {
        board = [f.board[0]!, f.board[1]!, f.board[2]!];
        if (b2) board2 = [b2[0]!, b2[1]!, b2[2]!];
        steps.push({
          street: "flop",
          label: fmtBoardLabel("Flop", board, board2),
          pot: running,
          board: [...board],
          ...(hasBoard2 && { board2: [...board2] }),
          streetBetsAfter: {},
          committedAfter: { ...prevStreetTotal },
        });
      } else if (ph === "turn" && f.board[3]) {
        board = [...board, f.board[3]!];
        if (b2 && b2[3]) board2 = [...board2, b2[3]!];
        steps.push({
          street: "turn",
          label: hasBoard2
            ? `Turn  ${f.board[3]}  /  ${b2![3] ?? ""}`
            : `Turn  ${f.board[3]}`,
          pot: running,
          board: [...board],
          ...(hasBoard2 && { board2: [...board2] }),
          streetBetsAfter: {},
          committedAfter: { ...prevStreetTotal },
        });
      } else if (ph === "river" && f.board[4]) {
        board = [...board, f.board[4]!];
        if (b2 && b2[4]) board2 = [...board2, b2[4]!];
        steps.push({
          street: "river",
          label: hasBoard2
            ? `River  ${f.board[4]}  /  ${b2![4] ?? ""}`
            : `River  ${f.board[4]}`,
          pot: running,
          board: [...board],
          ...(hasBoard2 && { board2: [...board2] }),
          streetBetsAfter: {},
          committedAfter: { ...prevStreetTotal },
        });
      }
    }

    const streetBets: Record<number, number> = {};
    let lastBet = 0;
    // Cap any seat's commit on this street at their remaining stack.
    const cap = (seat: number, target: number): number =>
      Math.min(
        target,
        Math.max(0, stackOf(seat) - (prevStreetTotal[seat] || 0)),
      );

    if (ph === "preflop") {
      if (f.bombPotOn) {
        // Bomb pot: every seat antes the flat amount. No actions on
        // preflop, so we emit a single "antes posted" frame and let the
        // flop block run its normal board reveal next iteration. lastBet
        // stays 0 so the flop opens with action checked to the first
        // seat left of the button.
        const ante = f.bombPotAmt ?? 0;
        for (let i = 0; i < f.playerCount; i++) {
          streetBets[i] = cap(i, ante);
          running += streetBets[i];
        }
        steps.push({
          street: "preflop",
          label: `Bomb pot — antes $${ante}`,
          pot: running,
          streetBetsAfter: { ...streetBets },
          committedAfter: mergeCommitted(streetBets),
        });
        // Roll antes into prevStreetTotal and skip the rest of the
        // preflop branch (nothing else to do — no blinds, no actions).
        for (const [k, v] of Object.entries(streetBets)) {
          prevStreetTotal[Number(k)] = (prevStreetTotal[Number(k)] || 0) + v;
        }
        continue;
      }
      if (f.playerCount === 2) {
        streetBets[0] = cap(0, f.sb);
        streetBets[1] = cap(1, f.bb);
        lastBet = streetBets[1];
        running = streetBets[0] + streetBets[1];
      } else {
        streetBets[1] = cap(1, f.sb);
        streetBets[2] = cap(2, f.bb);
        lastBet = streetBets[2];
        running = streetBets[1] + streetBets[2];
        if (f.straddleOn && f.playerCount >= 4) {
          streetBets[3] = cap(3, f.straddleAmt);
          if (streetBets[3] > lastBet) lastBet = streetBets[3];
          running += streetBets[3];
        }
      }
      // Initial frame: blinds posted, no action yet. The first ← / → step
      // then plays the first action.
      steps.push({
        street: "preflop",
        label: f.straddleOn && f.playerCount >= 4 ? "Blinds + straddle posted" : "Blinds posted",
        pot: running,
        streetBetsAfter: { ...streetBets },
        committedAfter: mergeCommitted(streetBets),
      });
    }
    const annotations = f.annotations ?? {};
    const phaseActions: { a: Action; index: number }[] = [];
    f.actions.forEach((a, i) => {
      if (a.street === ph) phaseActions.push({ a, index: i });
    });
    for (const { a, index } of phaseActions) {
      const prev = streetBets[a.seat] || 0;
      let capped = prev;
      let delta = 0;
      let actStr: string = a.action;
      if (a.action === "call") {
        capped = cap(a.seat, lastBet);
        streetBets[a.seat] = capped;
        delta = capped - prev;
      } else if (a.action === "bet") {
        capped = cap(a.seat, a.amount ?? 0);
        streetBets[a.seat] = capped;
        // A real bet/raise advances `lastBet`; an all-in for less than the
        // current bet doesn't lower it for downstream callers.
        if (capped >= lastBet) lastBet = capped;
        delta = capped - prev;
        actStr = `bet ${a.amount}`;
      } else if (a.action === "raise") {
        capped = cap(a.seat, a.amount ?? 0);
        streetBets[a.seat] = capped;
        if (capped >= lastBet) lastBet = capped;
        delta = capped - prev;
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
        streetBetsAfter: { ...streetBets },
        committedAfter: mergeCommitted(streetBets),
      });
    }

    // Roll this street's commits into the cumulative total before moving on.
    for (const [k, v] of Object.entries(streetBets)) {
      prevStreetTotal[Number(k)] = (prevStreetTotal[Number(k)] || 0) + v;
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

  // Carry the last action street's bubbles into the showdown step so bets
  // from the river (or whatever the final action street was) stay visible
  // when the replayer lands on showdown. Falls back to an empty map if the
  // hand had no action steps recorded.
  const lastStep = steps[steps.length - 1];
  const tailStreetBets = lastStep?.streetBetsAfter ?? {};
  const tailCommitted = lastStep?.committedAfter ?? {};

  if (survivors.length === 1) {
    steps.push({
      street: "showdown",
      label: `${survivors[0].pos} wins $${finalPot}`,
      pot: finalPot,
      winner: survivors[0].seat,
      streetBetsAfter: { ...tailStreetBets },
      committedAfter: { ...tailCommitted },
    });
  } else if (survivors.length > 1) {
    // Multi-survivor at showdown — try to determine winner(s) from the
    // shown cards via per-pot eval. Falls through to a generic "Showdown"
    // label if eval can't run (incomplete board, no shown cards, etc.).
    const board1 = f.board.filter((c): c is string => Boolean(c));
    const board2 = hasBoard2
      ? (f.board2 as (string | null)[]).filter((c): c is string => Boolean(c))
      : null;
    const gameType = f.gameType ?? "NLHE";
    const holeCount =
      gameType === "PLO5" ? 5 : gameType === "PLO4" ? 4 : 2;
    const contestants = survivors
      .filter((p) => {
        if (muckedSet.has(p.seat) || !p.cards) return false;
        for (let i = 0; i < holeCount; i++) if (!p.cards[i]) return false;
        return true;
      })
      .map((p) => ({
        seat: p.seat,
        cards: (p.cards as string[]).slice(0, holeCount),
      }));

    const posOf = (seat: number) =>
      players.find((p) => p.seat === seat)?.pos ?? `S${seat + 1}`;

    const boardsReady =
      board1.length === 5 && (board2 === null || board2.length === 5);

    if (board2 && boardsReady && contestants.length > 0) {
      // Double-board showdown — verbose per-board label so the user
      // sees both outcomes ("BTN wins board 1 ($X) · UTG wins board 2
      // ($Y)" / split lines for chops). The pot splits half/half (odd
      // dollar to board 1).
      try {
        const half1 = Math.ceil(finalPot / 2);
        const half2 = finalPot - half1;
        const w1 = determineWinner(contestants, board1, gameType).winners;
        const w2 = determineWinner(contestants, board2, gameType).winners;
        const labelOne = (
          ws: number[],
          amount: number,
          name: string,
        ): string =>
          ws.length === 1
            ? `${posOf(ws[0])} wins ${name} ($${amount})`
            : `${ws.map(posOf).join(", ")} split ${name} ($${amount})`;
        steps.push({
          street: "showdown",
          label: `${labelOne(w1, half1, "board 1")} · ${labelOne(w2, half2, "board 2")}`,
          pot: finalPot,
          streetBetsAfter: { ...tailStreetBets },
          committedAfter: { ...tailCommitted },
        });
      } catch {
        steps.push({
          street: "showdown",
          label: `Showdown — pot $${finalPot}`,
          pot: finalPot,
          streetBetsAfter: { ...tailStreetBets },
          committedAfter: { ...tailCommitted },
        });
      }
    } else {
      let winners: number[] = [];
      if (board1.length === 5 && contestants.length > 0) {
        try {
          const pots = computeSidePots(f);
          const awards = awardPots(pots, contestants, board1, gameType);
          const set = new Set<number>();
          for (const potAwards of awards)
            for (const a of potAwards) for (const w of a.winners) set.add(w);
          winners = [...set];
        } catch {
          winners = [];
        }
      }
      if (winners.length === 1) {
        steps.push({
          street: "showdown",
          label: `${posOf(winners[0])} wins $${finalPot}`,
          pot: finalPot,
          winner: winners[0],
          streetBetsAfter: { ...tailStreetBets },
          committedAfter: { ...tailCommitted },
        });
      } else if (winners.length > 1) {
        steps.push({
          street: "showdown",
          label: `${winners.map(posOf).join(" & ")} split $${finalPot}`,
          pot: finalPot,
          streetBetsAfter: { ...tailStreetBets },
          committedAfter: { ...tailCommitted },
        });
      } else {
        steps.push({
          street: "showdown",
          label: `Showdown — pot $${finalPot}`,
          pot: finalPot,
          streetBetsAfter: { ...tailStreetBets },
          committedAfter: { ...tailCommitted },
        });
      }
    }
  }

  return {
    id: rec.id,
    stakes: { sb: f.sb, bb: f.bb },
    straddleOn: f.straddleOn,
    straddleAmt: f.straddleAmt,
    bombPotOn: f.bombPotOn,
    bombPotAmt: f.bombPotAmt,
    doubleBoardOn: f.doubleBoardOn,
    gameType: f.gameType,
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
    equityByStep2: f.equityByStep2,
  };
}

// Replayer helper: per-player chips committed on the CURRENT street up to
// and including `upTo`. Reads the snapshot embedded in the step by
// `recordedToHand`, which already applies the per-seat stack cap so
// short-stack calls / all-ins-for-less render at the right amount.
//
// The `hand` param is retained for backward compat (older call sites),
// even though the lookup no longer needs it.
export function computeStreetBets(
  steps: ReplayStep[],
  upTo: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _hand: ReplayHand,
): Record<number, number> {
  return { ...(steps[upTo]?.streetBetsAfter ?? {}) };
}

export function hasFolded(steps: ReplayStep[], upTo: number, seat: number): boolean {
  for (let i = 0; i <= upTo; i++) {
    if (steps[i].action === "fold" && steps[i].active === seat) return true;
  }
  return false;
}

// Cumulative chips committed by each seat through step `upTo` (inclusive).
// Used to display live stacks in the replayer. Reads the precomputed
// snapshot from `recordedToHand` so the math is consistent with the
// stack-capped bet bubbles.
export function committedThroughStep(
  steps: ReplayStep[],
  upTo: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _hand: ReplayHand,
): Record<number, number> {
  return { ...(steps[upTo]?.committedAfter ?? {}) };
}
