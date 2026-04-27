"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import PlayingCard from "./PlayingCard";

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

function CardPicker({
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

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!anchor) return null;

  const rect = anchor.getBoundingClientRect();
  const W = 264;
  const H = 248;
  let left = rect.left + rect.width / 2 - W / 2;
  let top = rect.bottom + 8;
  left = Math.max(8, Math.min(window.innerWidth - W - 8, left));
  if (top + H > window.innerHeight - 8) top = rect.top - H - 8;

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
      <div className="p-2 grid grid-cols-4 gap-1">
        {SUITS.map((s) => (
          <div key={s} className="flex flex-col gap-1">
            <div
              className="text-center text-[14px] leading-none py-1"
              style={{ color: pickerSuitColor(s) }}
            >
              {s}
            </div>
            {RANKS.map((r) => {
              const id = r + s;
              const taken = used.has(id);
              return (
                <button
                  key={id}
                  disabled={taken}
                  onClick={() => onPick(id)}
                  className={`h-6 rounded text-[12px] font-bold tabular-nums leading-none transition-colors ${
                    taken
                      ? "opacity-25 cursor-not-allowed"
                      : "hover:bg-white/10 cursor-pointer"
                  }`}
                  style={{
                    color: pickerSuitColor(s),
                    background: taken ? "rgba(255,255,255,0.04)" : "transparent",
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        ))}
      </div>
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
