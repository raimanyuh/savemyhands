// Best-5-of-7 Hold'em evaluator. Returns a score that's safely comparable with
// `>` and a human-readable description (e.g. "Pair of Aces").

const RANK_VALUE: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const RANK_NAMES: Record<number, string> = {
  2: "Twos",
  3: "Threes",
  4: "Fours",
  5: "Fives",
  6: "Sixes",
  7: "Sevens",
  8: "Eights",
  9: "Nines",
  10: "Tens",
  11: "Jacks",
  12: "Queens",
  13: "Kings",
  14: "Aces",
};

const RANK_NAME_SINGULAR: Record<number, string> = {
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
  11: "Jack",
  12: "Queen",
  13: "King",
  14: "Ace",
};

export type HandScore = {
  category: number; // 0..8 (high card → straight flush)
  tiebreak: number[];
  description: string;
};

function compare(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.min(a.tiebreak.length, b.tiebreak.length); i++) {
    if (a.tiebreak[i] !== b.tiebreak[i]) {
      return a.tiebreak[i] - b.tiebreak[i];
    }
  }
  return 0;
}

export function compareHands(a: HandScore, b: HandScore): number {
  return compare(a, b);
}

function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  if (arr.length < k) return;
  const [head, ...rest] = arr;
  for (const combo of combinations(rest, k - 1)) {
    yield [head, ...combo];
  }
  yield* combinations(rest, k);
}

function score5(cards: string[]): HandScore {
  const ranks = cards
    .map((c) => RANK_VALUE[c.slice(0, -1)])
    .sort((a, b) => b - a);
  const suits = cards.map((c) => c.slice(-1));

  const flush = suits.every((s) => s === suits[0]);

  // Straight detection — need 5 unique consecutive ranks. A-low wheel (5-4-3-2-A) handled separately.
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let straight = false;
  let straightHigh = 0;
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      straight = true;
      straightHigh = uniqueRanks[0];
    } else if (uniqueRanks.join(",") === "14,5,4,3,2") {
      straight = true;
      straightHigh = 5; // wheel — 5 high
    }
  }

  // Group by rank, sorted by (count desc, rank desc).
  const counts: Record<number, number> = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([r, c]) => ({ rank: Number(r), count: c }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.rank - a.rank;
    });

  if (straight && flush) {
    return {
      category: 8,
      tiebreak: [straightHigh],
      description:
        straightHigh === 14
          ? "Royal Flush"
          : `Straight Flush, ${RANK_NAME_SINGULAR[straightHigh]} high`,
    };
  }
  if (groups[0].count === 4) {
    return {
      category: 7,
      tiebreak: [groups[0].rank, groups[1].rank],
      description: `Four ${RANK_NAMES[groups[0].rank]}`,
    };
  }
  if (groups[0].count === 3 && groups[1].count === 2) {
    return {
      category: 6,
      tiebreak: [groups[0].rank, groups[1].rank],
      description: `Full House, ${RANK_NAMES[groups[0].rank]} over ${
        RANK_NAMES[groups[1].rank]
      }`,
    };
  }
  if (flush) {
    return {
      category: 5,
      tiebreak: [...ranks],
      description: `Flush, ${RANK_NAME_SINGULAR[ranks[0]]} high`,
    };
  }
  if (straight) {
    return {
      category: 4,
      tiebreak: [straightHigh],
      description: `Straight, ${RANK_NAME_SINGULAR[straightHigh]} high`,
    };
  }
  if (groups[0].count === 3) {
    return {
      category: 3,
      tiebreak: [groups[0].rank, groups[1].rank, groups[2].rank],
      description: `Three ${RANK_NAMES[groups[0].rank]}`,
    };
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    return {
      category: 2,
      tiebreak: [groups[0].rank, groups[1].rank, groups[2].rank],
      description: `Two Pair, ${RANK_NAMES[groups[0].rank]} and ${
        RANK_NAMES[groups[1].rank]
      }`,
    };
  }
  if (groups[0].count === 2) {
    return {
      category: 1,
      tiebreak: [
        groups[0].rank,
        groups[1].rank,
        groups[2].rank,
        groups[3].rank,
      ],
      description: `Pair of ${RANK_NAMES[groups[0].rank]}`,
    };
  }
  return {
    category: 0,
    tiebreak: [...ranks],
    description: `${RANK_NAME_SINGULAR[ranks[0]]} high`,
  };
}

