import { describe, expect, it } from "vitest";
import { getSampleHand } from "@/lib/sample-hand";
import { getSampleReplayHand } from "@/components/landing/sample-hand";
import { communityGameDefinition } from "./game-format";
import { recordedToHand } from "./hand";

describe("community replay compatibility", () => {
  it("loads the existing schema-v1 NLHE sample with actions, boards and annotations", () => {
    const replay = recordedToHand(getSampleHand())!;
    expect(replay.schemaVersion).toBe(1);
    expect(replay.game).toEqual(communityGameDefinition());
    expect(replay.steps).toHaveLength(19);
    expect(replay.steps[0]).toMatchObject({ street: "preflop", pot: 3 });
    expect(replay.steps.find((step) => step.actionIndex === 3)).toMatchObject({
      street: "preflop", active: 0, action: "raise 24", pot: 35,
      annotation: getSampleHand()._full!.annotations![3],
    });
    expect(replay.steps.find((step) => step.street === "river")!.board).toEqual(getSampleHand().board);
    expect(replay.steps.at(-1)).toMatchObject({ street: "showdown", pot: 271, winner: 5 });
    expect(replay.steps.every((step) => step.draw === undefined)).toBe(true);
  });

  it.each(["NLHE", "PLO4", "PLO5"] as const)("keeps schema-v2 %s replay identical to its legacy counterpart", (gameType) => {
    const old = structuredClone(getSampleHand());
    old._full!.gameType = gameType;
    if (gameType !== "NLHE") {
      old._full!.players[0].cards = ["A♥", "K♥", "8♠", "6♠", ...(gameType === "PLO5" ? ["2♠"] : [])];
      old._full!.players[5].cards = ["Q♣", "J♣", "T♠", "9♠", ...(gameType === "PLO5" ? ["4♠"] : [])];
    }
    const modern = structuredClone(old);
    modern._full!.schemaVersion = 2;
    modern._full!.game = communityGameDefinition(gameType);
    const legacy = recordedToHand(old)!;
    expect(recordedToHand(modern)).toEqual({ ...legacy, schemaVersion: 2 });
  });

  it("retains the PLO4 double-board landing sample", () => {
    const replay = getSampleReplayHand();
    expect(replay.game).toEqual(communityGameDefinition("PLO4"));
    expect(replay.doubleBoardOn).toBe(true);
    expect(replay.steps.find((step) => step.street === "flop")).toMatchObject({
      board: ["K♦", "J♥", "4♣"], board2: ["T♠", "9♥", "6♣"],
    });
    expect(replay.steps.at(-1)!.pot).toBe(1001);
  });

  it("keeps bomb-pot antes and board progression", () => {
    const hand = structuredClone(getSampleHand());
    hand._full!.bombPotOn = true;
    hand._full!.bombPotAmt = 5;
    hand._full!.actions = [];
    const replay = recordedToHand(hand)!;
    expect(replay.steps[0]).toMatchObject({ street: "preflop", pot: 30, label: "Bomb pot — antes $5" });
    expect(replay.steps[1]).toMatchObject({ street: "flop", pot: 30, streetBetsAfter: {} });
  });
});
