import { describe, expect, it } from "vitest";
import {
  applyKnownDraw,
  currentDrawSeat,
  drawCountForVariant,
  drawDecisionToTimelineEvent,
  isDrawExchangeComplete,
  recordDrawDecision,
  startDrawExchange,
} from "./draw-engine";

describe("draw exchange state", () => {
  it("supports one draw in single draw and three in triple draw", () => {
    expect(drawCountForVariant("2-7_SINGLE_DRAW")).toBe(1);
    expect(drawCountForVariant("2-7_TRIPLE_DRAW")).toBe(3);
    expect(() =>
      startDrawExchange({
        variant: "2-7_SINGLE_DRAW",
        round: 2,
        order: [0, 1],
      }),
    ).toThrow("does not have draw 2");
  });

  it("enforces seat order while allowing count-only opponent draws", () => {
    let state = startDrawExchange({
      variant: "2-7_SINGLE_DRAW",
      round: 1,
      order: [2, 0, 1],
    });
    expect(currentDrawSeat(state)).toBe(2);
    expect(() => recordDrawDecision(state, { seat: 0, count: 1 })).toThrow(
      "Seat 2 must draw next",
    );

    state = recordDrawDecision(state, { seat: 2, count: 3 });
    state = recordDrawDecision(state, { seat: 0, count: 0 });
    state = recordDrawDecision(state, { seat: 1, count: 1 });

    expect(isDrawExchangeComplete(state)).toBe(true);
    expect(state.decisions).toEqual([
      { round: 1, seat: 2, count: 3 },
      { round: 1, seat: 0, count: 0 },
      { round: 1, seat: 1, count: 1 },
    ]);
  });

  it("keeps exact hero cards on the same visual slots", () => {
    const result = applyKnownDraw({
      cards: ["A♠", "7♥", "5♦", "4♣", "2♠"],
      discardIndexes: [0, 3],
      replacementCards: ["3♥", "6♣"],
    });
    expect(result).toEqual({
      cards: ["3♥", "7♥", "5♦", "6♣", "2♠"],
      discardedCards: ["A♠", "4♣"],
    });
  });

  it("rejects impossible known replacements", () => {
    const base = {
      cards: ["A♠", "7♥", "5♦", "4♣", "2♠"],
      discardIndexes: [0],
    };
    expect(() =>
      applyKnownDraw({ ...base, replacementCards: ["7♥"] }),
    ).toThrow("already unavailable");
    expect(() =>
      applyKnownDraw({
        ...base,
        replacementCards: ["3♥"],
        unavailableCards: ["3♥"],
      }),
    ).toThrow("already unavailable");
    expect(() =>
      applyKnownDraw({
        ...base,
        discardIndexes: [0, 0],
        replacementCards: ["3♥", "6♣"],
      }),
    ).toThrow("discarded twice");
  });

  it("converts a draw into a stable replay event", () => {
    expect(
      drawDecisionToTimelineEvent({
        round: 1,
        seat: 0,
        count: 2,
        discardIndexes: [0, 1],
        discardedCards: ["A♠", "K♥"],
        replacementCards: ["3♣", "2♦"],
      }),
    ).toEqual({
      id: "draw-1-seat-0",
      type: "draw",
      round: "draw-1",
      seat: 0,
      count: 2,
      discardIndexes: [0, 1],
      discardedCards: ["A♠", "K♥"],
      replacementCards: ["3♣", "2♦"],
    });
  });
});
