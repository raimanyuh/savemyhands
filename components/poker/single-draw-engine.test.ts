import { describe, expect, it } from "vitest";
import {
  advanceSingleDrawPhase,
  buildSingleDrawTimeline,
  deriveSingleDrawBetting,
  initialSingleDrawState,
  recordSingleDrawAction,
  recordSingleDrawDecision,
  setSingleDrawShownCards,
  setSingleDrawStartingCards,
  singleDrawCommittedBySeatFinal,
  startSingleDrawHand,
  undoSingleDraw,
  updateSingleDrawPlayer,
  type SingleDrawState,
} from "./single-draw-engine";

const heroCards = ["A♠", "7♥", "5♦", "4♣", "2♠"] as const;

function startedThreeHanded(): SingleDrawState {
  let state = initialSingleDrawState({ playerCount: 3, heroSeat: 0 });
  state = setSingleDrawStartingCards(state, 0, [...heroCards]);
  return startSingleDrawHand(state);
}

function reachDraw(): SingleDrawState {
  let state = startedThreeHanded();
  state = recordSingleDrawAction(state, { seat: 0, action: "call" });
  state = recordSingleDrawAction(state, { seat: 1, action: "call" });
  state = recordSingleDrawAction(state, { seat: 2, action: "check" });
  return advanceSingleDrawPhase(state);
}

