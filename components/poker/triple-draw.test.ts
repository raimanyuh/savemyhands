import { describe, expect, it } from "vitest";
import {
  advanceSingleDrawPhase as advance, buildSingleDrawTimeline, deriveSingleDrawBetting as betting,
  initialSingleDrawState, recordSingleDrawAction as act, recordSingleDrawDecision as draw,
  setSingleDrawMucked, setSingleDrawShownCards, setSingleDrawStartingCards,
  singleDrawCommittedBySeatFinal, startSingleDrawHand, undoSingleDraw, updateSingleDrawPlayer,
  type SingleDrawState,
} from "./single-draw-engine";
import { buildSingleDrawHand } from "@/lib/recorder/single-draw-hand";
import { recordedToHand, type SavedHand } from "./hand";
import { knownSingleDrawCards, changeSingleDrawSetup, singleDrawSizing } from "./single-draw-ui";
import { gameTypeOf, holeCountOf } from "./dashboard-shared";

const cards = ["A♠", "7♥", "5♦", "4♣", "2♠"];
const opponent = ["8♠", "6♥", "4♦", "3♣", "2♥"];
function start(args: Parameters<typeof initialSingleDrawState>[0] = {}) {
  return startSingleDrawHand(setSingleDrawStartingCards(initialSingleDrawState({ variant: "2-7_TRIPLE_DRAW", playerCount: 3, ...args }), args.heroSeat ?? 0, cards));
}
function finishBetting(state: SingleDrawState) {
  for (let guard = 0; guard < 100; guard++) {
    const current = betting(state);
    if (!current || current.activeSeat === null) return state;
    state = act(state, { seat: current.activeSeat, action: current.canCheck ? "check" : "call" });
  }
  throw new Error("Betting did not close");
}
function exchange(state: SingleDrawState, hero?: { discardIndexes: number[]; replacementCards: string[]; reshuffleBefore?: boolean }) {
  for (const seat of state.exchange!.order) state = draw(state, seat === state.heroSeat
    ? { seat, count: hero?.discardIndexes.length ?? 0, discardIndexes: hero?.discardIndexes ?? [], replacementCards: hero?.replacementCards ?? [], reshuffleBefore: hero?.reshuffleBefore }
    : { seat, count: seat === 1 ? 2 : 0 });
  return state;
}
function complete(withBets = false, playerCount = 3) {
  let state = advance(finishBetting(start({ playerCount })));
  for (let number = 1; number <= 3; number++) {
    state = exchange(state, number === 1 ? { discardIndexes: [0], replacementCards: ["3♥"] }
      : { discardIndexes: [3], replacementCards: [number === 2 ? "6♣" : "4♥"] });
    state = advance(state);
    if (withBets) state = act(state, { seat: betting(state)!.activeSeat!, action: "bet", amount: number === 1 ? 2 : 4 });
    state = advance(finishBetting(state));
  }
  state = setSingleDrawShownCards(state, 1, opponent);
  if (playerCount > 2) state = setSingleDrawMucked(state, 2, true);
  return state;
}
function save(state: SingleDrawState): SavedHand {
  return JSON.parse(JSON.stringify({ ...buildSingleDrawHand({ state, date: "2026-10-22" }), id: "triple" }));
}

