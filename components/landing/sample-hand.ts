// Hardcoded PLO4 double-board hand for the embedded landing-page replayer.
// Built directly as a SavedHand → ReplayHand without going through the
// recorder reducer. The replay card's annotations live here so visitors
// see what real-grinder notes look like in the product.

import type { Action, Player } from "@/components/poker/engine";
import type { ReplayHand, SavedHand } from "@/components/poker/hand";
import { recordedToHand } from "@/components/poker/hand";

const players: Player[] = [
  { seat: 0, name: "Hero", stack: 500, cards: ["A♠", "A♥", "K♣", "Q♣"] },
  { seat: 1, name: "Riley", stack: 200, cards: null },
  { seat: 2, name: "Tommy", stack: 500, cards: ["T♥", "T♣", "9♦", "8♦"] },
  { seat: 3, name: "Marco", stack: 400, cards: null },
];

const actions: Action[] = [
  { street: "preflop", seat: 3, action: "fold" },
  { street: "preflop", seat: 0, action: "raise", amount: 7 },
  { street: "preflop", seat: 1, action: "fold" },
  { street: "preflop", seat: 2, action: "call" },
  { street: "flop", seat: 2, action: "check" },
  { street: "flop", seat: 0, action: "bet", amount: 10 },
  { street: "flop", seat: 2, action: "call" },
  { street: "turn", seat: 2, action: "check" },
  { street: "turn", seat: 0, action: "bet", amount: 20 },
  { street: "turn", seat: 2, action: "raise", amount: 80 },
  { street: "turn", seat: 0, action: "call" },
  { street: "river", seat: 2, action: "bet", amount: 403 },
  { street: "river", seat: 0, action: "call" },
];

const annotations: Record<number, string> = {
  1: "AAKQ double-suited 4-handed — easy open.",
  5: "Probe small. Equity holds on both boards.",
  10: "Smells like a set. Calling with the overpair + redraws.",
  12: "Pot odds + chop equity. Snap. He scoops B2, I take B1. Wash.",
};

const SAMPLE_HAND: SavedHand = {
  id: "sample",
  name: "Friday $1/$2 PLO — double board",
  date: "2026-04-19",
  stakes: "$1/$2",
  loc: "Hustler — Los Angeles",
  positions: "BTN",
  multiway: false,
  board: ["K♦", "J♥", "4♣", "2♠", "3♦"],
  type: "SRP",
  tags: ["plo", "double-board"],
  result: 1,
  fav: false,
  notes: "",
  isPublic: true,
  _full: {
    players,
    actions,
    board: ["K♦", "J♥", "4♣", "2♠", "3♦"],
    sb: 1,
    bb: 2,
    playerCount: 4,
    heroPosition: 0,
    straddleOn: false,
    straddleAmt: 4,
    bombPotOn: false,
    bombPotAmt: 0,
    doubleBoardOn: true,
    board2: ["T♠", "9♥", "6♣", "5♦", "7♣"],
    gameType: "PLO4",
    muckedSeats: [],
    notes: "",
    venue: "Hustler — Los Angeles",
    date: "2026-04-19",
    annotations,
  },
};

let cached: ReplayHand | null = null;

export function getSampleReplayHand(): ReplayHand {
  if (cached) return cached;
  const h = recordedToHand(SAMPLE_HAND);
  if (!h) throw new Error("Sample hand failed to convert via recordedToHand()");
  cached = h;
  return h;
}

export const SAMPLE_HAND_TITLE = SAMPLE_HAND.name;
export const SAMPLE_HAND_SLUG = "k7q2nx";
