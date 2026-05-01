// Fanned-hand variant of PlayingCard. Used only by Omaha (4 / 5 hole
// cards) where the cards overlap horizontally — the corner-index design
// (rank + suit at the top-left of each card) keeps every card readable
// even when the right edge is covered by the next one in the fan.
//
// Hold'em's existing PlayingCard stays put; only the fanned slots use
// this component.

import { suitColor } from "./PlayingCard";

type Size = "sm" | "md";

const DIMS: Record<
  Size,
  {
    w: number;
    h: number;
    rank: number;
    suit: number;
    centerSuit: number;
    cornerOffset: number;
  }
> = {
  sm: { w: 38, h: 54, rank: 13, suit: 11, centerSuit: 22, cornerOffset: 4 },
  md: { w: 50, h: 70, rank: 16, suit: 13, centerSuit: 28, cornerOffset: 5 },
};

export type FannedPlayingCardProps = {
  rank?: string | null;
  suit?: string | null;
  size?: Size;
  // When `placeholder` is true the card renders as the dashed empty
  // slot used by the picker, matching the look of the standard card
  // placeholder so the fan stays visually coherent before all cards
  // are picked.
  placeholder?: boolean;
};

export default function FannedPlayingCard({
  rank,
  suit,
  size = "md",
  placeholder,
}: FannedPlayingCardProps) {
  const d = DIMS[size];

  if (placeholder || !rank || !suit) {
    return (
      <div
        className="rounded-md flex items-center justify-center font-medium"
        style={{
          width: d.w,
          height: d.h,
          fontSize: d.centerSuit * 0.7,
          background: "oklch(0.205 0 0)",
          color: "oklch(0.45 0 0)",
          border: "2px dashed oklch(1 0 0 / 0.18)",
        }}
      >
        +
      </div>
    );
  }

  const color = suitColor(suit);
  return (
    <div
      className="rounded-md font-bold relative"
      style={{
        width: d.w,
        height: d.h,
        background: "#fafafa",
        color,
        boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
        border: "1px solid rgba(0,0,0,0.1)",
      }}
    >
      {/* Top-left corner index — the only part guaranteed visible when
          the next card in the fan overlaps the right side of this one.
          Rank above, suit below, both left-aligned. */}
      <div
        style={{
          position: "absolute",
          top: d.cornerOffset,
          left: d.cornerOffset + 1,
          fontSize: d.rank,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {rank}
      </div>
      <div
        style={{
          position: "absolute",
          top: d.cornerOffset + d.rank + 1,
          left: d.cornerOffset + 1,
          fontSize: d.suit,
          lineHeight: 1,
        }}
      >
        {suit}
      </div>
      {/* Center suit watermark — adds visual weight to the rightmost
          card (the only one that's fully visible) and decorates each
          card so it doesn't look like a corner-only stub. */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "55%",
          transform: "translate(-50%, -50%)",
          fontSize: d.centerSuit,
          lineHeight: 1,
          opacity: 0.5,
        }}
      >
        {suit}
      </div>
    </div>
  );
}
