// Ace-to-five lowball: aces are low, straights/flushes are ignored, and
// paired hands still lose to every unpaired hand. Razz has no qualifier.
type RankedHand = {
  category: number;
  /** Lower wins, comparing the made rank(s) before descending kickers. */
  tiebreak: number[];
};
export type AceToFiveScore = RankedHand & {
  /** Lower is better; retain conventional categories for paired hands. */
  category: 0 | 1 | 2 | 3 | 6 | 7;
  description: string;
};

const RANKS = "A23456789TJQK";
const RANK_NAME = ["", "Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King"];
const RANK_PLURAL = ["", "Aces", "Twos", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines", "Tens", "Jacks", "Queens", "Kings"];

function validate(cards: string[], min: number, max = min) {
  if (cards.length < min || cards.length > max) throw new Error(`Ace-to-five evaluation requires ${min === max ? min : `${min} to ${max}`} cards`);
  if (cards.some((card) => !/^[A2-9TJQK][♣♦♥♠]$/u.test(card))) throw new Error("Invalid ace-to-five card");
  if (new Set(cards).size !== cards.length) throw new Error("Ace-to-five hand contains duplicate cards");
}
function rankScore(cards: string[]): [AceToFiveScore["category"], ...number[]] {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const rank = RANKS.indexOf(card[0]) + 1;
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const category = groups[0][1] === 4 ? 7 : groups[0][1] === 3 ? groups[1]?.[1] === 2 ? 6 : 3
    : groups[0][1] === 2 ? groups[1]?.[1] === 2 ? 2 : 1 : 0;
  return [category, ...groups.map(([rank]) => rank)];
}

/** One to five exposed cards, including an observed shared river. Lower
 * scores act first in Razz. Suits and straight/flush potential never rank. */
export function aceToFiveBoardScore(cards: string[]): number[] {
  validate(cards, 1, 5);
  return rankScore(cards);
}

export function evaluateAceToFive(cards: string[]): AceToFiveScore {
  validate(cards, 5);
  const [category, ...tiebreak] = rankScore(cards);
  const [first, second] = tiebreak;
  const description = category === 0 ? `${RANK_NAME[first]}-${RANK_NAME[second]} low`
    : category === 1 ? `Pair of ${RANK_PLURAL[first]}`
    : category === 2 ? `Two pair, ${RANK_PLURAL[first]} and ${RANK_PLURAL[second]}`
    : category === 3 ? `Three ${RANK_PLURAL[first]}`
    : category === 6 ? `Full house, ${RANK_PLURAL[first]} full of ${RANK_PLURAL[second]}`
    : `Four ${RANK_PLURAL[first]}`;
  return { category, tiebreak, description };
}

/** Positive means a is the better low hand; zero is a tie, never by suit. */
export function compareAceToFive(a: RankedHand, b: RankedHand): number {
  if (a.category !== b.category) return b.category - a.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    if ((a.tiebreak[i] ?? 0) !== (b.tiebreak[i] ?? 0)) return (b.tiebreak[i] ?? 0) - (a.tiebreak[i] ?? 0);
  }
  return 0;
}

/** Evaluate any five from a complete five-, six- or seven-card holding. */
export function evaluateBestAceToFive(cards: string[]): AceToFiveScore {
  validate(cards, 5, 7);
  let best: AceToFiveScore | undefined;
  for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++)
    for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++)
      for (let e = d + 1; e < cards.length; e++) {
        const score = evaluateAceToFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
        if (!best || compareAceToFive(score, best) > 0) best = score;
      }
  return best!;
}
