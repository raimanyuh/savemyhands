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

const RANK_NAME: Record<number, string> = {
  2: "Deuce",
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

export type DeuceToSevenCategory =
  | 0 // high card
  | 1 // pair
  | 2 // two pair
  | 3 // trips
  | 4 // straight
  | 5 // flush
  | 6 // full house
  | 7 // quads
  | 8; // straight flush

export type DeuceToSevenScore = {
  /** Lower category is better in 2-7 lowball. */
  category: DeuceToSevenCategory;
  /** Compared high-card first; lower values are better. */
  tiebreak: number[];
  description: string;
};

function rankOf(card: string): number {
  const value = RANK_VALUE[card.slice(0, -1)];
  if (!value) throw new Error(`Invalid card: ${card}`);
  return value;
}

function describeHighCard(ranks: number[]): string {
  return `${RANK_NAME[ranks[0]]}-${RANK_NAME[ranks[1]]} low`;
}

/**
 * Score one complete five-card Deuce-to-Seven hand. Aces are always high;
 * unlike ace-to-five lowball, straights and flushes count against the hand.
 */
export function evaluateDeuceToSeven(cards: string[]): DeuceToSevenScore {
  if (cards.length !== 5) {
    throw new Error("Deuce-to-Seven evaluation requires exactly 5 cards");
  }
  if (new Set(cards).size !== cards.length) {
    throw new Error("Deuce-to-Seven hand contains duplicate cards");
  }

  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const suits = cards.map((card) => card.slice(-1));
  const flush = suits.every((suit) => suit === suits[0]);
  const uniqueRanks = [...new Set(ranks)];
  // Ace is high only, so A-5-4-3-2 is not a straight in 2-7.
  const straight =
    uniqueRanks.length === 5 && uniqueRanks[0] - uniqueRanks[4] === 4;

  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()]
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  if (straight && flush) {
    return {
      category: 8,
      tiebreak: [ranks[0]],
      description: `${RANK_NAME[ranks[0]]}-high straight flush`,
    };
  }
  if (groups[0].count === 4) {
    return {
      category: 7,
      tiebreak: [groups[0].rank, groups[1].rank],
      description: `Four ${RANK_NAME[groups[0].rank]}s`,
    };
  }
  if (groups[0].count === 3 && groups[1].count === 2) {
    return {
      category: 6,
      tiebreak: [groups[0].rank, groups[1].rank],
      description: `Full house, ${RANK_NAME[groups[0].rank]}s full`,
    };
  }
  if (flush) {
    return {
      category: 5,
      tiebreak: ranks,
      description: `${RANK_NAME[ranks[0]]}-high flush`,
    };
  }
  if (straight) {
    return {
      category: 4,
      tiebreak: [ranks[0]],
      description: `${RANK_NAME[ranks[0]]}-high straight`,
    };
  }
  if (groups[0].count === 3) {
    const kickers = groups
      .filter((group) => group.count === 1)
      .map((group) => group.rank)
      .sort((a, b) => b - a);
    return {
      category: 3,
      tiebreak: [groups[0].rank, ...kickers],
      description: `Three ${RANK_NAME[groups[0].rank]}s`,
    };
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairs = groups
      .filter((group) => group.count === 2)
      .map((group) => group.rank)
      .sort((a, b) => b - a);
    const kicker = groups.find((group) => group.count === 1)!.rank;
    return {
      category: 2,
      tiebreak: [...pairs, kicker],
      description: `Two pair, ${RANK_NAME[pairs[0]]}s and ${RANK_NAME[pairs[1]]}s`,
    };
  }
  if (groups[0].count === 2) {
    const kickers = groups
      .filter((group) => group.count === 1)
      .map((group) => group.rank)
      .sort((a, b) => b - a);
    return {
      category: 1,
      tiebreak: [groups[0].rank, ...kickers],
      description: `Pair of ${RANK_NAME[groups[0].rank]}s`,
    };
  }
  return {
    category: 0,
    tiebreak: ranks,
    description: describeHighCard(ranks),
  };
}

/** Positive means a is the better (lower) 2-7 hand; zero is a tie. */
export function compareDeuceToSeven(
  a: DeuceToSevenScore,
  b: DeuceToSevenScore,
): number {
  if (a.category !== b.category) return b.category - a.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const av = a.tiebreak[i] ?? 0;
    const bv = b.tiebreak[i] ?? 0;
    if (av !== bv) return bv - av;
  }
  return 0;
}

export function determineDeuceToSevenWinners(
  players: { seat: number; cards: string[] }[],
): { winners: number[]; scores: Record<number, DeuceToSevenScore> } {
  const scores: Record<number, DeuceToSevenScore> = {};
  let winners: number[] = [];
  let best: DeuceToSevenScore | null = null;

  for (const player of players) {
    const score = evaluateDeuceToSeven(player.cards);
    scores[player.seat] = score;
    if (best === null) {
      best = score;
      winners = [player.seat];
      continue;
    }
    const comparison = compareDeuceToSeven(score, best);
    if (comparison > 0) {
      best = score;
      winners = [player.seat];
    } else if (comparison === 0) {
      winners.push(player.seat);
    }
  }

  return { winners, scores };
}
