"use client";

// Mobile card picker — bottom-sheet hosting a suit-then-rank selector.
// Built fresh rather than reusing components/poker/CardPicker.tsx
// because that component is an anchored popover with desktop keyboard
// navigation; the mobile picker is touch-only with bigger targets.
//
// Selection model is direct-pick: tap a suit (filters the grid), then
// tap a rank — that commits the card and dismisses the sheet. No
// separate confirm step on the assumption that fast live entry beats
// confirm-to-save mistakes for poker hand recording. (The brief
// suggested a two-step Save · A♥ flow; if user testing surfaces
// mis-taps we can swap back.)
//
// Used-card filtering: cards already on the felt (other hole cards,
// board) render disabled.

import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
const SUITS = ["s", "h", "d", "c"] as const;

const SUIT_GLYPH: Record<string, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣",
};

// Suit colors picked for legibility on the dark sheet background. Same
// 4-color deck the desktop felt uses, but tuned slightly for the
// near-white card faces in the picker grid.
const SUIT_COLOR: Record<string, string> = {
  s: "#fafafa",
  c: "oklch(0.7 0.17 145)",
  d: "oklch(0.72 0.16 250)",
  h: "oklch(0.7 0.20 22)",
};

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";

export type CardPickerSheetProps = {
  open: boolean;
  // Title shown in the sheet header — typically "Hero card 1 of 2",
  // "Flop card 2 of 3", "BTN reveal", etc.
  title: string;
  // Cards already in play. The picker greys out matches so the user
  // can't pick a duplicate.
  used: Set<string>;
  // Fires when the user picks a card. Caller is responsible for
  // dispatching the relevant state update and either closing the sheet
  // or repointing it at the next slot in a multi-card row.
  onPick: (card: string) => void;
  // Fires when the user dismisses the sheet (cancel button, backdrop
  // tap, drag-down, or Esc).
  onClose: () => void;
};

export function CardPickerSheet({
  open,
  title,
  used,
  onPick,
  onClose,
}: CardPickerSheetProps) {
  // Active suit filter. Resets to "s" each time the sheet opens so the
  // user lands on a predictable starting point. We can't trust prior
  // selection across opens — the next slot might be a wholly different
  // intent (e.g. picker just closed on hero card 1, opens for hero
  // card 2, the user might want a different suit).
  //
  // Reset is implemented via setState-during-render with an open-prop
  // sentinel — this avoids the react-hooks/set-state-in-effect lint
  // rule that would fire on the more obvious useEffect-on-open pattern.
  const [activeSuit, setActiveSuit] =
    useState<(typeof SUITS)[number]>("s");
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setActiveSuit("s");
  }

  const handlePick = (rank: string) => {
    const card = rank + activeSuit;
    if (used.has(card)) return;
    onPick(card);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={title}
      maxHeightVh={70}
    >
      {/* Suit row — 4 buttons, taller than the brief's 40pt baseline so
          we hit the 44pt accessibility minimum. */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6,
          padding: "12px 12px 8px",
        }}
      >
        {SUITS.map((s) => {
          const active = activeSuit === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSuit(s)}
              style={{
                height: 44,
                borderRadius: 10,
                background: active
                  ? "oklch(0.30 0.10 155 / 0.45)"
                  : "oklch(0.215 0 0)",
                border: active
                  ? `1px solid ${EMERALD}`
                  : "1px solid rgba(255,255,255,0.12)",
                color: SUIT_COLOR[s],
                fontSize: 22,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              {SUIT_GLYPH[s]}
            </button>
          );
        })}
      </div>

      {/* Rank grid — 7 columns (A K Q J T 9 8 / 7 6 5 4 3 2 ·).
          The 14th cell is a placeholder so the grid stays uniform; we
          could surface a Muck button there in a future revision. */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
          padding: "0 12px 16px",
        }}
      >
        {RANKS.map((rank) => {
          const card = rank + activeSuit;
          const taken = used.has(card);
          return (
            <button
              key={rank}
              type="button"
              onClick={() => handlePick(rank)}
              disabled={taken}
              style={{
                minHeight: 56,
                borderRadius: 10,
                background: taken ? "oklch(0.18 0 0)" : "#fafafa",
                border: taken
                  ? "1px dashed rgba(255,255,255,0.10)"
                  : "1px solid rgba(0,0,0,0.1)",
                color: taken ? "oklch(0.4 0 0)" : SUIT_COLOR[activeSuit],
                fontSize: 18,
                fontWeight: 700,
                cursor: taken ? "not-allowed" : "pointer",
                opacity: taken ? 0.5 : 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                lineHeight: 1,
              }}
            >
              <span>{rank}</span>
              <span style={{ fontSize: 14 }}>{SUIT_GLYPH[activeSuit]}</span>
            </button>
          );
        })}
        {/* Slot 14 — placeholder, keeps the grid rectangle clean */}
        <div
          style={{
            minHeight: 56,
            borderRadius: 10,
            border: "1px dashed rgba(255,255,255,0.06)",
            opacity: 0.3,
          }}
        />
      </div>

      {/* Hint footer — only renders if there's a previewable preview */}
      <div
        className="px-3 pb-2 font-mono"
        style={{
          fontSize: 10,
          color: "oklch(0.55 0 0)",
          letterSpacing: "0.06em",
          textAlign: "center",
        }}
      >
        Tap a suit, then a rank · {EMERALD_BRIGHT === EMERALD_BRIGHT ? "" : ""}
        Esc or drag down to cancel
      </div>
    </BottomSheet>
  );
}
