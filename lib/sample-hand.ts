// Bundled sample hand used by:
//   * the dashboard's first-run row (when a user has zero saved hands), and
//   * the public replayer URL `/hand/sample` (no DB lookup required).
//
// Picking a single rich hand instead of multiple thin ones gives new users
// one polished thing to click through that exercises every replayer
// feature: multi-street narration, hand-level notes, per-action
// annotations, an opponent reveal at showdown, equity overlay support,
// the action log popover, and keyboard shortcuts.
//
// To regenerate or change this hand without touching code, you could
// instead record it in production, mark it public, and replace the
// constants below with the resulting payload. The shape is the same as
// any saved hand.

import type { SavedHand } from "@/components/poker/hand";
import type { Action, Player } from "@/components/poker/engine";

// Stable id used in the URL `/hand/sample`. Won't collide with the 8-char
// base36 ids `newHandId()` mints. The replayer page (`app/hand/[id]/page.tsx`)
// intercepts this id before it hits the DB.
export const SAMPLE_HAND_ID = "sample";

// 6-handed, 1/2 NLHE. BTN is hero by convention (cycle 0 + heroPosition 0).
// Cards are entered for hero (always face up) and CO (revealed at showdown
// because they showed). Other seats stay face-down.
const PLAYERS: Player[] = [
  { seat: 0, name: "Hero",          stack: 400, cards: ["A♥", "K♥"] },
  { seat: 1, name: "reg_3",         stack: 290, cards: null },
  { seat: 2, name: "Whale",         stack: 580, cards: null },
  { seat: 3, name: "tight reg",     stack: 310, cards: null },
  { seat: 4, name: "loose passive", stack: 250, cards: null },
  { seat: 5, name: "Villain",       stack: 480, cards: ["Q♣", "J♣"] },
];

// Action log. Indices below feed the annotations map. Note that blinds
// (SB=$1, BB=$2) post automatically and don't appear as actions.
const ACTIONS: Action[] = [
  // Preflop: UTG/HJ fold, CO opens, hero 3-bets, blinds fold, CO calls.
  { street: "preflop", seat: 3, action: "fold" },                  // 0
  { street: "preflop", seat: 4, action: "fold" },                  // 1
  { street: "preflop", seat: 5, action: "raise", amount: 8 },      // 2
  { street: "preflop", seat: 0, action: "raise", amount: 24 },     // 3 ← annotated
  { street: "preflop", seat: 1, action: "fold" },                  // 4
  { street: "preflop", seat: 2, action: "fold" },                  // 5
  { street: "preflop", seat: 5, action: "call" },                  // 6
  // Flop A♣ 7♣ 3♦, pot $51: CO check, hero c-bets, CO calls.
  { street: "flop",    seat: 5, action: "check" },                 // 7
  { street: "flop",    seat: 0, action: "bet",   amount: 30 },     // 8 ← annotated
  { street: "flop",    seat: 5, action: "call" },                  // 9
  // Turn 5♣ (third club, flush completes). CO check, hero check back.
  { street: "turn",    seat: 5, action: "check" },                 // 10
  { street: "turn",    seat: 0, action: "check" },                 // 11 ← annotated
  // River 9♦ (bricks). CO leads polarized; hero calls light.
  { street: "river",   seat: 5, action: "bet",   amount: 80 },     // 12 ← annotated
  { street: "river",   seat: 0, action: "call" },                  // 13 ← annotated
];

const ANNOTATIONS: Record<number, string> = {
  3: "Standard 3-bet IP with AKs — folds out his weakest opens and isolates the call-down range.",
  8: "C-bet for value and protection. Top pair top kicker on a two-tone board with the nut backdoor flush; he calls with worse pairs and draws.",
  11: "Pot control. The flush card just came in; betting turns me into a bluff-catcher with showdown value. Better to realize equity to the river.",
  12: "Polarized river sizing. Either he got there with clubs, or he's bluffing the missed broadways and gutters that his preflop range is loaded with.",
  13: "Hero call. Pot odds ~30%, and his river range has way more missed combos (KQ, QJ, T9 with a club, etc.) than slowplayed flushes. Sticky here.",
};

const NOTES =
  "Played at Lucky Chances on a Friday. Villain had been opening late position wide all session and 3-betting light. The turn check was the inflection point — with the flush card in, betting value-owns me against actual flushes and folds out worse. The river call comes down to his bluff-to-value ratio on the polarized lead, which read closer to bluff-heavy given how often clubs missed his range.";

// The 5-card runout, used both at the top level (for the dashboard mini
// board) and inside `_full` (for the replayer's street-by-street reveal).
const BOARD = ["A♣", "7♣", "3♦", "5♣", "9♦"];

export function getSampleHand(): SavedHand {
  return {
    id: SAMPLE_HAND_ID,
    name: "Hero call river vs missed flush draw",
    date: "Aug 15, 25",
    stakes: "1/2",
    loc: "Lucky Chances",
    positions: "BTN",
    multiway: false,
    board: BOARD,
    type: "3BP",
    tags: ["hero-call", "river", "review"],
    // Hero risked $134 (24 + 30 + 80) and won the $271 pot. Net $137.
    result: 137,
    fav: false,
    notes: NOTES,
    isPublic: true,
    _full: {
      players: PLAYERS,
      actions: ACTIONS,
      // `_full.board` accepts (string | null)[]; the dashboard top-level
      // `board` uses "—" placeholders for empty slots, but here every
      // street completes so all five are filled.
      board: BOARD,
      sb: 1,
      bb: 2,
      playerCount: 6,
      heroPosition: 0,
      straddleOn: false,
      straddleAmt: 4,
      muckedSeats: [],
      notes: NOTES,
      venue: "Lucky Chances",
      date: "2025-08-15",
      annotations: ANNOTATIONS,
    },
  };
}
