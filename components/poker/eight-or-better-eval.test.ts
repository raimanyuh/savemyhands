import { describe, expect, it } from "vitest";
import { compareAceToFive } from "./ace-to-five-eval";
import { evaluateEightOrBetter as score, evaluateBestEightOrBetter as best } from "./eight-or-better-eval";

const suited = (ranks: string) => [...ranks].map((rank) => `${rank}♣`);

describe("Eight-or-better low qualification", () => {
  it("accepts the wheel and an eight-high straight flush, ignoring suits and straights", () => {
    expect(score(suited("A2345"))).toMatchObject({ category: 0, tiebreak: [5, 4, 3, 2, 1] });
    expect(score(suited("45678"))).toMatchObject({ category: 0, tiebreak: [8, 7, 6, 5, 4] });
    expect(compareAceToFive(score(suited("A2345"))!, score(suited("45678"))!)).toBeGreaterThan(0);
  });
  it("qualifies every five-distinct-rank selection from ace through eight, with a strict eight boundary", () => {
    const ranks = "A2345678";
    let count = 0;
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 6; c++)
      for (let d = c + 1; d < 7; d++) for (let e = d + 1; e < 8; e++) {
        const holding = [a, b, c, d, e].map((index) => `${ranks[index]}♣`);
        expect(score(holding)).not.toBeNull();
        expect(score([...holding.slice(0, 4), "9♣"])).toBeNull();
        count++;
      }
    expect(count).toBe(56);
  });
  it.each(["9234A", "K2345", "TJQKA"])("rejects the nonqualifying unpaired low %s", (ranks) => {
    expect(score(suited(ranks))).toBeNull();
  });
  it("rejects paired lows and seven-card holdings with fewer than five distinct low ranks", () => {
    expect(score(["A♣", "A♦", "2♣", "3♣", "4♣"])).toBeNull();
    expect(best(["A♣", "A♦", "2♣", "2♦", "3♣", "4♣", "K♣"])).toBeNull();
    expect(best(suited("A239TJQ"))).toBeNull();
  });
  it("uses any five cards and discards paired or high extras without mutating the holding", () => {
    const holding = ["A♣", "A♦", "2♥", "3♠", "4♣", "5♦", "K♥"];
    const original = [...holding];
    expect(best(holding)).toEqual(score(suited("A2345")));
    expect(best([...holding].reverse())).toEqual(best(holding));
    expect(best(suited("A23568"))).toEqual(score(suited("A2356")));
    expect(holding).toEqual(original);
  });
  it("breaks low ties by all five ranks, with no suit tiebreak", () => {
    expect(compareAceToFive(score(suited("A2378"))!, score(suited("23468"))!)).toBeLessThan(0);
    expect(compareAceToFive(score(suited("A2378"))!, score(["8♠", "7♥", "3♦", "2♠", "A♦"])!)).toBe(0);
  });
  it("validates all cards, including discarded extras, instead of treating invalid input as no low", () => {
    for (const invalid of [[], suited("A234"), suited("A2345678"), ["As", ...suited("2345")], ["A♣", ...suited("A2345")]]) {
      expect(() => best(invalid)).toThrow();
    }
    expect(() => score(suited("A23456"))).toThrow("5 cards");
  });
});
