import { CURRENT_HAND_SCHEMA_VERSION } from "@/components/poker/game-format";
import type { SavedHand } from "@/components/poker/hand";
import { buildStudTimeline, studResult, type StudState } from "@/components/poker/stud-engine";
import { studToReplay } from "@/components/poker/stud-replay";

export type BuildStudHandArgs = {
  state: StudState;
  name?: string;
  /** Local calendar date, YYYY-MM-DD; supplied by the recorder. */
  date: string;
  venue?: string;
  notes?: string;
};

/** Pure Stud payload builder. The legacy board/actions/blinds and pot-type
 * columns are compatibility containers; native Stud data lives in _full. */
export function buildStudHand(args: BuildStudHandArgs): Omit<SavedHand, "id"> {
  const { state } = args;
  if (state.variant !== "STUD_HIGH") throw new Error("This Stud variant is not ready to save");
  if (state.phase !== "showdown" && state.phase !== "done") throw new Error("Finish the hand before saving");
  if (!studResult(state).resolved) throw new Error("Every live hand must show or muck, and every pot needs a shown eligible winner");
  const [year, month, day] = args.date.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date) || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error("Hand date must be a valid YYYY-MM-DD date");
  const timeline = buildStudTimeline(state).map((event) => {
    if (event.type !== "deal" || event.seat === state.heroSeat || event.visibility === "up") return event;
    const { card, ...hidden } = event;
    void card;
    return hidden;
  });
  const notes = args.notes?.trim() || undefined;
  const venue = args.venue?.trim() || undefined;
  const payload: Omit<SavedHand, "id"> = {
    name: args.name?.trim() || "Untitled hand",
    date: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "2-digit" }),
    stakes: `${state.smallBet}/${state.smallBet * 2} FL`, loc: venue || "—", positions: `S${state.heroSeat + 1}`,
    multiway: new Set(timeline.flatMap((event) => event.type === "deal" && event.round === "fourth-street" ? [event.seat] : [])).size > 2,
    board: Array<string>(5).fill("—"), type: "LP", tags: [], result: 0, fav: false, notes,
    _full: {
      schemaVersion: CURRENT_HAND_SCHEMA_VERSION, game: { family: "stud", variant: "STUD_HIGH", bettingStructure: "FL" },
      studRules: { ante: state.ante, bringIn: state.bringIn, smallBet: state.smallBet, dealerSeat: state.dealerSeat, ...state.limitRules },
      timeline,
      players: state.players.map((player) => ({
        seat: player.seat, name: player.name, stack: player.stack,
        cards: player.seat === state.heroSeat ? player.cards.map((slot) => slot.card ?? null)
          : state.shownCards[player.seat] && !state.muckedSeats.includes(player.seat) ? [...state.shownCards[player.seat]] : null,
      })),
      actions: [], board: [], sb: 0, bb: 0, straddleOn: false, straddleAmt: 0,
      playerCount: state.playerCount, heroPosition: state.heroSeat, muckedSeats: [...state.muckedSeats], notes, venue, date: args.date,
    },
  };
  const replay = studToReplay({ ...payload, id: "pending" })!;
  const result = replay.steps.at(-1)!;
  if (!result.stud.resolved) throw new Error("Every pot needs a shown eligible winner before saving");
  payload.result = (result.stud.winnings?.[state.heroSeat] ?? 0) - (result.committedAfter?.[state.heroSeat] ?? 0);
  return payload;
}
