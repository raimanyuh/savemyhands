import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialState } from "./engine";
import { changeSingleDrawSetup, knownSingleDrawCards, singleDrawDraftFromCommunity, singleDrawSizing } from "./single-draw-ui";
import { deriveSingleDrawBetting, initialSingleDrawState, setSingleDrawStartingCards, startSingleDrawHand, updateSingleDrawPlayer } from "./single-draw-engine";
import { gameTypeOf, holeCountOf } from "./dashboard-shared";
import { getSampleHand } from "@/lib/sample-hand";
import DrawTable from "./DrawTable";
import VerticalDrawFelt from "@/components/mobile/VerticalDrawFelt";
import type { DrawReplayCard } from "./single-draw-replay";

const holding = ["A♠", "7♥", "5♦", "4♣", "2♠"];

describe("Single Draw UI derivations", () => {
  it("keeps setup metadata and player profiles without reusing community hole cards", () => {
    const community = initialState();
    community.heroPosition = 2;
    community.players[2] = { ...community.players[2], name: "Hero", stack: 450, cards: ["A♠", "K♠"] };
    community.handName = "Draw night";
    community.notes = "A read";
    const draft = singleDrawDraftFromCommunity(community);
    expect(draft).toMatchObject({ name: "Draw night", notes: "A read", state: { heroSeat: 2, sb: 1, bb: 2 } });
    expect(draft.state.players[2]).toMatchObject({ name: "Hero", stack: 450, cards: [null, null, null, null, null] });
    expect(community.players[2].cards).toEqual(["A♠", "K♠"]);
  });

  it("moves the hero holding and profile together when position/table size changes", () => {
    let state = setSingleDrawStartingCards(initialSingleDrawState({ playerCount: 6 }), 0, holding);
    state = updateSingleDrawPlayer(state, 0, { name: "Hero", stack: 450 });
    state = updateSingleDrawPlayer(state, 2, { name: "BB", stack: 300 });
    const moved = changeSingleDrawSetup(state, { heroSeat: 2 });
    expect(moved.players[2]).toMatchObject({ seat: 2, name: "Hero", stack: 450, cards: holding });
    expect(moved.players[0]).toMatchObject({ seat: 0, name: "BB", stack: 300, cards: null });
    const smaller = changeSingleDrawSetup(moved, { playerCount: 2 });
    expect(smaller.heroSeat).toBe(1);
    expect(smaller.players[1].cards).toEqual(holding);
    expect(state.players[0].cards).toEqual(holding);
    expect(() => changeSingleDrawSetup(startSingleDrawHand(state), { bb: 4 })).toThrow("locked");
  });

  it("retains discarded cards as unavailable when editing a shown hand", () => {
    const state = initialSingleDrawState({ playerCount: 2 });
    state.players[0].startingCards = [...holding];
    state.players[0].cards = ["3♥", ...holding.slice(1)];
    state.players[1].cards = ["8♠", "6♥", "4♦", "3♣", "2♥"];
    state.draws = [{ round: 1, seat: 0, count: 1, discardIndexes: [0], discardedCards: ["A♠"], replacementCards: ["3♥"] }];
    const used = knownSingleDrawCards(state, 1);
    expect(used.has("A♠")).toBe(true);
    expect(used.has("3♥")).toBe(true);
    expect(used.has("8♠")).toBe(false);
  });

  it("caps calls and disables raises when a short stack cannot cover the bet", () => {
    let state = initialSingleDrawState({ playerCount: 2 });
    state = updateSingleDrawPlayer(state, 0, { stack: 1.5 });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, holding));
    const sizing = singleDrawSizing(state, deriveSingleDrawBetting(state)!);
    expect(sizing).toEqual({ minimum: 1.5, maximum: 1.5, call: 0.5, canRaise: false });
  });

  it("labels recorded draw hands correctly on both dashboards", () => {
    const hand = getSampleHand();
    hand._full = { ...hand._full!, schemaVersion: 2, game: { family: "draw", variant: "2-7_SINGLE_DRAW", bettingStructure: "NL" } };
    expect(gameTypeOf(hand)).toBe("2-7_SINGLE_DRAW");
    expect(holeCountOf(hand)).toBe(5);
    expect(gameTypeOf(getSampleHand())).toBe("NLHE");
  });
});

function MobileTable(props: ComponentProps<typeof DrawTable>) {
  return createElement(VerticalDrawFelt, { ...props, onHeroCardSlot: props.onToggleHero, discarding: !!props.onToggleHero });
}

describe.each([{ name: "desktop", Table: DrawTable }, { name: "mobile", Table: MobileTable }])("$name draw felt rendering", ({ Table }) => {
  const players = [{ seat: 0, name: "Hero", stack: 200 }, { seat: 1, name: "Opponent", stack: 200 }];
  const hero: DrawReplayCard[] = holding.map((card) => ({ present: true, visibility: "up", card }));
  const hidden: DrawReplayCard[] = Array.from({ length: 5 }, () => ({ present: true, visibility: "down" }));

  it("renders actual empty slots instead of backs during the hero exchange", () => {
    const slots = hero.map((slot, index) => [0, 3].includes(index) ? { present: false, visibility: "down" as const } : slot);
    const html = renderToStaticMarkup(createElement(Table, { players, heroSeat: 0, cards: { 0: slots, 1: hidden }, pot: 4, round: "Draw" }));
    expect(html.match(/aria-label="Empty card slot"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Hidden card"/g)).toHaveLength(5);
    expect(html).toContain('aria-label="7♥"');
    expect(html).not.toContain('aria-label="A♠"');
  });

  it("makes discard selection accessible without changing kept cards", () => {
    const html = renderToStaticMarkup(createElement(Table, {
      players, heroSeat: 0, cards: { 0: hero, 1: hidden }, pot: 4, round: "Draw", selected: [0, 3], onToggleHero: () => {},
    }));
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Discard hero card 1 A♠"');
    expect(html).toContain('aria-label="Discard hero card 2 7♥"');
  });

  it("honors visibility even if a hidden slot contains a stored identity", () => {
    const html = renderToStaticMarkup(createElement(Table, {
      players, heroSeat: 0, cards: { 0: hero, 1: hidden.map((slot) => ({ ...slot, card: "8♠" })) }, pot: 4, round: "Predraw",
    }));
    expect(html).not.toContain('aria-label="8♠"');
    expect(html.match(/aria-label="Hidden card"/g)).toHaveLength(5);
  });

  it("keeps anonymous identities hidden in the departing-card animation", () => {
    const slots = hidden.map((slot, index) => index === 0 ? { ...slot, present: false } : slot);
    const html = renderToStaticMarkup(createElement(Table, {
      players, heroSeat: 0, cards: { 0: hero, 1: slots }, pot: 4, round: "Draw",
      previousCards: { 0: hero, 1: hidden.map((slot) => ({ ...slot, card: "8♠" })) },
    }));
    expect(html).toContain('class="smh-draw-card-leave"');
    expect(html).not.toContain("8♠");
    expect(html.match(/aria-label="Empty card slot"/g)).toHaveLength(1);
  });
});
