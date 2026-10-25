import { describe, expect, it, vi } from "vitest";
import {
  advanceStudPhase as advance, deriveStudBetting as betting, initialStudState,
  pendingStudDealSeat, recordStudAction as act, recordStudDeal, setStudMucked,
  setStudShownCards, setStudStartingCards, startStudHand, studResult, updateStudPlayer, type StudState,
} from "@/components/poker/stud-engine";
import { studToReplay } from "@/components/poker/stud-replay";
import { committedThroughStep, potTypeOf, recordedToHand, type SavedHand } from "@/components/poker/hand";
import { GAME_LABEL, gameTypeOf, holeCountOf } from "@/components/poker/dashboard-shared";
import { assertPayloadSize, clampSavedHand } from "@/lib/hands/limits";
import { saveHandAction } from "@/lib/hands/actions";
import { precomputeEquityByStep } from "@/components/poker/equity";
import { buildAndSaveStudHand } from "./save-hand";
import { buildStudHand } from "./stud-hand";

vi.mock("@/lib/hands/actions", () => ({ saveHandAction: vi.fn() }));
vi.mock("@/components/poker/equity", () => ({ precomputeEquityByStep: vi.fn() }));

function table(ranks: string[]): string[][] {
  const used = new Set<string>();
  return ranks.map((holding, seat) => [...holding].map((rank, index) => {
    const card = Array.from({ length: 4 }, (_, i) => rank + "♣♦♥♠"[(index + seat + i) % 4]).find((value) => !used.has(value));
    if (!card) throw new Error(`Fixture has too many ${rank}s`);
    used.add(card);
    return card;
  }));
}
const hands = table(["KKKQQJ9", "A234578", "AA6789T"]);
const details = { name: " Stud/8 night ", date: "2026-10-25", venue: " Home ", notes: " Split pot " };
function setup(holdings = hands, args: Parameters<typeof initialStudState>[0] = {}) {
  let state = initialStudState({ variant: "STUD_HILO_8", playerCount: holdings.length, ...args });
  for (const player of state.players) state = setStudStartingCards(state, player.seat,
    player.seat === state.heroSeat ? holdings[player.seat].slice(0, 3) : [null, null, holdings[player.seat][2]]);
  return state;
}
function finishBetting(state: StudState) {
  for (let i = 0; i < 100; i++) {
    const next = betting(state);
    if (!next || next.activeSeat === null) return state;
    state = act(state, { seat: next.activeSeat, action: next.canCheck ? "check" : "call" });
  }
  throw new Error("Betting did not close");
}
function deal(state: StudState, holdings: string[][]) {
  for (let seat = pendingStudDealSeat(state); seat !== null; seat = pendingStudDealSeat(state)) {
    const known = state.street !== "seventh-street" || seat === state.heroSeat;
    state = recordStudDeal(state, { seat, ...(known ? { card: holdings[seat][state.players[seat].cards.length] } : {}) });
  }
  return advance(state);
}
function complete(holdings = hands, state = startStudHand(setup(holdings)), withBets = false) {
  for (let street = 0; street < 5; street++) {
    const current = betting(state)!;
    if (withBets && current.canRaise) state = act(state, {
      seat: current.activeSeat!, action: current.lastBet ? "raise" : "bet", amount: Math.min(current.minRaise, current.allInTarget),
    });
    state = advance(finishBetting(state));
    if (street < 4) state = deal(state, holdings);
  }
  return state;
}
function resolve(state = complete(hands, startStudHand(setup()), true), holdings = hands, showSeats = [0, 1, 2]) {
  for (const player of state.players) if (player.seat !== state.heroSeat) state = showSeats.includes(player.seat)
    ? setStudShownCards(state, player.seat, holdings[player.seat]) : setStudMucked(state, player.seat);
  return state;
}
function saved(state = resolve(undefined, hands, [0, 1])): SavedHand {
  const hand = clampSavedHand({ ...buildStudHand({ state, ...details }), id: "studhilo" });
  assertPayloadSize(hand);
  return JSON.parse(JSON.stringify(hand));
}
function finalOf(hand: SavedHand) {
  const replay = studToReplay(hand)!;
  const final = replay.steps.at(-1)!;
  expect(final.stud.resolved).toBe(true);
  expect(Object.values(final.stud.winnings!).reduce((a, b) => a + b, 0)).toBeCloseTo(final.pot);
  expect(final.stud.awards!.reduce((total, award) => total + award.amount, 0)).toBeCloseTo(final.pot);
  return final;
}

