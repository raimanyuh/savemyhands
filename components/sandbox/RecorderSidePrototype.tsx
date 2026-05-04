"use client";

// Side-by-side recorder layout prototype. Static / non-interactive — the
// felt and panels are populated from a hardcoded mid-hand snapshot so the
// layout can be evaluated visually. Toggle in the header flips between
// the existing "stacked" arrangement and the proposed "side" arrangement.
//
// When the real implementation lands this entire file (and `app/sandbox/`)
// can be deleted.

import { useState, type CSSProperties } from "react";
import HandFan from "@/components/poker/HandFan";
import PlayingCard from "@/components/poker/PlayingCard";
import { seatXY } from "@/components/poker/lib";
import { scaled } from "@/components/poker/scale";
import {
  BetBubble,
  DealerButtonChip,
  TableSurface,
} from "@/components/poker/table-pieces";
import { VerticalActionPanel } from "./VerticalActionPanel";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";

// 6-handed mid-preflop snapshot. Hero on BTN with AKs, CO 3-bet to $30,
// hero is to act facing $30 to call (min-raise to $50). Pot is $5 + $10
// + $30 = $45.
const SEATS = [
  { cycleIdx: 0, pos: "BTN", name: "Hero", stack: 1500, cards: ["A♠", "K♠"] as (string | null)[], folded: false, bet: 0, isHero: true, active: true },
  { cycleIdx: 1, pos: "SB", name: "Whale", stack: 1495, cards: null, folded: false, bet: 5, isHero: false, active: false },
  { cycleIdx: 2, pos: "BB", name: "Tom", stack: 1490, cards: null, folded: false, bet: 10, isHero: false, active: false },
  { cycleIdx: 3, pos: "UTG", name: "Mike", stack: 1500, cards: null, folded: true, bet: 0, isHero: false, active: false },
  { cycleIdx: 4, pos: "MP", name: "Riley", stack: 1500, cards: null, folded: true, bet: 0, isHero: false, active: false },
  { cycleIdx: 5, pos: "CO", name: "Marco", stack: 1470, cards: null, folded: false, bet: 30, isHero: false, active: false },
];
const POT = 45;
const TO_CALL = 30;
const MIN_RAISE = 50;
const MAX_ALLOWED = 1500; // hero's all-in
const CHIPS = [
  { id: "half", label: "½ pot", amount: 68 },
  { id: "twothird", label: "⅔ pot", amount: 80 },
  { id: "pot", label: "Pot", amount: 105 },
  { id: "overpot", label: "1.25×", amount: 124 },
  { id: "allin", label: "All-in", amount: 1500 },
];

const HERO_POS = 0;
const PLAYER_COUNT = 6;

export default function RecorderSidePrototype() {
  // The two screenshots the user wants to compare. Side mode is the new
  // proposal; stacked mirrors what production looks like today.
  const [layout, setLayout] = useState<"side" | "stacked">("side");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      <PrototypeBanner layout={layout} setLayout={setLayout} />

      {/* Mock header — stripped-down version of Shell's Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <span className="text-sm text-muted-foreground">← Dashboard</span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>draft · preflop</span>
          <button
            type="button"
            className="h-7 px-3 rounded-md text-xs font-semibold"
            style={{ background: EMERALD, color: "oklch(0.145 0 0)" }}
          >
            Save hand
          </button>
        </div>
      </header>

      {/* Mock meta strip */}
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-semibold mb-2">New hand</h1>
        <div className="flex items-center gap-3 text-xs">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md border"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            ⚙ Stakes &amp; seats · $5/$10 · 6-max
          </span>
          <span
            className="inline-flex items-center px-2 h-6 rounded-md text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{
              background: "oklch(0.696 0.205 155 / 0.18)",
              color: "oklch(0.795 0.184 155)",
              border: "1px solid oklch(0.696 0.205 155 / 0.4)",
            }}
          >
            preflop
          </span>
          <span className="text-zinc-500 tabular-nums">pot ${POT}</span>
          <div className="flex-1" />
          <span className="text-zinc-500">BTN to act</span>
        </div>
      </div>

      {/* Page body — switches between stacked and side layouts */}
      {layout === "side" ? <SideLayout /> : <StackedLayout />}
    </div>
  );
}

