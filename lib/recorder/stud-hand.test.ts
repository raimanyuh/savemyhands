import { describe, expect, it, vi } from "vitest";
import {
  advanceStudPhase as advance, deriveStudBetting as betting, initialStudState,
  pendingStudDealSeat, recordStudAction as act, recordStudDeal, restoreLegacyStudSharedSeventh,
  setStudMucked, setStudShownCards, setStudStartingCards, startStudHand, studAccounting,
  studResult, unavailableStudCards, updateStudPlayer, type StudState,
} from "@/components/poker/stud-engine";
import { studToReplay } from "@/components/poker/stud-replay";
import { committedThroughStep, computeStreetBets, potTypeOf, recordedToHand, type SavedHand } from "@/components/poker/hand";
import { GAME_LABEL, gameTypeOf, holeCountOf, multiwayOf } from "@/components/poker/dashboard-shared";
import { assertPayloadSize, clampSavedHand } from "@/lib/hands/limits";
import { saveHandAction } from "@/lib/hands/actions";
import { precomputeEquityByStep } from "@/components/poker/equity";
import { buildAndSaveStudHand } from "./save-hand";
import { buildStudHand } from "./stud-hand";

vi.mock("@/lib/hands/actions", () => ({ saveHandAction: vi.fn() }));
vi.mock("@/components/poker/equity", () => ({ precomputeEquityByStep: vi.fn() }));