describe("No-Limit 2-7 Single Draw state machine", () => {
  it("records a complete hand through both betting rounds and showdown", () => {
    let state = reachDraw();
    expect(state.phase).toBe("draw");
    expect(state.exchange?.order).toEqual([1, 2, 0]);

    state = recordSingleDrawDecision(state, { seat: 1, count: 2 });
    state = recordSingleDrawDecision(state, { seat: 2, count: 0 });
    state = recordSingleDrawDecision(state, {
      seat: 0,
      count: 1,
      discardIndexes: [0],
      replacementCards: ["3♥"],
    });
    expect(state.players[0].cards).toEqual(["3♥", "7♥", "5♦", "4♣", "2♠"]);

    state = advanceSingleDrawPhase(state);
    expect(state.phase).toBe("postdraw");
    expect(deriveSingleDrawBetting(state)?.activeSeat).toBe(1);
    state = recordSingleDrawAction(state, { seat: 1, action: "check" });
    state = recordSingleDrawAction(state, { seat: 2, action: "check" });
    state = recordSingleDrawAction(state, { seat: 0, action: "check" });
    expect(deriveSingleDrawBetting(state)?.roundClosed).toBe(true);

    state = advanceSingleDrawPhase(state);
    expect(state.phase).toBe("showdown");
    state = setSingleDrawShownCards(state, 1, [
      "8♠",
      "6♥",
      "4♦",
      "3♣",
      "2♥",
    ]);

    const timeline = buildSingleDrawTimeline(state);
    expect(timeline.filter((event) => event.type === "deal")).toHaveLength(15);
    expect(
      timeline
        .filter((event) => event.type === "draw")
        .map((event) => ({ seat: event.seat, count: event.count })),
    ).toEqual([
      { seat: 1, count: 2 },
      { seat: 2, count: 0 },
      { seat: 0, count: 1 },
    ]);
    expect(
      timeline.find((event) => event.type === "draw" && event.seat === 0),
    ).toMatchObject({
      discardIndexes: [0],
      discardedCards: ["A♠"],
      replacementCards: ["3♥"],
    });
    expect(
      timeline
        .filter((event) => event.type === "deal" && event.seat !== 0)
        .every((event) => event.type === "deal" && event.card === undefined),
    ).toBe(true);
  });

  it("reopens action after raises and tracks the real last raise size", () => {
    let state = startedThreeHanded();
    state = recordSingleDrawAction(state, {
      seat: 0,
      action: "raise",
      amount: 6,
    });
    expect(deriveSingleDrawBetting(state)).toMatchObject({
      activeSeat: 1,
      toCall: 5,
      minRaise: 10,
    });
    state = recordSingleDrawAction(state, { seat: 1, action: "call" });
    state = recordSingleDrawAction(state, {
      seat: 2,
      action: "raise",
      amount: 10,
    });
    expect(deriveSingleDrawBetting(state)).toMatchObject({
      activeSeat: 0,
      toCall: 4,
      minRaise: 14,
    });
    expect(() =>
      recordSingleDrawAction(state, { seat: 0, action: "raise", amount: 13 }),
    ).toThrow("Minimum raise is 14");
  });

  it("does not let a short all-in reduce the next legal raise size", () => {
    let state = initialSingleDrawState({ playerCount: 3, heroSeat: 0 });
    state = updateSingleDrawPlayer(state, 1, { stack: 8 });
    state = setSingleDrawStartingCards(state, 0, [...heroCards]);
    state = startSingleDrawHand(state);
    state = recordSingleDrawAction(state, {
      seat: 0,
      action: "raise",
      amount: 6,
    });
    state = recordSingleDrawAction(state, {
      seat: 1,
      action: "raise",
      amount: 8,
    });
    expect(deriveSingleDrawBetting(state)).toMatchObject({
      activeSeat: 2,
      lastBet: 8,
      lastRaiseSize: 4,
      minRaise: 12,
    });
  });

  it("undoes the latest decision and restores the correct actor", () => {
    let state = reachDraw();
    state = recordSingleDrawDecision(state, { seat: 1, count: 2 });
    state = recordSingleDrawDecision(state, { seat: 2, count: 0 });
    expect(state.exchange?.cursor).toBe(2);

    state = undoSingleDraw(state);
    expect(state.exchange?.cursor).toBe(1);
    expect(state.draws).toEqual([{ round: 1, seat: 1, count: 2 }]);
  });

  it("allows calls but not a re-raise when a short all-in does not reopen action", () => {
    let state = initialSingleDrawState({ playerCount: 3 });
    state = updateSingleDrawPlayer(state, 1, { stack: 8 });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, [...heroCards]));
    state = recordSingleDrawAction(state, { seat: 0, action: "raise", amount: 6 });
    state = recordSingleDrawAction(state, { seat: 1, action: "raise", amount: 8 });
    expect(deriveSingleDrawBetting(state)?.canRaise).toBe(true);
    state = recordSingleDrawAction(state, { seat: 2, action: "call" });
    expect(deriveSingleDrawBetting(state)).toMatchObject({ activeSeat: 0, canRaise: false, toCall: 2 });
    expect(() => recordSingleDrawAction(state, { seat: 0, action: "raise", amount: 12 })).toThrow("not reopened");
    state = recordSingleDrawAction(state, { seat: 0, action: "call" });
    expect(deriveSingleDrawBetting(state)?.roundClosed).toBe(true);
  });

  it("reopens raising when successive short all-ins cumulatively make a full raise", () => {
    let state = initialSingleDrawState({ playerCount: 4, heroSeat: 3 });
    state = updateSingleDrawPlayer(state, 0, { stack: 8 });
    state = updateSingleDrawPlayer(state, 1, { stack: 10 });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 3, [...heroCards]));
    state = recordSingleDrawAction(state, { seat: 3, action: "raise", amount: 6 });
    state = recordSingleDrawAction(state, { seat: 0, action: "raise", amount: 8 });
    state = recordSingleDrawAction(state, { seat: 1, action: "raise", amount: 10 });
    state = recordSingleDrawAction(state, { seat: 2, action: "call" });
    expect(deriveSingleDrawBetting(state)).toMatchObject({ activeSeat: 3, canRaise: true, minRaise: 14 });
    expect(() => recordSingleDrawAction(state, { seat: 3, action: "raise", amount: 14 })).not.toThrow();
  });

  it("ends immediately when folds leave one player and refunds an uncalled blind", () => {
    let state = startedThreeHanded();
    state = recordSingleDrawAction(state, { seat: 0, action: "fold" });
    state = recordSingleDrawAction(state, { seat: 1, action: "fold" });
    expect(deriveSingleDrawBetting(state)).toMatchObject({
      activeSeat: null,
      handOver: true,
      roundClosed: true,
    });
    state = advanceSingleDrawPhase(state);
    expect(state.phase).toBe("done");
    expect(singleDrawCommittedBySeatFinal(state)).toEqual({ 1: 1, 2: 1 });
  });

  it("lets all-in players draw but skips betting when nobody can respond", () => {
    let state = initialSingleDrawState({ playerCount: 2, heroSeat: 0 });
    state = updateSingleDrawPlayer(state, 0, { stack: 2 });
    state = updateSingleDrawPlayer(state, 1, { stack: 2 });
    state = setSingleDrawStartingCards(state, 0, [...heroCards]);
    state = startSingleDrawHand(state);
    state = recordSingleDrawAction(state, { seat: 0, action: "call" });
    expect(deriveSingleDrawBetting(state)?.roundClosed).toBe(true);
    state = advanceSingleDrawPhase(state);
    expect(state.exchange?.order).toEqual([1, 0]);
    state = recordSingleDrawDecision(state, { seat: 1, count: 1 });
    state = recordSingleDrawDecision(state, {
      seat: 0,
      count: 0,
      discardIndexes: [],
      replacementCards: [],
    });
    state = advanceSingleDrawPhase(state);
    expect(state.phase).toBe("showdown");
  });

  it("rejects shown cards that were already dealt or discarded", () => {
    let state = reachDraw();
    state = recordSingleDrawDecision(state, { seat: 1, count: 0 });
    state = recordSingleDrawDecision(state, { seat: 2, count: 0 });
    state = recordSingleDrawDecision(state, {
      seat: 0,
      count: 1,
      discardIndexes: [0],
      replacementCards: ["3♥"],
    });
    state = advanceSingleDrawPhase(state);
    state = recordSingleDrawAction(state, { seat: 1, action: "check" });
    state = recordSingleDrawAction(state, { seat: 2, action: "check" });
    state = recordSingleDrawAction(state, { seat: 0, action: "check" });
    state = advanceSingleDrawPhase(state);

    expect(() =>
      setSingleDrawShownCards(state, 1, ["A♠", "8♠", "6♥", "4♦", "2♥"]),
    ).toThrow("Card is already in use: A♠");
    expect(() =>
      setSingleDrawShownCards(state, 1, ["3♥", "8♠", "6♥", "4♦", "2♥"]),
    ).toThrow("Card is already in use: 3♥");
  });
});