describe("Stud/8 save → load → replay", () => {
  it("persists native rules, the Stud/8 descriptor, seven-card metadata and the combined fractional net result", () => {
    const state = resolve(undefined, hands, [0, 1]);
    const hand = saved(state);
    expect(hand).toMatchObject({ name: "Stud/8 night", date: "Oct 25, 26", stakes: "2/4 FL", loc: "Home", positions: "S1", multiway: true,
      board: ["—", "—", "—", "—", "—"], type: "LP", result: 8.125, notes: "Split pot",
      _full: { schemaVersion: 2, game: { family: "stud", variant: "STUD_HILO_8", bettingStructure: "FL" },
        studRules: { ante: .25, bringIn: 1, smallBet: 2, dealerSeat: 2, maxBets: 4, headsUpUncapped: false, fourthStreetBigBet: false },
        actions: [], board: [], sb: 0, bb: 0, muckedSeats: [2], date: "2026-10-25" } });
    expect(gameTypeOf(hand)).toBe("STUD_HILO_8");
    expect(GAME_LABEL[gameTypeOf(hand)]).toBe("Stud Hi/Lo 8");
    expect(holeCountOf(hand)).toBe(7);
    expect(potTypeOf(hand)).toBe("—");
    expect(hand._full!.players[1].cards).toEqual(hands[1]);
    expect(hand._full!.players[2].cards).toBeNull();
    expect(hand._full).not.toHaveProperty("history");
    expect(hand._full).not.toHaveProperty("equityByStep");
    const replay = studToReplay(hand)!;
    expect(recordedToHand(hand)).toEqual(replay);
    expect(replay.players.every((player) => player.cards === null)).toBe(true);
    expect(replay.steps.every((step) => !step.board && !step.draw && step.actionIndex === undefined && !step.stud.sharedCard)).toBe(true);
    expect(finalOf(hand)).toMatchObject({ pot: 48.75, committedAfter: studResult(state).committed, label: "S1 wins high $24.375 · S2 wins low $24.375",
      stud: { awards: [{ amount: 24.375, portion: "high", winners: [0] }, { amount: 24.375, portion: "low", winners: [1] }], winnings: { 0: 24.375, 1: 24.375 } } });
    expect(finalOf(hand).winner).toBeUndefined();
    expect(committedThroughStep(replay.steps, replay.steps.length - 1, replay)).toEqual(studResult(state).committed);
  });
  it("rebuilds the low-door bring-in and high exposed-board action order with small/big limits", () => {
    const replay = studToReplay(saved())!;
    expect(replay.steps.find((step) => step.stud.eventId === "third-street-opening"))
      .toMatchObject({ active: 1, pot: 1.75, stud: { firstToAct: 2, nextToAct: 2, limitBet: 2 } });
    for (const [round, limitBet] of [["fourth-street", 2], ["fifth-street", 4], ["sixth-street", 4], ["seventh-street", 4]] as const) {
      const ready = replay.steps.find((step) => step.street === round && step.stud.kind === "deal" && step.active === 2)!;
      expect(ready.stud).toMatchObject({ firstToAct: 0, nextToAct: 0, limitBet });
    }
  });
  it("reveals opponent downcards only at their show event, with fixed slots and physical orientations", () => {
    const hand = saved();
    const replay = studToReplay(hand)!;
    const showIndex = replay.steps.findIndex((step) => step.stud.kind === "show" && step.active === 1);
    const first = replay.steps.find((step) => step.stud.eventId === "deal-third-street-seat-0-card-0")!;
    expect(first.stud.cards[0][0]).toEqual({ present: true, visibility: "down", faceUp: true, card: hands[0][0] });
    expect(first.stud.cards[0].slice(1).every((slot) => !slot.present)).toBe(true);
    for (const step of replay.steps.slice(0, showIndex)) for (const index of [0, 1, 6]) expect(step.stud.cards[1][index].card).toBeUndefined();
    const river = replay.steps.find((step) => step.stud.eventId === "deal-seventh-street-seat-1-card-6")!;
    expect(river.stud.cards[1][6]).toEqual({ present: true, faceUp: false, visibility: "down" });
    expect(replay.steps[showIndex].stud.cards[1].map((slot) => slot.card)).toEqual(hands[1]);
    expect(replay.steps[showIndex].stud.cards[1][6]).toMatchObject({ faceUp: true, visibility: "down" });
    expect(replay.steps.at(-1)!.stud.cards[2].every((slot) => !slot.present && !slot.card)).toBe(true);
    expect(hand._full!.timeline!.filter((event) => event.type === "deal" && event.seat !== 0 && event.visibility === "down").every((event) => !("card" in event))).toBe(true);
    expect(replay.steps.slice(0, -1).every((step) => step.stud.awards === undefined && step.stud.winnings === undefined)).toBe(true);
  });
  it("ignores final player cards, stored result metadata and accidental private deal identities", () => {
    const hand = saved();
    const expected = studToReplay(hand);
    hand.result = 999999;
    for (const player of hand._full!.players) player.cards = ["invalid metadata"];
    for (const event of hand._full!.timeline!) if (event.type === "deal" && event.seat !== 0 && event.visibility === "down") event.card = "invalid hidden card";
    expect(studToReplay(hand)).toEqual(expected);
  });
  it("keeps earlier cards, sets and awards independent from later snapshots and repeated loads", () => {
    const hand = saved();
    const replay = studToReplay(hand)!;
    const before = replay.steps.find((step) => step.stud.eventId === "deal-seventh-street-seat-1-card-6")!;
    const copy = structuredClone(before);
    const original = structuredClone(hand);
    const final = replay.steps.at(-1)!;
    final.stud.cards[1][0].card = "T♠";
    final.stud.muckedSeats.push(1);
    final.stud.awards![0].winners.push(2);
    final.stud.awards![0].eligibleSeats.push(7);
    final.stud.winnings![0] = 0;
    expect(before).toEqual(copy);
    expect(hand).toEqual(original);
    expect(finalOf(hand).stud.winnings).toEqual({ 0: 24.375, 1: 24.375 });
  });
  it.each([[1, 8.125], [2, -16.25]])("preserves hero at seat %i, net result and clockwise dealing order", (heroSeat, result) => {
    const state = resolve(complete(hands, startStudHand(setup(hands, { heroSeat, dealerSeat: 0 })), true));
    const hand = saved(state);
    const replay = studToReplay(hand)!;
    expect(hand).toMatchObject({ positions: `S${heroSeat + 1}`, result, _full: { heroPosition: heroSeat, studRules: { dealerSeat: 0 } } });
    expect(replay.steps.find((step) => step.stud.kind === "deal")!.active).toBe(1);
    expect(replay.steps.find((step) => step.stud.kind === "deal" && step.active === heroSeat)!.stud.cards[heroSeat][0])
      .toMatchObject({ card: hands[heroSeat][0], faceUp: true, visibility: "down" });
    expect(finalOf(hand).stud.winnings).toEqual({ 0: 24.375, 1: 24.375 });
  });
  it("scoops using different five-card selections for high and low", () => {
    const holdings = table(["A23456K", "7788QJT"]);
    const hand = saved(resolve(complete(holdings), holdings));
    expect(hand.result).toBe(1.25);
    expect(finalOf(hand)).toMatchObject({ winner: 0, pot: 2.5, label: "S1 wins high $1.25 · S1 wins low $1.25", stud: { winnings: { 0: 2.5 } } });
  });
  it.each(["AA6789T", "A2349TJ"])("awards the entire pot high when %s cannot qualify for low", (ranks) => {
    const holdings = table(["KKKQQJ9", ranks]);
    const hand = saved(resolve(complete(holdings), holdings));
    expect(hand.result).toBe(1.25);
    expect(finalOf(hand)).toMatchObject({ winner: 0, label: "S1 wins high $2.5", stud: { awards: [{ amount: 2.5, portion: "high", winners: [0] }], winnings: { 0: 2.5 } } });
    expect(finalOf(hand).stud.awards).toHaveLength(1);
  });
  it("retains a qualifying eight-low and an unpaired low selected from a paired holding", () => {
    for (const ranks of ["A2378KQ", "A2345AA"]) {
      const holdings = table(["KKKQQJ9", ranks]);
      const hand = saved(resolve(complete(holdings), holdings));
      expect(hand.result).toBe(0);
      expect(finalOf(hand).stud.winnings).toEqual({ 0: 1.25, 1: 1.25 });
    }
  });
  it("quarters tied low winners and saves an exact negative fractional net", () => {
    const holdings = table(["A2345KQ", "A2345JT", "KKKQQJ9"]);
    const hand = saved(resolve(complete(holdings), holdings));
    expect(hand.result).toBe(-.3125);
    expect(finalOf(hand)).toMatchObject({ label: "S3 wins high $1.875 · S1 / S2 split low $1.875", stud: {
      awards: [{ portion: "high", winners: [2] }, { portion: "low", winners: [0, 1] }], winnings: { 0: .9375, 1: .9375, 2: 1.875 },
    } });
  });
  it("combines high and tied-low portions into a three-quarter net result", () => {
    const holdings = table(["A23456K", "A2345QJ"]);
    const hand = saved(resolve(complete(holdings), holdings));
    expect(hand.result).toBe(.625);
    expect(finalOf(hand).stud.winnings).toEqual({ 0: 1.875, 1: .625 });
  });
  it("splits tied high and low halves independently without a false single winner", () => {
    const holdings = table(["A23456K", "A23456K"]);
    const hand = saved(resolve(complete(holdings), holdings));
    expect(hand.result).toBe(0);
    expect(finalOf(hand)).toMatchObject({ stud: { awards: [
      { portion: "high", winners: [0, 1] }, { portion: "low", winners: [0, 1] },
    ], winnings: { 0: 1.25, 1: 1.25 } } });
    expect(finalOf(hand).winner).toBeUndefined();
  });
  it("resolves a tied high-only pot when nobody qualifies low", () => {
    const holdings = table(["AKQJT98", "AKQJT76"]);
    const hand = saved(resolve(complete(holdings), holdings));
    expect(hand.result).toBe(0);
    expect(finalOf(hand)).toMatchObject({ label: "S1 / S2 split high $2.5", stud: { winnings: { 0: 1.25, 1: 1.25 } } });
    expect(finalOf(hand).stud.awards).toHaveLength(1);
  });
  it("qualifies low separately per side pot and saves the short stack's combined net", () => {
    const holdings = table(["A234578", "KKKQQJ9", "AA6789T"]);
    let state = setup(holdings);
    for (const [seat, stack] of [[0, 5.25], [1, 10.25], [2, 20.25]]) state = updateStudPlayer(state, seat, { stack });
    state = resolve(complete(holdings, startStudHand(state), true), holdings);
    const hand = saved(state);
    expect(hand.result).toBe(2.625);
    expect(finalOf(hand)).toMatchObject({ pot: 25.75, committedAfter: studResult(state).committed, stud: { awards: [
      { amount: 7.875, eligibleSeats: [0, 1, 2], portion: "high", winners: [1] },
      { amount: 7.875, eligibleSeats: [0, 1, 2], portion: "low", winners: [0] },
      { amount: 10, eligibleSeats: [1, 2], portion: "high", winners: [1] },
    ], winnings: { 0: 7.875, 1: 17.875 } } });
    expect(() => saved(setStudMucked(setStudMucked(state, 1), 2))).toThrow("eligible winner");
  });
  it("preserves different main-pot and side-pot low ties", () => {
    const holdings = table(["A23456K", "A2345QJ", "KKKQQJT"]);
    let state = setup(holdings);
    for (const [seat, stack] of [[0, 5.25], [1, 10.25], [2, 20.25]]) state = updateStudPlayer(state, seat, { stack });
    const hand = saved(resolve(complete(holdings, startStudHand(state), true), holdings));
    expect(hand.result).toBe(-1.3125);
    expect(finalOf(hand)).toMatchObject({ pot: 25.75, stud: { awards: [
      { amount: 7.875, portion: "high", winners: [2] }, { amount: 7.875, portion: "low", winners: [0, 1] },
      { amount: 5, portion: "high", winners: [2] }, { amount: 5, portion: "low", winners: [1] },
    ], winnings: { 0: 3.9375, 1: 8.9375, 2: 12.875 } } });
  });
  it("excludes mucked lows and requires every live showdown decision", () => {
    const state = complete();
    expect(() => saved(state)).toThrow("show or muck");
    const shown = setStudShownCards(state, 2, hands[2]);
    expect(() => saved(shown)).toThrow("show or muck");
    const hand = saved(setStudMucked(shown, 1));
    expect(finalOf(hand)).toMatchObject({ winner: 0, stud: { awards: [{ portion: "high", winners: [0] }], winnings: { 0: 3.75 } } });
  });
  it("refunds an uncalled completion and saves a fold win without inventing high/low halves or later streets", () => {
    let state = act(startStudHand(setup()), { seat: 2, action: "raise", amount: 2 });
    state = act(state, { seat: 0, action: "fold" });
    state = advance(act(state, { seat: 1, action: "fold" }));
    const hand = saved(state);
    expect(hand.result).toBe(-.25);
    const replay = studToReplay(hand)!;
    expect(replay.steps.find((step) => step.stud.kind === "round-end")!.stud.refunds).toEqual({ 2: 1 });
    expect(finalOf(hand)).toMatchObject({ winner: 2, pot: 2.75, label: "S3 wins $2.75", stud: { winnings: { 2: 2.75 } } });
    expect(replay.steps.every((step) => step.street === "third-street" || step.stud.kind === "result")).toBe(true);
    expect(finalOf(hand).stud.awards!.every((award) => award.portion === undefined)).toBe(true);
  });
  it.each([2, 3, 8])("round trips %i-seat ante-only all-ins with individual rivers and no dry betting", (count) => {
    const deck = [..."23456789TJQKA"].flatMap((rank) => [..."♣♦♥♠"].map((suit) => rank + suit));
    const heroSeat = count - 1;
    const holdings = Array.from({ length: count }, (_, seat) => [...deck.slice(seat * 6, seat * 6 + 6), ...(seat === heroSeat ? ["A♣"] : [])]);
    const state = resolve(complete(holdings, startStudHand(setup(holdings, { heroSeat, dealerSeat: 0, stack: .25 }))), holdings, []);
    const hand = saved(state);
    expect(hand.result).toBe(.25 * (count - 1));
    expect(hand._full!.timeline!.filter((event) => event.type === "deal")).toHaveLength(count * 7);
    expect(hand._full!.timeline!.some((event) => event.type === "shared-deal" || event.type === "action")).toBe(false);
    expect(finalOf(hand).pot).toBe(.25 * count);
  });
  it("replays zero antes and a direct full opening", () => {
    const noAnte = saved(resolve(complete(hands, startStudHand(setup(hands, { ante: 0 })))));
    expect(noAnte._full!.timeline![0].type).toBe("deal");
    expect(finalOf(noAnte).pot).toBe(3);
    const direct = saved(resolve(complete(hands, startStudHand(setup(), { complete: true }))));
    expect(studToReplay(direct)!.steps.find((step) => step.stud.eventId === "third-street-opening"))
      .toMatchObject({ active: 1, label: "S2 opens for $2", stud: { nextToAct: 2, limitBet: 2 } });
    expect(finalOf(direct).pot).toBe(6.75);
  });
  it("rejects malformed rules, shared rivers, invalid actors, wager amounts and contradictory showdown events", () => {
    const mutations: ((hand: SavedHand) => void)[] = [
      (hand) => { hand._full!.studRules!.fourthStreetBigBet = true; },
      (hand) => { hand._full!.timeline!.push({ id: "shared", type: "shared-deal", round: "seventh-street", cardIndex: 6, visibility: "up", card: "T♠" }); },
      (hand) => { const e = hand._full!.timeline!.find((e) => e.type === "forced-bet" && e.kind === "bring-in")!; if (e.type === "forced-bet") e.seat = 0; },
      (hand) => { const e = hand._full!.timeline![0]; if (e.type === "forced-bet") e.amount = 9; },
      (hand) => { hand._full!.timeline![1].id = hand._full!.timeline![0].id; },
      (hand) => { const events = hand._full!.timeline!; [events[3], events[4]] = [events[4], events[3]]; },
      (hand) => { const e = hand._full!.timeline!.find((e) => e.type === "deal" && e.round === "fourth-street")!; if (e.type === "deal") e.card = hands[0][0]; },
      (hand) => { const e = hand._full!.timeline!.find((e) => e.type === "deal" && e.round === "fourth-street")!; if (e.type === "deal") e.visibility = "down"; },
      (hand) => { const e = hand._full!.timeline!.find((e) => e.type === "action" && e.round === "fourth-street")!; if (e.type === "action") e.seat = 1; },
      (hand) => { const e = hand._full!.timeline!.find((e) => e.type === "action" && e.round === "fourth-street")!; if (e.type === "action") { e.amount = 4; e.limitBet = 4; } },
      (hand) => { hand._full!.timeline = hand._full!.timeline!.filter((e) => !(e.type === "show" && e.seat === 1)); },
      (hand) => { const e = hand._full!.timeline!.find((e) => e.type === "show" && e.seat === 1)!; if (e.type === "show") e.cards[2] = "T♠"; },
      (hand) => { hand._full!.timeline = hand._full!.timeline!.filter((e) => !(e.type === "deal" && e.seat === 0 && e.cardIndex === 6)); },
      (hand) => { hand._full!.game!.variant = "RAZZ"; },
    ];
    for (const mutate of mutations) { const hand = saved(); mutate(hand); expect(() => studToReplay(hand)).toThrow(); }
  });
  it("requires supported metadata and complete hands while canonicalizing the High-only setting off", () => {
    const state = resolve();
    expect(() => saved(setup())).toThrow("Finish");
    expect(() => buildStudHand({ state, date: "2026-02-30" })).toThrow("valid YYYY-MM-DD");
    expect(() => saved({ ...state, sharedSeventh: "T♠" })).toThrow("individual seventh");
    state.limitRules.fourthStreetBigBet = true;
    expect(saved(state)._full!.studRules!.fourthStreetBigBet).toBe(false);
    for (const mutate of [
      (hand: SavedHand) => { delete hand._full!.studRules; },
      (hand: SavedHand) => { delete hand._full!.timeline; },
      (hand: SavedHand) => { hand._full!.game!.bettingStructure = "NL"; },
    ]) { const hand = saved(); mutate(hand); expect(studToReplay(hand)).toBeNull(); }
  });
  it("retains text/payload limits and omits undo history from stored data", () => {
    const hand = clampSavedHand({ ...buildStudHand({ state: resolve(), ...details, name: "h".repeat(120), notes: "n".repeat(5000) }), id: "hilo" });
    expect(hand.name).toHaveLength(100);
    expect(hand._full!.notes).toHaveLength(4000);
    expect(hand._full).not.toHaveProperty("history");
    assertPayloadSize(hand);
  });
  it("uses the existing private-by-default save action, skips community equity and preserves state on failure/retry", async () => {
    vi.mocked(saveHandAction).mockClear();
    vi.mocked(precomputeEquityByStep).mockClear();
    const state = resolve();
    const copy = structuredClone(state);
    vi.mocked(saveHandAction).mockRejectedValueOnce(new Error("Connection lost"));
    await expect(buildAndSaveStudHand({ state, ...details })).rejects.toThrow("Connection lost");
    expect(state).toEqual(copy);
    vi.mocked(saveHandAction).mockResolvedValueOnce({ ...saved(state), id: "saved-hilo" });
    expect(await buildAndSaveStudHand({ state, ...details })).toEqual({ id: "saved-hilo" });
    const payload = vi.mocked(saveHandAction).mock.calls[1][0];
    expect(payload._full!.game).toMatchObject({ family: "stud", variant: "STUD_HILO_8" });
    expect(payload.result).toBe(8.125);
    expect(payload.isPublic).toBeUndefined();
    expect(precomputeEquityByStep).not.toHaveBeenCalled();
    expect(state).toEqual(copy);
  });
});
