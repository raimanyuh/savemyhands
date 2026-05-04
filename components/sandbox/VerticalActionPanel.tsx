"use client";

// Sketched vertical layout for the recorder's action bar — what the
// existing horizontal ActionBar would look like as a ~400px sidebar
// alongside the felt. Static / non-interactive: state setters work but
// nothing dispatches. Used only by the side-by-side prototype.

import { useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_HOVER = "oklch(0.745 0.198 155)";
const EMERALD_FAINT = "oklch(0.696 0.205 155 / 0.18)";
const EMERALD_BORDER = "oklch(0.696 0.205 155 / 0.5)";
const ROSE_FAINT = "oklch(0.704 0.191 22.216 / 0.12)";
const ROSE_BORDER = "oklch(0.704 0.191 22.216 / 0.4)";
const ROSE_TEXT = "oklch(0.78 0.191 22.216)";
const BG_DEEP = "oklch(0.145 0 0)";

type ChipDef = { id: string; label: string; amount: number };

export function VerticalActionPanel({
  posName,
  heroName,
  liveStack,
  toCall,
  minRaise,
  maxAllowed,
  pot,
  chips,
  canCheck,
  hasUndo,
}: {
  posName: string;
  heroName: string;
  liveStack: number;
  toCall: number;
  minRaise: number;
  maxAllowed: number;
  pot: number;
  chips: ChipDef[];
  canCheck: boolean;
  hasUndo: boolean;
}) {
  const [amount, setAmount] = useState(String(minRaise));
  const isBetMode = toCall === 0;
  const amt = Number(amount);
  const cannotBet =
    amt > maxAllowed || (amt < minRaise && amt !== maxAllowed);

  const sliderMin = Math.max(minRaise, 1);
  const sliderMax = Math.max(sliderMin, maxAllowed);
  const sliderVal = Math.min(
    sliderMax,
    Math.max(sliderMin, Number.isFinite(amt) ? amt : sliderMin),
  );

  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden flex flex-col"
      style={{
        background: "rgba(15,15,18,0.88)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Position info pill row */}
      <div
        className="flex items-center gap-2 border-b border-white/8 px-4 py-2"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-[0.16em] px-1.5 h-5 inline-flex items-center rounded"
          style={{
            background: EMERALD_FAINT,
            color: EMERALD_HOVER,
            border: `1px solid ${EMERALD_BORDER}`,
          }}
        >
          {posName}
        </span>
        <span className="text-[13px] font-medium text-zinc-100">
          {heroName}
        </span>
        <div className="flex-1" />
        <span className="text-[12px] text-zinc-400 tabular-nums">
          ${liveStack.toLocaleString()}
        </span>
      </div>

      {/* Bet sizing */}
      <div
        className="px-4 py-2.5 flex flex-col gap-2.5 border-b border-white/8"
        style={{ background: "oklch(0.165 0 0)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Bet sizing
          </span>
          <span className="text-[11px] text-zinc-500 tabular-nums">
            pot ${pot}
          </span>
        </div>

        {/* Chip grid: 2 cols, last chip (Max/All-in) spans full width */}
        <div className="grid grid-cols-2 gap-1.5">
          {chips.map((c, i) => {
            const isLast = i === chips.length - 1;
            const active = String(c.amount) === amount;
            const baseStyle: CSSProperties = {
              gridColumn: isLast ? "span 2" : undefined,
              height: 44,
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              cursor: "pointer",
              transition: "background 120ms ease, border-color 120ms ease",
            };
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setAmount(String(c.amount))}
                style={
                  active
                    ? {
                        ...baseStyle,
                        background: EMERALD_FAINT,
                        border: `1px solid ${EMERALD_BORDER}`,
                        color: "oklch(0.85 0.184 155)",
                      }
                    : {
                        ...baseStyle,
                        background: "oklch(1 0 0 / 0.04)",
                        border: "1px solid oklch(1 0 0 / 0.10)",
                        color: "#e4e4e7",
                      }
                }
              >
                <span className="text-[12px] font-semibold">{c.label}</span>
                <span
                  className="text-[11px] tabular-nums"
                  style={{ opacity: 0.75 }}
                >
                  ${c.amount.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Slider */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] text-zinc-500 tabular-nums"
            style={{ minWidth: 32 }}
          >
            ${sliderMin}
          </span>
          <input
            type="range"
            min={sliderMin}
            max={sliderMax}
            value={sliderVal}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 accent-[oklch(0.696_0.205_155)]"
          />
          <span
            className="text-[11px] text-zinc-500 tabular-nums text-right"
            style={{ minWidth: 48 }}
          >
            ${sliderMax}
          </span>
        </div>

        {/* Amount input — full width below slider */}
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full h-9 px-3 rounded-lg text-[14px] tabular-nums text-zinc-100 outline-none transition-colors"
          style={{
            background: "rgba(9,9,11,0.6)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = EMERALD_BORDER)
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")
          }
        />
      </div>

      {/* Action buttons — stacked vertically */}
      <div className="px-4 py-2.5 flex flex-col gap-2">
        <button
          type="button"
          className="w-full h-11 rounded-lg cursor-pointer flex items-center justify-center gap-2 transition-colors"
          style={{
            background: ROSE_FAINT,
            border: `1px solid ${ROSE_BORDER}`,
            color: ROSE_TEXT,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Fold <Kbd tone="rose">F</Kbd>
        </button>
        {canCheck ? (
          <button
            type="button"
            className="w-full h-11 rounded-lg cursor-pointer flex items-center justify-center gap-2 transition-colors"
            style={{
              background: "oklch(1 0 0 / 0.06)",
              border: "1px solid oklch(1 0 0 / 0.15)",
              color: "#f4f4f5",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Check <Kbd>C</Kbd>
          </button>
        ) : (
          <button
            type="button"
            className="w-full h-11 rounded-lg cursor-pointer flex items-center justify-center gap-2 transition-colors tabular-nums"
            style={{
              background: "oklch(1 0 0 / 0.06)",
              border: "1px solid oklch(1 0 0 / 0.15)",
              color: "#f4f4f5",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Call ${Math.min(toCall, liveStack).toLocaleString()}
            <Kbd>C</Kbd>
          </button>
        )}
        <button
          type="button"
          disabled={cannotBet}
          className="w-full h-11 rounded-lg cursor-pointer flex items-center justify-center gap-2 transition-colors tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: EMERALD,
            border: "none",
            color: BG_DEEP,
            fontSize: 14,
            fontWeight: 700,
            boxShadow: "0 6px 18px oklch(0.696 0.205 155 / 0.3)",
          }}
        >
          {`${isBetMode ? "Bet" : "Raise to"} $${(Number.isFinite(amt) ? amt : 0).toLocaleString()}`}
          <Kbd tone="dark">R</Kbd>
        </button>

        {/* Undo — text link, low emphasis */}
        <button
          type="button"
          disabled={!hasUndo}
          className="text-center text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors py-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
        >
          <RotateCcw size={12} /> Undo last action
        </button>
      </div>
    </div>
  );
}

function Kbd({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "rose" | "dark";
}) {
  const styles: Record<string, CSSProperties> = {
    default: {
      background: "rgba(255,255,255,0.10)",
      color: "#d4d4d8",
      border: "1px solid rgba(255,255,255,0.18)",
    },
    rose: {
      background: "oklch(0.704 0.191 22.216 / 0.18)",
      color: "oklch(0.85 0.191 22.216)",
      border: "1px solid oklch(0.704 0.191 22.216 / 0.4)",
    },
    dark: {
      background: "oklch(0.145 0 0 / 0.55)",
      color: "oklch(0.145 0 0)",
      border: "1px solid oklch(0.145 0 0 / 0.4)",
    },
  };
  return (
    <span
      style={{
        ...styles[tone],
        fontFamily:
          "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 9,
        fontWeight: 700,
        padding: "1px 5px",
        borderRadius: 4,
        lineHeight: 1.2,
        marginLeft: 2,
      }}
    >
      {children}
    </span>
  );
}
