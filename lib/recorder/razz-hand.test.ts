import { describe, expect, it, vi } from "vitest";
import {
  advanceStudPhase as advance, deriveStudBetting as betting, initialStudState,
  pendingStudDealSeat, recordStudAction as act, recordStudDeal, setStudMucked,
  setStudShownCards, setStudStartingCards, startStudHand, studResult,
  unavailableStudCards, updateStudPlayer, type StudState,
} from "@/components/poker/stud-engine";
import { studToReplay } from "@/components/poker/stud-replay";
import { potTypeOf, recordedToHand, type SavedHand } from "@/components/poker/hand";
import { GAME_LABEL, gameTypeOf, holeCountOf } from "@/components/poker/dashboard-shared";
import { assertPayloadSize, clampSavedHand } from "@/lib/hands/limits";
import { saveHandAction } from "@/lib/hands/actions";
import { precomputeEquityByStep } from "@/components/poker/equity";
import { buildAndSaveStudHand } from "./save-hand";
import { buildStudHand } from "./stud-hand";

vi.mock("@/lib/hands/actions", () => ({ saveHandAction: vi.fn() }));
vi.mock("@/components/poker/equity", () => ({ precomputeEquityByStep: vi.fn() }));

const hands = [
  ["A♣", "2♦", "K♠", "3♣", "4♦", "5♥", "6♠"],
  ["A♦", "2♥", "Q♠", "3♦", "4♥", "6♣", "7♠"],
  ["A♥", "2♠", "J♣", "3♥", "5♦", "7♣", "8♠"],
];
const details = { name: " Razz night ", date: "2026-10-24", venue: " Home ", notes: " Wheel wins " };
const deck = [..."23456789TJQKA"].flatMap((rank) => [..."♣♦♥♠"].map((suit) => rank + suit));
function setup(args: Parameters<typeof initialStudState>[0] = {}, holdings = hands) {
  let state = initialStudState({ variant: "RAZZ", playerCount: holdings.length, ...args });
  for (let seat = 0; seat < state.playerCount; seat++) state = setStudStartingCards(state, seat,
    seat === state.heroSeat ? holdings[seat].slice(0, 3) : [null, null, holdings[seat]?.[2] ?? `${seat + 2}♣`]);
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
function deal(state: StudState, holdings: string[][], automatic: boolean) {
  for (let seat = pendingStudDealSeat(state); seat !== null; seat = pendingStudDealSeat(state)) {
    const known = state.street !== "seventh-street" || seat === state.heroSeat;
    const card = known ? automatic ? deck.find((card) => !unavailableStudCards(state).has(card)) : holdings[seat][state.players[seat].cards.length] : undefined;
    state = recordStudDeal(state, { seat, ...(card ? { card } : {}) });
  }
  return advance(state);
}
function complete(args: { state?: StudState; holdings?: string[][]; withBets?: boolean; automatic?: boolean } = {}) {
  const holdings = args.holdings ?? hands;
  let state = args.state ?? startStudHand(setup({}, holdings));
  for (let street = 0; street < 5; street++) {
    const current = betting(state)!;
    if (args.withBets && current.canRaise) state = act(state, { seat: current.activeSeat!, action: current.lastBet ? "raise" : "bet", amount: Math.min(current.minRaise, current.allInTarget) });
    state = advance(finishBetting(state));
    if (street < 4) state = deal(state, holdings, !!args.automatic);
  }
  return state;
}
function resolve(state = complete({ withBets: true }), holdings = hands, showSeats = [0, 1]) {
  for (const player of state.players) if (player.seat !== state.heroSeat) state = showSeats.includes(player.seat)
    ? setStudShownCards(state, player.seat, holdings[player.seat]) : setStudMucked(state, player.seat);
  return state;
}
function saved(state = resolve()): SavedHand {
  const hand = clampSavedHand({ ...buildStudHand({ state, ...details }), id: "razz1234" });
  assertPayloadSize(hand);
  return JSON.parse(JSON.stringify(hand));
}

describe("Razz save → load → replay", () => {
  it("persists the Razz descriptor, canonical rules, native timeline and fractional-ready dashboard result", () => {
    const state = resolve();
    const hand = saved(state);
    expect(hand).toMatchObject({ name: "Razz night", date: "Oct 24, 26", stakes: "2/4 FL", loc: "Home", positions: "S1", multiway: true,
      board: ["—", "—", "—", "—", "—"], type: "LP", result: 32.5, notes: "Wheel wins",
      _full: { schemaVersion: 2, game: { family: "stud", variant: "RAZZ", bettingStructure: "FL" },
        studRules: { ante: .25, bringIn: 1, smallBet: 2, dealerSeat: 2, maxBets: 4, headsUpUncapped: false, fourthStreetBigBet: false },
        sb: 0, bb: 0, actions: [], board: [], muckedSeats: [2], date: "2026-10-24" } });
    expect(gameTypeOf(hand)).toBe("RAZZ");
    expect(GAME_LABEL[gameTypeOf(hand)]).toBe("Razz");
    expect(holeCountOf(hand)).toBe(7);
    expect(potTypeOf(hand)).toBe("—");
    expect(hand._full!.players[1].cards).toEqual(hands[1]);
    expect(hand._full!.players[2].cards).toBeNull();
    expect(hand._full).not.toHaveProperty("history");
    expect(hand._full).not.toHaveProperty("equityByStep");
    const replay = studToReplay(hand)!;
    expect(recordedToHand(hand)).toEqual(replay);
    expect(replay.game).toEqual(hand._full!.game);
    expect(replay.steps.at(-1)).toMatchObject({ winner: 0, pot: 48.75, committedAfter: studResult(state).committed, stud: { resolved: true, winnings: { 0: 48.75 } } });
    expect(replay.steps.every((step) => !step.board && !step.draw && step.actionIndex === undefined && !step.stud.sharedCard)).toBe(true);
    expect(replay.players.every((player) => player.cards === null)).toBe(true);
  });
  it("reconstructs the highest-card bring-in and lowest exposed action order with the fifth-street increase", () => {
    const replay = studToReplay(saved())!;
    const opening = replay.steps.find((step) => step.stud.eventId === "third-street-opening")!;
    expect(opening).toMatchObject({ active: 0, pot: 1.75, stud: { firstToAct: 1, nextToAct: 1, limitBet: 2 } });
    for (const [round, limitBet] of [["fourth-street", 2], ["fifth-street", 4], ["sixth-street", 4], ["seventh-street", 4]] as const) {
      const ready = replay.steps.find((step) => step.street === round && step.stud.kind === "deal" && step.active === 2)!;
      expect(ready.stud).toMatchObject({ firstToAct: 2, nextToAct: 2, limitBet });
    }
  });
  it("uses seven exact slots and reveals opponent downcards only at their show event", () => {
    const hand = saved();
    const replay = studToReplay(hand)!;
    const showIndex = replay.steps.findIndex((step) => step.stud.kind === "show" && step.active === 1);
    const first = replay.steps.find((step) => step.stud.eventId === "deal-third-street-seat-0-card-0")!;
    expect(first.stud.cards[0][0]).toEqual({ present: true, visibility: "down", faceUp: true, card: "A♣" });
    expect(first.stud.cards[0].slice(1).every((slot) => !slot.present)).toBe(true);
    for (const step of replay.steps.slice(0, showIndex)) for (const index of [0, 1, 6]) expect(step.stud.cards[1][index].card).toBeUndefined();
    const river = replay.steps.find((step) => step.stud.eventId === "deal-seventh-street-seat-1-card-6")!;
    expect(river.stud.cards[1][6]).toEqual({ present: true, faceUp: false, visibility: "down" });
    expect(replay.steps[showIndex].stud.cards[1].map((slot) => slot.card)).toEqual(hands[1]);
    expect(replay.steps[showIndex].stud.cards[1][6]).toMatchObject({ faceUp: true, visibility: "down" });
    expect(replay.steps.at(-1)!.stud.cards[2].every((slot) => !slot.present && !slot.card)).toBe(true);
    expect(hand._full!.timeline!.filter((event) => event.type === "deal" && event.seat !== 0 && event.visibility === "down").every((event) => !("card" in event))).toBe(true);
  });
  it("ignores final player cards and accidental hidden deal identities when rebuilding earlier frames", () => {
    const hand = saved();
    const expected = studToReplay(hand);
    for (const player of hand._full!.players) player.cards = ["invalid metadata"];
    for (const event of hand._full!.timeline!) if (event.type === "deal" && event.seat !== 0 && event.visibility === "down") event.card = "invalid hidden card";
    expect(studToReplay(hand)).toEqual(expected);
  });
  it("keeps earlier cards, visibility, muck sets and payouts independent of later snapshots", () => {
    const replay = studToReplay(saved())!;
    const before = replay.steps.find((step) => step.stud.eventId === "deal-seventh-street-seat-1-card-6")!;
    const copy = structuredClone(before);
    const final = replay.steps.at(-1)!;
    final.stud.cards[1][0].card = "T♠";
    final.stud.muckedSeats.push(1);
    final.stud.awards![0].winners.push(2);
    final.stud.winnings![0] = 0;
    expect(before).toEqual(copy);
  });
  it.each([1, 2])("preserves hero at seat %i and the dealer's clockwise dealing order", (heroSeat) => {
    const state = resolve(complete({ state: startStudHand(setup({ heroSeat, dealerSeat: 0 })) }), hands, []);
    const hand = saved(state);
    const replay = studToReplay(hand)!;
    expect(hand).toMatchObject({ positions: `S${heroSeat + 1}`, result: 2.5, _full: { heroPosition: heroSeat, studRules: { dealerSeat: 0 } } });
    expect(replay.steps.find((step) => step.stud.kind === "deal")!.active).toBe(1);
    const heroDeal = replay.steps.find((step) => step.stud.kind === "deal" && step.active === heroSeat)!;
    expect(heroDeal.stud.cards[heroSeat][0]).toMatchObject({ card: hands[heroSeat][0], faceUp: true, visibility: "down" });
    expect(replay.steps.at(-1)).toMatchObject({ winner: heroSeat, stud: { winnings: { [heroSeat]: 3.75 } } });
  });
  it("awards a nine-low the whole pot without an eight-or-better qualifier", () => {
    const holdings = [["A♣", "2♦", "K♠", "3♣", "4♦", "9♥", "T♠"], ["A♦", "2♥", "Q♠", "3♦", "5♥", "T♣", "J♠"]];
    const hand = saved(resolve(complete({ holdings }), holdings));
    expect(hand.result).toBe(1.25);
    expect(studToReplay(hand)!.steps.at(-1)).toMatchObject({ winner: 0, pot: 2.5, stud: { winnings: { 0: 2.5 } } });
  });
  it("resolves the lowest paired hand when no unpaired five-card hand is available", () => {
    const holdings = [["A♣", "A♦", "2♣", "2♦", "3♣", "3♦", "4♣"], ["2♥", "2♠", "3♥", "3♠", "4♦", "4♥", "5♣"]];
    const hand = saved(resolve(complete({ holdings }), holdings));
    expect(studToReplay(hand)!.steps.at(-1)).toMatchObject({ winner: 0, stud: { winnings: { 0: 2.5 } } });
  });
  it("splits tied lows without suit tiebreaks and retains fractional net results", () => {
    const holdings = [
      ["A♣", "2♣", "K♣", "3♣", "4♣", "5♣", "6♣"],
      ["A♦", "2♦", "Q♦", "3♦", "4♦", "5♦", "6♦"],
      ["A♥", "2♥", "J♥", "3♥", "4♥", "5♥", "6♥"],
    ];
    const hand = saved(resolve(complete({ holdings }), holdings));
    expect(hand.result).toBe(.625);
    expect(studToReplay(hand)!.steps.at(-1)).toMatchObject({ pot: 3.75, stud: { awards: [{ winners: [0, 1] }], winnings: { 0: 1.875, 1: 1.875 } } });
  });
  it("uses a different eligible low winner for the main and side pot", () => {
    let state = setup();
    for (const [seat, stack] of [[0, 5.25], [1, 10.25], [2, 20.25]]) state = updateStudPlayer(state, seat, { stack });
    state = complete({ state: startStudHand(state), withBets: true });
    const hand = saved(resolve(state, hands, [0, 1, 2]));
    expect(hand.result).toBe(10.5);
    expect(studToReplay(hand)!.steps.at(-1)).toMatchObject({ pot: 25.75, stud: { awards: [{ amount: 15.75, eligibleSeats: [0, 1, 2], winners: [0] }, { amount: 10, eligibleSeats: [1, 2], winners: [1] }], winnings: { 0: 15.75, 1: 10 } } });
    expect(() => saved(resolve(state, hands, []))).toThrow("eligible winner");
  });
  it("refunds uncalled completions and saves an early fold without inventing later streets", () => {
    let state = act(startStudHand(setup()), { seat: 1, action: "raise", amount: 2 });
    state = act(state, { seat: 2, action: "fold" });
    state = advance(act(state, { seat: 0, action: "fold" }));
    const hand = saved(state);
    expect(hand.result).toBe(-1.25);
    const replay = studToReplay(hand)!;
    expect(replay.steps.find((step) => step.stud.kind === "round-end")!.stud.refunds).toEqual({ 1: 1 });
    expect(replay.steps.at(-1)).toMatchObject({ winner: 1, pot: 2.75, committedAfter: { 0: 1.25, 1: 1.25, 2: .25 } });
    expect(replay.steps.every((step) => step.street === "third-street" || step.stud.kind === "result")).toBe(true);
  });
  it("preserves a stack-capped bring-in and structured call price through all-in runouts", () => {
    const state = resolve(complete({ state: startStudHand(updateStudPlayer(setup(), 0, { stack: .75 })) }));
    const hand = saved(state);
    expect(hand.result).toBe(1.5);
    const replay = studToReplay(hand)!;
    expect(replay.steps.find((step) => step.stud.eventId === "third-street-opening")).toMatchObject({ pot: 1.25, active: 0 });
    expect(replay.steps.at(-1)).toMatchObject({ pot: 3.25, stud: { winnings: { 0: 2.25, 1: 1 } } });
  });
  it("reconstructs a direct full opening by the highest door card", () => {
    const hand = saved(resolve(complete({ state: startStudHand(setup(), { complete: true }) })));
    expect(hand.result).toBe(4.5);
    expect(studToReplay(hand)!.steps.find((step) => step.stud.eventId === "third-street-opening")).toMatchObject({ active: 0, label: "S1 opens for $2", stud: { nextToAct: 1 } });
  });
  it.each([2, 3, 8])("saves a %i-seat ante-only all-in with individual rivers and no dry betting", (playerCount) => {
    const state = resolve(complete({ state: startStudHand(setup({ playerCount, stack: .25 })), automatic: true }), hands, []);
    const hand = saved(state);
    expect(hand.result).toBe(.25 * (playerCount - 1));
    expect(hand._full!.timeline!.filter((event) => event.type === "deal")).toHaveLength(playerCount * 7);
    expect(hand._full!.timeline!.some((event) => event.type === "shared-deal" || event.type === "action")).toBe(false);
    expect(studToReplay(hand)!.steps.at(-1)).toMatchObject({ pot: .25 * playerCount, stud: { resolved: true } });
  });
  it("requires complete showdown decisions, valid metadata and a supported engine variant", () => {
    expect(() => saved(setup())).toThrow("Finish");
    expect(() => saved(complete())).toThrow("show or muck");
    expect(() => buildStudHand({ state: resolve(), date: "2026-02-30" })).toThrow("valid YYYY-MM-DD");
    expect(() => saved({ ...resolve(), variant: "STUD_HILO_8" as never })).toThrow("not ready");
    expect(() => saved({ ...resolve(), sharedSeventh: "T♦" })).toThrow("individual seventh");
  });
  it("rejects high-game openings, illegal low-board actors, big fourth-street bets and shared events", () => {
    const mutations: ((hand: SavedHand) => void)[] = [
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "forced-bet" && event.kind === "bring-in")!; if (event.type === "forced-bet") event.seat = 2; },
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "action" && event.round === "fourth-street")!; if (event.type === "action") event.seat = 0; },
      (hand) => { hand._full!.studRules!.fourthStreetBigBet = true; },
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "action" && event.round === "fourth-street")!; if (event.type === "action") { event.amount = 4; event.limitBet = 4; } },
      (hand) => { hand._full!.timeline!.push({ id: "forbidden-shared", type: "shared-deal", round: "seventh-street", cardIndex: 6, visibility: "up", card: "T♦" }); },
      (hand) => { hand._full!.timeline = hand._full!.timeline!.filter((event) => !(event.type === "show" && event.seat === 1)); },
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "show" && event.seat === 1)!; if (event.type === "show") event.cards[2] = "T♦"; },
    ];
    for (const mutate of mutations) { const hand = saved(); mutate(hand); expect(() => studToReplay(hand)).toThrow(); }
  });
  it("canonicalizes the Razz fourth-street rule and retains existing text/payload limits", () => {
    const state = resolve();
    state.limitRules.fourthStreetBigBet = true;
    const hand = clampSavedHand({ ...buildStudHand({ state, date: details.date, name: "h".repeat(120), notes: "n".repeat(5000) }), id: "razz" });
    expect(hand._full!.studRules!.fourthStreetBigBet).toBe(false);
    expect(hand.name).toHaveLength(100);
    expect(hand._full!.notes).toHaveLength(4000);
    assertPayloadSize(hand);
    expect(recordedToHand(hand)?.game.variant).toBe("RAZZ");
  });
  it("uses the existing save action, skips community equity and propagates save failures", async () => {
    vi.mocked(saveHandAction).mockClear();
    vi.mocked(precomputeEquityByStep).mockClear();
    vi.mocked(saveHandAction).mockResolvedValueOnce({ ...saved(), id: "saved-razz" });
    expect(await buildAndSaveStudHand({ state: resolve(), ...details })).toEqual({ id: "saved-razz" });
    const payload = vi.mocked(saveHandAction).mock.calls[0][0];
    expect(payload._full!.game).toMatchObject({ family: "stud", variant: "RAZZ" });
    expect(payload.isPublic).toBeUndefined();
    expect(precomputeEquityByStep).not.toHaveBeenCalled();
    vi.mocked(saveHandAction).mockRejectedValueOnce(new Error("Connection lost"));
    await expect(buildAndSaveStudHand({ state: resolve(), ...details })).rejects.toThrow("Connection lost");
  });
});
