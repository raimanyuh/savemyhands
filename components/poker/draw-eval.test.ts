import { describe, expect, it } from "vitest";
import {
  compareDeuceToSeven,
  determineDeuceToSevenWinners,
  evaluateDeuceToSeven,
} from "./draw-eval";

describe("Deuce-to-Seven evaluation", () => {
  it("ranks 7-5-4-3-2 as the best common low", () => {
    const nuts = evaluateDeuceToSeven(["7♠", "5♥", "4♦", "3♣", "2♠"]);
    const six = evaluateDeuceToSeven(["7♥", "6♣", "4♠", "3♦", "2♣"]);
    expect(compareDeuceToSeven(nuts, six)).toBeGreaterThan(0);
    expect(nuts).toMatchObject({ category: 0, tiebreak: [7, 5, 4, 3, 2] });
  });

  it("treats aces as high and does not make a wheel straight", () => {
    const aceHigh = evaluateDeuceToSeven(["A♠", "5♥", "4♦", "3♣", "2♠"]);
    expect(aceHigh.category).toBe(0);
    expect(aceHigh.tiebreak).toEqual([14, 5, 4, 3, 2]);
  });

  it("penalizes straights and flushes", () => {
    const eightLow = evaluateDeuceToSeven(["8♠", "6♥", "4♦", "3♣", "2♠"]);
    const straight = evaluateDeuceToSeven(["6♠", "5♥", "4♦", "3♣", "2♠"]);
    const flush = evaluateDeuceToSeven(["9♠", "7♠", "5♠", "3♠", "2♠"]);
    expect(compareDeuceToSeven(eightLow, straight)).toBeGreaterThan(0);
    expect(compareDeuceToSeven(straight, flush)).toBeGreaterThan(0);
  });

  it("orders paired hands by their standard high-hand value, reversed", () => {
    const pairOfTwos = evaluateDeuceToSeven(["2♠", "2♥", "7♦", "5♣", "3♠"]);
    const pairOfThrees = evaluateDeuceToSeven(["3♠", "3♥", "7♦", "5♣", "2♠"]);
    const twoPair = evaluateDeuceToSeven(["2♠", "2♥", "3♦", "3♣", "4♠"]);
    expect(compareDeuceToSeven(pairOfTwos, pairOfThrees)).toBeGreaterThan(0);
    expect(compareDeuceToSeven(pairOfThrees, twoPair)).toBeGreaterThan(0);
  });

  it("returns every seat when the best hand ties", () => {
    const result = determineDeuceToSevenWinners([
      { seat: 0, cards: ["7♠", "5♥", "4♦", "3♣", "2♠"] },
      { seat: 1, cards: ["8♠", "6♥", "4♣", "3♦", "2♥"] },
      { seat: 2, cards: ["7♥", "5♣", "4♠", "3♦", "2♣"] },
    ]);
    expect(result.winners).toEqual([0, 2]);
  });

  it("rejects incomplete and duplicate hands", () => {
    expect(() => evaluateDeuceToSeven(["7♠", "5♥"])).toThrow(
      "exactly 5 cards",
    );
    expect(() =>
      evaluateDeuceToSeven(["7♠", "7♠", "4♦", "3♣", "2♠"]),
    ).toThrow("duplicate cards");
  });
});