function PrototypeBanner({
  layout,
  setLayout,
}: {
  layout: "side" | "stacked";
  setLayout: (l: "side" | "stacked") => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-6 py-2 text-[11px]"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.42 0.12 155 / 0.18) 0%, oklch(0.42 0.12 155 / 0.06) 100%)",
        borderBottom: "1px solid oklch(0.696 0.205 155 / 0.25)",
      }}
    >
      <span className="text-zinc-300">
        <span
          className="font-semibold uppercase tracking-[0.22em] mr-2"
          style={{ color: EMERALD_BRIGHT }}
        >
          prototype
        </span>
        Recorder layout sketch · static, non-interactive · resize the window
        to see how the proposed layout adapts
      </span>
      <div className="flex items-center gap-1">
        <ToggleBtn
          active={layout === "side"}
          onClick={() => setLayout("side")}
        >
          Side-by-side (proposed)
        </ToggleBtn>
        <ToggleBtn
          active={layout === "stacked"}
          onClick={() => setLayout("stacked")}
        >
          Stacked (current)
        </ToggleBtn>
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 h-7 rounded-md text-[11px] font-medium cursor-pointer transition-colors"
      style={
        active
          ? {
              background: EMERALD,
              color: "oklch(0.145 0 0)",
              border: "1px solid oklch(0.745 0.198 155 / 0.6)",
            }
          : {
              background: "transparent",
              color: "rgba(255,255,255,0.65)",
              border: "1px solid rgba(255,255,255,0.10)",
            }
      }
    >
      {children}
    </button>
  );
}

// ─── Felt (shared by both layouts) ────────────────────────────────────────

function Felt() {
  const visualSeatPos = Array.from({ length: PLAYER_COUNT }, (_, i) =>
    seatXY(i, PLAYER_COUNT),
  );
  const visualOf = (cycleIdx: number) =>
    (cycleIdx - HERO_POS + PLAYER_COUNT) % PLAYER_COUNT;

  return (
    <TableSurface>
      {/* Pot label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
        style={{
          transform: `translateY(calc(-34px * var(--smh-u, 1)))`,
          gap: scaled(8),
        }}
      >
        <span
          className="inline-flex items-center rounded-lg font-semibold tabular-nums text-white"
          style={{
            paddingInline: scaled(12),
            height: scaled(32),
            fontSize: scaled(18),
            background: "rgba(9,9,11,0.85)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 6px 16px rgba(0,0,0,0.6)",
          }}
        >
          ${POT}
        </span>
        {/* Empty board slots */}
        <div className="flex" style={{ gap: scaled(6) }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <PlayingCard key={i} />
          ))}
        </div>
      </div>

      {/* Seats */}
      {SEATS.map((s) => {
        const visualI = visualOf(s.cycleIdx);
        const pos = visualSeatPos[visualI];
        const dimmed = s.folded;
        return (
          <div
            key={s.cycleIdx}
            className="absolute z-10"
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              transform: "translate(-50%,-50%)",
            }}
          >
            <div
              className={`flex flex-col items-center rounded-xl text-center border transition-all ${
                s.active
                  ? "border-[oklch(0.696_0.205_155_/_0.6)]"
                  : "border-white/10"
              }`}
              style={{
                minWidth: scaled(100),
                paddingInline: scaled(16),
                paddingBlock: scaled(10),
                gap: scaled(6),
                opacity: dimmed ? 0.32 : 1,
                filter: dimmed ? "grayscale(0.6)" : "none",
                background: s.active
                  ? "rgba(20, 60, 40, 0.85)"
                  : "rgba(9,9,11,0.85)",
                backdropFilter: "blur(10px)",
                boxShadow: s.active
                  ? "0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px oklch(0.696 0.205 155 / 0.4)"
                  : "0 8px 20px rgba(0,0,0,0.55)",
              }}
            >
              <span
                className="font-semibold text-zinc-300 leading-none tracking-[0.14em] uppercase"
                style={{ fontSize: scaled(12) }}
              >
                {s.pos}
              </span>
              <span
                className="font-medium leading-none"
                style={{ fontSize: scaled(13) }}
              >
                {s.name}
              </span>
              <span
                className={`font-semibold leading-none tabular-nums ${
                  dimmed
                    ? "text-[oklch(0.55_0_0)]"
                    : "text-[oklch(0.745_0.198_155)]"
                }`}
                style={{ fontSize: scaled(13) }}
              >
                ${s.stack.toLocaleString()}
              </span>
              {s.folded && (
                <span
                  className="font-semibold uppercase tracking-[0.18em] text-[oklch(0.55_0_0)] leading-none"
                  style={{ fontSize: scaled(9) }}
                >
                  Folded
                </span>
              )}
            </div>
            {/* Hero hole cards / villain backs */}
            {s.isHero && s.cards && (
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: scaled(-96) }}
              >
                <HandFan
                  cards={s.cards}
                  size="md"
                  fan={false}
                  faceDown={false}
                />
              </div>
            )}
            {!s.isHero && !s.folded && (
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: scaled(-56) }}
              >
                <HandFan
                  cards={[null, null]}
                  size="sm"
                  fan={false}
                  faceDown
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Bet bubbles */}
      {SEATS.filter((s) => s.bet > 0).map((s) => {
        const visualI = visualOf(s.cycleIdx);
        return (
          <BetBubble
            key={s.cycleIdx}
            seatPos={visualSeatPos[visualI]}
            amount={s.bet}
            isHero={visualI === 0}
          />
        );
      })}

      {/* Dealer button */}
      <DealerButtonChip seatPos={visualSeatPos[visualOf(0)]} />
    </TableSurface>
  );
}