describe("fixed-limit Triple Draw", () => {
  it("interleaves three exchanges and four native betting rounds with stable ids", () => {
    const state = complete(true);
    expect(state).toMatchObject({ phase: "showdown", drawNumber: 3 });
    expect(state.draws).toHaveLength(9);
    expect(state.players[0].cards).toEqual(["3♥", "7♥", "5♦", "4♥", "2♠"]);
    const timeline = buildSingleDrawTimeline(state);
    expect(new Set(timeline.map((event) => event.id)).size).toBe(timeline.length);
    const rounds = timeline.filter((event) => event.type === "draw" || event.type === "action").map((event) => event.round);
    expect([...new Set(rounds)]).toEqual(["predraw", "draw-1", "postdraw-1", "draw-2", "postdraw-2", "draw-3", "postdraw-3"]);
    expect(singleDrawCommittedBySeatFinal(state)).toEqual({ 0: 12, 1: 12, 2: 12 });
  });

  it("rejects variable-sized bets and doubles the unit after the second draw", () => {
    let state = start();
    expect(betting(state)).toMatchObject({ limitBet: 2, minRaise: 4 });
    expect(() => act(state, { seat: 0, action: "raise", amount: 5 })).toThrow("Fixed-limit");
    state = advance(finishBetting(state));
    state = advance(exchange(state));
    expect(betting(state)).toMatchObject({ round: "postdraw-1", limitBet: 2, minRaise: 2 });
    expect(singleDrawSizing(state, betting(state)!)).toMatchObject({ minimum: 2, maximum: 2 });
    state = advance(finishBetting(state));
    state = advance(exchange(state));
    expect(betting(state)).toMatchObject({ round: "postdraw-2", limitBet: 4, minRaise: 4 });
    expect(() => act(state, { seat: 1, action: "bet", amount: 2 })).toThrow("Fixed-limit");
  });

  it("caps at four bets including the blind, and supports a five-bet table", () => {
    let state = start();
    for (const [seat, amount] of [[0,4], [1,6], [2,8]]) state = act(state, { seat, action: "raise", amount });
    expect(betting(state)).toMatchObject({ betCount: 4, raiseCapped: true, canRaise: false });
    expect(() => act(state, { seat: 0, action: "raise", amount: 10 })).toThrow("capped");
    let five = start({ limitRules: { maxBets: 5, headsUpUncapped: false } });
    for (const [seat, amount] of [[0,4], [1,6], [2,8], [0,10]]) five = act(five, { seat, action: "raise", amount });
    expect(betting(five)).toMatchObject({ betCount: 5, raiseCapped: true });
  });

  it("uncaps a heads-up starting round only when the table setting allows it", () => {
    let state = start({ playerCount: 2, limitRules: { maxBets: 4, headsUpUncapped: true } });
    for (const [seat, amount] of [[0,4], [1,6], [0,8], [1,10]]) state = act(state, { seat, action: "raise", amount });
    expect(betting(state)).toMatchObject({ raiseCapped: false, canRaise: true, minRaise: 12 });
    let multiway = start({ limitRules: { maxBets: 4, headsUpUncapped: true } });
    multiway = act(multiway, { seat: 0, action: "raise", amount: 4 });
    multiway = act(multiway, { seat: 1, action: "raise", amount: 6 });
    multiway = act(multiway, { seat: 2, action: "fold" });
    multiway = act(multiway, { seat: 0, action: "raise", amount: 8 });
    expect(betting(multiway)?.raiseCapped).toBe(true);
  });

  it.each([{ extra: .5, reopens: false, next: 4 }, { extra: 1, reopens: true, next: 5 }])("handles a $extra short all-in over a $2 bet", ({ extra, reopens, next }) => {
    let state = initialSingleDrawState({ variant: "2-7_TRIPLE_DRAW", playerCount: 3 });
    state = updateSingleDrawPlayer(state, 2, { stack: 4 + extra });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, cards));
    state = advance(exchange(advance(finishBetting(state))));
    state = act(state, { seat: 1, action: "bet", amount: 2 });
    state = act(state, { seat: 2, action: "raise", amount: 2 + extra });
    expect(betting(state)?.minRaise).toBe(next);
    state = act(state, { seat: 0, action: "call" });
    expect(betting(state)).toMatchObject({ activeSeat: 1, canRaise: reopens });
  });

  it("counts only players with chips when a round begins heads-up for betting", () => {
    let state = initialSingleDrawState({ variant: "2-7_TRIPLE_DRAW", playerCount: 3, limitRules: { maxBets: 4, headsUpUncapped: true } });
    state = updateSingleDrawPlayer(state, 2, { stack: 2 });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, cards));
    for (const [seat, amount] of [[0,4], [1,6], [0,8], [1,10]]) state = act(state, { seat, action: "raise", amount });
    expect(betting(state)).toMatchObject({ betCount: 5, raiseCapped: false, canRaise: true });
  });

  it("keeps all three draws when everyone is all-in before the first draw", () => {
    let state = advance(finishBetting(start({ stack: 2 })));
    for (let number = 1; number <= 3; number++) {
      expect(state).toMatchObject({ phase: "draw", drawNumber: number });
      state = advance(exchange(state));
      if (number < 3) {
        expect(betting(state)?.roundClosed).toBe(true);
        state = advance(state);
      }
    }
    expect(state.phase).toBe("showdown");
    expect(state.draws).toHaveLength(9);
  });

  it.each([0,1])("does not ask for a dry blind completion when seat %i is all-in short", (shortSeat) => {
    let state = initialSingleDrawState({ variant: "2-7_TRIPLE_DRAW", playerCount: 2 });
    state = updateSingleDrawPlayer(state, shortSeat, { stack: .5 });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, cards));
    expect(betting(state)).toMatchObject({ activeSeat: null, roundClosed: true });
    state = advance(state);
    for (let number = 1; number <= 3; number++) {
      state = advance(exchange(state));
      if (number < 3) state = advance(state);
    }
    state = setSingleDrawShownCards(state, 1, opponent);
    const replay = recordedToHand(save(state))!;
    expect(singleDrawCommittedBySeatFinal(state)).toEqual({ 0: .5, 1: .5 });
    expect(replay.steps.at(-1)?.pot).toBe(1);
    expect(replay.steps.filter((step) => step.draw?.kind === "action")).toHaveLength(0);
  });

  it("completes an incomplete raise and cumulatively reopens at half a limit bet", () => {
    let state = initialSingleDrawState({ variant: "2-7_TRIPLE_DRAW", playerCount: 4 });
    state = updateSingleDrawPlayer(state, 2, { stack: 4.5 });
    state = updateSingleDrawPlayer(state, 3, { stack: 5 });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, cards));
    state = advance(exchange(advance(finishBetting(state))));
    state = act(state, { seat: 1, action: "bet", amount: 2 });
    state = act(state, { seat: 2, action: "raise", amount: 2.5 });
    expect(betting(state)?.minRaise).toBe(4);
    state = act(state, { seat: 3, action: "raise", amount: 3 });
    state = act(state, { seat: 0, action: "call" });
    expect(betting(state)).toMatchObject({ activeSeat: 1, canRaise: true, minRaise: 5, betCount: 2 });
  });

  it("ends on a fold after draw two without inventing a third exchange", () => {
    let state = advance(finishBetting(start({ playerCount: 2 })));
    for (let number = 1; number <= 2; number++) {
      state = advance(exchange(state));
      if (number === 1) state = advance(finishBetting(state));
    }
    state = act(state, { seat: 1, action: "bet", amount: 4 });
    state = act(state, { seat: 0, action: "fold" });
    state = advance(state);
    expect(state).toMatchObject({ phase: "done", drawNumber: 2 });
    const hand = save(state);
    expect(hand._full!.timeline!.some((event) => event.round === "draw-3")).toBe(false);
    expect(recordedToHand(hand)!.steps.at(-1)?.draw?.winnings).toEqual({ 1: 4 });
  });

  it("restores draw number, exact cards, decisions and round actions with undo", () => {
    const first = advance(finishBetting(start()));
    const exchanged = exchange(first, { discardIndexes: [0], replacementCards: ["3♥"] });
    const after = advance(exchanged);
    expect(undoSingleDraw(after)).toEqual(exchanged);
    expect(undoSingleDraw(exchanged).players[0].cards).toEqual(cards);
    expect(after.draws.at(-1)?.round).toBe(1);
  });

  it("keeps old discards dead until a recorded reshuffle and never recycles this draw's discards", () => {
    let state = advance(finishBetting(start()));
    state = advance(finishBetting(advance(exchange(state, { discardIndexes: [0], replacementCards: ["3♥"] }))));
    state = draw(state, { seat: 1, count: 0 });
    state = draw(state, { seat: 2, count: 0 });
    expect(() => draw(state, { seat: 0, count: 1, discardIndexes: [0], replacementCards: ["A♠"] })).toThrow("unavailable");
    expect(knownSingleDrawCards(state, undefined, true).has("A♠")).toBe(false);
    expect(() => draw(state, { seat: 0, count: 1, discardIndexes: [0], replacementCards: ["3♥"], reshuffleBefore: true })).toThrow("unavailable");
    const recycled = draw(state, { seat: 0, count: 1, discardIndexes: [0], replacementCards: ["A♠"], reshuffleBefore: true });
    expect(recycled.players[0].cards).toEqual(cards);
    expect(recycled.draws.at(-1)?.reshuffleBefore).toBe(true);
    expect(undoSingleDraw(recycled)).toEqual(state);
  });

  it("preserves profiles, cards and cap rules when changing format in setup", () => {
    const state = setSingleDrawStartingCards(initialSingleDrawState(), 0, cards);
    const triple = changeSingleDrawSetup(state, { variant: "2-7_TRIPLE_DRAW", limitRules: { maxBets: 5, headsUpUncapped: true } });
    expect(triple).toMatchObject({ variant: "2-7_TRIPLE_DRAW", limitRules: { maxBets: 5, headsUpUncapped: true } });
    expect(triple.players[0].cards).toEqual(cards);
    expect(changeSingleDrawSetup(triple, { bb: 10 }).variant).toBe("2-7_TRIPLE_DRAW");
  });
});

