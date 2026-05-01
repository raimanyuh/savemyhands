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
import type { GameType } from "./engine";

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
  contestants: { seat: number; cards: string[] }[],
  board: string[],
  gameType: GameType = "NLHE",
): Record<number, number> {
  if (contestants.length < 2) return {};
  // Pre-flop equity (5-card runout) is a couple seconds in the worst case;
  // we skip it to keep the toggle responsive. The user asked for flop /
  // turn / river only.
  if (board.length < 3 || board.length > 5) return {};

  const used = new Set<string>();
  for (const c of contestants) {
    for (const card of c.cards) used.add(card);
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
      gameType,
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
//
// `boardKey` defaults to "board" (the primary board). Pass "board2" on a
// double-board hand to get the parallel equity map for the second board;
// the caller stores both alongside the hand and the replayer renders two
// badges per seat when both are present.
export function precomputeEquityByStep(
  hand: {
    steps: ReplayHand["steps"];
    players: ReplayHand["players"];
  },
  boardKey: "board" | "board2" = "board",
  gameType: GameType = "NLHE",
): Record<number, Record<number, number>> {
  const result: Record<number, Record<number, number>> = {};
  // For Omaha all hole cards count; for Hold'em use the first two.
  const holeCount = gameType === "PLO5" ? 5 : gameType === "PLO4" ? 4 : 2;
  const allFilled = (cards: (string | null)[] | null | undefined): boolean => {
    if (!cards || cards.length < holeCount) return false;
    for (let i = 0; i < holeCount; i++) if (!cards[i]) return false;
    return true;
  };
  for (let s = 0; s < hand.steps.length; s++) {
    let stepBoard: string[] = [];
    for (let i = 0; i <= s; i++) {
      const b = hand.steps[i][boardKey];
      if (b) stepBoard = b;
    }
    const contestants = hand.players
      .filter(
        (p) => allFilled(p.cards) && !hasFolded(hand.steps, s, p.seat),
      )
      .map((p) => ({
        seat: p.seat,
        cards: (p.cards as string[]).slice(0, holeCount),
      }));
    const equity = computeEquity(contestants, stepBoard, gameType);
    if (Object.keys(equity).length > 0) {
      result[s] = equity;
    }
  }
  return result;
}
