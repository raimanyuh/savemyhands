import { describe, expect, it } from "vitest";
import {
  advanceStudPhase as advance, buildStudTimeline, deriveStudBetting as betting,
  initialStudState, pendingStudDealSeat, recordStudAction as act, recordStudDeal,
  restoreLegacyStudSharedSeventh, setStudMucked, setStudShownCards, setStudStartingCards,
  startStudHand, studAccounting, studBoardScore, studBringInSeat, studFirstToAct,
  studResult, undoStud, unavailableStudCards, updateStudPlayer,
  type StudState,
} from "./stud-engine";

const holdings = [
  ["A♠", "A♥", "K♦", "7♦", "K♣", "J♥", "A♦"],
  ["K♠", "K♥", "2♣", "3♣", "4♦", "5♥", "6♠"],
  ["T♣", "9♥", "Q♣", "Q♦", "8♥", "8♠", "T♦"],
];
const deck = [..."23456789TJQKA"].flatMap((rank) => [..."♣♦♥♠"].map((suit) => rank + suit));
function setup(args: Parameters<typeof initialStudState>[0] = {}) {
  let state = initialStudState({ playerCount: 3, ...args });
  for (let seat = 0; seat < state.playerCount; seat++) state = setStudStartingCards(state, seat,
    seat === state.heroSeat ? holdings[0].slice(0, 3) : [null, null, holdings[seat]?.[2] ?? `${seat + 2}♣`]);
  return state;
}
function start(args: Parameters<typeof initialStudState>[0] = {}) { return startStudHand(setup(args)); }
function finishBetting(state: StudState) {
  for (let i = 0; i < 100; i++) {
    const next = betting(state);
    if (!next || next.activeSeat === null) return state;
    state = act(state, { seat: next.activeSeat, action: next.canCheck ? "check" : "call" });
  }
  throw new Error("Betting did not close");
}
function deal(state: StudState, exact = true) {
  for (let seat = pendingStudDealSeat(state); seat !== null; seat = pendingStudDealSeat(state)) {
    const index = state.players[seat].cards.length;
    const needsKnown = state.street !== "seventh-street" || seat === state.heroSeat;
    const card = needsKnown ? exact && holdings[seat]?.[index] || deck.find((card) => !unavailableStudCards(state).has(card)) : undefined;
    state = recordStudDeal(state, { seat, ...(card ? { card } : {}) });
  }
  return advance(state);
}
function fourth(state = start()) { return deal(advance(finishBetting(state))); }
function complete(withBets = false) {
  let state = start();
  for (let i = 0; i < 5; i++) {
    if (withBets) {
      const next = betting(state)!;
      state = act(state, { seat: next.activeSeat!, action: next.lastBet ? "raise" : "bet", amount: next.minRaise });
    }
    state = advance(finishBetting(state));
    if (i < 4) state = deal(state);
  }
  return state;
}

