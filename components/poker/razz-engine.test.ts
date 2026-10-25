import { describe, expect, it } from "vitest";
import {
  advanceStudPhase as advance, buildStudTimeline, deriveStudBetting as betting,
  initialStudState, pendingStudDealSeat, recordStudAction as act, recordStudDeal,
  restoreLegacyStudSharedSeventh, setStudMucked, setStudShownCards, setStudStartingCards,
  startStudHand, studBoardScore, studBringInSeat, studFirstToAct, studResult,
  undoStud, updateStudPlayer, type StudState,
} from "./stud-engine";
import { changeStudSetup } from "./stud-ui";

const hands = [
  ["A♣", "2♦", "K♠", "3♣", "4♦", "5♥", "6♠"],
  ["A♦", "2♥", "Q♠", "3♦", "4♥", "6♣", "7♠"],
  ["A♥", "2♠", "J♣", "3♥", "5♦", "7♣", "8♠"],
];
function setup(args: Parameters<typeof initialStudState>[0] = {}, holdings = hands) {
  let state = initialStudState({ variant: "RAZZ", playerCount: holdings.length, ...args });
  for (let seat = 0; seat < state.playerCount; seat++) state = setStudStartingCards(state, seat,
    seat === state.heroSeat ? holdings[seat].slice(0, 3) : [null, null, holdings[seat][2]]);
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
function deal(state: StudState, holdings = hands) {
  for (let seat = pendingStudDealSeat(state); seat !== null; seat = pendingStudDealSeat(state)) {
    const known = state.street !== "seventh-street" || seat === state.heroSeat;
    state = recordStudDeal(state, { seat, ...(known ? { card: holdings[seat][state.players[seat].cards.length] } : {}) });
  }
  return advance(state);
}
function complete(args: { state?: StudState; holdings?: string[][]; withBets?: boolean } = {}) {
  const holdings = args.holdings ?? hands;
  let state = args.state ?? startStudHand(setup({}, holdings));
  for (let street = 0; street < 5; street++) {
    const current = betting(state)!;
    if (args.withBets && current.canRaise) state = act(state, { seat: current.activeSeat!, action: current.lastBet ? "raise" : "bet", amount: Math.min(current.minRaise, current.allInTarget) });
    state = advance(finishBetting(state));
    if (street < 4) state = deal(state, holdings);
  }
  return state;
}
function revealAll(state: StudState, holdings = hands) {
  for (const player of state.players) if (player.seat !== state.heroSeat) state = setStudShownCards(state, player.seat, holdings[player.seat]);
  return state;
}

describe("Razz domain", () => {
  it("opts in explicitly, preserves the variant through setup/undo, and rejects unsupported variants", () => {
    expect(initialStudState().variant).toBe("STUD_HIGH");
    expect(() => initialStudState({ variant: "UNKNOWN_STUD" as never })).toThrow("Unsupported");
    const state = setup();
    const changed = changeStudSetup(state, { heroSeat: 1, ante: .5 });
    expect(changed).toMatchObject({ variant: "RAZZ", ante: .5, heroSeat: 1, limitRules: { fourthStreetBigBet: false } });
    expect(changed.players[1].cards).toEqual(state.players[0].cards);
    expect(undoStud(changed)).toEqual(state);
  });
  it("uses the highest door card by rank then suit, with aces always low", () => {
    let state = initialStudState({ variant: "RAZZ", playerCount: 4 });
    for (const [seat, holding] of [[0, ["2♥", "3♦", "A♠"]], [1, [null, null, "K♣"]], [2, [null, null, "K♥"]], [3, [null, null, "K♠"]]] as const) {
      state = setStudStartingCards(state, seat, [...holding]);
    }
    expect(studBringInSeat(state)).toBe(3);
    state = setStudStartingCards(state, 3, [null, null, "Q♠"]);
    expect(studBringInSeat(state)).toBe(2);
    expect(betting(startStudHand(state))).toMatchObject({ activeSeat: 3, toCall: 1, minRaise: 2, betCount: 0 });
  });
  it("passes an ante-all-in's bring-in clockwise regardless of the next door card", () => {
    const state = updateStudPlayer(setup(), 0, { stack: .25 });
    expect(studBringInSeat(state)).toBe(1);
    const started = startStudHand(state);
    expect(started.events.at(-1)).toMatchObject({ seat: 1, kind: "bring-in", amount: 1 });
    expect(betting(started)?.activeSeat).toBe(2);
    expect(betting(finishBetting(started))?.roundClosed).toBe(true);
  });
  it("completes the bring-in without consuming a raise and refunds an uncalled completion", () => {
    let state = startStudHand(setup());
    state = act(state, { seat: 1, action: "raise", amount: 2 });
    expect(betting(state)).toMatchObject({ activeSeat: 2, betCount: 1, minRaise: 4 });
    state = act(state, { seat: 2, action: "fold" });
    state = act(state, { seat: 0, action: "fold" });
    state = advance(state);
    expect(studResult(state)).toMatchObject({ resolved: true, totalPot: 2.75, committed: { 0: 1.25, 1: 1.25, 2: .25 }, winnings: { 1: 2.75 } });
    expect(undoStud(state).phase).toBe("betting");
    expect(startStudHand(setup(), { complete: true }).events.at(-1)).toMatchObject({ seat: 0, kind: "completion", amount: 2 });
  });
  it("uses the lowest exposed hand after third street, ignoring private aces and high-hand strength", () => {
    const holdings = [["A♠", "2♦", "3♣", "3♦"], ["K♦", "Q♥", "A♣", "2♣"], ["J♥", "T♠", "A♦", "A♥"]];
    const state = deal(advance(finishBetting(startStudHand(setup({}, holdings)))), holdings);
    expect(studFirstToAct(state)).toBe(1);
    expect(betting(state)?.activeSeat).toBe(1);
    expect(studBoardScore(["A♦", "A♥"], "RAZZ")).toEqual([1, 1]);
    expect(studBoardScore(["2♦", "2♥"], "RAZZ")).toEqual([1, 2]);
    expect(studBoardScore(["A♦", "A♥"])[1]).toBe(14);
  });
  it("breaks equal low boards by deal order, with no suit tiebreak", () => {
    const holdings = [["K♠", "Q♦", "A♠", "2♠"], ["J♦", "T♥", "A♥", "2♥"], ["9♠", "8♦", "3♣", "4♣"]];
    const state = deal(advance(finishBetting(startStudHand(setup({ dealerSeat: 0 }, holdings)))), holdings);
    expect(studFirstToAct(state)).toBe(1);
  });
  it("acts with a pair of aces before higher pairs when every exposed board is paired", () => {
    const holdings = [["2♠", "3♦", "A♣", "A♦"], ["A♥", "4♦", "2♣", "2♦"], ["Q♣", "T♥", "K♣", "K♦"]];
    const state = deal(advance(finishBetting(startStudHand(setup({}, holdings)))), holdings);
    expect(studFirstToAct(state)).toBe(0);
  });
  it("forbids fourth-street big bets with an open pair even if a house-rule flag is supplied", () => {
    const holdings = [["A♠", "2♦", "3♣", "3♦"], ["K♦", "Q♥", "A♣", "2♣"], ["J♥", "T♠", "A♦", "A♥"]];
    let state = setup({ limitRules: { maxBets: 4, headsUpUncapped: false, fourthStreetBigBet: true } }, holdings);
    expect(state.limitRules.fourthStreetBigBet).toBe(false);
    state = deal(advance(finishBetting(startStudHand(state))), holdings);
    state = { ...state, limitRules: { ...state.limitRules, fourthStreetBigBet: true } };
    expect(betting(state)).toMatchObject({ limitBet: 2, bigBetTarget: undefined, legalRaiseTargets: [2] });
    expect(() => act(state, { seat: 1, action: "bet", amount: 4, bigBet: true })).toThrow("unavailable");
    expect(() => act(state, { seat: 1, action: "bet", amount: 4 })).toThrow("Fixed-limit");
  });
  it("retains fixed-limit caps and changes from small to big bets on fifth street", () => {
    let state = startStudHand(setup());
    for (let i = 0; i < 4; i++) {
      const current = betting(state)!;
      state = act(state, { seat: current.activeSeat!, action: "raise", amount: current.minRaise });
    }
    expect(betting(state)).toMatchObject({ raiseCapped: true, canRaise: false, betCount: 4 });
    state = deal(advance(finishBetting(state)));
    expect(betting(state)?.limitBet).toBe(2);
    state = deal(advance(finishBetting(state)));
    expect(betting(state)).toMatchObject({ limitBet: 4, legalRaiseTargets: [4] });
  });
  it.each([0, 2])("plays all five rounds with hero at seat %i, resolves the best low, and keeps historical downcards anonymous", (heroSeat) => {
    const state = revealAll(complete({ state: startStudHand(setup({ heroSeat })) }));
    expect(studResult(state)).toMatchObject({ resolved: true, totalPot: 3.75, winnings: { 0: 3.75 } });
    const events = buildStudTimeline(state);
    expect([...new Set(events.map((event) => event.round))]).toEqual(["third-street", "fourth-street", "fifth-street", "sixth-street", "seventh-street", "showdown"]);
    expect(events.filter((event) => event.type === "deal" && event.seat !== heroSeat && event.visibility === "down").every((event) => !("card" in event))).toBe(true);
    expect(events.filter((event) => event.type === "show")).toHaveLength(3);
    expect(studResult(JSON.parse(JSON.stringify(state)))).toEqual(studResult(state));
  });
  it("awards the entire pot to a nine-low without an eight-or-better qualifier", () => {
    const holdings = [["A♣", "2♦", "K♠", "3♣", "4♦", "9♥", "T♠"], ["A♦", "2♥", "Q♠", "3♦", "5♥", "T♣", "J♠"]];
    const state = revealAll(complete({ holdings }), holdings);
    expect(studResult(state)).toMatchObject({ resolved: true, totalPot: 2.5, winnings: { 0: 2.5 } });
  });
  it("uses low-hand eligibility per side pot and requires show/muck decisions", () => {
    let state = setup();
    for (const [seat, stack] of [[0, 5.25], [1, 10.25], [2, 20.25]]) state = updateStudPlayer(state, seat, { stack });
    state = complete({ state: startStudHand(state), withBets: true });
    expect(studResult(state).resolved).toBe(false);
    const shown = revealAll(state);
    expect(studResult(shown)).toMatchObject({ resolved: true, totalPot: 25.75, awards: [{ amount: 15.75, winners: [0] }, { amount: 10, winners: [1] }], winnings: { 0: 15.75, 1: 10 } });
    expect(studResult(setStudMucked(setStudMucked(state, 1), 2)).resolved).toBe(false);
    expect(undoStud(setStudShownCards(state, 1, hands[1]))).toEqual(state);
  });
  it("retains a legacy shared river's exposed low order and best-five ties", () => {
    const holdings = [["A♠", "7♦", "2♣", "3♦", "4♥", "5♠"], ["A♥", "8♣", "3♣", "4♦", "5♥", "6♠"]];
    let state = startStudHand(setup({}, holdings));
    for (let street = 0; street < 3; street++) state = deal(advance(finishBetting(state)), holdings);
    expect(state.street).toBe("sixth-street");
    expect(studFirstToAct(state)).toBe(0);
    state = advance(finishBetting(state));
    state = advance(restoreLegacyStudSharedSeventh(state, "2♦"));
    expect(studFirstToAct(state)).toBe(1);
    state = revealAll(advance(finishBetting(state)), holdings);
    expect(studResult(state)).toMatchObject({ resolved: true, totalPot: 2.5, winnings: { 0: 1.25, 1: 1.25 } });
    expect(state.players.every((player) => player.cards.length === 6)).toBe(true);
    expect(buildStudTimeline(state).filter((event) => event.type === "shared-deal")).toHaveLength(1);
  });
  it("runs out an eight-player all-in with individual anonymous opponent rivers", () => {
    const deck = [..."23456789TJQKA"].flatMap((rank) => [..."♣♦♥♠"].map((suit) => rank + suit));
    const holdings = Array.from({ length: 8 }, (_, seat) => deck.slice(seat * 6, seat * 6 + 6));
    let state = startStudHand(setup({ stack: 1.25 }, holdings));
    for (let street = 0; street < 3; street++) state = deal(advance(finishBetting(state)), holdings);
    state = advance(finishBetting(state));
    state = recordStudDeal(state, { seat: 0, card: "A♣" });
    for (let seat = pendingStudDealSeat(state); seat !== null; seat = pendingStudDealSeat(state)) state = recordStudDeal(state, { seat });
    state = advance(state);
    expect(betting(state)?.activeSeat).toBeNull();
    state = advance(state);
    for (let seat = 1; seat < 8; seat++) state = setStudMucked(state, seat);
    const result = studResult(state);
    expect(result.resolved).toBe(true);
    expect(result.totalPot).toBe(10);
    expect(Object.values(result.winnings).reduce((a, b) => a + b, 0)).toBeCloseTo(10);
    expect(buildStudTimeline(state).filter((event) => event.type === "deal")).toHaveLength(56);
    expect(state.players.every((player) => player.cards.length === 7)).toBe(true);
    expect(state.players.slice(1).every((player) => !player.cards[6].card)).toBe(true);
    expect(state.events.some((event) => event.type === "shared-deal")).toBe(false);
  });
});
