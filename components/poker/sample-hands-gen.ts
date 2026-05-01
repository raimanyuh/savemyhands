// Demo data generator for the dashboard.
//
// Used by `/dashboard?demo=N` to inject N synthetic hand rows into the
// dashboard so we can preview how the UI behaves with a populated library
// (filters, sort, density, scroll). The hands aren't persisted and aren't
// clickable through to the replayer — they're a visual fixture only.
//
// IDs are prefixed with `demo-` so the dashboard's sample-id check can
// flag every generated row as non-mutable, the same way the bundled
// SAMPLE_HANDS are.

import type { SavedHand } from "./hand";

// Deterministic seeded PRNG. Mulberry32 — small, fast, good enough for
// shuffling fixture data. Reusing the same seed means refreshing the page
// renders the same fake data, which is what we want for visual review.
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VENUES = [
  "Lucky Chances",
  "Bay 101",
  "Hustler",
  "Wynn",
  "Bellagio",
  "Aria",
  "Stones Gardens",
  "Live at the Bike",
  "Commerce",
  "Borgata",
  "Encore",
  "MGM National Harbor",
  // A few rows without a venue so the "—" placeholder renders too.
  null,
  null,
];
const STAKES = ["1/2", "1/3", "2/3", "2/5", "5/5", "5/10", "10/20"];
const POSITIONS = ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"];
// Weighted toward SRP / 3BP because that's the most common live distribution.
const POT_TYPES: SavedHand["type"][] = [
  "LP",
  "SRP",
  "SRP",
  "SRP",
  "SRP",
  "3BP",
  "3BP",
  "4BP",
  "5BP",
];
const RANK = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUIT = ["♠", "♥", "♦", "♣"];
const TAG_POOL = [
  "bluff",
  "river",
  "turn",
  "flop",
  "leak",
  "review",
  "premium",
  "win",
  "draw",
  "flush",
  "set",
  "cooler",
  "barrel",
  "fold-equity",
  "value",
  "thin",
  "spr",
  "icm",
];
const NAMES = [
  "Aces hold",
  "Aces cracked",
  "KK 4-bet",
  "QQ overplay",
  "JJ vs ace-high",
  "Set over set",
  "Top pair fold",
  "Suited connector flush",
  "Wheel draw",
  "Backdoor flush",
  "River bluff vs reg",
  "River value bet",
  "Cold 4-bet bluff",
  "Squeeze gone wrong",
  "Triple barrel",
  "Donk lead the turn",
  "Big blind defense",
  "Out of position c-bet",
  "Check-raise river",
  "ICM nightmare",
  "Crushing the river",
  "Flop xC, turn lead",
  "Limp call BTN",
  "Under-set boat",
  "Top two on a wet board",
  "Overpair vs raise",
  "Slow play rivered",
  "Wide BB call",
  "Iso-raise the limper",
  "River jam vs draw",
  "Deepstack 5BP",
  "BvB battle",
  "Polarized 3-bet",
  "Thin value river",
  "Flopped straight",
  "Rivered two pair",
  "Overpair vs check-raise",
  "Set mining hits",
  "Float the flop",
  "Probe turn vs PFR",
];

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomCards(rng: () => number, count: number): string[] {
  const cards: string[] = [];
  const used = new Set<string>();
  while (cards.length < count) {
    const c = `${pick(rng, RANK)}${pick(rng, SUIT)}`;
    if (used.has(c)) continue;
    used.add(c);
    cards.push(c);
  }
  return cards;
}

// Returns a 5-element board array. "—" placeholders for streets that didn't
// run out (the dashboard's MiniCard renders these as empty slots).
function makeBoard(rng: () => number, streetsRevealed: number): string[] {
  const filled = randomCards(rng, streetsRevealed);
  return Array.from({ length: 5 }, (_, i) => filled[i] ?? "—");
}

function displayDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "2-digit",
  });
}

export function generateSampleHands(n: number, seed = 42): SavedHand[] {
  const rng = mulberry32(seed);
  const out: SavedHand[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    // Date skewed toward recent — `rng() * rng()` is biased toward 0, so
    // most hands land in the last few months.
    const daysBack = Math.floor(rng() * rng() * 540);
    const d = new Date(today);
    d.setDate(d.getDate() - daysBack);

    const stakes = pick(rng, STAKES);
    const venue = pick(rng, VENUES);
    const positions = pick(rng, POSITIONS);
    const type = pick(rng, POT_TYPES);
    const multiway = rng() < 0.3;
    const fav = rng() < 0.1;

    // Result distribution: bell-shaped around 0 with fat tails. r1^3 picks up
    // the occasional big swing while keeping the median in single-buy-in
    // territory.
    const r1 = (rng() - 0.5) * 2;
    const r2 = (rng() - 0.5) * 2;
    const result = Math.round(r1 * r1 * r1 * 1500 + r2 * 100);

    // Most hands run the full board. Some fold preflop / on flop / on turn.
    const completion = rng();
    const streets =
      completion < 0.05
        ? 0
        : completion < 0.2
          ? 3
          : completion < 0.35
            ? 4
            : 5;
    const board = makeBoard(rng, streets);

    // 0-3 distinct tags.
    const numTags = Math.floor(rng() * 4);
    const tagPool = [...TAG_POOL];
    const tags: string[] = [];
    for (let j = 0; j < numTags && tagPool.length > 0; j++) {
      const idx = Math.floor(rng() * tagPool.length);
      tags.push(tagPool.splice(idx, 1)[0]);
    }

    out.push({
      id: `demo-${i.toString(36).padStart(3, "0")}`,
      name: pick(rng, NAMES),
      date: displayDate(d),
      stakes,
      loc: venue ?? "—",
      positions,
      multiway,
      board,
      type,
      tags,
      result,
      fav,
      notes: undefined,
      isPublic: false,
    });
  }
  return out;
}