const hands = [
  ["A♠", "A♥", "K♦", "7♦", "K♣", "J♥", "A♦"],
  ["K♠", "K♥", "2♣", "3♣", "4♦", "5♥", "6♠"],
  ["T♣", "9♥", "Q♣", "Q♦", "8♥", "8♠", "T♦"],
];
const details = { name: "  Stud night  ", date: "2026-10-23", venue: "  Home  ", notes: "  Rolled up  " };
const deck = [..."23456789TJQKA"].flatMap((rank) => [..."♣♦♥♠"].map((suit) => rank + suit));
function setup(args: Parameters<typeof initialStudState>[0] = {}, holdings = hands) {
  let state = initialStudState({ playerCount: 3, ...args });
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
function deal(state: StudState, holdings = hands, automatic = false) {
  for (let seat = pendingStudDealSeat(state); seat !== null; seat = pendingStudDealSeat(state)) {
    const known = state.street !== "seventh-street" || seat === state.heroSeat;
    const card = !known ? undefined : automatic ? deck.find((card) => !unavailableStudCards(state).has(card)) : holdings[seat][state.players[seat].cards.length];
    state = recordStudDeal(state, { seat, ...(card ? { card } : {}) });
  }
  return advance(state);
}
function complete(args: { state?: StudState; withBets?: boolean; holdings?: string[][]; shared?: string; automatic?: boolean } = {}) {
  const holdings = args.holdings ?? hands;
  let state = args.state ?? startStudHand(setup({}, holdings));
  for (let street = 0; street < 5; street++) {
    const current = betting(state)!;
    if (args.withBets && current.activeSeat !== null && current.canRaise) state = act(state, { seat: current.activeSeat, action: current.lastBet ? "raise" : "bet", amount: Math.min(current.minRaise, current.allInTarget) });
    state = advance(finishBetting(state));
    if (street < 4) state = street === 3 && args.shared ? advance(restoreLegacyStudSharedSeventh(state, args.shared)) : deal(state, holdings, args.automatic);
  }
  return state;
}
function resolved(state = complete({ withBets: true })) { return setStudMucked(setStudShownCards(state, 1, hands[1]), 2); }
function saved(state = resolved()): SavedHand {
  const hand = clampSavedHand({ ...buildStudHand({ state, ...details }), id: "stud1234" });
  assertPayloadSize(hand);
  return JSON.parse(JSON.stringify(hand));
}

describe("Stud save → load → replay", () => {
  it("persists native rules, timeline and dashboard metadata without inventing blinds or a board", () => {
    const state = resolved();
    const hand = saved(state);
    expect(hand).toMatchObject({
      name: "Stud night", date: "Oct 23, 26", stakes: "2/4 FL", loc: "Home", positions: "S1", multiway: true,
      board: ["—","—","—","—","—"], result: 32.5, notes: "Rolled up", type: "LP",
      _full: { schemaVersion: 2, game: { family: "stud", variant: "STUD_HIGH", bettingStructure: "FL" },
        studRules: { ante: .25, bringIn: 1, smallBet: 2, dealerSeat: 2, maxBets: 4, headsUpUncapped: false, fourthStreetBigBet: true },
        sb: 0, bb: 0, actions: [], board: [], heroPosition: 0, playerCount: 3, muckedSeats: [2], date: "2026-10-23" },
    });
    expect(potTypeOf(hand)).toBe("—");
    expect(gameTypeOf(hand)).toBe("STUD_HIGH");
    expect(GAME_LABEL[gameTypeOf(hand)]).toBe("Stud High");
    expect(holeCountOf(hand)).toBe(7);
    expect(multiwayOf(hand)).toBe(true);
    expect(hand._full!.players[0].cards).toEqual(hands[0]);
    expect(hand._full!.players[1].cards).toEqual(hands[1]);
    expect(hand._full!.players[2].cards).toBeNull();
    expect(hand._full!.timeline!.filter((event) => event.type === "deal" && event.seat !== 0 && event.visibility === "down").every((event) => !("card" in event))).toBe(true);
    const replay = studToReplay(hand)!;
    expect(recordedToHand(hand)).toEqual(replay);
    expect(replay.steps.at(-1)).toMatchObject({ pot: 48.75, winner: 0, committedAfter: studResult(state).committed, stud: { resolved: true, winnings: { 0: 48.75 } } });
    expect([...new Set(replay.steps.map((step) => step.street))]).toEqual(["third-street","fourth-street","fifth-street","sixth-street","seventh-street","showdown"]);
    expect(replay.steps.every((step) => step.board === undefined && step.draw === undefined && step.actionIndex === undefined)).toBe(true);
    expect(replay.players.map((player) => player.pos)).toEqual(["S1","S2","S3"]);
    expect(replay.players.every((player) => player.cards === null)).toBe(true);
    expect(replay.stakes).toEqual({ sb: 0, bb: 0 });
  });

  it("deals into seven fixed slots, preserves physical downcards, and keeps future streets empty", () => {
    const replay = studToReplay(saved())!;
    const ante = replay.steps[0];
    expect(ante.pot).toBe(.25);
    expect(ante.streetBetsAfter).toEqual({});
    expect(ante.stud.cards[0].every((slot) => !slot.present)).toBe(true);
    const first = replay.steps.find((step) => step.stud.eventId === "deal-third-street-seat-0-card-0")!;
    expect(first.stud.cards[0][0]).toEqual({ present: true, visibility: "down", faceUp: true, card: "A♠" });
    expect(first.stud.cards[0].slice(1).every((slot) => !slot.present && !slot.card)).toBe(true);
    const thirdEnd = replay.steps.find((step) => step.street === "third-street" && step.stud.kind === "round-end")!;
    expect(thirdEnd.stud.cards[1].slice(0, 3)).toEqual([
      { present: true, visibility: "down", faceUp: false }, { present: true, visibility: "down", faceUp: false },
      { present: true, visibility: "up", faceUp: true, card: "2♣" },
    ]);
    expect(thirdEnd.stud.cards[1].slice(3).every((slot) => !slot.present)).toBe(true);
    const fourth = replay.steps.find((step) => step.stud.eventId === "deal-fourth-street-seat-0-card-3")!;
    expect(fourth.stud.cards[0][3]).toEqual({ present: true, visibility: "up", faceUp: true, card: "7♦" });
    expect(fourth.streetBetsAfter).toEqual({});
    expect(fourth.stud.firstToAct).toBeNull(); // The street's deal is not finished yet.
    const fourthReady = replay.steps.find((step) => step.stud.eventId === "deal-fourth-street-seat-2-card-3")!;
    expect(fourthReady.stud).toMatchObject({ firstToAct: 2, nextToAct: 2, limitBet: 2 });
    const fifthReady = replay.steps.find((step) => step.stud.eventId === "deal-fifth-street-seat-2-card-4")!;
    expect(fifthReady.stud).toMatchObject({ firstToAct: 0, nextToAct: 0, limitBet: 4 });
  });

  it("preserves a nonzero hero seat and a different dealer's clockwise deal order", () => {
    let state = complete({ state: startStudHand(setup({ heroSeat: 1, dealerSeat: 0 })) });
    state = setStudMucked(setStudMucked(state, 0), 2);
    const hand = saved(state);
    expect(hand).toMatchObject({ positions: "S2", result: 2.5, _full: { heroPosition: 1, studRules: { dealerSeat: 0 } } });
    const replay = studToReplay(hand)!;
    expect(replay).toMatchObject({ heroPosition: 1, studRules: { dealerSeat: 0 } });
    const first = replay.steps.find((step) => step.stud.kind === "deal")!;
    expect(first.active).toBe(1);
    expect(first.stud.cards[1][0]).toMatchObject({ card: "K♠", visibility: "down", faceUp: true });
    expect(first.stud.cards[0][0].card).toBeUndefined();
    expect(replay.steps.at(-1)).toMatchObject({ winner: 1, pot: 3.75, stud: { winnings: { 1: 3.75 } } });
  });

  it("reveals opponent downcards only at their show event, including the river", () => {
    const replay = studToReplay(saved())!;
    const index = replay.steps.findIndex((step) => step.stud.kind === "show" && step.active === 1);
    for (const step of replay.steps.slice(0, index)) for (const slot of [0,1,6]) expect(step.stud.cards[1][slot].card).toBeUndefined();
    const river = replay.steps.find((step) => step.stud.eventId === "deal-seventh-street-seat-1-card-6")!;
    expect(river.stud.cards[1][6]).toEqual({ present: true, visibility: "down", faceUp: false });
    expect(replay.steps[index].stud.cards[1].map((slot) => slot.card)).toEqual(hands[1]);
    expect(replay.steps[index].stud.cards[1][6]).toMatchObject({ visibility: "down", faceUp: true, card: "6♠" });
    const muck = replay.steps.find((step) => step.stud.kind === "muck" && step.active === 2)!;
    expect(muck.stud.cards[2].every((slot) => !slot.present && !slot.card)).toBe(true);
    expect(river.stud.muckedSeats).toEqual([]);
    expect(replay.steps.at(-1)!.stud.muckedSeats).toEqual([2]);
  });

  it("ignores final player cards and accidental opponent downcard values in deal events", () => {
    const hand = saved();
    const expected = studToReplay(hand)!;
    hand._full!.players.forEach((player) => { player.cards = ["2♠"]; });
    for (const event of hand._full!.timeline!) if (event.type === "deal" && event.seat !== 0 && event.visibility === "down") event.card = "A♣";
    expect(studToReplay(hand)).toEqual(expected);
  });

  it("keeps card, shared-card and payout snapshots independent when scrubbing backwards", () => {
    const replay = studToReplay(saved())!;
    const earlier = structuredClone(replay.steps[5]);
    const final = replay.steps.at(-1)!;
    final.stud.cards[0][0].card = "2♠";
    final.stud.foldedSeats.push(0);
    final.stud.muckedSeats.push(1);
    final.committedAfter![0] = 999;
    expect(replay.steps[5]).toEqual(earlier);
  });

  it("saves fold wins without shows or later streets and refunds only the uncalled wager", () => {
    let state = startStudHand(setup());
    state = act(state, { seat: 2, action: "raise", amount: 2 });
    state = act(state, { seat: 0, action: "fold" });
    state = advance(act(state, { seat: 1, action: "fold" }));
    const hand = saved(state);
    const replay = studToReplay(hand)!;
    expect(hand).toMatchObject({ result: -.25, multiway: false });
    expect(multiwayOf({ ...hand, multiway: undefined })).toBe(false);
    expect(hand._full!.timeline!.every((event) => event.round === "third-street")).toBe(true);
    expect(replay.steps.find((step) => step.stud.kind === "round-end")).toMatchObject({ pot: 2.75, committedAfter: { 0: .25, 1: 1.25, 2: 1.25 }, stud: { refunds: { 2: 1 } } });
    expect(replay.steps.at(-1)).toMatchObject({ winner: 2, pot: 2.75, stud: { resolved: true, winnings: { 2: 2.75 } } });
    expect(replay.steps.at(-1)!.stud.cards[2].filter((slot) => slot.present)).toHaveLength(3);
  });

  it.each([false, true])("matches short bring-in accounting with heads-up=%s", (headsUp) => {
    let ready = setup({ playerCount: headsUp ? 2 : 3 });
    ready = updateStudPlayer(ready, 1, { stack: .5 });
    let state = complete({ state: startStudHand(ready) });
    state = setStudShownCards(state, 1, hands[1]);
    if (!headsUp) state = setStudMucked(state, 2);
    const replay = studToReplay(saved(state))!;
    const opening = replay.steps.find((step) => step.stud.eventId === "third-street-opening")!;
    expect(opening.pot).toBe(headsUp ? .75 : 1);
    const call = replay.steps.find((step) => step.action === "call")!;
    expect(call.label).toContain(headsUp ? "$0.25" : "$1");
    expect(replay.steps.at(-1)!.committedAfter).toEqual(studAccounting(state, true).committed);
    expect(replay.steps.at(-1)!.pot).toBe(headsUp ? 1 : 3);
  });

  it("replays direct full openings, five-bet caps and an ante-all-in bring-in transfer", () => {
    const rules = { maxBets: 5 as const, headsUpUncapped: true, fourthStreetBigBet: true };
    let ready = updateStudPlayer(setup({ limitRules: rules }), 1, { stack: .25 });
    ready = startStudHand(ready, { complete: true });
    let state = complete({ state: ready });
    state = setStudShownCards(state, 1, hands[1]);
    state = setStudMucked(state, 2);
    const hand = saved(state);
    expect(hand._full!.studRules).toMatchObject(rules);
    expect(studToReplay(hand)!.steps.find((step) => step.stud.eventId === "third-street-opening"))
      .toMatchObject({ active: 2, label: "S3 opens for $2", pot: 2.75, stud: { nextToAct: 0, limitBet: 2 } });
  });

  it("replays a fourth-street switch to big bets and returns to the fifth-street unit", () => {
    let state = deal(advance(finishBetting(startStudHand(setup()))));
    state = act(state, { seat: 2, action: "bet", amount: 2 });
    state = act(state, { seat: 0, action: "raise", amount: 6, bigBet: true });
    for (let street = 1; street < 5; street++) {
      state = advance(finishBetting(state));
      if (street < 4) state = deal(state);
    }
    state = resolved(state);
    const replay = studToReplay(saved(state))!;
    expect(replay.steps.find((step) => step.stud.eventId === "action-fourth-street-1"))
      .toMatchObject({ action: "raise 6", stud: { limitBet: 4, nextToAct: 1 } });
    expect(replay.steps.at(-1)!.committedAfter).toEqual(studResult(state).committed);
  });

  it("refunds a closed street before deriving later stacks in an all-in runout", () => {
    let ready = updateStudPlayer(updateStudPlayer(setup(), 0, { stack: 1.25 }), 1, { stack: 1.25 });
    ready = act(startStudHand(ready), { seat: 2, action: "raise", amount: 2 });
    let state = complete({ state: ready });
    state = resolved(state);
    const replay = studToReplay(saved(state))!;
    expect(replay.steps.find((step) => step.street === "third-street" && step.stud.kind === "round-end"))
      .toMatchObject({ pot: 3.75, committedAfter: { 0: 1.25, 1: 1.25, 2: 1.25 }, stud: { refunds: { 2: 1 } } });
    expect(replay.steps.filter((step) => step.action && step.street !== "third-street")).toHaveLength(0);
    expect(replay.steps.at(-1)!.pot).toBe(3.75);
  });

  it("resolves the main and side pot separately and matches the dashboard's net result", () => {
    const state = setStudShownCards(setStudShownCards(complete({ state: startStudHand(updateStudPlayer(setup(), 0, { stack: 2.25 })), withBets: true }), 1, hands[1]), 2, hands[2]);
    const hand = saved(state);
    const replay = studToReplay(hand)!;
    expect(replay.steps.at(-1)).toMatchObject({ pot: 34.75, stud: { awards: [
      { amount: 6.75, eligibleSeats: [0,1,2], winners: [0] }, { amount: 28, eligibleSeats: [1,2], winners: [1] },
    ], winnings: { 0: 6.75, 1: 28 } } });
    expect(hand.result).toBe(4.5);
    expect(committedThroughStep(replay.steps, replay.steps.length - 1, replay)).toEqual(studResult(state).committed);
    expect(computeStreetBets(replay.steps, replay.steps.length - 1, replay)).toEqual({});
    expect(() => saved(setStudMucked(setStudMucked(state, 1), 2))).toThrow("eligible winner");
  });

  it("handles a tied showdown without using suits to break the tie", () => {
    const tied = [["A♠","K♠","Q♠","J♠","T♥","2♣","3♣"], ["A♥","K♥","Q♥","J♥","T♣","4♣","5♣"]];
    const state = setStudShownCards(complete({ state: startStudHand(setup({ playerCount: 2 }, tied)), holdings: tied }), 1, tied[1]);
    const hand = saved(state);
    expect(hand.result).toBe(0);
    expect(studToReplay(hand)!.steps.at(-1)).toMatchObject({ pot: 2.5, stud: { resolved: true, winnings: { 0: 1.25, 1: 1.25 } } });
  });

  it("replays a legacy shared seventh outside six personal cards without leaking it into earlier frames", () => {
    let state = complete({ shared: "K♥" });
    state = setStudShownCards(state, 1, ["K♠","9♦",...hands[1].slice(2, 6)]);
    state = setStudMucked(state, 2);
    const hand = saved(state);
    const replay = studToReplay(hand)!;
    expect(hand._full!.players[0].cards).toHaveLength(6);
    expect(hand._full!.timeline!.filter((event) => event.type === "shared-deal")).toHaveLength(1);
    const sharedIndex = replay.steps.findIndex((step) => step.stud.kind === "shared-deal");
    expect(replay.steps.slice(0, sharedIndex).every((step) => !step.stud.sharedCard)).toBe(true);
    const shared = replay.steps[sharedIndex];
    expect(shared.stud).toMatchObject({ firstToAct: 0, nextToAct: 0, sharedCard: { present: true, visibility: "up", faceUp: true, card: "K♥" } });
    expect(shared.stud.cards[0][6].present).toBe(false);
    const original = structuredClone(shared.stud.sharedCard);
    replay.steps.at(-1)!.stud.sharedCard!.card = "2♠";
    expect(shared.stud.sharedCard).toEqual(original);
    expect(replay.steps.at(-1)!.pot).toBe(studResult(state).totalPot);
  });

  it.each([2, 3, 7, 8])("saves and replays a complete %i-seat checkdown with individual seventh cards", (playerCount) => {
    let state = startStudHand(setup({ playerCount }));
    for (let street = 0; street < 5; street++) {
      state = advance(finishBetting(state));
      if (street < 4) state = deal(state, hands, true);
    }
    for (let seat = 1; seat < playerCount; seat++) state = setStudMucked(state, seat);
    const hand = saved(state);
    const replay = studToReplay(hand)!;
    expect(replay.steps.at(-1)).toMatchObject({ pot: 1.25 * playerCount, stud: { resolved: true } });
    expect(hand.result).toBe(1.25 * (playerCount - 1));
    expect(replay.steps.filter((step) => step.stud.kind === "deal")).toHaveLength(playerCount * 7);
    expect(hand._full!.timeline!.some((event) => event.type === "shared-deal")).toBe(false);
    expect(hand._full!.players[0].cards).toHaveLength(7);
    const river = replay.steps.find((step) => step.stud.kind === "deal" && step.stud.cardIndex === 6 && step.active === 0)!;
    expect(river.stud.sharedCard).toBeUndefined();
    expect(replay.steps.every((step) => step.stud.cards[1].filter((slot) => slot.visibility === "down").every((slot) => !slot.faceUp && !slot.card))).toBe(true);
  });

  it("supports no antes and tables all-in for the ante before any bring-in", () => {
    const noAnte = resolved(complete({ state: startStudHand(setup({ ante: 0 })) }));
    expect(studToReplay(saved(noAnte))!.steps[0].stud.kind).toBe("deal");
    const anteOnly = resolved(complete({ state: startStudHand(setup({ ante: .25, stack: .25 })) }));
    const replay = studToReplay(saved(anteOnly))!;
    expect(replay.steps.at(-1)!.pot).toBe(.75);
    expect(replay.steps.some((step) => step.action)).toBe(false);
  });

  it("requires a finished, resolved hand and a real calendar date", () => {
    expect(() => buildStudHand({ state: startStudHand(setup()), ...details })).toThrow("Finish the hand");
    expect(() => buildStudHand({ state: complete(), ...details })).toThrow("show or muck");
    const state = resolved();
    for (const date of ["", "2026-02-30", "2026-13-01", "2026-2-01"]) expect(() => buildStudHand({ state, ...details, date })).toThrow("valid YYYY-MM-DD");
    expect(buildStudHand({ state, date: "2024-02-29", name: " ", venue: " ", notes: " " })).toMatchObject({ name: "Untitled hand", loc: "—", notes: undefined });
  });

  it("keeps unsupported Stud variants and incomplete metadata hidden", () => {
    const unsupported = saved();
    unsupported._full!.game = { family: "stud", variant: "STUD_HILO_8", bettingStructure: "FL" };
    expect(recordedToHand(unsupported)).toBeNull();
    const hand = saved();
    delete hand._full!.studRules;
    expect(recordedToHand(hand)).toBeNull();
  });

  it("rejects malformed antes, openings, deal order, street order and duplicate event ids", () => {
    const mutations: ((hand: SavedHand) => void)[] = [
      (hand) => { const event = hand._full!.timeline![0]; if (event.type === "forced-bet") event.amount = 9; },
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "forced-bet" && event.kind === "bring-in")!; if (event.type === "forced-bet") event.seat = 0; },
      (hand) => { const events = hand._full!.timeline!; [events[3], events[4]] = [events[4], events[3]]; },
      (hand) => { const event = hand._full!.timeline!.find((event) => event.round === "fourth-street")!; event.round = "sixth-street"; },
      (hand) => { hand._full!.timeline![1].id = hand._full!.timeline![0].id; },
      (hand) => { hand._full!.timeline![0].round = "preflop"; },
    ];
    for (const mutate of mutations) { const hand = saved(); mutate(hand); expect(() => studToReplay(hand)).toThrow(); }
  });

  it("rejects missing/contradictory cards, impossible betting and missing showdown decisions", () => {
    const mutations: ((hand: SavedHand) => void)[] = [
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "deal" && event.round === "fourth-street")!; if (event.type === "deal") event.card = "A♠"; },
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "deal" && event.round === "fourth-street")!; if (event.type === "deal") event.cardIndex = 6; },
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "action")!; if (event.type === "action") event.amount = 3; },
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "action")!; if (event.type === "action") event.seat = 1; },
      (hand) => { const event = hand._full!.timeline!.find((event) => event.type === "show" && event.seat === 1)!; if (event.type === "show") event.cards[2] = "3♦"; },
      (hand) => { hand._full!.timeline = hand._full!.timeline!.filter((event) => !(event.type === "show" && event.seat === 1)); },
      (hand) => { hand._full!.timeline = hand._full!.timeline!.filter((event) => event.round !== "seventh-street"); },
    ];
    for (const mutate of mutations) { const hand = saved(); mutate(hand); expect(() => studToReplay(hand)).toThrow(); }
  });

  it("uses existing text/payload limits and does not persist undo history", () => {
    const state = resolved();
    const hand = clampSavedHand({ ...buildStudHand({ state, ...details, notes: "n".repeat(5000), name: "h".repeat(120) }), id: "stud" });
    expect(hand.name).toHaveLength(100);
    expect(hand._full!.notes).toHaveLength(4000);
    expect("history" in hand._full!).toBe(false);
    assertPayloadSize(hand);
  });

  it("saves through the existing server action, skips community equity and preserves save failures", async () => {
    vi.mocked(saveHandAction).mockClear();
    vi.mocked(precomputeEquityByStep).mockClear();
    vi.mocked(saveHandAction).mockResolvedValueOnce({ ...saved(), id: "saved-stud" });
    expect(await buildAndSaveStudHand({ state: resolved(), ...details })).toEqual({ id: "saved-stud" });
    expect(saveHandAction).toHaveBeenCalledOnce();
    expect(vi.mocked(saveHandAction).mock.calls[0][0]._full!.game?.family).toBe("stud");
    expect(precomputeEquityByStep).not.toHaveBeenCalled();
    vi.mocked(saveHandAction).mockRejectedValueOnce(new Error("Connection lost"));
    await expect(buildAndSaveStudHand({ state: resolved(), ...details })).rejects.toThrow("Connection lost");
    expect(studResult(resolved()).resolved).toBe(true);
  });
});
