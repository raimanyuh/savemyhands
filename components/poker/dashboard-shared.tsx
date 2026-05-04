// Shared helpers used by both the desktop Dashboard and the mobile sibling
// (`components/mobile/MobileDashboard.tsx`). Pure derivations + the small
// MiniCard renderer. No state, no server actions — those live in the
// surface components.

import { isMultiway, type SavedHand } from "./hand";

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
export function gameTypeOf(h: SavedHand): "NLHE" | "PLO4" | "PLO5" {
  return h._full?.gameType ?? "NLHE";
}
export const GAME_LABEL: Record<"NLHE" | "PLO4" | "PLO5", string> = {
  NLHE: "NLHE",
  PLO4: "PLO4",
  PLO5: "PLO5",
};
export function holeCountOf(h: SavedHand): 2 | 4 | 5 {
  const g = gameTypeOf(h);
  if (g === "PLO5") return 5;
  if (g === "PLO4") return 4;
  return 2;
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
}: {
  card: string;
  size?: "sm" | "md";
}) {
  const dim =
    size === "md"
      ? { w: 26, h: 32, fs: 13, br: 5 }
      : { w: 22, h: 26, fs: 11, br: 4 };
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
