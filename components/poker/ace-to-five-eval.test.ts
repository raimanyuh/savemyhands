import { describe, expect, it } from "vitest";
import { aceToFiveBoardScore, compareAceToFive, evaluateAceToFive as score, evaluateBestAceToFive as best } from "./ace-to-five-eval";

function cards(ranks: string) {
  const counts: Record<string, number> = {};
  return [...ranks].map((rank) => {
    const suit = counts[rank] ?? 0;
    counts[rank] = suit + 1;
    return rank + "♣♦♥♠"[suit];
  });
}

describe("Ace-to-five low evaluation", () => {
  it("orders the published Razz examples from a full house through the wheel", () => {
    // PokerStars' Razz ranking examples, weakest to strongest.
    const examples = ["33355", "KK432", "22765", "AAT98", "KQJT9", "KQJT7", "98765", "97653", "9765A", "65432", "6432A", "5432A"];
    for (let i = 1; i < examples.length; i++) {
      expect(compareAceToFive(score(cards(examples[i])), score(cards(examples[i - 1])))).toBeGreaterThan(0);
      expect(compareAceToFive(score(cards(examples[i - 1])), score(cards(examples[i])))).toBeLessThan(0);
    }
  });
  it("ignores straights, flushes and suits, and treats aces as low in paired hands too", () => {
    const wheel = score(["A♣", "2♣", "3♣", "4♣", "5♣"]);
    expect(wheel).toMatchObject({ category: 0, tiebreak: [5, 4, 3, 2, 1], description: "Five-Four low" });
    expect(compareAceToFive(wheel, score(["5♥", "A♠", "3♦", "2♥", "4♠"]))).toBe(0);
    expect(compareAceToFive(score(cards("AAT98")), score(cards("22765")))).toBeGreaterThan(0);
    expect(compareAceToFive(score(cards("KQJT9")), score(cards("AA432")))).toBeGreaterThan(0);
  });
  it.each([
    ["76532", "76542"], ["AA932", "AAT32"], ["2234A", "2254A"],
    ["AA223", "AA233"], ["AAA32", "2223A"], ["AAA22", "222AA"], ["AAAA2", "2222A"],
  ])("compares all deciding ranks for %s against %s", (better, worse) => {
    expect(compareAceToFive(score(cards(better)), score(cards(worse)))).toBeGreaterThan(0);
  });
  it("keeps all paired categories worse than unpaired lows without straight/flush categories", () => {
    const categories = ["KQJT9", "AA432", "AA223", "AAA23", "AAA22", "AAAA2"];
    expect(categories.map((ranks) => score(cards(ranks)).category)).toEqual([0, 1, 2, 3, 6, 7]);
    for (let i = 1; i < categories.length; i++) expect(compareAceToFive(score(cards(categories[i - 1])), score(cards(categories[i])))).toBeGreaterThan(0);
  });
  it("chooses any five from six or seven cards, discarding pairs and high cards", () => {
    const holding = ["A♣", "A♦", "2♥", "3♠", "4♣", "5♦", "K♥"];
    const original = [...holding];
    expect(best(holding)).toEqual(score(cards("5432A")));
    expect(best([...holding].reverse())).toEqual(best(holding));
    expect(holding).toEqual(original);
    expect(best(["A♣", "2♦", "3♥", "4♠", "5♣", "5♥"])).toEqual(score(cards("5432A")));
    expect(best(cards("9765A"))).toMatchObject({ category: 0, tiebreak: [9, 7, 6, 5, 1] });
  });
  it("validates the whole holding, including cards that would be discarded", () => {
    for (const invalid of [[], cards("5432"), cards("5432AKQJ"), ["A♣", "A♣", ...cards("23456")], ["As", ...cards("2345")], ["10♣", ...cards("2345")]]) {
      expect(() => best(invalid)).toThrow();
    }
    expect(() => score(cards("5432AK"))).toThrow("5 cards");
  });
  it.each([
    ["AA22KK3", 1, [1, 13, 3, 2]],
    ["AAAA222", 6, [1, 2]],
    ["AAAKKK2", 2, [13, 1, 2]],
  ])("finds the best paired five-card selection within %s", (holding, category, tiebreak) => {
    expect(best(cards(holding))).toMatchObject({ category, tiebreak });
  });
  it("ranks partial exposed boards by made low value, ignoring straight/flush draws", () => {
    expect(aceToFiveBoardScore(["A♣", "2♣"])).toEqual([0, 2, 1]);
    expect(aceToFiveBoardScore(["A♣", "A♦"])).toEqual([1, 1]);
    expect(aceToFiveBoardScore(["2♣", "2♦", "A♥", "K♠"])).toEqual([1, 2, 13, 1]);
    expect(aceToFiveBoardScore(["T♣", "J♣", "Q♣", "K♣", "A♣"])).toEqual([0, 13, 12, 11, 10, 1]);
    expect(() => aceToFiveBoardScore([])).toThrow();
    expect(() => aceToFiveBoardScore(["A♣", "A♣"])).toThrow("duplicate");
  });
});
