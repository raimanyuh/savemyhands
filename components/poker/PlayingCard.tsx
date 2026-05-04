// Four-color deck primitive used by the table, recorder, and replayer felts.

import { scaled } from "./scale";

const SUIT_COLORS: Record<string, string> = {
  "♠": "#0a0a0a", // black
  "♣": "oklch(0.5 0.16 145)", // green
  "♦": "oklch(0.5 0.18 250)", // blue
  "♥": "oklch(0.55 0.22 22)", // red
};

type Size = "sm" | "md";
type BackColor = "brown" | "darkRed";

// Pixel dimensions are the design baseline; rendered values are scaled
// via `--smh-u` when the card sits inside a TableSurface. Outside the
// felt the var falls back to 1 so dashboard MiniCards / pickers stay at
// design size.
const DIMS: Record<Size, { w: number; h: number; rank: number; suit: number; back: number; placeholder: number }> = {
  sm: { w: 44, h: 62, rank: 18, suit: 16, back: 10, placeholder: 20 },
  md: { w: 56, h: 80, rank: 22, suit: 20, back: 12, placeholder: 26 },
};

export function suitColor(suit: string): string {
  return SUIT_COLORS[suit] ?? "#0a0a0a";
}

export type PlayingCardProps = {
  rank?: string | null;
  suit?: string | null;
  faceDown?: boolean;
  size?: Size;
  backColor?: BackColor;
};

export default function PlayingCard({
  rank,
  suit,
  faceDown,
  size = "md",
  backColor = "darkRed",
}: PlayingCardProps) {
  const d = DIMS[size];

  if (faceDown) {
    const back =
      backColor === "darkRed"
        ? "linear-gradient(135deg, #6b1722 0%, #2a0608 100%)"
        : "linear-gradient(135deg, #4a2511 0%, #190a02 100%)";
    return (
      <div
        className="rounded-md flex items-center justify-center font-medium uppercase tracking-[0.28em]"
        style={{
          width: scaled(d.w),
          height: scaled(d.h),
          fontSize: scaled(d.back),
          background: back,
          color: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
        }}
      >
        smh
      </div>
    );
  }

  if (!rank) {
    return (
      <div
        className="rounded-md flex items-center justify-center font-medium"
        style={{
          width: scaled(d.w),
          height: scaled(d.h),
          fontSize: scaled(d.placeholder),
          background: "oklch(0.205 0 0)",
          color: "oklch(0.45 0 0)",
          border: "2px dashed oklch(1 0 0 / 0.18)",
        }}
      >
        +
      </div>
    );
  }

  return (
    <div
      className="rounded-md flex flex-col items-center justify-center font-bold"
      style={{
        width: scaled(d.w),
        height: scaled(d.h),
        gap: 2,
        background: "#fafafa",
        color: suit ? suitColor(suit) : "#0a0a0a",
        boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
        border: "1px solid rgba(0,0,0,0.1)",
      }}
    >
      <div style={{ fontSize: scaled(d.rank), lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{rank}</div>
      <div style={{ fontSize: scaled(d.suit), lineHeight: 1 }}>{suit}</div>
    </div>
  );
}
