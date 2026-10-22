import type { ActionType, GameType } from "./engine";

/**
 * Version 1 is the existing community-card payload. Version 2 introduces
 * an explicit game descriptor and an event timeline for draw/stud hands.
 * Fields remain optional on SavedHand so every pre-v2 row still loads.
 */
export const CURRENT_HAND_SCHEMA_VERSION = 2 as const;
export type HandSchemaVersion = 1 | typeof CURRENT_HAND_SCHEMA_VERSION;

export type GameFamily = "community" | "draw" | "stud";
export type BettingStructure = "NL" | "PL" | "FL";
export type CommunityVariant = GameType;
export type DrawVariant = "2-7_SINGLE_DRAW" | "2-7_TRIPLE_DRAW";
export type StudVariant = "STUD_HIGH" | "RAZZ" | "STUD_HILO_8";

export type CommunityGameDefinition = {
  family: "community";
  variant: CommunityVariant;
  bettingStructure: "NL" | "PL";
};

export type DrawGameDefinition = {
  family: "draw";
  variant: DrawVariant;
  bettingStructure: "NL" | "FL";
};

export type StudGameDefinition = {
  family: "stud";
  variant: StudVariant;
  bettingStructure: "FL";
};

export type GameDefinition =
  | CommunityGameDefinition
  | DrawGameDefinition
  | StudGameDefinition;

export type CardId = string;
export type CardVisibility = "up" | "down";
export type ForcedBetKind =
  | "ante"
  | "small-blind"
  | "big-blind"
  | "straddle"
  | "bring-in"
  | "completion";

type TimelineEventBase = {
  /** Stable identifier used by annotations and replay navigation. */
  id: string;
  /** Variant-native round id: preflop, draw-1, fourth-street, etc. */
  round: string;
};

export type HandTimelineEvent =
  | (TimelineEventBase & {
      type: "forced-bet";
      seat: number;
      kind: ForcedBetKind;
      amount: number;
    })
  | (TimelineEventBase & {
      type: "deal";
      seat: number;
      /** Unknown opponent downcards intentionally omit the card value. */
      card?: CardId;
      cardIndex: number;
      visibility: CardVisibility;
    })
  | (TimelineEventBase & {
      type: "action";
      seat: number;
      action: ActionType;
      amount?: number;
    })
  | (TimelineEventBase & {
      type: "draw";
      seat: number;
      count: number;
      /** Exact cards are normally present for hero only. */
      discardedCards?: CardId[];
      replacementCards?: CardId[];
    })
  | (TimelineEventBase & {
      type: "show";
      seat: number;
      cards: CardId[];
    })
  | (TimelineEventBase & {
      type: "muck";
      seat: number;
    });

export function communityGameDefinition(
  gameType: GameType = "NLHE",
): CommunityGameDefinition {
  return {
    family: "community",
    variant: gameType,
    bettingStructure: gameType === "NLHE" ? "NL" : "PL",
  };
}

/**
 * Normalize old and new payload metadata into one descriptor. Old rows only
 * carry gameType (or no game field at all), so they remain community games.
 */
export function gameDefinitionOf(input?: {
  game?: GameDefinition;
  gameType?: GameType;
} | null): GameDefinition {
  return input?.game ?? communityGameDefinition(input?.gameType ?? "NLHE");
}
