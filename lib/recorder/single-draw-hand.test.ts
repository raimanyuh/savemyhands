import { describe, expect, it, vi } from "vitest";
import {
  advanceSingleDrawPhase,
  deriveSingleDrawBetting,
  initialSingleDrawState,
  recordSingleDrawAction,
  recordSingleDrawDecision,
  setSingleDrawMucked,
  setSingleDrawShownCards,
  setSingleDrawStartingCards,
  singleDrawCommittedBySeatFinal,
  startSingleDrawHand,
  updateSingleDrawPlayer,
  type SingleDrawState,
} from "@/components/poker/single-draw-engine";
import {
  committedThroughStep, computeStreetBets, hasFolded, potTypeOf,
  recordedToHand, type SavedHand,
} from "@/components/poker/hand";
import { singleDrawToReplay } from "@/components/poker/single-draw-replay";
import { assertPayloadSize, clampSavedHand } from "@/lib/hands/limits";
import { saveHandAction } from "@/lib/hands/actions";
import { buildAndSaveSingleDrawHand } from "./save-hand";
import { buildSingleDrawHand } from "./single-draw-hand";

vi.mock("@/lib/hands/actions", () => ({ saveHandAction: vi.fn() }));

const initialCards = ["A♠", "7♥", "5♦", "4♣", "2♠"];
const sevenLow = ["7♠", "5♥", "4♦", "3♣", "2♥"];
const eightLow = ["8♠", "6♥", "4♦", "3♣", "2♥"];
const nineLow = ["9♠", "8♥", "6♦", "5♣", "2♦"];
const details = { name: "  Single Draw night  ", date: "2026-10-22", venue: "  Home  ", notes: "  Draw two  " };

function start(playerCount = 3, heroSeat = 0, heroCards = initialCards): SingleDrawState {
  return startSingleDrawHand(setSingleDrawStartingCards(
    initialSingleDrawState({ playerCount, heroSeat }), heroSeat, [...heroCards],
  ));
}

function checkedShowdown(): SingleDrawState {
  let state = start();
  state = recordSingleDrawAction(state, { seat: 0, action: "raise", amount: 6 });
  state = recordSingleDrawAction(state, { seat: 1, action: "call" });
  state = recordSingleDrawAction(state, { seat: 2, action: "call" });
  state = advanceSingleDrawPhase(state);
  state = recordSingleDrawDecision(state, { seat: 1, count: 2 });
  state = recordSingleDrawDecision(state, { seat: 2, count: 0 });
  state = recordSingleDrawDecision(state, {
    seat: 0, count: 2, discardIndexes: [3, 0], replacementCards: ["6♣", "3♥"],
  });
  state = advanceSingleDrawPhase(state);
  for (const seat of [1, 2, 0]) state = recordSingleDrawAction(state, { seat, action: "check" });
  return advanceSingleDrawPhase(state);
}

function completed(): SingleDrawState {
  let state = setSingleDrawShownCards(checkedShowdown(), 1, eightLow);
  state = setSingleDrawMucked(state, 2, true);
  return state;
}

function saved(state: SingleDrawState): SavedHand {
  // Same clamp + JSON representation used by the server/jsonb persistence.
  const hand = clampSavedHand({ ...buildSingleDrawHand({ state, ...details }), id: "draw1234" });
  assertPayloadSize(hand);
  return JSON.parse(JSON.stringify(hand)) as SavedHand;
}

function patToShowdown(state: SingleDrawState): SingleDrawState {
  state = advanceSingleDrawPhase(state);
  for (const seat of state.exchange!.order) {
    state = recordSingleDrawDecision(state, { seat, count: 0 });
  }
  state = advanceSingleDrawPhase(state);
  while (state.phase === "postdraw") {
    const activeSeat = deriveSingleDrawBetting(state)!.activeSeat;
    if (activeSeat === null) state = advanceSingleDrawPhase(state);
    else state = recordSingleDrawAction(state, { seat: activeSeat, action: "check" });
  }
  return state;
}

