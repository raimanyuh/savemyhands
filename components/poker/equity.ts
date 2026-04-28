// All-in equity calculator. Given each contestant's hole cards and a
// partial board, enumerate every possible runout and tally hand-eval wins
// (with ties split evenly). Designed for the replayer's "show equity"
// toggle — fast enough for instant feedback on flop / turn / river.
//
// Computational cost (2 contestants, no card duplication):
//   * river  — 1 enum, instant
//   * turn   — 44 enums, ~1ms
//   * flop   — C(45,2) = 990 enums, ~5–15ms
//   * pre    — C(48,5) = 1.7M enums, several seconds — skipped (returns {})
//
// More contestants or known villain cards reduce the deck and speed things
// up further, so multi-way flop equity stays well under a frame.

import { determineWinner } from "./hand-eval";
import { hasFolded, type ReplayHand } from "./hand";

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["♠", "♥", "♦", "♣"];

function fullDeck(): string[] {
  const deck: string[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  return deck;
}

function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  if (k > arr.length) return;
  for (let i = 0; i <= arr.length - k; i++) {
    for (const tail of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...tail];
    }
  }
}

export function computeEquity(
  contestants: { seat: number; cards: [string, string] }[],
  board: string[],
): Record<number, number> {
  if (contestants.length < 2) return {};
  // Pre-flop equity (5-card runout) is a couple seconds in the worst case;
  // we skip it to keep the toggle responsive. The user asked for flop /
  // turn / river only.
  if (board.length < 3 || board.length > 5) return {};

  const used = new Set<string>();
  for (const c of contestants) {
    used.add(c.cards[0]);
    used.add(c.cards[1]);
  }
  for (const b of board) used.add(b);

  const deck = fullDeck().filter((c) => !used.has(c));
  const cardsToCome = 5 - board.length;

  const wins: Record<number, number> = {};
  for (const c of contestants) wins[c.seat] = 0;

  let total = 0;
  for (const combo of combinations(deck, cardsToCome)) {
    const fullBoard = [...board, ...combo];
    const out = determineWinner(
      contestants.map((c) => ({ seat: c.seat, cards: c.cards })),
      fullBoard,
    );
    const share = 1 / out.winners.length;
    for (const w of out.winners) wins[w] += share;
    total++;
  }

  const equity: Record<number, number> = {};
  for (const c of contestants) {
    equity[c.seat] = total > 0 ? wins[c.seat] / total : 0;
  }
  return equity;
}

// Precompute equity for every step in a hand. Called at save time so the
// replayer can do a pure lookup instead of recomputing on each toggle.
// Steps where equity isn't applicable (pre-flop, or fewer than 2 players
// with shown cards) are simply omitted from the result.
export function precomputeEquityByStep(hand: {
  steps: ReplayHand["steps"];
  players: ReplayHand["players"];
}): Record<number, Record<number, number>> {
  const result: Record<number, Record<number, number>> = {};
  for (let s = 0; s < hand.steps.length; s++) {
    let stepBoard: string[] = [];
    for (let i = 0; i <= s; i++) {
      if (hand.steps[i].board) stepBoard = hand.steps[i].board!;
    }
    const contestants = hand.players
      .filter(
        (p) =>
          !!(p.cards?.[0] && p.cards?.[1]) &&
          !hasFolded(hand.steps, s, p.seat),
      )
      .map((p) => ({
        seat: p.seat,
        cards: [p.cards![0]!, p.cards![1]!] as [string, string],
      }));
    const equity = computeEquity(contestants, stepBoard);
    if (Object.keys(equity).length > 0) {
      result[s] = equity;
    }
  }
  return result;
}
