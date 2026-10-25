// Shared helpers used by both the desktop Dashboard and the mobile sibling
// (`components/mobile/MobileDashboard.tsx`). Pure derivations + the small
// MiniCard renderer. No state, no server actions — those live in the
// surface components.

import { isMultiway, type SavedHand } from "./hand";
import type { StudVariant } from "./game-format";

// Hero's position only — older saves stored "X vs Y", strip back to the hero side.
export function heroPositionOf(h: SavedHand): string {
  const raw = (h.positions || "").trim();
  if (!raw) return "—";
  const i = raw.toLowerCase().indexOf(" vs ");
  return i >= 0 ? raw.slice(0, i).trim() : raw;
}

// Multiway flag — derived on the fly when the row predates the field.
export function multiwayOf(h: SavedHand): boolean | null {
  if (typeof h.multiway === "boolean") return h.multiway;
  if (h._full?.game?.family === "stud" && h._full.timeline) {
    return new Set(h._full.timeline.flatMap((event) => event.type === "deal" && event.round === "fourth-street" ? [event.seat] : [])).size > 2;
  }
  if (h._full?.actions && typeof h._full.playerCount === "number") {
    return isMultiway({
      playerCount: h._full.playerCount,
      actions: h._full.actions,
    });
  }
  return null;
}

// Game variant for a saved hand. Older saves predate `_full.gameType`
// and are always Hold'em.
export type DashboardGameType = "NLHE" | "PLO4" | "PLO5" | "2-7_SINGLE_DRAW" | "2-7_TRIPLE_DRAW" | StudVariant;
export function gameTypeOf(h: SavedHand): DashboardGameType {
  if (h._full?.game?.family === "draw") return h._full.game.variant;
  if (h._full?.game?.family === "stud") return h._full.game.variant;
  return h._full?.gameType ?? "NLHE";
}
export const GAME_LABEL: Record<DashboardGameType, string> = {
  NLHE: "NLHE",
  PLO4: "PLO4",
  PLO5: "PLO5",
  "2-7_SINGLE_DRAW": "2–7 SD",
  "2-7_TRIPLE_DRAW": "2–7 TD",
  STUD_HIGH: "Stud High",
  RAZZ: "Razz",
  STUD_HILO_8: "Stud Hi/Lo 8",
};
export function dashboardGameOptions(enableStud = false, enableRazz = false, enableStudHilo = false): { value: DashboardGameType; label: string }[] {
  return [
    { value: "NLHE", label: "Hold'em" }, { value: "PLO4", label: "PLO 4-card" }, { value: "PLO5", label: "PLO 5-card" },
    { value: "2-7_SINGLE_DRAW", label: "2–7 Single Draw" }, { value: "2-7_TRIPLE_DRAW", label: "2–7 Triple Draw" },
    ...(enableStud ? [{ value: "STUD_HIGH" as const, label: "Seven-Card Stud High" }] : []),
    ...(enableRazz ? [{ value: "RAZZ" as const, label: "Razz" }] : []),
    ...(enableStudHilo ? [{ value: "STUD_HILO_8" as const, label: "Stud Hi/Lo 8" }] : []),
  ];
}
export function holeCountOf(h: SavedHand): 2 | 4 | 5 | 7 {
  if (h._full?.game?.family === "stud") return 7;
  const g = gameTypeOf(h);
  if (g === "PLO5" || g === "2-7_SINGLE_DRAW" || g === "2-7_TRIPLE_DRAW") return 5;
  if (g === "PLO4") return 4;
  return 2;
}

/** Keep Stud's seven ranks within the existing five-card column width.
 * A shared river is labeled separately from the six personal cards. */
export function HeroCardsPreview({ hand, size = "sm" }: { hand: SavedHand; size?: "sm" | "md" }) {
  const full = hand._full;
  const heroCards = full?.players?.find((player) => player.seat === (full.heroPosition ?? 0))?.cards;
  const count = holeCountOf(hand);
  const shared = full?.game?.family === "stud" ? full.timeline?.find((event) => event.type === "shared-deal") : undefined;
  return <div aria-label="Hero cards" className="flex items-center" style={{ gap: 2, flexShrink: 0 }}>
    {Array.from({ length: count }, (_, index) => {
      const isShared = index === 6 && shared?.type === "shared-deal";
      const card = isShared ? shared.card : heroCards?.[index] ?? "—";
      return <span key={index} aria-label={`${isShared ? "Shared seventh card" : `Hero card ${index + 1}`} ${card === "—" ? "unknown" : card}`} title={isShared ? "Shared seventh card" : undefined}
        className={isShared ? "rounded outline outline-dashed outline-emerald-300/50 outline-offset-1" : undefined}>
        <MiniCard card={card} size={size} compact={count === 7} />
      </span>;
    })}
  </div>;
}

// Double-board flag.
export function doubleBoardOf(h: SavedHand): boolean {
  return !!h._full?.doubleBoardOn;
}

// Four-color deck on the dashboard's dark background:
//   ♠ near-white (the "black" suit), ♣ green, ♦ blue, ♥ red.
export const suitColor = (s: string) =>
  s === "♥"
    ? "oklch(0.7 0.20 22)"
    : s === "♦"
      ? "oklch(0.72 0.16 250)"
      : s === "♣"
        ? "oklch(0.7 0.17 145)"
        : s === "♠"
          ? "oklch(0.95 0 0)"
          : "transparent";

// Small card chip used in the dashboard's Hand and Board columns. `size`
// scales the dimensions; defaults to the desktop sizing.
export function MiniCard({
  card,
  size = "sm",
  compact = false,
}: {
  card: string;
  size?: "sm" | "md";
  compact?: boolean;
}) {
  const dim =
    size === "md"
      ? { w: 26, h: 32, fs: 13, br: 5 }
      : { w: 22, h: 26, fs: 11, br: 4 };
  if (compact) { dim.w = size === "md" ? 18 : 15; dim.fs = size === "md" ? 11 : 10; }
  if (!card || card === "—") {
    return (
      <div
        style={{
          width: dim.w,
          height: dim.h,
          borderRadius: dim.br,
          border: "1px dashed oklch(1 0 0 / 8%)",
        }}
      />
    );
  }
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const color = suitColor(suit);
  return (
    <div
      style={{
        width: dim.w,
        height: dim.h,
        borderRadius: dim.br,
        background: color.replace(")", " / 0.18)"),
        color,
        border: `1px solid ${color.replace(")", " / 0.35)")}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: dim.fs,
        fontWeight: 700,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {rank}
    </div>
  );
}
