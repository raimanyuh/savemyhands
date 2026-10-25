import { CURRENT_HAND_SCHEMA_VERSION } from "@/components/poker/game-format";
import { potTypeOf, type SavedHand } from "@/components/poker/hand";
import { POSITION_NAMES } from "@/components/poker/lib";
import { buildSingleDrawTimeline, type SingleDrawState } from "@/components/poker/single-draw-engine";
import { singleDrawToReplay } from "@/components/poker/single-draw-replay";

export type BuildSingleDrawHandArgs = {
  state: SingleDrawState;
  name?: string;
  /** Local calendar date, YYYY-MM-DD; supplied by the recorder. */
  date: string;
  venue?: string;
  notes?: string;
};

/** Pure payload builder shared by both draw variants and responsive recorders. */
export function buildSingleDrawHand(args: BuildSingleDrawHandArgs): Omit<SavedHand, "id"> {
  const { state } = args;
  if (state.phase !== "showdown" && state.phase !== "done") {
    throw new Error("Finish the hand before saving");
  }
  const folded = new Set(state.actions.filter((action) => action.action === "fold").map((action) => action.seat));
  const survivors = state.players.filter((player) => !folded.has(player.seat));
  if (survivors.length > 1 && survivors.some((player) =>
    !state.muckedSeats.includes(player.seat) &&
    (!player.cards || player.cards.length !== 5 || player.cards.some((card) => !card)))) {
    throw new Error("Every live hand must show or muck before saving");
  }
  const [year, month, day] = args.date.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date) || date.getFullYear() !== year ||
      date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error("Hand date must be a valid YYYY-MM-DD date");
  }
  // Opponent cards known at showdown never become initial-deal identities.
  let timeline = buildSingleDrawTimeline({
    ...state,
    players: state.players.map((player) => ({
      ...player, startingCards: player.seat === state.heroSeat ? player.startingCards : null,
    })),
  });
  // Winning by folds does not imply that the winner tabled their cards.
  if (survivors.length === 1) timeline = timeline.filter((event) => event.type !== "show" && event.type !== "muck");
  const notes = args.notes?.trim() || undefined;
  const venue = args.venue?.trim() || undefined;
  const payload: Omit<SavedHand, "id"> = {
    name: args.name?.trim() || "Untitled hand",
    date: date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "2-digit" }),
    stakes: state.variant === "2-7_TRIPLE_DRAW" ? `${state.bb}/${state.bb * 2} FL` : `${state.sb}/${state.bb}`,
    loc: venue || "—",
    positions: POSITION_NAMES[state.playerCount]?.[state.heroSeat] ?? `S${state.heroSeat + 1}`,
    // Draw-game counterpart of reaching the flop: more than two drew.
    multiway: state.draws.filter((draw) => draw.round === 1).length > 2,
    board: Array<string>(5).fill("—"),
    type: "LP",
    tags: [], result: 0, fav: false, notes,
    _full: {
      schemaVersion: CURRENT_HAND_SCHEMA_VERSION,
      game: { family: "draw", variant: state.variant, bettingStructure: state.variant === "2-7_TRIPLE_DRAW" ? "FL" : "NL" },
      ...(state.variant === "2-7_TRIPLE_DRAW" ? { drawRules: { ...state.limitRules } } : {}),
      timeline,
      players: state.players.map((player) => ({
        seat: player.seat, name: player.name, stack: player.stack,
        cards: player.cards && (player.seat === state.heroSeat ||
          (!folded.has(player.seat) && !state.muckedSeats.includes(player.seat))) ? [...player.cards] : null,
      })),
      // Compatibility containers only; draw replay reads the timeline.
      actions: [], board: [], straddleOn: false, straddleAmt: 0,
      sb: state.sb, bb: state.bb, playerCount: state.playerCount,
      heroPosition: state.heroSeat,
      muckedSeats: [...state.muckedSeats], notes, venue, date: args.date,
    },
  };
  const draft = { ...payload, id: "pending" };
  const replay = singleDrawToReplay(draft)!;
  const result = replay.steps.at(-1)!;
  if (!result.draw.resolved) throw new Error("Every pot needs a shown eligible winner before saving");
  payload.result = (result.draw.winnings?.[state.heroSeat] ?? 0) - (result.committedAfter?.[state.heroSeat] ?? 0);
  payload.type = potTypeOf(draft) as SavedHand["type"];
  return payload;
}
