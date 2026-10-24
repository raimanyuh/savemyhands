import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialState } from "./engine";
import { CardRow } from "./CardPicker";
import StudTable, { StudCards, studSeatXY } from "./StudTable";
import VerticalStudFelt, { MobileStudCards, mobileStudSeatCoords, mobileStudFeltHeight } from "@/components/mobile/VerticalStudFelt";
import { changeStudSetup, missingStudSetupSeats, studDraftFromCommunity, studRecorderCards, studSizing } from "./stud-ui";
import {
  deriveStudBetting, initialStudState, setStudStartingCards, startStudHand,
  undoStud, updateStudPlayer,
} from "./stud-engine";
import type { StudReplayCard } from "./stud-replay";

const heroCards = ["A♠","K♥","Q♦"];
function setup() {
  let state = setStudStartingCards(initialStudState({ playerCount: 3 }), 0, heroCards);
  state = setStudStartingCards(state, 1, [null,null,"2♣"]);
  return setStudStartingCards(state, 2, [null,null,"J♣"]);
}
describe("Stud UI state derivations", () => {
  it("retains names, stacks and metadata when switching families, with a fresh three-card holding", () => {
    const community = initialState();
    community.heroPosition = 2;
    community.players[2] = { ...community.players[2], name: "Hero", stack: 450, cards: ["A♠","A♥"] };
    community.handName = "Stud night";
    community.notes = "A read";
    const draft = studDraftFromCommunity(community);
    expect(draft).toMatchObject({ name: "Stud night", notes: "A read", state: { heroSeat: 2, smallBet: 2, ante: .25, bringIn: 1 } });
    expect(draft.state.players[2]).toMatchObject({ name: "Hero", stack: 450 });
    expect(draft.state.players[2].cards.every((slot) => !slot.card)).toBe(true);
    expect(community.players[2].cards).toEqual(["A♠","A♥"]);
  });
  it("moves the hero holding and profile together while preserving other door cards and undo", () => {
    let state = updateStudPlayer(setup(), 0, { stack: 450 });
    state = updateStudPlayer(state, 2, { name: "Other", stack: 300 });
    const moved = changeStudSetup(state, { heroSeat: 2 });
    expect(moved.players[2]).toMatchObject({ seat: 2, name: "Hero", stack: 450 });
    expect(moved.players[2].cards.map((slot) => slot.card)).toEqual(heroCards);
    expect(moved.players[0]).toMatchObject({ name: "Other", stack: 300 });
    expect(moved.players[0].cards[2].card).toBe("J♣");
    expect(moved.players[1].cards[2].card).toBe("2♣");
    expect(undoStud(moved)).toEqual(state);
    expect(changeStudSetup(moved, { ante: moved.ante })).toBe(moved);
    const smaller = changeStudSetup(moved, { playerCount: 2 });
    expect(smaller).toMatchObject({ playerCount: 2, heroSeat: 1, dealerSeat: 1 });
    expect(smaller.players[1].cards.map((slot) => slot.card)).toEqual(heroCards);
    expect(() => changeStudSetup(startStudHand(state), { ante: 1 })).toThrow("locked");
  });
  it("gates Start on every door card and all three hero cards", () => {
    const state = initialStudState({ playerCount: 3 });
    expect(missingStudSetupSeats(state)).toEqual([0,1,2]);
    expect(missingStudSetupSeats(setup())).toEqual([]);
  });
  it("caps calls and fixed-limit targets at the active stack", () => {
    const state = startStudHand(updateStudPlayer(setup(), 2, { stack: .75 }));
    const betting = deriveStudBetting(state)!;
    expect(studSizing(state, betting)).toMatchObject({ call: .5, minimum: .5, canRaise: false });
  });
  it("never derives opponent downcard identities before showdown, even if present in memory", () => {
    const state = setup();
    state.players[1].cards[0].card = "8♠";
    const cards = studRecorderCards(state);
    expect(cards[1][0]).toEqual({ present: true, visibility: "down", faceUp: false });
    expect(cards[1][2]).toMatchObject({ present: true, faceUp: true, card: "2♣" });
    expect(cards[0][0]).toMatchObject({ visibility: "down", faceUp: true, card: "A♠" });
    expect(cards[0].slice(3).every((slot) => !slot.present)).toBe(true);
  });
});