// ─── Layout A: Side-by-side (proposed) ────────────────────────────────────
//
// Felt occupies the left + most of the page; action panel and notes
// stack vertically in a ~400px right column. Felt's max-width respects
// remaining horizontal space; the height-driven cap shrinks because no
// action area sits below the felt eating vertical budget.

function SideLayout() {
  return (
    <div
      className="flex-1 flex gap-6 px-6 pb-6 items-start"
      style={
        {
          // Smaller chrome reservation than stacked mode — only header +
          // meta + paddings sit above the felt; nothing below it.
          "--smh-u":
            "clamp(0.65, calc((100vh - 200px) / 640px), 1.5)",
        } as React.CSSProperties
      }
    >
      {/* Felt column — flex-1, max-width capped so very wide screens
          don't blow out the felt absurdly. */}
      <div className="flex-1 flex justify-center min-w-0">
        <div
          className="w-full"
          style={{
            maxWidth: "calc((100vh - 200px) * 2)",
          }}
        >
          <Felt />
        </div>
      </div>

      {/* Right column — fixed width, action panel + notes stacked. The
          column is capped at the same height as the felt so the page
          never overflows the viewport. Action panel takes its natural
          height; notes flexes into the remaining space (and scrolls
          internally when there's not much room). */}
      <div
        className="flex flex-col gap-3 shrink-0"
        style={{
          width: 380,
          maxHeight: "calc(100vh - 200px)",
        }}
      >
        <VerticalActionPanel
          posName="BTN"
          heroName="Hero"
          liveStack={1500}
          toCall={TO_CALL}
          minRaise={MIN_RAISE}
          maxAllowed={MAX_ALLOWED}
          pot={POT}
          chips={CHIPS}
          canCheck={false}
          hasUndo={true}
        />
        <NotesPanel fill />
      </div>
    </div>
  );
}

// ─── Layout B: Stacked (current production) ──────────────────────────────

function StackedLayout() {
  return (
    <div
      className="flex-1 flex flex-col gap-3 px-6 pb-6"
      style={
        {
          "--smh-u":
            "clamp(0.65, calc((100vh - 360px) / 640px), 1.0)",
        } as React.CSSProperties
      }
    >
      {/* Felt */}
      <div className="self-stretch flex justify-center">
        <div
          className="w-full"
          style={{ maxWidth: "calc((100vh - 360px) * 2)" }}
        >
          <Felt />
        </div>
      </div>

      {/* Below-felt: action bar (left) + notes (right) */}
      <div className="self-stretch flex flex-col lg:flex-row gap-3 items-stretch">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <FakeHorizontalActionBar />
        </div>
        <div className="w-full lg:w-[320px] lg:flex-shrink-0">
          <NotesPanel />
        </div>
      </div>
    </div>
  );
}