describe("Seven-Card Stud High engine", () => {
  it("validates stakes, seats, card ids and setup without mutating earlier states", () => {
    for (const args of [{ ante: -1 }, { stack: NaN }, { bringIn: 3 }, { playerCount: 3.5 }, { heroSeat: -1 }, { smallBet: Infinity }]) {
      expect(() => initialStudState(args)).toThrow();
    }
    const empty = initialStudState({ playerCount: 3 });
    expect(() => startStudHand(empty)).toThrow("hero");
    expect(() => setStudStartingCards(empty, 0, ["As", "K♥", "Q♣"])).toThrow("Invalid card");
    expect(() => setStudStartingCards(empty, 1, ["A♠", null, "2♣"])).toThrow("downcards");
    const chosen = setStudStartingCards(empty, 0, holdings[0].slice(0, 3));
    expect(empty.players[0].cards[0].card).toBeUndefined();
    expect(() => setStudStartingCards(chosen, 1, [null, null, "A♠"])).toThrow("already in use");
    expect(() => updateStudPlayer(chosen, 1, { stack: Infinity })).toThrow("positive");
    expect(() => startStudHand(chosen)).toThrow("door card");
    const playing = start();
    expect(() => updateStudPlayer(playing, 1, { name: "Later" })).toThrow("locked");
    expect(() => setStudStartingCards(playing, 0, holdings[0].slice(0, 3))).toThrow("locked");
  });

  it("posts dead antes, deals in three clockwise passes, and omits opponent downcard identities", () => {
    const state = start();
    const events = buildStudTimeline(state);
    expect(events.slice(0, 3)).toEqual([0, 1, 2].map((seat) => ({ id: `ante-seat-${seat}`, round: "third-street", type: "forced-bet", kind: "ante", seat, amount: .25 })));
    const deals = events.filter((event) => event.type === "deal");
    expect(deals.map((event) => [event.seat, event.cardIndex, event.visibility])).toEqual([
      [0,0,"down"], [1,0,"down"], [2,0,"down"], [0,1,"down"], [1,1,"down"], [2,1,"down"],
      [0,2,"up"], [1,2,"up"], [2,2,"up"],
    ]);
    expect(deals.filter((event) => event.seat !== 0 && event.visibility === "down").every((event) => event.card === undefined)).toBe(true);
    expect(events.at(-1)).toMatchObject({ seat: 1, type: "forced-bet", kind: "bring-in", amount: 1 });
    expect(studAccounting(state)).toMatchObject({ totalPot: 1.75, committed: { 0: .25, 1: 1.25, 2: .25 } });
    expect(betting(state)).toMatchObject({ activeSeat: 2, toCall: 1, canComplete: true, minRaise: 2, betCount: 0 });
    const copy = buildStudTimeline(state);
    copy[0].id = "modified";
    expect(state.events[0].id).toBe("ante-seat-0");
  });

  it("uses rank then clubs/diamonds/hearts/spades for the bring-in, with aces high", () => {
    let state = initialStudState({ playerCount: 4 });
    for (const [seat, cards] of [[0,["K♠","Q♥","A♣"]], [1,[null,null,"2♠"]], [2,[null,null,"2♦"]], [3,[null,null,"2♣"]]] as const) {
      state = setStudStartingCards(state, seat, [...cards]);
    }
    expect(studBringInSeat(state)).toBe(3);
    state = setStudStartingCards(state, 3, [null,null,"J♣"]);
    expect(studBringInSeat(state)).toBe(2);
    expect(betting(startStudHand(state))?.activeSeat).toBe(3);
  });

  it("moves an ante-all-in's bring-in clockwise and caps a partial bring-in", () => {
    let state = updateStudPlayer(setup(), 1, { stack: .25 });
    expect(studBringInSeat(state)).toBe(2);
    state = startStudHand(state);
    expect(state.events.at(-1)).toMatchObject({ seat: 2, amount: 1 });
    expect(betting(state)).toMatchObject({ activeSeat: 0, allIn: new Set([1]) });
    const short = startStudHand(updateStudPlayer(setup(), 1, { stack: .75 }));
    expect(short.events.at(-1)).toMatchObject({ seat: 1, amount: .5 });
    expect(betting(short)).toMatchObject({ lastBet: 1, toCall: 1, allIn: new Set([1]) });
    expect(studAccounting(finishBetting(short)).committed).toEqual({ 0: 1.25, 1: .75, 2: 1.25 });
  });

  it("closes calls around the bring-in without giving it a blind-style option", () => {
    let state = start();
    state = act(state, { seat: 2, action: "call" });
    state = act(state, { seat: 0, action: "call" });
    expect(betting(state)).toMatchObject({ activeSeat: null, roundClosed: true });
    expect(() => act(state, { seat: 1, action: "raise", amount: 2 })).toThrow("none");
  });

  it("completes to the small bet, counts completion as the opening bet, and leaves all raises", () => {
    let state = act(start(), { seat: 2, action: "raise", amount: 2 });
    expect(betting(state)).toMatchObject({ betCount: 1, minRaise: 4, canComplete: false });
    for (const [seat, amount] of [[0,4], [1,6], [2,8]]) state = act(state, { seat, action: "raise", amount });
    expect(betting(state)).toMatchObject({ betCount: 4, raiseCapped: true, canRaise: false });
    expect(() => act(state, { seat: 0, action: "raise", amount: 10 })).toThrow("capped");
    let five = start({ limitRules: { maxBets: 5, headsUpUncapped: false, fourthStreetBigBet: true } });
    for (const [seat, amount] of [[2,2], [0,4], [1,6], [2,8], [0,10]]) five = act(five, { seat, action: "raise", amount });
    expect(betting(five)).toMatchObject({ betCount: 5, raiseCapped: true });
  });

  it("allows the bring-in player to open with a full bet and undo that decision", () => {
    const ready = setup();
    const state = startStudHand(ready, { complete: true });
    expect(state.events.at(-1)).toMatchObject({ kind: "completion", amount: 2, seat: 1 });
    expect(betting(state)).toMatchObject({ activeSeat: 2, toCall: 2, minRaise: 4, betCount: 1 });
    expect(undoStud(state)).toEqual(ready);
    const short = startStudHand(updateStudPlayer(ready, 1, { stack: .75 }), { complete: true });
    expect(betting(short)).toMatchObject({ minRaise: 2, betCount: 0 });
  });

  it("rejects out-of-turn, premature deals and incorrect betting actions", () => {
    const state = start();
    expect(() => advance(state)).toThrow("Finish betting");
    expect(() => recordStudDeal(state, { seat: 0, card: "7♦" })).toThrow("next live seat");
    expect(() => act(state, { seat: 0, action: "call" })).toThrow("Seat 2");
    expect(() => act(state, { seat: 2, action: "check" })).toThrow("Cannot check");
    expect(() => act(state, { seat: 2, action: "bet", amount: 2 })).toThrow("Use raise");
    expect(() => act(state, { seat: 2, action: "raise", amount: 3 })).toThrow("Fixed-limit");
    const later = fourth();
    expect(() => act(later, { seat: 2, action: "call" })).toThrow("Nothing to call");
    expect(() => act(later, { seat: 2, action: "raise", amount: 2 })).toThrow("Use bet");
  });

  it("changes the first actor with exposed hands, ignores hidden pairs, and doubles on fifth", () => {
    let state = fourth();
    expect(studFirstToAct(state)).toBe(2); // QQ beats hero's K7 despite private AA.
    expect(betting(state)).toMatchObject({ activeSeat: 2, limitBet: 2 });
    state = deal(advance(finishBetting(state)));
    expect(studFirstToAct(state)).toBe(0); // KK beats Q Q 8.
    expect(betting(state)).toMatchObject({ activeSeat: 0, limitBet: 4, minRaise: 4 });
    state = deal(advance(finishBetting(state)));
    expect(studFirstToAct(state)).toBe(2); // QQ88 beats KK.
    expect(betting(state)).toMatchObject({ activeSeat: 2, limitBet: 4 });
    expect(studBoardScore(["2♠","2♥","2♦"])[0]).toBeGreaterThan(studBoardScore(["K♠","K♥","A♦"])[0]);
    expect(studBoardScore(["T♣","J♣","Q♣","K♣","A♣"])[0]).toBe(0);
  });

  it("breaks equal exposed boards by deal order rather than suit", () => {
    let state = initialStudState({ playerCount: 3, dealerSeat: 1 });
    state = setStudStartingCards(state, 0, ["2♠","3♥","Q♥"]);
    state = setStudStartingCards(state, 1, [null,null,"K♠"]);
    state = setStudStartingCards(state, 2, [null,null,"K♣"]);
    state = advance(finishBetting(startStudHand(state)));
    state = recordStudDeal(state, { seat: 2, card: "A♣" });
    state = recordStudDeal(state, { seat: 0, card: "4♦" });
    state = recordStudDeal(state, { seat: 1, card: "A♠" });
    expect(studFirstToAct(advance(state))).toBe(2);
  });

  it("allows either fourth-street size with an open pair and locks subsequent big raises", () => {
    let state = fourth();
    expect(betting(state)).toMatchObject({ minRaise: 2, bigBetTarget: 4, legalRaiseTargets: [2,4] });
    state = act(state, { seat: 2, action: "bet", amount: 2 });
    expect(betting(state)).toMatchObject({ minRaise: 4, bigBetTarget: 6 });
    state = act(state, { seat: 0, action: "raise", amount: 6, bigBet: true });
    expect(betting(state)).toMatchObject({ minRaise: 10, limitBet: 4, bigBetTarget: undefined, betCount: 2 });
    expect(() => act(state, { seat: 1, action: "raise", amount: 8 })).toThrow("Fixed-limit");
    const openingBig = act(fourth(), { seat: 2, action: "bet", amount: 4, bigBet: true });
    expect(betting(openingBig)?.minRaise).toBe(8);
    const disabled = fourth(start({ limitRules: { maxBets: 4, headsUpUncapped: false, fourthStreetBigBet: false } }));
    expect(betting(disabled)?.legalRaiseTargets).toEqual([2]);
    expect(() => act(disabled, { seat: 2, action: "bet", amount: 4, bigBet: true })).toThrow("unavailable");
  });

  it("supports heads-up uncapped rounds without uncapping after a multiway fold", () => {
    const limitRules = { maxBets: 4 as const, headsUpUncapped: true, fourthStreetBigBet: true };
    let headsUp = start({ playerCount: 2, limitRules });
    for (const [seat, amount] of [[0,2], [1,4], [0,6], [1,8], [0,10]]) headsUp = act(headsUp, { seat, action: "raise", amount });
    expect(betting(headsUp)).toMatchObject({ raiseCapped: false, minRaise: 12 });
    let multi = act(start({ limitRules }), { seat: 2, action: "raise", amount: 2 });
    multi = act(multi, { seat: 0, action: "fold" });
    for (const [seat, amount] of [[1,4], [2,6], [1,8]]) multi = act(multi, { seat, action: "raise", amount });
    expect(betting(multi)).toMatchObject({ raiseCapped: true });
  });

  it("excludes ante-all-ins when deciding whether betting starts heads-up", () => {
    const limitRules = { maxBets: 4 as const, headsUpUncapped: true, fourthStreetBigBet: true };
    let state = startStudHand(updateStudPlayer(setup({ limitRules }), 1, { stack: .25 }));
    for (const [seat, amount] of [[0,2], [2,4], [0,6], [2,8], [0,10]]) state = act(state, { seat, action: "raise", amount });
    expect(betting(state)).toMatchObject({ raiseCapped: false, minRaise: 12 });
  });

  it("reopens an initial bring-in when another player completes even by less than half a bet", () => {
    let state = act(start({ bringIn: 1.75 }), { seat: 2, action: "raise", amount: 2 });
    state = act(state, { seat: 0, action: "call" });
    expect(betting(state)).toMatchObject({ activeSeat: 1, canRaise: true, minRaise: 4 });
  });

  it("uses the actual short all-in to determine a fourth-street big-bet transition", () => {
    const short = fourth(startStudHand(updateStudPlayer(setup(), 2, { stack: 1.25 + 1.5 })));
    const smallAllIn = act(short, { seat: 2, action: "bet", amount: 1.5, bigBet: true });
    expect(betting(smallAllIn)).toMatchObject({ limitBet: 2, minRaise: 3.5 });
    const larger = fourth(startStudHand(updateStudPlayer(setup(), 2, { stack: 1.25 + 3 })));
    const bigAllIn = act(larger, { seat: 2, action: "bet", amount: 3, bigBet: true });
    expect(betting(bigAllIn)).toMatchObject({ limitBet: 4, minRaise: 7 });
  });

  it.each([{ extra: .5, reopens: false, target: 4 }, { extra: 1, reopens: true, target: 5 }])("handles a $extra short all-in after a fourth-street bet", ({ extra, reopens, target }) => {
    let state = fourth(startStudHand(updateStudPlayer(setup(), 0, { stack: 1.25 + 2 + extra })));
    state = act(state, { seat: 2, action: "bet", amount: 2 });
    state = act(state, { seat: 0, action: "raise", amount: 2 + extra });
    expect(betting(state)?.minRaise).toBe(target);
    state = act(state, { seat: 1, action: "call" });
    expect(betting(state)).toMatchObject({ activeSeat: 2, canRaise: reopens });
  });

  it("lets an unacted player complete a small all-in and cumulatively reopens half-bets", () => {
    let ready = setup();
    ready = updateStudPlayer(ready, 2, { stack: 1.25 + .5 });
    let state = fourth(startStudHand(ready));
    state = act(state, { seat: 2, action: "bet", amount: .5 });
    expect(betting(state)).toMatchObject({ activeSeat: 0, canRaise: true, minRaise: 2, betCount: 0 });
    state = act(state, { seat: 0, action: "raise", amount: 2 });
    expect(betting(state)).toMatchObject({ minRaise: 4, betCount: 1 });
    ready = updateStudPlayer(setup(), 0, { stack: 1.25 + 2.5 });
    ready = updateStudPlayer(ready, 1, { stack: 1.25 + 3 });
    state = act(fourth(startStudHand(ready)), { seat: 2, action: "bet", amount: 2 });
    state = act(state, { seat: 0, action: "raise", amount: 2.5 });
    state = act(state, { seat: 1, action: "raise", amount: 3 });
    // Only the original bettor has chips: no dry side-pot raise.
    expect(betting(state)).toMatchObject({ activeSeat: 2, minRaise: 5, canRaise: false });
  });

  it("keeps all-in players in every deal and never asks for dry betting", () => {
    let state = start({ stack: 1.25 });
    state = advance(finishBetting(state));
    for (let street = 0; street < 4; street++) {
      expect(state.phase).toBe("deal");
      state = deal(state);
      expect(betting(state)).toMatchObject({ activeSeat: null, roundClosed: true });
      state = advance(state);
    }
    expect(state.phase).toBe("showdown");
    expect(state.players.every((player) => player.cards.length === 7)).toBe(true);
    expect(studAccounting(state).totalPot).toBe(3.75);
    const short = startStudHand(updateStudPlayer(setup({ playerCount: 2 }), 1, { stack: .5 }));
    expect(betting(short)).toMatchObject({ toCall: .25, canRaise: false });
    expect(studAccounting(advance(finishBetting(short))).committed).toEqual({ 0: .5, 1: .5 });
  });

  it("cumulatively reopens half-bets while two other stacks can contest a raise", () => {
    let ready = updateStudPlayer(setup({ playerCount: 4 }), 3, { stack: 1.25 + 2.5 });
    ready = updateStudPlayer(ready, 0, { stack: 1.25 + 3 });
    let state = act(fourth(startStudHand(ready)), { seat: 2, action: "bet", amount: 2 });
    state = act(state, { seat: 3, action: "raise", amount: 2.5 });
    state = act(state, { seat: 0, action: "raise", amount: 3 });
    state = act(state, { seat: 1, action: "call" });
    expect(betting(state)).toMatchObject({ activeSeat: 2, canRaise: true, minRaise: 5, betCount: 2 });
  });

  it("deals only live seats in order, validates new cards, and leaves folded cards unavailable", () => {
    let state = act(start(), { seat: 2, action: "fold" });
    state = advance(finishBetting(state));
    expect(pendingStudDealSeat(state)).toBe(0);
    expect(() => recordStudDeal(state, { seat: 1, card: "3♣" })).toThrow("next live seat");
    expect(() => recordStudDeal(state, { seat: 0 })).toThrow("known");
    expect(() => recordStudDeal(state, { seat: 0, card: "Q♣" })).toThrow("already in use");
    expect(() => advance(state)).toThrow("Finish dealing");
    state = recordStudDeal(state, { seat: 0, card: "7♦" });
    state = recordStudDeal(state, { seat: 1, card: "3♣" });
    expect(pendingStudDealSeat(state)).toBeNull();
    expect(state.players[2].cards).toHaveLength(3);
    expect(unavailableStudCards(state).has("Q♣")).toBe(true);
    expect(advance(state).phase).toBe("betting");
  });

  it("refunds uncalled wagers per street while preserving every ante and ends folds early", () => {
    let state = act(start(), { seat: 2, action: "raise", amount: 2 });
    state = act(state, { seat: 0, action: "fold" });
    state = act(state, { seat: 1, action: "fold" });
    expect(betting(state)).toMatchObject({ handOver: true, roundClosed: true });
    state = advance(state);
    expect(state.phase).toBe("done");
    expect(studAccounting(state)).toEqual({
      committed: { 0: .25, 1: 1.25, 2: 1.25 }, totalPot: 2.75,
      refunds: { "third-street": { 2: 1 }, "fourth-street": {}, "fifth-street": {}, "sixth-street": {}, "seventh-street": {} },
    });
    expect(studResult(state)).toMatchObject({ resolved: true, winnings: { 2: 2.75 } });
    expect(buildStudTimeline(state).some((event) => event.type === "show" || event.type === "muck")).toBe(false);
    expect(() => advance(state)).toThrow("No street");
  });

  it("records all five native rounds, hides the opponent river until show, and evaluates best five of seven", () => {
    let state = complete(true);
    expect(state.phase).toBe("showdown");
    expect(studResult(state).resolved).toBe(false);
    state = setStudShownCards(state, 1, holdings[1]);
    state = setStudMucked(state, 2);
    const result = studResult(state);
    expect(result).toMatchObject({ resolved: true, totalPot: 48.75, committed: { 0: 16.25, 1: 16.25, 2: 16.25 }, winnings: { 0: 48.75 } });
    const events = buildStudTimeline(state);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    expect([...new Set(events.filter((event) => event.type === "action").map((event) => event.round))]).toEqual([
      "third-street", "fourth-street", "fifth-street", "sixth-street", "seventh-street",
    ]);
    expect(events.filter((event) => event.type === "deal")).toHaveLength(21);
    expect(events.filter((event) => event.type === "deal" && event.seat !== 0 && event.visibility === "down").every((event) => event.type === "deal" && event.card === undefined)).toBe(true);
    expect(events.find((event) => event.type === "show" && event.seat === 1)).toMatchObject({ cards: holdings[1] });
    expect(state.players[1].cards[6]).toEqual({ visibility: "down" });
    const loaded = JSON.parse(JSON.stringify(state)) as StudState;
    expect(studResult(loaded)).toEqual(result);
    expect(buildStudTimeline(loaded)).toEqual(events);
  });

  it("rejects contradictory/duplicate reveals, and undo restores private state and show/muck choices", () => {
    const state = complete();
    expect(() => setStudShownCards(state, 1, holdings[1].slice(0, 5))).toThrow("all 7");
    expect(() => setStudShownCards(state, 1, ["A♠", ...holdings[1].slice(1)])).toThrow("already in use");
    expect(() => setStudShownCards(state, 1, [...holdings[1].slice(0, 2), "3♦", ...holdings[1].slice(3)])).toThrow("match");
    expect(() => setStudShownCards(state, 1, ["K♠", "K♠", ...holdings[1].slice(2)])).toThrow("already in use");
    const shown = setStudShownCards(state, 1, holdings[1]);
    const mucked = setStudMucked(shown, 1);
    expect(mucked.shownCards[1]).toBeUndefined();
    expect(undoStud(mucked)).toEqual(shown);
    expect(undoStud(shown)).toEqual(state);
    const allMuck = setStudMucked(setStudMucked(setStudMucked(state, 0), 1), 2);
    expect(studResult(allMuck)).toMatchObject({ resolved: false, winnings: {} });
    const beforeDeal = advance(finishBetting(start()));
    const dealt = recordStudDeal(beforeDeal, { seat: 0, card: "7♦" });
    expect(undoStud(dealt)).toEqual(beforeDeal);
    expect(beforeDeal.players[0].cards).toHaveLength(3);
  });

  it("resolves side pots using eligible hands and never awards a wholly mucked side pot", () => {
    let state = startStudHand(updateStudPlayer(setup(), 0, { stack: 2.25 }));
    for (let i = 0; i < 5; i++) {
      const next = betting(state)!;
      if (next.activeSeat !== null && next.canRaise) state = act(state, { seat: next.activeSeat, action: next.lastBet ? "raise" : "bet", amount: next.minRaise });
      state = advance(finishBetting(state));
      if (i < 4) state = deal(state);
    }
    state = setStudShownCards(setStudShownCards(state, 1, holdings[1]), 2, holdings[2]);
    const result = studResult(state);
    expect(result).toMatchObject({ resolved: true, totalPot: 34.75, winnings: { 0: 6.75, 1: 28 } });
    expect(result.awards).toEqual([
      { amount: 6.75, eligibleSeats: [0,1,2], winners: [0] },
      { amount: 28, eligibleSeats: [1,2], winners: [1] },
    ]);
    expect(studResult(setStudMucked(setStudMucked(state, 1), 2)).resolved).toBe(false);
  });

  it("splits equal best-five hands without using suit to break a showdown tie", () => {
    let state = initialStudState({ playerCount: 2 });
    const tied = [
      ["A♠","K♠","Q♠","J♠","T♥","2♣","3♣"],
      ["A♥","K♥","Q♥","J♥","T♣","4♣","5♣"],
    ];
    state = setStudStartingCards(state, 0, tied[0].slice(0, 3));
    state = setStudStartingCards(state, 1, [null,null,tied[1][2]]);
    state = startStudHand(state);
    for (let street = 0; street < 5; street++) {
      state = advance(finishBetting(state));
      if (street < 4) {
        for (let seat = pendingStudDealSeat(state); seat !== null; seat = pendingStudDealSeat(state)) state = recordStudDeal(state, {
          seat, ...(street === 3 && seat !== 0 ? {} : { card: tied[seat][street + 3] }),
        });
        state = advance(state);
      }
    }
    state = setStudShownCards(state, 1, tied[1]);
    expect(studResult(state)).toMatchObject({ resolved: true, totalPot: 2.5, winnings: { 0: 1.25, 1: 1.25 } });
  });

  it("restores a legacy shared seventh with its original exposed order and six personal slots", () => {
    let state = start();
    for (let i = 0; i < 4; i++) { state = advance(finishBetting(state)); if (i < 3) state = deal(state); }
    expect(state).toMatchObject({ phase: "deal", street: "seventh-street" });
    expect(() => restoreLegacyStudSharedSeventh(state, "K♣")).toThrow("already in use");
    const shared = restoreLegacyStudSharedSeventh(state, "K♥");
    expect(pendingStudDealSeat(shared)).toBeNull();
    expect(() => recordStudDeal(shared, { seat: 0, card: "6♥" })).toThrow("next live seat");
    expect(shared.players.every((player) => player.cards.length === 6)).toBe(true);
    expect(studFirstToAct(advance(shared))).toBe(0); // KKK now beats QQ88.
    expect(undoStud(shared)).toEqual(state);
    state = advance(finishBetting(advance(shared)));
    state = setStudMucked(setStudMucked(state, 1), 2);
    expect(studResult(state)).toMatchObject({ resolved: true, winnings: { 0: 3.75 } });
    expect(buildStudTimeline(state).filter((event) => event.type === "shared-deal")).toEqual([
      { id: "deal-seventh-street-shared", round: "seventh-street", type: "shared-deal", card: "K♥", cardIndex: 6, visibility: "up" },
    ]);
    expect(() => setStudShownCards(state, 1, holdings[1])).toThrow("all 6");
  });

  it("records all eight individual rivers without inferring a shared card from the deck count", () => {
    let state = start({ playerCount: 8 });
    for (let i = 0; i < 4; i++) { state = advance(finishBetting(state)); if (i < 3) state = deal(state, false); }
    expect(() => recordStudDeal(state, { seat: 0, card: "K♦" })).toThrow("already in use");
    const before = state;
    state = deal(state, false);
    expect(state.players.every((player) => player.cards.length === 7)).toBe(true);
    expect(state.events.filter((event) => event.type === "deal")).toHaveLength(56);
    expect(state.events.some((event) => event.type === "shared-deal")).toBe(false);
    expect(state.players.slice(1).every((player) => player.cards[6].card === undefined && player.cards[6].visibility === "down")).toBe(true);
    expect(undoStud(undoStud(state)).players[7].cards).toHaveLength(6);
    expect(before.players.every((player) => player.cards.length === 6)).toBe(true);
    state = advance(finishBetting(state));
    for (let seat = 1; seat < 8; seat++) state = setStudMucked(state, seat);
    expect(studResult(state)).toMatchObject({ resolved: true, totalPot: 10, winnings: { 0: 10 } });
  });

  it("rejects invented opponent river identities and late shared-card changes", () => {
    let state = start();
    for (let i = 0; i < 4; i++) { state = advance(finishBetting(state)); if (i < 3) state = deal(state); }
    state = recordStudDeal(state, { seat: 0, card: "A♦" });
    expect(() => restoreLegacyStudSharedSeventh(state, "6♥")).toThrow("before individual");
    expect(() => recordStudDeal(state, { seat: 1, card: "6♠" })).toThrow("downcards");
    expect(recordStudDeal(state, { seat: 1 }).players[1].cards[6]).toEqual({ visibility: "down" });
  });
});