describe("Triple Draw save and replay", () => {
  it("round-trips fixed-limit metadata, all three exchanges and the shared result", () => {
    const hand = save(complete(true));
    expect(hand).toMatchObject({ result: 24, stakes: "2/4 FL", multiway: true, _full: {
      game: { family: "draw", variant: "2-7_TRIPLE_DRAW", bettingStructure: "FL" }, drawRules: { maxBets: 4, headsUpUncapped: false },
    } });
    expect(gameTypeOf(hand)).toBe("2-7_TRIPLE_DRAW");
    expect(holeCountOf(hand)).toBe(5);
    const replay = recordedToHand(hand)!;
    expect(replay.steps.at(-1)?.draw).toMatchObject({ resolved: true, winnings: { 0: 36 } });
    for (const number of [1,2,3]) {
      const discarded = replay.steps.find((step) => step.street === `draw-${number}` && step.active === 0 && step.draw?.stage === "discard")!;
      expect(discarded.draw!.cards[0].filter((slot) => !slot.present)).toHaveLength(1);
      expect(discarded.draw!.cards[1].some((slot) => slot.card)).toBe(false);
    }
    expect(replay.steps.find((step) => step.street === "postdraw-1")?.draw?.cards[0].map((slot) => slot.card)).toEqual(["3♥", "7♥", "5♦", "4♣", "2♠"]);
    expect(replay.steps.filter((step) => step.street === "postdraw-3").at(-1)?.pot).toBe(36);
  });

  it("does not classify repeated heads-up draws as multiway", () => {
    expect(save(complete(false, 2)).multiway).toBe(false);
  });

  it("replays an explicit reshuffle without changing earlier card snapshots", () => {
    let state = advance(finishBetting(start()));
    state = advance(finishBetting(advance(exchange(state, { discardIndexes: [0], replacementCards: ["3♥"] }))));
    state = advance(finishBetting(advance(exchange(state, { discardIndexes: [0], replacementCards: ["A♠"], reshuffleBefore: true }))));
    state = advance(finishBetting(advance(exchange(state))));
    state = setSingleDrawShownCards(state, 1, opponent);
    state = setSingleDrawMucked(state, 2, true);
    const replay = recordedToHand(save(state))!;
    const shuffle = replay.steps.find((step) => step.draw?.stage === "reshuffle")!;
    expect(shuffle.street).toBe("draw-2");
    expect(shuffle.draw!.cards[0][0].card).toBe("3♥");
    expect(replay.steps.find((step) => step.street === "postdraw-2")!.draw!.cards[0][0].card).toBe("A♠");
    expect(replay.steps.find((step) => step.street === "postdraw-1")!.draw!.cards[0][0].card).toBe("3♥");
  });
});
