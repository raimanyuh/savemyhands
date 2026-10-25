import { describe, expect, it } from "vitest";
import {
  advanceStudPhase as advance, buildStudTimeline, deriveStudBetting as betting,
  initialStudState, pendingStudDealSeat, recordStudAction as act, recordStudDeal,
  restoreLegacyStudSharedSeventh, setStudMucked, setStudShownCards, setStudStartingCards,
  startStudHand, studBoardScore, studBringInSeat, studFirstToAct, studResult,
  undoStud, updateStudPlayer, type StudState,
} from "./stud-engine";
import { changeStudSetup } from "./stud-ui";

/** Allocate distinct real cards, cycling suits to avoid accidental flushes. */
function table(ranks: string[]): string[][] {
  const used = new Set<string>();
  return ranks.map((holding, seat) => [...holding].map((rank, index) => {
    const card = Array.from({ length: 4 }, (_, i) => rank + "♣♦♥♠"[(index + seat + i) % 4]).find((value) => !used.has(value));
    if (!card) throw new Error(`Fixture has too many ${rank}s`);
    used.add(card);
    return card;
  }));
}
const splitHands = table(["KKKQQJ9", "A234578", "AA6789T"]);
function setup(holdings = splitHands, args: Parameters<typeof initialStudState>[0] = {}) {
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
function deal(state: StudState, holdings = splitHands) {
  for (let seat = pendingStudDealSeat(state); seat !== null; seat = pendingStudDealSeat(state)) {
    const known = state.street !== "seventh-street" || seat === state.heroSeat;
    state = recordStudDeal(state, { seat, ...(known ? { card: holdings[seat][state.players[seat].cards.length] } : {}) });
  }
  return advance(state);
}
function complete(holdings = splitHands, state = startStudHand(setup(holdings)), withBets = false) {
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
function revealAll(state: StudState, holdings = splitHands) {
  for (const player of state.players) if (player.seat !== state.heroSeat) state = setStudShownCards(state, player.seat, holdings[player.seat]);
  return state;
}
function expectConserved(state: StudState) {
  const result = studResult(state);
  expect(result.resolved).toBe(true);
  expect(result.awards.reduce((total, award) => total + award.amount, 0)).toBeCloseTo(result.totalPot);
  expect(Object.values(result.winnings).reduce((a, b) => a + b, 0)).toBeCloseTo(result.totalPot);
  return result;
}

describe("Seven-Card Stud eight-or-better domain", () => {
  it("opts in explicitly and preserves its variant and low rules through setup edits and undo", () => {
    const state = setup();
    expect(state).toMatchObject({ variant: "STUD_HILO_8", limitRules: { fourthStreetBigBet: false } });
    const changed = changeStudSetup(state, { heroSeat: 1, smallBet: 4, limitRules: { ...state.limitRules, fourthStreetBigBet: true } });
    expect(changed).toMatchObject({ variant: "STUD_HILO_8", heroSeat: 1, smallBet: 4, limitRules: { fourthStreetBigBet: false } });
    expect(changed.players[1].cards).toEqual(state.players[0].cards);
    expect(undoStud(changed)).toEqual(state);
  });
  it("brings in the lowest door by rank and suit, with aces high", () => {
    let state = initialStudState({ variant: "STUD_HILO_8", playerCount: 4 });
    for (const [seat, cards] of [[0, ["K♣", "Q♦", "A♠"]], [1, [null, null, "2♥"]], [2, [null, null, "2♦"]], [3, [null, null, "2♣"]]] as const) {
      state = setStudStartingCards(state, seat, [...cards]);
    }
    expect(studBringInSeat(state)).toBe(3);
    expect(startStudHand(state).events.at(-1)).toMatchObject({ seat: 3, kind: "bring-in", amount: 1 });
    const passed = updateStudPlayer(state, 3, { stack: .25 });
    expect(studBringInSeat(passed)).toBe(0);
    expect(startStudHand(state, { complete: true }).events.at(-1)).toMatchObject({ seat: 3, kind: "completion", amount: 2 });
  });
  it("uses the highest exposed board, with aces high, rather than the best low draw", () => {
    const holdings = table(["23AA", "45KK", "67QJ"]);
    const state = deal(advance(finishBetting(startStudHand(setup(holdings)))), holdings);
    expect(studFirstToAct(state)).toBe(0);
    expect(betting(state)?.activeSeat).toBe(0);
    expect(studBoardScore(["A♣", "A♦"], "STUD_HILO_8")).toEqual([1, 14]);
  });
  it("breaks equal exposed boards by deal order without using suit", () => {
    const holdings = table(["23AK", "45AK", "67QJ"]);
    const state = deal(advance(finishBetting(startStudHand(setup(holdings, { dealerSeat: 0 })))), holdings);
    expect(studFirstToAct(state)).toBe(1);
    expect(betting(state)?.activeSeat).toBe(1);
  });
  it("passes action clockwise when the highest exposed hand is all-in", () => {
    const holdings = table(["23AA", "45KQ", "67JJ"]);
    let state = updateStudPlayer(setup(holdings), 0, { stack: 1.25 });
    state = deal(advance(finishBetting(startStudHand(state))), holdings);
    expect(studFirstToAct(state)).toBe(0);
    expect(betting(state)).toMatchObject({ activeSeat: 1, allIn: new Set([0]) });
  });
  it("forbids the fourth-street big-bet option even when supplied a High-only setting", () => {
    const holdings = table(["23AA", "45KK", "67QJ"]);
    let state = setup(holdings, { limitRules: { maxBets: 4, headsUpUncapped: false, fourthStreetBigBet: true } });
    expect(state.limitRules.fourthStreetBigBet).toBe(false);
    state = deal(advance(finishBetting(startStudHand(state))), holdings);
    state = { ...state, limitRules: { ...state.limitRules, fourthStreetBigBet: true } };
    expect(betting(state)).toMatchObject({ limitBet: 2, legalRaiseTargets: [2], bigBetTarget: undefined });
    expect(() => act(state, { seat: 0, action: "bet", amount: 4, bigBet: true })).toThrow("unavailable");
    expect(() => act(state, { seat: 0, action: "bet", amount: 4 })).toThrow("Fixed-limit");
  });
  it.each([4, 5] as const)("retains a %i-bet cap and switches to the big increment on fifth street", (maxBets) => {
    let state = startStudHand(setup(splitHands, { limitRules: { maxBets, headsUpUncapped: false, fourthStreetBigBet: false } }));
    for (let i = 0; i < maxBets; i++) {
      const current = betting(state)!;
      state = act(state, { seat: current.activeSeat!, action: "raise", amount: current.minRaise });
    }
    expect(betting(state)).toMatchObject({ raiseCapped: true, canRaise: false, betCount: maxBets });
    state = deal(advance(finishBetting(state)));
    expect(betting(state)?.limitBet).toBe(2);
    state = deal(advance(finishBetting(state)));
    expect(betting(state)).toMatchObject({ limitBet: 4, legalRaiseTargets: [4] });
  });
  it("retains the optional uncapped heads-up limit rule", () => {
    let state = startStudHand(setup(splitHands.slice(0, 2), { limitRules: { maxBets: 4, headsUpUncapped: true, fourthStreetBigBet: false } }));
    for (let i = 0; i < 6; i++) {
      const current = betting(state)!;
      state = act(state, { seat: current.activeSeat!, action: "raise", amount: current.minRaise });
    }
    expect(betting(state)).toMatchObject({ betCount: 6, canRaise: true, raiseCapped: false });
  });
  it.each([0, 2])("splits high and low with hero at seat %i, preserving all streets and private downcards", (heroSeat) => {
    const state = revealAll(complete(splitHands, startStudHand(setup(splitHands, { heroSeat }))));
    expect(expectConserved(state)).toMatchObject({ totalPot: 3.75, awards: [
      { amount: 1.875, portion: "high", winners: [0] }, { amount: 1.875, portion: "low", winners: [1] },
    ], winnings: { 0: 1.875, 1: 1.875 } });
    const events = buildStudTimeline(state);
    expect([...new Set(events.map((event) => event.round))]).toEqual(["third-street", "fourth-street", "fifth-street", "sixth-street", "seventh-street", "showdown"]);
    expect(events.filter((event) => event.type === "deal" && event.seat !== heroSeat && event.visibility === "down").every((event) => !("card" in event))).toBe(true);
    expect(studResult(JSON.parse(JSON.stringify(state)))).toEqual(studResult(state));
  });
  it("scoops with independently chosen high and low five-card hands", () => {
    const holdings = table(["A23456K", "7788QJT"]);
    expect(expectConserved(revealAll(complete(holdings), holdings))).toMatchObject({ totalPot: 2.5, winnings: { 0: 2.5 }, awards: [
      { portion: "high", winners: [0] }, { portion: "low", winners: [0] },
    ] });
  });
  it.each(["AA6789T", "A2349TJ"])("awards high the entire pot when %s cannot qualify for low", (ranks) => {
    const holdings = table(["KKKQQJ9", ranks]);
    expect(expectConserved(revealAll(complete(holdings), holdings))).toMatchObject({ totalPot: 2.5, winnings: { 0: 2.5 }, awards: [
      { amount: 2.5, portion: "high", winners: [0] },
    ] });
  });
  it("quarters tied low winners while paying the high winner half", () => {
    const holdings = table(["A2345KQ", "A2345JT", "KKKQQJ9"]);
    expect(expectConserved(revealAll(complete(holdings), holdings))).toMatchObject({ winnings: { 0: .9375, 1: .9375, 2: 1.875 }, awards: [
      { portion: "high", winners: [2] }, { portion: "low", winners: [0, 1] },
    ] });
  });
  it("awards three quarters to a high winner who also ties low", () => {
    const holdings = table(["A23456K", "A2345QJ"]);
    expect(expectConserved(revealAll(complete(holdings), holdings))).toMatchObject({ winnings: { 0: 1.875, 1: .625 } });
  });
  it("splits both halves independently when the same players tie high and low", () => {
    const holdings = table(["A23456K", "A23456K"]);
    expect(expectConserved(revealAll(complete(holdings), holdings))).toMatchObject({ winnings: { 0: 1.25, 1: 1.25 }, awards: [
      { amount: 1.25, portion: "high", winners: [0, 1] }, { amount: 1.25, portion: "low", winners: [0, 1] },
    ] });
  });
  it("checks low qualification separately for each side pot, excluding a short-stack's main-pot low", () => {
    const holdings = table(["A234578", "KKKQQJ9", "AA6789T"]);
    let state = setup(holdings);
    for (const [seat, stack] of [[0, 5.25], [1, 10.25], [2, 20.25]]) state = updateStudPlayer(state, seat, { stack });
    const result = expectConserved(revealAll(complete(holdings, startStudHand(state), true), holdings));
    expect(result).toMatchObject({ totalPot: 25.75, winnings: { 0: 7.875, 1: 17.875 }, awards: [
      { amount: 7.875, eligibleSeats: [0, 1, 2], portion: "high", winners: [1] },
      { amount: 7.875, eligibleSeats: [0, 1, 2], portion: "low", winners: [0] },
      { amount: 10, eligibleSeats: [1, 2], portion: "high", winners: [1] },
    ] });
  });
  it("uses different low ties for the main and side pots", () => {
    const holdings = table(["A23456K", "A2345QJ", "KKKQQJT"]);
    let state = setup(holdings);
    for (const [seat, stack] of [[0, 5.25], [1, 10.25], [2, 20.25]]) state = updateStudPlayer(state, seat, { stack });
    expect(expectConserved(revealAll(complete(holdings, startStudHand(state), true), holdings))).toMatchObject({
      totalPot: 25.75, winnings: { 0: 3.9375, 1: 8.9375, 2: 12.875 }, awards: [
        { amount: 7.875, portion: "high", winners: [2] }, { amount: 7.875, portion: "low", winners: [0, 1] },
        { amount: 5, portion: "high", winners: [2] }, { amount: 5, portion: "low", winners: [1] },
      ],
    });
  });
  it("requires every live show/muck choice and excludes mucked low hands", () => {
    const state = complete();
    expect(studResult(state)).toMatchObject({ resolved: false, winnings: {} });
    const partlyShown = setStudShownCards(state, 2, splitHands[2]);
    expect(studResult(partlyShown).resolved).toBe(false);
    const resolved = setStudMucked(partlyShown, 1);
    expect(expectConserved(resolved)).toMatchObject({ winnings: { 0: 3.75 }, awards: [{ portion: "high", winners: [0] }] });
    expect(undoStud(resolved)).toEqual(partlyShown);
    expect(studResult(setStudMucked(setStudMucked(resolved, 0), 2)).resolved).toBe(false);
  });
  it("merges folded contributions before dividing a pot with the same eligible players", () => {
    const holdings = table(["KKKQQJ9", "A234578", "AA6789T", "KQJT987"]);
    let state = startStudHand(setup(holdings, { heroSeat: 3 }));
    const first = betting(state)!;
    state = act(state, { seat: first.activeSeat!, action: "raise", amount: first.minRaise });
    // S4's folded ante remains dead money in the same contested pot.
    for (let i = 0; i < 4 && betting(state)?.activeSeat !== null; i++) {
      const current = betting(state)!;
      state = act(state, { seat: current.activeSeat!, action: current.activeSeat === 3 ? "fold" : "call" });
    }
    state = complete(holdings, state);
    for (const seat of [0, 1, 2]) state = setStudShownCards(state, seat, holdings[seat]);
    const result = expectConserved(state);
    expect(result.awards).toEqual([
      { amount: 3.5, eligibleSeats: [0, 1, 2], winners: [0], portion: "high" },
      { amount: 3.5, eligibleSeats: [0, 1, 2], winners: [1], portion: "low" },
    ]);
    expect(result.committed[3]).toBe(.25);
  });
  it("refunds an uncalled completion and awards an uncontested pot without requiring a low or seven cards", () => {
    let state = startStudHand(setup());
    const winner = betting(state)!.activeSeat!;
    state = act(state, { seat: winner, action: "raise", amount: 2 });
    while (betting(state)?.activeSeat !== null) state = act(state, { seat: betting(state)!.activeSeat!, action: "fold" });
    state = advance(state);
    expect(expectConserved(state)).toMatchObject({ totalPot: 2.75, winnings: { [winner]: 2.75 } });
    expect(studResult(state).awards.every((award) => award.portion === undefined)).toBe(true);
    expect(state.players.every((player) => player.cards.length === 3)).toBe(true);
  });
  it.each([2, 3, 8])("runs out %i all-in seats with individual seventh cards and anonymous opponent downcards", (count) => {
    const deck = [..."23456789TJQKA"].flatMap((rank) => [..."♣♦♥♠"].map((suit) => rank + suit));
    const heroSeat = count - 1;
    const holdings = Array.from({ length: count }, (_, seat) => [...deck.slice(seat * 6, seat * 6 + 6), ...(seat === heroSeat ? ["A♣"] : [])]);
    let state = complete(holdings, startStudHand(setup(holdings, { heroSeat, dealerSeat: 0, stack: 1.25 })));
    for (const player of state.players) if (player.seat !== heroSeat) state = setStudMucked(state, player.seat);
    expect(expectConserved(state)).toMatchObject({ totalPot: count * 1.25, winnings: { [heroSeat]: count * 1.25 } });
    expect(state.players.every((player) => player.cards.length === 7)).toBe(true);
    expect(state.players.filter((player) => player.seat !== heroSeat).every((player) => !player.cards[6].card)).toBe(true);
    expect(buildStudTimeline(state).some((event) => event.type === "shared-deal")).toBe(false);
  });
  it("rejects shared rivers", () => {
    let state = startStudHand(setup());
    for (let street = 0; street < 3; street++) state = deal(advance(finishBetting(state)));
    state = advance(finishBetting(state));
    expect(() => restoreLegacyStudSharedSeventh(state, "2♠")).toThrow("individual seventh");
  });
});