describe("Mobile Stud felt", () => {
  it("keeps unknown downcards separate from future slots and hero identities", () => {
    const hidden = renderToStaticMarkup(createElement(MobileStudCards, { slots: slots.map((slot, index) => index === 0 ? { ...slot, card: "K♠" } : slot) }));
    expect(hidden.match(/aria-label="Hidden card"/g)).toHaveLength(2);
    expect(hidden.match(/aria-label="Empty card slot"/g)).toHaveLength(4);
    expect(hidden).not.toContain("K♠");
    const hero = renderToStaticMarkup(createElement(MobileStudCards, { hero: true, slots: studRecorderCards(setup())[0] }));
    expect(hero).toContain('aria-label="A♠" data-card-slot="1" data-dealt="down"');
  });
  it("never leaks identities through departing anonymous downcards", () => {
    const previousSlots = slots.map((slot) => ({ ...slot, card: slot.faceUp ? slot.card : "K♠" }));
    const html = renderToStaticMarkup(createElement(MobileStudCards, { slots: slots.map((slot) => ({ ...slot, present: false })), previousSlots }));
    expect(html).toContain("smh-draw-card-leave");
    expect(html).not.toContain("K♠");
  });
  it("provides touch targets only for editable slots in a shown hand", () => {
    const html = renderToStaticMarkup(createElement(MobileStudCards, { hero: true, slots, onSlot: () => {}, editableIndexes: [0,1,6], labelPrefix: "Shown card" }));
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Shown card 3 2♣ · locked"');
    expect(html).toContain('aria-label="Shown card 7"');
  });
  it("does not expose future hero cards as setup controls", () => {
    const html = renderToStaticMarkup(createElement(VerticalStudFelt, { players: setup().players, heroSeat: 0, dealerSeat: 2, cards: studRecorderCards(setup()), pot: 0, round: "Setup", onHeroCardSlot: () => {} }));
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).not.toContain("BTN");
  });
  it("animates a muck without exposing anonymous values or moving its plate", () => {
    const state = setup();
    const previousCards = studRecorderCards(state);
    previousCards[1][0].card = "K♠";
    const cards = { ...previousCards, 1: previousCards[1].map((slot) => ({ ...slot, present: false, faceUp: false })) };
    const html = renderToStaticMarkup(createElement(VerticalStudFelt, { players: state.players, heroSeat: 0, dealerSeat: 2, cards, previousCards, mucked: [1], pot: 10, round: "Showdown" }));
    expect(html).toContain("smh-draw-card-leave");
    expect(html).not.toContain("K♠");
    expect(html).toContain("height:53px");
  });
  it("renders one shared river with all eight physical seats and hides mucked cards", () => {
    const state = initialStudState({ playerCount: 8, heroSeat: 3 });
    const cards = Object.fromEntries(state.players.map((player) => [player.seat, slots]));
    const html = renderToStaticMarkup(createElement(VerticalStudFelt, { players: state.players, heroSeat: 3, dealerSeat: 7, cards, pot: 10, round: "Seventh street", mucked: [1], sharedCard: { present: true, visibility: "up", faceUp: true, card: "A♦" } }));
    expect(html.match(/aria-label="Shared seventh card"/g)).toHaveLength(1);
    expect(html.match(/data-stud-seat=/g)).toHaveLength(8);
    expect(html.match(/aria-label="2♣"/g)).toHaveLength(7);
  });
  it("has a portrait arrangement for every table size, with a separate hero band", () => {
    for (let count = 2; count <= 8; count++) {
      const coords = mobileStudSeatCoords(count);
      expect(coords).toHaveLength(count);
      expect(coords[0]).toEqual({ left: 50, top: 90 });
      expect(new Set(coords.map((point) => `${point.left},${point.top}`)).size).toBe(count);
      expect(coords.slice(1).every((point) => point.top <= 64 && point.left >= 23 && point.left <= 77)).toBe(true);
      expect(mobileStudFeltHeight(count)).toBeGreaterThanOrEqual(400);
    }
  });
});

const slots: StudReplayCard[] = Array.from({ length: 7 }, (_, i) => ({ present: i < 3, visibility: i < 2 || i === 6 ? "down" : "up", faceUp: i === 2, ...(i === 2 ? { card: "2♣" } : {}) }));
describe("Stud felt and locked showdown cards", () => {
  it("distinguishes unknown downcards from cards not yet dealt", () => {
    const html = renderToStaticMarkup(createElement(StudCards, { slots }));
    expect(html.match(/aria-label="Hidden card"/g)).toHaveLength(2);
    expect(html.match(/aria-label="Empty card slot"/g)).toHaveLength(4);
    expect(html).toContain('aria-label="2♣"');
    expect(html).toContain('data-card-slot="7" data-dealt="down"');
  });
  it("hides accidental downcard values in both current and departing cards", () => {
    const poisoned = slots.map((slot, index) => index < 2 ? { ...slot, card: "8♠" } : slot);
    const html = renderToStaticMarkup(createElement(StudCards, { slots: poisoned }));
    expect(html).not.toContain("8♠");
    const departed = renderToStaticMarkup(createElement(StudCards, { slots: slots.map((slot) => ({ ...slot, present: false })), previousSlots: poisoned }));
    expect(departed).toContain("smh-draw-card-leave");
    expect(departed).not.toContain("8♠");
  });
  it("shows hero hole cards while retaining their downcard orientation", () => {
    const html = renderToStaticMarkup(createElement(StudCards, { hero: true, slots: slots.map((slot, index) => index < 2 ? { ...slot, faceUp: true, card: heroCards[index] } : slot) }));
    expect(html).toContain('aria-label="A♠" data-card-slot="1" data-dealt="down"');
    expect(html).toContain('aria-label="K♥" data-card-slot="2" data-dealt="down"');
  });
  it("renders a shared seventh once, separately from personal cards", () => {
    const html = renderToStaticMarkup(createElement(StudTable, { players: [{ seat: 0, name: "Hero", stack: 200 }, { seat: 1, name: "Other", stack: 200 }], heroSeat: 0, dealerSeat: 1, cards: { 0: slots, 1: slots }, pot: 10, round: "Seventh street", sharedCard: { present: true, visibility: "up", faceUp: true, card: "A♦" } }));
    expect(html.match(/aria-label="Shared seventh card"/g)).toHaveLength(1);
    expect(html).toContain("Shared 7th");
    expect(html).not.toContain("BTN");
    for (let seat = 0; seat < 8; seat++) { const pos = studSeatXY(seat, 8); expect(pos.left).toBeGreaterThanOrEqual(15); expect(pos.left).toBeLessThanOrEqual(85); }
  });
  it("prevents clearing locked exposed cards and disables clears while saving", () => {
    const props = { cards: ["A♠","K♥","2♣","3♦"], used: new Set<string>(), onPick: () => {}, onClear: () => {}, lockedIndexes: [2,3] };
    const html = renderToStaticMarkup(createElement(CardRow, props));
    expect(html.match(/aria-label="Clear card"/g)).toHaveLength(2);
    const disabled = renderToStaticMarkup(createElement(CardRow, { ...props, disabled: true }));
    expect(disabled).not.toContain('aria-label="Clear card"');
  });
});
