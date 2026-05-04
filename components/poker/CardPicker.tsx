"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import PlayingCard from "./PlayingCard";
import FannedPlayingCard from "./FannedPlayingCard";
import { scaled } from "./scale";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = ["♠", "♥", "♦", "♣"];

// On the dark popover background, give spades a near-white tint so they don't disappear.
function pickerSuitColor(s: string): string {
  if (s === "♠") return "#fafafa";
  if (s === "♣") return "oklch(0.7 0.17 145)";
  if (s === "♦") return "oklch(0.72 0.16 250)";
  if (s === "♥") return "oklch(0.7 0.20 22)";
  return "#fafafa";
}

export function CardPicker({
  anchor,
  used,
  onPick,
  onClose,
}: {
  anchor: HTMLElement | null;
  used: Set<string>;
  onPick: (card: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 2D ref grid keyed by [rankIdx][suitIdx] so the keyboard handler can
  // programmatically focus the active card.
  const buttonRefs = useRef<(HTMLButtonElement | null)[][]>([]);
  // Currently keyboard-focused card. Initialized to the first non-taken
  // card via a lazy initializer so keyboard nav engages immediately on
  // open. Auto-advance to the next slot remounts the picker via `key` on
  // the CardRow side, so this initializer runs fresh each pick.
  const [focused, setFocused] = useState<{ r: number; s: number } | null>(
    () => {
      for (let r = 0; r < RANKS.length; r++) {
        for (let s = 0; s < SUITS.length; s++) {
          if (!used.has(RANKS[r] + SUITS[s])) return { r, s };
        }
      }
      return null;
    },
  );

  // Layout decision — picker is ~432px tall in its default vertical
  // layout (4 suit columns × 13 rank rows) and that doesn't fit in
  // viewports / anchor positions where neither above nor below the
  // anchor has enough room. When that happens we transpose to a
  // horizontal layout (~188px tall, 13 rank columns × 4 suit rows) so
  // every card stays visible and clickable. Computed once at mount
  // from the anchor's position; the picker remounts on every fresh
  // open so this is fine to memoize on the anchor element.
  const layout = useMemo<"vertical" | "horizontal">(() => {
    if (!anchor || typeof window === "undefined") return "vertical";
    const rect = anchor.getBoundingClientRect();
    const VERT_H_TOTAL = 440; // body grid + header chrome
    const M = 8;
    const roomBelow = window.innerHeight - rect.bottom - M;
    const roomAbove = rect.top - M;
    if (roomBelow >= VERT_H_TOTAL || roomAbove >= VERT_H_TOTAL)
      return "vertical";
    return "horizontal";
  }, [anchor]);

  // Outside-click → close.
  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchor, onClose]);

  // Move DOM focus to the focused card whenever the index changes.
  useEffect(() => {
    if (!focused) return;
    buttonRefs.current[focused.r]?.[focused.s]?.focus();
  }, [focused]);

  // Keyboard handler. Registered in capture phase on document so the
  // recorder's bubble-phase shortcuts (f/c/r/b/1-4/a) don't fire while the
  // picker is open — every printable key gets `stopPropagation` whether or
  // not we recognize it, so the recorder never sees stray input.
  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        !!target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();
        e.stopPropagation();
        setFocused((f) => {
          const cur = f ?? { r: 0, s: 0 };
          // Arrows map to data movement based on visual layout. In
          // vertical (suit columns × rank rows) ArrowDown advances rank;
          // in horizontal (rank columns × suit rows) ArrowDown advances
          // suit. Keep keys aligned with what the user sees.
          if (layout === "vertical") {
            if (e.key === "ArrowDown")
              return { r: Math.min(RANKS.length - 1, cur.r + 1), s: cur.s };
            if (e.key === "ArrowUp")
              return { r: Math.max(0, cur.r - 1), s: cur.s };
            if (e.key === "ArrowRight")
              return { r: cur.r, s: Math.min(SUITS.length - 1, cur.s + 1) };
            return { r: cur.r, s: Math.max(0, cur.s - 1) };
          }
          if (e.key === "ArrowDown")
            return { r: cur.r, s: Math.min(SUITS.length - 1, cur.s + 1) };
          if (e.key === "ArrowUp")
            return { r: cur.r, s: Math.max(0, cur.s - 1) };
          if (e.key === "ArrowRight")
            return { r: Math.min(RANKS.length - 1, cur.r + 1), s: cur.s };
          return { r: Math.max(0, cur.r - 1), s: cur.s };
        });
        return;
      }

      // Let modifier shortcuts (Cmd/Ctrl-Z for undo, etc.) pass through.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key.length === 1) {
        const upper = e.key.toUpperCase();
        const rankIdx = RANKS.indexOf(upper);
        if (rankIdx >= 0) {
          e.preventDefault();
          e.stopPropagation();
          // Jump to that rank, preferring the current suit column. Skip
          // suits already taken so the user lands on something pickable.
          setFocused((f) => {
            const cur = f?.s ?? 0;
            const order = [cur, ...[0, 1, 2, 3].filter((s) => s !== cur)];
            for (const s of order) {
              if (!used.has(RANKS[rankIdx] + SUITS[s])) {
                return { r: rankIdx, s };
              }
            }
            return { r: rankIdx, s: cur };
          });
          return;
        }
        // Unknown printable key — swallow so the recorder's f/c/r/b/etc.
        // shortcuts don't trigger while the user is mid-pick.
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [anchor, used, onClose, layout]);

  if (!anchor) return null;

  const rect = anchor.getBoundingClientRect();
  // Picker dimensions depend on layout. Vertical: compact horizontally
  // (~264) but ~440 tall — preferred when there's room. Horizontal: wider
  // (~380) but only ~188 tall — used when the vertical layout wouldn't
  // fit above or below the anchor.
  const W = layout === "vertical" ? 264 : 380;
  const H = layout === "vertical" ? 440 : 188;
  const M = 8; // viewport margin
  let left = rect.left + rect.width / 2 - W / 2;
  let top = rect.bottom + M;
  left = Math.max(M, Math.min(window.innerWidth - W - M, left));
  // First-choice: below the anchor. If that doesn't fit, flip above.
  // Final clamp pins the picker to the viewport so it never renders
  // off-screen even when neither above nor below clears the picker.
  if (top + H > window.innerHeight - M) top = rect.top - H - M;
  top = Math.max(M, Math.min(window.innerHeight - H - M, top));

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[200] rounded-xl shadow-2xl overflow-hidden"
      style={{
        left,
        top,
        width: W,
        background: "oklch(0.18 0 0)",
        border: "1px solid oklch(1 0 0 / 0.14)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/10">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Pick card
        </span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>
      {layout === "vertical" ? (
        <div className="p-2 grid grid-cols-4 gap-1">
          {SUITS.map((s, sIdx) => (
            <div key={s} className="flex flex-col gap-1">
              <div
                className="text-center text-[14px] leading-none py-1"
                style={{ color: pickerSuitColor(s) }}
              >
                {s}
              </div>
              {RANKS.map((r, rIdx) => {
                const id = r + s;
                const taken = used.has(id);
                const isFocused =
                  focused?.r === rIdx && focused?.s === sIdx;
                return (
                  <button
                    key={id}
                    ref={(el) => {
                      if (!buttonRefs.current[rIdx])
                        buttonRefs.current[rIdx] = [];
                      buttonRefs.current[rIdx][sIdx] = el;
                    }}
                    disabled={taken}
                    onClick={() => onPick(id)}
                    className={`h-6 rounded text-[12px] font-bold tabular-nums leading-none transition-colors outline-none ${
                      taken
                        ? "opacity-25 cursor-not-allowed"
                        : "hover:bg-white/10 cursor-pointer"
                    }`}
                    style={{
                      color: pickerSuitColor(s),
                      background: isFocused
                        ? "oklch(0.696 0.205 155 / 0.18)"
                        : taken
                          ? "rgba(255,255,255,0.04)"
                          : "transparent",
                      boxShadow: isFocused
                        ? "inset 0 0 0 1.5px oklch(0.696 0.205 155 / 0.7)"
                        : undefined,
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        // Horizontal layout — used when neither above nor below the
        // anchor has room for the taller vertical layout. Each suit is a
        // row; ranks span the row left-to-right. Same data model as
        // vertical (focused.r = rank index, focused.s = suit index) so
        // the existing keyboard nav still works after the arrow-key
        // remap above.
        <div className="p-2 flex flex-col gap-1">
          {SUITS.map((s, sIdx) => (
            <div key={s} className="flex gap-1 items-center">
              <div
                className="shrink-0 text-center text-[14px] leading-none"
                style={{ width: 22, color: pickerSuitColor(s) }}
              >
                {s}
              </div>
              {RANKS.map((r, rIdx) => {
                const id = r + s;
                const taken = used.has(id);
                const isFocused =
                  focused?.r === rIdx && focused?.s === sIdx;
                return (
                  <button
                    key={id}
                    ref={(el) => {
                      if (!buttonRefs.current[rIdx])
                        buttonRefs.current[rIdx] = [];
                      buttonRefs.current[rIdx][sIdx] = el;
                    }}
                    disabled={taken}
                    onClick={() => onPick(id)}
                    className={`flex-1 h-7 rounded text-[12px] font-bold tabular-nums leading-none transition-colors outline-none ${
                      taken
                        ? "opacity-25 cursor-not-allowed"
                        : "hover:bg-white/10 cursor-pointer"
                    }`}
                    style={{
                      color: pickerSuitColor(s),
                      background: isFocused
                        ? "oklch(0.696 0.205 155 / 0.18)"
                        : taken
                          ? "rgba(255,255,255,0.04)"
                          : "transparent",
                      boxShadow: isFocused
                        ? "inset 0 0 0 1.5px oklch(0.696 0.205 155 / 0.7)"
                        : undefined,
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

export type CardSlotProps = {
  card: string | null | undefined;
  faceDown?: boolean;
  onPick: (card: string) => void;
  onClear?: () => void;
  size?: "sm" | "md";
  disabled?: boolean;
  used: Set<string>;
  label?: string;
};

export function CardSlot({
  card,
  faceDown,
  onPick,
  onClear,
  size = "md",
  disabled,
  used,
  label,
}: CardSlotProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const w = size === "sm" ? 36 : 56;
  const h = size === "sm" ? 52 : 80;
  const close = () => setAnchor(null);
  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchor(e.currentTarget);
  };

  if (!card) {
    return (
      <>
        <button
          disabled={disabled}
          onClick={handleOpen}
          aria-label={label || "Pick card"}
          className={`rounded-md flex items-center justify-center transition-all ${
            disabled
              ? "opacity-30 cursor-not-allowed"
              : "cursor-pointer hover:bg-white/5"
          }`}
          style={{
            width: w,
            height: h,
            background: "oklch(0.18 0 0 / 0.6)",
            border: "2px dashed oklch(1 0 0 / 0.2)",
            color: "oklch(0.5 0 0)",
            fontSize: size === "sm" ? 16 : 22,
          }}
        >
          +
        </button>
        {anchor && (
          <CardPicker
            anchor={anchor}
            used={used}
            onPick={(c) => {
              onPick(c);
              close();
            }}
            onClose={close}
          />
        )}
      </>
    );
  }

  if (faceDown) {
    return (
      <>
        <button
          disabled={disabled}
          onClick={handleOpen}
          className="rounded-md cursor-pointer hover:ring-2 hover:ring-white/30 transition-all"
          style={{
            width: w,
            height: h,
            background: "linear-gradient(135deg, #6b1722 0%, #2a0608 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
          }}
        >
          <span
            className="text-[10px] uppercase tracking-[0.28em]"
            style={{ color: "rgba(255,255,255,0.18)" }}
          >
            smh
          </span>
        </button>
        {anchor && (
          <CardPicker
            anchor={anchor}
            used={used}
            onPick={(c) => {
              onPick(c);
              close();
            }}
            onClose={close}
          />
        )}
      </>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return (
    <div className="relative group">
      <button
        onClick={handleOpen}
        className="cursor-pointer transition-transform hover:-translate-y-0.5"
      >
        <PlayingCard rank={rank} suit={suit} size={size} />
      </button>
      {onClear && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Clear card"
        >
          <X size={9} className="text-zinc-200" />
        </button>
      )}
      {anchor && (
        <CardPicker
          anchor={anchor}
          used={used}
          onPick={(c) => {
            onPick(c);
            close();
          }}
          onClose={close}
        />
      )}
    </div>
  );
}

// CardRow — N card slots sharing one CardPicker. After picking slot i, if
// `i + 1 < autoAdvanceCount` and the next slot is empty, the picker re-anchors
// to the next slot instead of closing. Used for the flop (autoAdvance=3) and
// hero hole cards (autoAdvance=2).
export function CardRow({
  cards,
  used,
  disabled,
  onPick,
  onClear,
  size = "md",
  autoAdvanceCount = 0,
  gapClass = "gap-1.5",
  ariaLabelPrefix = "Card",
  highlight = false,
  autoOpenOnHighlight = false,
  fan = false,
}: {
  cards: (string | null | undefined)[];
  used: Set<string>;
  disabled?: boolean;
  onPick: (idx: number, card: string) => void;
  onClear?: (card: string) => void;
  size?: "sm" | "md";
  autoAdvanceCount?: number;
  gapClass?: string;
  ariaLabelPrefix?: string;
  // When true, empty slots glow emerald to signal "you must pick this".
  highlight?: boolean;
  // Opt-in: pop the card picker open on the first empty slot the moment
  // `highlight` transitions false→true. Used for the board so a player
  // never has to grab the mouse mid-hand. Off for hole-card rows where
  // the user controls when to enter cards.
  autoOpenOnHighlight?: boolean;
  // Render cards as an overlapping fan (Omaha-style holding) instead of
  // a flat horizontal row. Triggers the corner-indices `FannedPlayingCard`
  // variant for filled cards and rotates each slot ±N° from the centre
  // with horizontal overlap so 4–5 cards fit inside a seat plate.
  fan?: boolean;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // Single anchor for the whole row — picker positions itself centered
  // beneath this container and stays put across auto-advance, with the
  // active-slot ring sliding from card to card to "gesture" toward
  // which slot the next pick will fill.
  const containerRef = useRef<HTMLDivElement>(null);
  // Track the previous highlight value so we can fire the auto-open exactly
  // once per false→true transition (and not every render where it's still
  // true). If the user dismisses the picker mid-street, we don't reopen
  // until the highlight cycles again on the next street.
  const prevHighlightRef = useRef(highlight);
  const close = () => {
    setOpenIdx(null);
    setAnchor(null);
  };

  // Open the picker on the first empty slot. If every slot is filled
  // we no-op so a stray click doesn't wipe state — the user has to X
  // a card first to edit it. Single click target for the whole row.
  const openOnFirstEmpty = () => {
    if (disabled) return;
    if (!containerRef.current) return;
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i]) {
        setOpenIdx(i);
        setAnchor(containerRef.current);
        return;
      }
    }
  };

  useEffect(() => {
    const wasHighlighted = prevHighlightRef.current;
    prevHighlightRef.current = highlight;
    if (
      !autoOpenOnHighlight ||
      !highlight ||
      wasHighlighted ||
      disabled ||
      anchor
    ) {
      return;
    }
    // Open on the first empty slot in this row, anchored to the row
    // container so the picker doesn't jump around as auto-advance
    // walks the slots.
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i]) {
        if (containerRef.current) {
          setOpenIdx(i);
          setAnchor(containerRef.current);
        }
        return;
      }
    }
  }, [highlight, autoOpenOnHighlight, disabled, anchor, cards]);

  const handlePick = (card: string) => {
    if (openIdx === null) return;
    onPick(openIdx, card);
    const nextIdx = openIdx + 1;
    if (nextIdx < autoAdvanceCount && !cards[nextIdx]) {
      // Stable anchor: only move the active-slot ring, picker stays
      // pinned to the same row container.
      setOpenIdx(nextIdx);
      return;
    }
    close();
  };

  const w = size === "sm" ? 36 : 56;
  const h = size === "sm" ? 52 : 80;
  const placeholderFontSize = size === "sm" ? 16 : 22;
  // Fan-mode card dimensions match FannedPlayingCard. Slightly narrower
  // than the flat-row card so the overlapping fan fits inside the seat
  // plate horizontally.
  const fanW = size === "sm" ? 38 : 50;
  const fanH = size === "sm" ? 54 : 70;
  // Per-slot fan transform — angle + horizontal offset evenly spread
  // around the centre. Tuned so 4 PLO4 cards span ~110px (md) and 5
  // PLO5 cards span ~128px, both narrower than a hero seat plate.
  const fanAngleStep = 7;
  const fanOffsetStep = size === "sm" ? 14 : 18;
  const fanCount = cards.length;
  const fanRowWidth = fanW + (fanCount - 1) * fanOffsetStep;
  const fanRowHeight = fanH + 12; // slack for the rotation tilt
  // Whether the row should respond to a "fill the rest" click. When
  // every slot is filled we no-op (X first to edit). Disabled rows
  // also no-op.
  const canOpen =
    !disabled && cards.some((c) => !c) && openIdx === null;
  const containerCursor = disabled
    ? "cursor-not-allowed"
    : cards.every(Boolean)
      ? "cursor-default"
      : "cursor-pointer";

  // Per-slot decorations. `isActive` slot gets the emerald ring + a
  // subtle pulse to gesture toward what the next pick will fill. We
  // suppress the row-wide `highlight` pulse on empty slots while the
  // picker is open so only the active slot stands out.
  const decorate = (
    i: number,
    c: string | null | undefined,
  ): {
    isActive: boolean;
    showHighlight: boolean;
  } => {
    const isActive = openIdx === i && !c;
    const showHighlight =
      highlight && !disabled && !c && openIdx === null;
    return { isActive, showHighlight };
  };

  if (fan) {
    return (
      <>
        <div
          ref={containerRef}
          onClick={() => {
            if (canOpen) openOnFirstEmpty();
          }}
          role={canOpen ? "button" : undefined}
          aria-label={canOpen ? `Fill ${ariaLabelPrefix}` : undefined}
          tabIndex={canOpen ? 0 : undefined}
          onKeyDown={(e) => {
            if (canOpen && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              openOnFirstEmpty();
            }
          }}
          className={`relative ${containerCursor} select-none`}
          style={{ width: scaled(fanRowWidth), height: scaled(fanRowHeight) }}
        >
          {cards.map((c, i) => {
            const { isActive, showHighlight } = decorate(i, c);
            const center = (fanCount - 1) / 2;
            const angle = (i - center) * fanAngleStep;
            const tx = (i - center) * fanOffsetStep;
            const slotStyle: React.CSSProperties = {
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate(calc(${tx}px * var(--smh-u, 1)), 0) rotate(${angle}deg)${isActive ? " scale(1.06)" : ""}`,
              transformOrigin: "center",
              zIndex: i + (isActive ? 100 : 0),
              transition: "transform 120ms ease",
              pointerEvents: "none",
            };
            if (!c) {
              return (
                <div
                  // Key includes openIdx + highlight so all empty slots
                  // remount in sync when the picker opens / closes — keeps
                  // every animate-pulse phase aligned (otherwise the slot
                  // that was active runs a different beat than its siblings
                  // after the picker dismisses).
                  key={`${i}-${openIdx ?? "x"}-${highlight ? "h" : "n"}`}
                  aria-label={`${ariaLabelPrefix} ${i + 1}`}
                  className={`rounded-md flex items-center justify-center ${
                    isActive || showHighlight ? "animate-pulse" : ""
                  }`}
                  style={{
                    ...slotStyle,
                    width: scaled(fanW),
                    height: scaled(fanH),
                    background: isActive
                      ? "oklch(0.696 0.205 155 / 0.20)"
                      : showHighlight
                        ? "oklch(0.696 0.205 155 / 0.12)"
                        : "oklch(0.18 0 0 / 0.6)",
                    border: isActive
                      ? "2px solid oklch(0.696 0.205 155 / 0.85)"
                      : showHighlight
                        ? "2px dashed oklch(0.696 0.205 155 / 0.7)"
                        : "2px dashed oklch(1 0 0 / 0.2)",
                    color:
                      isActive || showHighlight
                        ? "oklch(0.795 0.184 155)"
                        : "oklch(0.5 0 0)",
                    fontSize: scaled(placeholderFontSize),
                    boxShadow: isActive
                      ? "0 0 0 4px oklch(0.696 0.205 155 / 0.25), 0 6px 14px rgba(0,0,0,0.4)"
                      : showHighlight
                        ? "0 0 0 2px oklch(0.696 0.205 155 / 0.18), 0 6px 14px rgba(0,0,0,0.4)"
                        : undefined,
                  }}
                >
                  +
                </div>
              );
            }
            const rank = c.slice(0, -1);
            const suit = c.slice(-1);
            return (
              <div
                key={i}
                aria-label={`${ariaLabelPrefix} ${i + 1}`}
                className="group"
                style={{
                  ...slotStyle,
                  pointerEvents: onClear ? "auto" : "none",
                  borderRadius: 6,
                }}
              >
                <FannedPlayingCard rank={rank} suit={suit} size={size} />
                {onClear && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClear(c);
                    }}
                    className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Clear card"
                  >
                    <X size={9} className="text-zinc-200" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {anchor && (
          <CardPicker
            key={openIdx ?? 0}
            anchor={anchor}
            used={used}
            onPick={handlePick}
            onClose={close}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        onClick={() => {
          if (canOpen) openOnFirstEmpty();
        }}
        role={canOpen ? "button" : undefined}
        aria-label={canOpen ? `Fill ${ariaLabelPrefix}` : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onKeyDown={(e) => {
          if (canOpen && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openOnFirstEmpty();
          }
        }}
        className={`flex ${gapClass} ${containerCursor} select-none`}
      >
        {cards.map((c, i) => {
          const { isActive, showHighlight } = decorate(i, c);
          if (!c) {
            return (
              <div
                // Key includes openIdx + highlight so all empty slots
                // remount in sync when the picker opens / closes —
                // keeps every animate-pulse phase aligned.
                key={`${i}-${openIdx ?? "x"}-${highlight ? "h" : "n"}`}
                aria-label={`${ariaLabelPrefix} ${i + 1}`}
                className={`rounded-md flex items-center justify-center transition-all pointer-events-none ${
                  isActive || showHighlight ? "animate-pulse" : ""
                }`}
                style={{
                  width: scaled(w),
                  height: scaled(h),
                  background: isActive
                    ? "oklch(0.696 0.205 155 / 0.20)"
                    : showHighlight
                      ? "oklch(0.696 0.205 155 / 0.12)"
                      : "oklch(0.18 0 0 / 0.6)",
                  border: isActive
                    ? "2px solid oklch(0.696 0.205 155 / 0.85)"
                    : showHighlight
                      ? "2px dashed oklch(0.696 0.205 155 / 0.7)"
                      : "2px dashed oklch(1 0 0 / 0.2)",
                  color:
                    isActive || showHighlight
                      ? "oklch(0.795 0.184 155)"
                      : "oklch(0.5 0 0)",
                  fontSize: scaled(placeholderFontSize),
                  boxShadow: isActive
                    ? "0 0 0 4px oklch(0.696 0.205 155 / 0.25), 0 6px 14px rgba(0,0,0,0.4)"
                    : showHighlight
                      ? "0 0 0 2px oklch(0.696 0.205 155 / 0.18), 0 6px 14px rgba(0,0,0,0.4)"
                      : undefined,
                  transform: isActive ? "scale(1.04)" : undefined,
                }}
              >
                +
              </div>
            );
          }
          const rank = c.slice(0, -1);
          const suit = c.slice(-1);
          return (
            <div
              key={i}
              aria-label={`${ariaLabelPrefix} ${i + 1}`}
              className="relative group"
              style={{ pointerEvents: onClear ? "auto" : "none" }}
            >
              <PlayingCard rank={rank} suit={suit} size={size} />
              {onClear && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear(c);
                  }}
                  className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Clear card"
                >
                  <X size={9} className="text-zinc-200" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {anchor && (
        // `key={openIdx}` remounts the picker each time auto-advance
        // moves to the next slot, so its lazy-initialized focus snaps to
        // the first non-taken card again instead of staying on the card
        // the user just picked.
        <CardPicker
          key={openIdx ?? 0}
          anchor={anchor}
          used={used}
          onPick={handlePick}
          onClose={close}
        />
      )}
    </>
  );
}