// Best 5-card hand from up to 7 cards (typical Hold'em: 2 hole + 5 board).
export function evaluateBest(cards: string[]): HandScore {
  if (cards.length < 5) {
    throw new Error("Need at least 5 cards to evaluate");
  }
  let best: HandScore | null = null;
  for (const combo of combinations(cards, 5)) {
    const s = score5(combo);
    if (best === null || compare(s, best) > 0) best = s;
  }
  return best!;
}

// Determine winner(s) among players who showed cards. `board` should have 5 cards
// for a proper Hold'em comparison. Returns winners + each player's score.
export function determineWinner(
  players: { seat: number; cards: string[] }[],
  board: string[],
): { winners: number[]; scores: Record<number, HandScore> } {
  const scores: Record<number, HandScore> = {};
  let winners: number[] = [];
  let bestScore: HandScore | null = null;
  for (const p of players) {
    const score = evaluateBest([...p.cards, ...board]);
    scores[p.seat] = score;
    if (bestScore === null) {
      bestScore = score;
      winners = [p.seat];
    } else {
      const cmp = compare(score, bestScore);
      if (cmp > 0) {
        bestScore = score;
        winners = [p.seat];
      } else if (cmp === 0) {
        winners.push(p.seat);
      }
    }
  }
  return { winners, scores };
}

// One slice of a pot's payout. Today every pot produces exactly one Award
// (the high hand wins the whole pot). The array shape is here to keep
// future games drop-in: hi-lo would push a second Award (lo-half), and
// double-board would push a second Award per board. Each Award's `amount`
// is its share of the parent pot, summing to the pot's total.
export type PotAward = {
  amount: number;
  // Seats sharing this award. Length > 1 for ties; the per-seat split is
  // computed at distribution time, not stored here.
  winners: number[];
};

// For each pot, decide who wins. Inputs:
//   * `pots` — from engine.computeSidePots, ordered main → side.
//   * `contestants` — seats that showed cards (hero + any villains who
//     didn't muck), with their hole cards.
//   * `board` — five community cards.
//
// Returns one `PotAward[]` per pot. A seat eligible for a pot but who
// didn't show is treated as conceded; if every eligible seat-with-cards has
// folded out of the pot, the remaining eligible seat (typically the only
// non-folder) wins by default.
export function awardPots(
  pots: { amount: number; eligibleSeats: number[] }[],
  contestants: { seat: number; cards: string[] }[],
  board: string[],
): PotAward[][] {
  const cardsBySeat = new Map(contestants.map((c) => [c.seat, c.cards]));
  return pots.map((pot) => {
    // Eligible seats *and* showed cards — these are the contenders for this
    // pot's hand-eval.
    const showing = pot.eligibleSeats
      .filter((s) => cardsBySeat.has(s))
      .map((s) => ({ seat: s, cards: cardsBySeat.get(s)! }));

    // Single eligible seat (others folded out before reaching this layer):
    // they win uncontested, no eval needed.
    if (pot.eligibleSeats.length === 1) {
      return [{ amount: pot.amount, winners: [pot.eligibleSeats[0]] }];
    }
    // No one showed — fall back to splitting among the eligible seats.
    if (showing.length === 0) {
      return [{ amount: pot.amount, winners: pot.eligibleSeats }];
    }
    if (showing.length === 1) {
      return [{ amount: pot.amount, winners: [showing[0].seat] }];
    }
    const { winners } = determineWinner(showing, board);
    return [{ amount: pot.amount, winners }];
  });
}

// Sum up the chips a seat actually receives across all awarded pots. Splits
// each award evenly among its winners (rounding toward chips — leftover
// pennies go nowhere; in real chips that's an odd-chip rule we don't model).
export function seatWinnings(awards: PotAward[][], seat: number): number {
  let total = 0;
  for (const potAwards of awards) {
    for (const a of potAwards) {
      if (a.winners.includes(seat)) {
        total += Math.round(a.amount / a.winners.length);
      }
    }
  }
  return total;
}
