import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StudAwards from "./StudAwards";
import { formatStudAmount } from "./stud-ui";

describe("Stud/8 payout display", () => {
  it("shows per-player quarters without rounding away fractional chips", () => {
    const html = renderToStaticMarkup(createElement(StudAwards, { awards: [
      { amount: 1.875, eligibleSeats: [0, 1, 2], winners: [2], portion: "high" },
      { amount: 1.875, eligibleSeats: [0, 1, 2], winners: [0, 1], portion: "low" },
    ] }));
    expect(html).toContain("S1 +$0.9375");
    expect(html).toContain("S2 +$0.9375");
    expect(html).toContain("S3 +$1.875");
    expect(formatStudAmount(-4.0625)).toBe("-4.0625");
  });
  it("groups main and side portions and explains a missing side-pot low", () => {
    const html = renderToStaticMarkup(createElement(StudAwards, { awards: [
      { amount: 7.875, eligibleSeats: [0, 1, 2], winners: [1], portion: "high" },
      { amount: 7.875, eligibleSeats: [0, 1, 2], winners: [0], portion: "low" },
      { amount: 10, eligibleSeats: [1, 2], winners: [1], portion: "high" },
    ] }));
    expect(html).toContain("Main pot");
    expect(html).toContain("Side pot 1");
    expect(html).toContain("15.75");
    expect(html).toContain("Low: no qualifying hand");
  });
  it("shows uncontested awards without inventing a low half", () => {
    const html = renderToStaticMarkup(createElement(StudAwards, { awards: [{ amount: 2.75, eligibleSeats: [1], winners: [1] }] }));
    expect(html).toContain("Uncontested");
    expect(html).not.toContain("no qualifying hand");
    expect(html).toContain("S2 +$2.75");
  });
  it("does not show future payout details before the result exists", () => {
    expect(renderToStaticMarkup(createElement(StudAwards, {}))).toBe("");
    expect(renderToStaticMarkup(createElement(StudAwards, { awards: [] }))).toBe("");
  });
});