describe("Single Draw save → load → replay", () => {
  it("rejects a Stud shared-card event in a draw payload", () => {
    const hand = saved(completed());
    hand._full!.timeline!.push({ id: "stud-only", round: "seventh-street", type: "shared-deal", card: "T♠", cardIndex: 6, visibility: "up" });
    expect(() => singleDrawToReplay(hand)).toThrow("shared Stud card");
    expect(() => recordedToHand(hand)).toThrow("shared Stud card");
  });

  it("persists schema-v2 metadata, the full timeline and dashboard result", () => {
    const state = completed();
    const hand = saved(state);
    expect(hand).toMatchObject({
      id: "draw1234", name: "Single Draw night", date: "Oct 22, 26",
      stakes: "1/2", loc: "Home", positions: "BTN", multiway: true,
      type: "SRP", result: 12, notes: "Draw two", tags: [], fav: false,
      board: ["—", "—", "—", "—", "—"],
      _full: {
        schemaVersion: 2,
        game: { family: "draw", variant: "2-7_SINGLE_DRAW", bettingStructure: "NL" },
        heroPosition: 0, sb: 1, bb: 2, playerCount: 3,
        date: "2026-10-22", venue: "Home", notes: "Draw two", muckedSeats: [2],
        actions: [], board: [],
      },
    });
    expect(hand._full!.players.map((player) => player.stack)).toEqual([200, 200, 200]);
    expect(hand._full!.timeline!.filter((event) => event.type === "deal")).toHaveLength(15);
    expect(hand._full!.timeline!.filter((event) => event.type === "deal" && event.seat !== 0)
      .every((event) => !("card" in event))).toBe(true);
    expect(hand._full!.timeline!.filter((event) => event.type === "show").map((event) => event.seat)).toEqual([0, 1]);
    expect(hand._full!.timeline!.at(-1)).toMatchObject({ type: "muck", seat: 2 });
    expect(potTypeOf({ ...hand, type: "LP" })).toBe("SRP");
    const replay = recordedToHand(hand)!;
    expect(replay.game).toEqual(hand._full!.game);
    expect([...new Set(replay.steps.map((step) => step.street))]).toEqual([
      "initial-deal", "predraw", "draw-1", "postdraw", "showdown",
    ]);
    expect(replay.steps.at(-1)).toMatchObject({ pot: 18, winner: 0, committedAfter: singleDrawCommittedBySeatFinal(state) });
  });

  it("removes exact hero slots before replacement, preserving kept cards and old snapshots", () => {
    const replay = singleDrawToReplay(saved(completed()))!;
    const before = replay.steps.find((step) => step.draw.kind === "round-end")!;
    expect(before.draw.cards[0].map((slot) => slot.card)).toEqual(initialCards);
    const discard = replay.steps.find((step) => step.active === 0 && step.draw.stage === "discard")!;
    const replace = replay.steps.find((step) => step.active === 0 && step.draw.stage === "replace")!;
    expect(discard.draw.eventId).toBe(replace.draw.eventId);
    expect(discard.draw.cardIndexes).toEqual([3, 0]);
    expect(discard.draw.cards[0].map((slot) => slot.present)).toEqual([false, true, true, false, true]);
    expect(discard.draw.cards[0][0].card).toBeUndefined();
    expect(discard.draw.cards[0][3].card).toBeUndefined();
    expect(replace.draw.cards[0].map((slot) => slot.card)).toEqual(["3♥", "7♥", "5♦", "6♣", "2♠"]);
    expect(before.draw.cards[0].map((slot) => slot.card)).toEqual(initialCards);
    replace.draw.cards[0][1].present = false;
    expect(discard.draw.cards[0][1].present).toBe(true);
  });

  it("animates anonymous opponent backs and reveals only on each show event", () => {
    const replay = singleDrawToReplay(saved(completed()))!;
    expect(replay.players.every((player) => player.cards === null)).toBe(true);
    const discard = replay.steps.find((step) => step.active === 1 && step.draw.stage === "discard")!;
    const replace = replay.steps.find((step) => step.active === 1 && step.draw.stage === "replace")!;
    expect(discard.draw.cards[1].filter((slot) => slot.present)).toHaveLength(3);
    expect(replace.draw.cards[1].filter((slot) => slot.present)).toHaveLength(5);
    const revealIndex = replay.steps.findIndex((step) => step.draw.kind === "show" && step.active === 1);
    expect(replay.steps.slice(0, revealIndex).every((step) =>
      step.draw.cards[1].every((slot) => slot.card === undefined && slot.visibility === "down"))).toBe(true);
    expect(replay.steps[revealIndex].draw.cards[1].map((slot) => slot.card)).toEqual(eightLow);
    expect(replay.steps.at(-1)!.draw.cards[2].every((slot) => !slot.present && !slot.card)).toBe(true);
    expect(replay.steps.at(-1)!.draw.muckedSeats).toEqual([2]);
    expect(replay.steps.filter((step) => step.active === 2 && step.draw.stage === "pat")).toHaveLength(1);
  });

  it("uses only timeline identities even when final player cards differ", () => {
    const hand = saved(completed());
    const original = singleDrawToReplay(hand);
    hand._full!.players.forEach((player) => { player.cards = ["K♣", "Q♣", "J♣", "T♣", "9♣"]; });
    hand._full!.muckedSeats = [];
    expect(singleDrawToReplay(hand)).toEqual(original);
  });

  it("returns blinds when folds end a hand and retains a non-button hero seat", () => {
    let state = start(3, 2, sevenLow);
    state = recordSingleDrawAction(state, { seat: 0, action: "fold" });
    state = recordSingleDrawAction(state, { seat: 1, action: "fold" });
    state = advanceSingleDrawPhase(state);
    const hand = saved(state);
    const replay = singleDrawToReplay(hand)!;
    expect(hand.positions).toBe("BB");
    expect(hand.result).toBe(1);
    expect(hand.multiway).toBe(false);
    expect(replay.heroPosition).toBe(2);
    expect(replay.steps.some((step) => step.draw.kind === "show" || step.street === "draw-1")).toBe(false);
    expect(replay.steps.find((step) => step.draw.kind === "round-end")).toMatchObject({ pot: 2, draw: { refunds: { 2: 1 } } });
    const last = replay.steps.length - 1;
    expect(replay.steps[last]).toMatchObject({ pot: 2, winner: 2, draw: { foldedSeats: [0, 1] } });
    expect(hasFolded(replay.steps, last, 0)).toBe(true);
    expect(committedThroughStep(replay.steps, last, replay)).toEqual({ 1: 1, 2: 1 });
    expect(computeStreetBets(replay.steps, last, replay)).toEqual({});
  });

  it("caps short blinds/calls, lets all-ins draw five, and skips postdraw betting", () => {
    let state = initialSingleDrawState({ playerCount: 2 });
    state = updateSingleDrawPlayer(state, 0, { name: "Pat", stack: 3.5 });
    state = updateSingleDrawPlayer(state, 1, { name: "Short", stack: 1.5 });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, sevenLow));
    state = recordSingleDrawAction(state, { seat: 0, action: "call" });
    state = advanceSingleDrawPhase(state);
    state = recordSingleDrawDecision(state, { seat: 1, count: 5 });
    state = recordSingleDrawDecision(state, { seat: 0, count: 0 });
    state = advanceSingleDrawPhase(state);
    state = setSingleDrawShownCards(state, 1, nineLow);
    const hand = saved(state);
    const replay = singleDrawToReplay(hand)!;
    expect(hand.result).toBe(1.5);
    expect(hand.positions).toBe("BTN/SB");
    expect(replay.players.map((player) => player.name)).toEqual(["Pat", "Short"]);
    expect(replay.steps.some((step) => step.street === "postdraw")).toBe(false);
    expect(replay.steps.find((step) => step.draw.stage === "discard")!.draw.cards[1].filter((slot) => slot.present)).toHaveLength(0);
    expect(replay.steps.at(-1)).toMatchObject({ pot: 3, committedAfter: { 0: 1.5, 1: 1.5 } });
    for (const step of replay.steps) {
      expect(step.pot).toBeCloseTo(Object.values(step.committedAfter!).reduce((sum, amount) => sum + amount, 0));
      for (const [seat, amount] of Object.entries(step.committedAfter!)) {
        expect(amount).toBeLessThanOrEqual(state.players[Number(seat)].stack);
      }
    }
  });

  it("resets wagers after the draw and refunds an uncalled postdraw raise", () => {
    let state = start(2, 0, sevenLow);
    state = recordSingleDrawAction(state, { seat: 0, action: "call" });
    state = recordSingleDrawAction(state, { seat: 1, action: "check" });
    state = advanceSingleDrawPhase(state);
    for (const seat of [1, 0]) state = recordSingleDrawDecision(state, { seat, count: 0 });
    state = advanceSingleDrawPhase(state);
    state = recordSingleDrawAction(state, { seat: 1, action: "bet", amount: 10 });
    state = recordSingleDrawAction(state, { seat: 0, action: "raise", amount: 30 });
    state = recordSingleDrawAction(state, { seat: 1, action: "fold" });
    state = advanceSingleDrawPhase(state);
    const hand = saved(state);
    const replay = singleDrawToReplay(hand)!;
    expect(hand.result).toBe(12);
    expect(replay.steps.find((step) => step.street === "draw-1")!.streetBetsAfter).toEqual({});
    expect(replay.steps.find((step) => step.action === "bet 10")).toMatchObject({ active: 1, pot: 14, streetBetsAfter: { 1: 10 }, committedAfter: { 0: 2, 1: 12 } });
    expect(replay.steps.find((step) => step.street === "postdraw" && step.draw.kind === "round-end"))
      .toMatchObject({ pot: 24, streetBetsAfter: { 0: 10, 1: 10 }, committedAfter: { 0: 12, 1: 12 }, draw: { refunds: { 0: 20 } } });
    expect(replay.steps.at(-1)).toMatchObject({ winner: 0, pot: 24 });
  });

  it("keeps the call price after a short all-in raise", () => {
    let state = initialSingleDrawState({ playerCount: 3 });
    state = updateSingleDrawPlayer(state, 1, { stack: 8 });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, sevenLow));
    state = recordSingleDrawAction(state, { seat: 0, action: "raise", amount: 6 });
    state = recordSingleDrawAction(state, { seat: 1, action: "raise", amount: 8 });
    for (const seat of [2, 0]) state = recordSingleDrawAction(state, { seat, action: "call" });
    state = patToShowdown(state);
    state = setSingleDrawMucked(state, 1, true);
    state = setSingleDrawShownCards(state, 2, nineLow);
    const hand = saved(state);
    const replay = singleDrawToReplay(hand)!;
    expect(replay.steps.find((step) => step.draw.eventId === "action-predraw-2"))
      .toMatchObject({ active: 2, pot: 22, committedAfter: { 0: 6, 1: 8, 2: 8 } });
    expect(replay.steps.find((step) => step.draw.eventId === "action-predraw-3"))
      .toMatchObject({ active: 0, pot: 24, committedAfter: { 0: 8, 1: 8, 2: 8 } });
    expect(hand.result).toBe(16);
  });

  it("matches recorder commitments when the capped big blind is below the small blind", () => {
    let state = initialSingleDrawState({ playerCount: 3 });
    state = updateSingleDrawPlayer(state, 2, { stack: 0.5 });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, sevenLow));
    state = recordSingleDrawAction(state, { seat: 0, action: "call" });
    state = recordSingleDrawAction(state, { seat: 1, action: "check" });
    state = patToShowdown(state);
    state = setSingleDrawMucked(state, 1, true);
    state = setSingleDrawShownCards(state, 2, nineLow);
    const replay = singleDrawToReplay(saved(state))!;
    expect(replay.steps.at(-1)!.committedAfter).toEqual(singleDrawCommittedBySeatFinal(state));
    expect(replay.steps.at(-1)!.pot).toBe(1.5);
  });

  it("can record hero mucking while preserving the earlier known hero cards", () => {
    let state = setSingleDrawMucked(checkedShowdown(), 0, true);
    state = setSingleDrawShownCards(state, 1, eightLow);
    state = setSingleDrawMucked(state, 2, true);
    const hand = saved(state);
    const replay = singleDrawToReplay(hand)!;
    expect(hand.result).toBe(-6);
    expect(replay.steps.at(-1)).toMatchObject({ winner: 1, draw: { muckedSeats: [0, 2] } });
    expect(replay.steps.at(-1)!.draw.cards[0].every((slot) => !slot.present)).toBe(true);
    expect(replay.steps.find((step) => step.draw.stage === "replace" && step.active === 0)!
      .draw.cards[0].map((slot) => slot.card)).toEqual(["3♥", "7♥", "5♦", "6♣", "2♠"]);
  });

  it("awards main and side pots separately after a predraw refund", () => {
    let state = initialSingleDrawState({ playerCount: 3 });
    for (const [seat, stack] of [20, 8, 15].entries()) state = updateSingleDrawPlayer(state, seat, { stack });
    state = startSingleDrawHand(setSingleDrawStartingCards(state, 0, eightLow));
    state = recordSingleDrawAction(state, { seat: 0, action: "raise", amount: 20 });
    for (const seat of [1, 2]) state = recordSingleDrawAction(state, { seat, action: "call" });
    state = patToShowdown(state);
    state = setSingleDrawShownCards(state, 1, ["7♠", "5♥", "4♣", "3♦", "2♣"]);
    state = setSingleDrawShownCards(state, 2, nineLow);
    const hand = saved(state);
    const replay = singleDrawToReplay(hand)!;
    expect(hand.result).toBe(-1);
    expect(replay.steps.at(-1)).toMatchObject({
      pot: 38, committedAfter: { 0: 15, 1: 8, 2: 15 },
      draw: { resolved: true, awards: [
        { amount: 24, eligibleSeats: [1, 0, 2], winners: [1] },
        { amount: 14, eligibleSeats: [0, 2], winners: [0] },
      ], winnings: { 0: 14, 1: 24 } },
    });
    expect(replay.steps.at(-1)!.committedAfter).toEqual(singleDrawCommittedBySeatFinal(state));
  });

  it("preserves tie shares and folded dead money without rounding chips away", () => {
    let state = start(3, 0, sevenLow);
    state = recordSingleDrawAction(state, { seat: 0, action: "raise", amount: 6 });
    state = recordSingleDrawAction(state, { seat: 1, action: "fold" });
    state = recordSingleDrawAction(state, { seat: 2, action: "call" });
    state = patToShowdown(state);
    state = setSingleDrawShownCards(state, 2, ["7♥", "5♦", "4♣", "3♦", "2♣"]);
    const hand = saved(state);
    const result = singleDrawToReplay(hand)!.steps.at(-1)!;
    expect(hand.result).toBe(0.5);
    expect(result).toMatchObject({ pot: 13, draw: { winnings: { 0: 6.5, 2: 6.5 } } });
    expect(result.winner).toBeUndefined();
  });

  it("blocks unfinished hands and undecided or unawardable showdowns", () => {
    expect(() => buildSingleDrawHand({ state: start(), ...details })).toThrow("Finish the hand");
    expect(() => buildSingleDrawHand({ state: checkedShowdown(), ...details })).toThrow("show or muck");
    let state = completed();
    state = setSingleDrawMucked(state, 0, true);
    state = setSingleDrawMucked(state, 1, true);
    expect(() => saved(state)).toThrow("shown eligible winner");
    expect(() => buildSingleDrawHand({ state: completed(), ...details, date: "2026-02-30" })).toThrow("valid YYYY-MM-DD");
  });

  it("rejects missing hero slots and identities that reuse a discarded card", () => {
    const hand = saved(completed());
    const event = hand._full!.timeline!.find((event) => event.type === "draw" && event.seat === 0)!;
    if (event.type !== "draw") throw new Error("Missing hero draw");
    event.discardIndexes = undefined;
    expect(() => recordedToHand(hand)).toThrow("exact discard slots");
    event.discardIndexes = [3, 0];
    event.replacementCards = ["4♣", "3♥"];
    expect(() => recordedToHand(hand)).toThrow("already unavailable");
  });

  it("dispatches non-community hands without falling through to Hold'em", () => {
    const hand = saved(completed());
    hand._full!.timeline = undefined;
    expect(recordedToHand(hand)).toBeNull();
    hand._full!.game = { family: "draw", variant: "2-7_TRIPLE_DRAW", bettingStructure: "FL" };
    expect(recordedToHand(hand)).toBeNull();
    hand._full!.game = { family: "stud", variant: "RAZZ", bettingStructure: "FL" };
    expect(recordedToHand(hand)).toBeNull();
  });

  it("saves through the existing server action and propagates failures", async () => {
    const state = completed();
    vi.mocked(saveHandAction).mockResolvedValueOnce({ ...buildSingleDrawHand({ state, ...details }), id: "serverid" });
    await expect(buildAndSaveSingleDrawHand({ state, ...details })).resolves.toEqual({ id: "serverid" });
    expect(saveHandAction).toHaveBeenLastCalledWith(buildSingleDrawHand({ state, ...details }));
    vi.mocked(saveHandAction).mockRejectedValueOnce(new Error("Save failed"));
    await expect(buildAndSaveSingleDrawHand({ state, ...details })).rejects.toThrow("Save failed");
  });
});
