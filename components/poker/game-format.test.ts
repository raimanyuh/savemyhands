import { describe, expect, it } from "vitest";
import {
  CURRENT_HAND_SCHEMA_VERSION,
  gameDefinitionOf,
  type GameDefinition,
  type HandTimelineEvent,
} from "./game-format";

describe("game format compatibility", () => {
  it("keeps metadata-free legacy hands as no-limit Hold'em", () => {
    expect(gameDefinitionOf()).toEqual({
      family: "community",
      variant: "NLHE",
      bettingStructure: "NL",
    });
  });

  it("maps legacy Omaha metadata to pot limit", () => {
    expect(gameDefinitionOf({ gameType: "PLO5" })).toEqual({
      family: "community",
      variant: "PLO5",
      bettingStructure: "PL",
    });
  });

  it("preserves an explicit v2 draw descriptor", () => {
    const game: GameDefinition = {
      family: "draw",
      variant: "2-7_SINGLE_DRAW",
      bettingStructure: "NL",
    };
    expect(gameDefinitionOf({ game, gameType: "NLHE" })).toBe(game);
    expect(CURRENT_HAND_SCHEMA_VERSION).toBe(2);
  });

  it("represents unknown opponent draws without inventing cards", () => {
    const event: HandTimelineEvent = {
      id: "draw-1-seat-3",
      type: "draw",
      round: "draw-1",
      seat: 3,
      count: 2,
    };
    expect(event).toEqual({
      id: "draw-1-seat-3",
      type: "draw",
      round: "draw-1",
      seat: 3,
      count: 2,
    });
  });
});