// Visual mock of the existing horizontal ActionBar — just enough fidelity
// for side-by-side comparison against the new vertical panel.
function FakeHorizontalActionBar() {
  return (
    <div
      className="rounded-2xl border border-white/10 w-full overflow-hidden"
      style={{
        maxWidth: scaled(1100),
        background: "rgba(15,15,18,0.88)",
      }}
    >
      <div
        className="flex flex-col border-b border-white/8"
        style={{
          paddingInline: scaled(18),
          paddingBlock: scaled(14),
          gap: scaled(10),
          background: "oklch(0.165 0 0)",
        }}
      >
        <span
          className="font-semibold uppercase tracking-[0.22em] text-zinc-400"
          style={{ fontSize: scaled(10) }}
        >
          Bet sizing
        </span>
        <div className="flex" style={{ gap: scaled(6) }}>
          {CHIPS.map((c) => (
            <div
              key={c.id}
              className="flex-1 rounded-lg flex flex-col items-center justify-center"
              style={{
                height: scaled(50),
                gap: scaled(2),
                background: "oklch(1 0 0 / 0.04)",
                border: "1px solid oklch(1 0 0 / 0.10)",
                color: "#e4e4e7",
              }}
            >
              <span
                className="font-semibold"
                style={{ fontSize: scaled(12) }}
              >
                {c.label}
              </span>
              <span
                className="tabular-nums"
                style={{ fontSize: scaled(11), opacity: 0.75 }}
              >
                ${c.amount}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center" style={{ gap: scaled(12) }}>
          <span
            className="text-zinc-500 tabular-nums"
            style={{ fontSize: scaled(11), minWidth: scaled(36) }}
          >
            ${MIN_RAISE}
          </span>
          <input
            type="range"
            min={MIN_RAISE}
            max={MAX_ALLOWED}
            defaultValue={MIN_RAISE}
            className="flex-1 accent-[oklch(0.696_0.205_155)]"
          />
          <span
            className="text-zinc-500 tabular-nums text-right"
            style={{ fontSize: scaled(11), minWidth: scaled(56) }}
          >
            ${MAX_ALLOWED}
          </span>
          <input
            type="number"
            defaultValue={MIN_RAISE}
            className="text-center tabular-nums rounded-md"
            style={{
              width: scaled(96),
              height: scaled(32),
              fontSize: scaled(14),
              background: "rgba(9,9,11,0.6)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#fafaf9",
              paddingInline: 8,
            }}
          />
        </div>
      </div>
      <div
        className="flex items-center"
        style={{
          paddingInline: scaled(18),
          paddingBlock: scaled(12),
          gap: scaled(10),
        }}
      >
        <div className="flex items-center" style={{ gap: scaled(8) }}>
          <span
            className="font-bold uppercase tracking-[0.16em] inline-flex items-center rounded"
            style={{
              fontSize: scaled(10),
              paddingInline: scaled(6),
              height: scaled(20),
              background: "oklch(0.696 0.205 155 / 0.18)",
              color: "oklch(0.795 0.184 155)",
              border: "1px solid oklch(0.696 0.205 155 / 0.4)",
            }}
          >
            BTN
          </span>
          <span
            className="font-medium text-zinc-100"
            style={{ fontSize: scaled(13) }}
          >
            Hero
          </span>
          <span
            className="text-zinc-500 tabular-nums"
            style={{ fontSize: scaled(11) }}
          >
            ${(1500).toLocaleString()}
          </span>
        </div>
        <div
          className="flex-1 flex justify-center"
          style={{ gap: scaled(8) }}
        >
          <div
            className="rounded-lg inline-flex items-center justify-center"
            style={{
              width: scaled(130),
              height: scaled(48),
              background: "oklch(0.704 0.191 22.216 / 0.12)",
              border: "1px solid oklch(0.704 0.191 22.216 / 0.4)",
              color: "oklch(0.78 0.191 22.216)",
              fontSize: scaled(14),
              fontWeight: 600,
            }}
          >
            Fold
          </div>
          <div
            className="rounded-lg inline-flex items-center justify-center"
            style={{
              width: scaled(130),
              height: scaled(48),
              background: "oklch(1 0 0 / 0.06)",
              border: "1px solid oklch(1 0 0 / 0.15)",
              color: "#f4f4f5",
              fontSize: scaled(14),
              fontWeight: 500,
            }}
          >
            Call $30
          </div>
          <div
            className="rounded-lg inline-flex items-center justify-center"
            style={{
              width: scaled(200),
              height: scaled(48),
              background: EMERALD,
              color: "oklch(0.145 0 0)",
              fontSize: scaled(14),
              fontWeight: 700,
            }}
          >
            Raise to $50
          </div>
        </div>
        <span
          className="text-zinc-500 inline-flex items-center gap-1.5 cursor-pointer"
          style={{ fontSize: scaled(12) }}
        >
          ↺ Undo
        </span>
      </div>
    </div>
  );
}

// ─── Notes panel (shared by both layouts) ────────────────────────────────

function NotesPanel({ fill = false }: { fill?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-1.5 ${fill ? "flex-1 min-h-0" : ""}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground shrink-0">
        Notes
      </span>
      <textarea
        defaultValue=""
        placeholder="Articulate your read, decision points, anything you want the viewer to know."
        className={`w-full rounded-lg p-3 text-[14px] outline-none ${fill ? "flex-1 min-h-[60px] resize-none" : "min-h-[120px] resize-y"}`}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "#fafaf9",
        }}
      />
    </div>
  );
}

// Suppress an unused-helper warning when CSSProperties helpers aren't
// referenced after edits; keeps the file lint-clean.
export type _PrototypeKeep = CSSProperties;
