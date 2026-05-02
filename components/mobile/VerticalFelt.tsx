"use client";

// Vertical felt — portrait oval used by the mobile recorder + replayer.
// Hero is anchored bottom-center; opponents sit on a hero-anchored
// portrait ellipse. Coordinates per the design handoff for 6-handed,
// extended in the same spirit for 7 and 8.
//
// Two modes:
//   - mode="record": hero hole cards are clickable (onHeroCardSlot fires
//     with the slot index when an empty slot is tapped).
//   - mode="replay": all cards read-only.
//
// `bottomInset` is reserved when a floating dock sits at the bottom of
// the parent (mobile replayer). When > 0, all seats — including hero —
// lift upward proportionally so the dock can't occlude the hero plate.

import type { RecorderState } from "@/components/poker/engine";
import { isPotLimit } from "@/components/poker/engine";
import FannedPlayingCard from "@/components/poker/FannedPlayingCard";

const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";

type SeatCoord = { left: number; top: number };

// Hand-tuned coordinate maps (% of felt area). Cycle index 0 = BTN sits
// at visual slot 0 (bottom-center, hero); subsequent indices fan
// counter-clockwise around the portrait ellipse so SB is at hero's left
// and so on. These are the *visual* slots, not cycle indices — the felt
// translates between the two.
const SEAT_COORDS_BY_N: Record<number, SeatCoord[]> = {
  6: [
    { left: 50, top: 92 },
    { left: 12, top: 78 },
    { left: 12, top: 38 },
    { left: 50, top: 10 },
    { left: 88, top: 38 },
    { left: 88, top: 78 },
  ],
  7: [
    { left: 50, top: 92 },
    { left: 14, top: 80 },
    { left: 8, top: 50 },
    { left: 26, top: 16 },
    { left: 74, top: 16 },
    { left: 92, top: 50 },
    { left: 86, top: 80 },
  ],
  8: [
    { left: 50, top: 92 },
    { left: 16, top: 82 },
    { left: 8, top: 56 },
    { left: 14, top: 20 },
    { left: 50, top: 8 },
    { left: 86, top: 20 },
    { left: 92, top: 56 },
    { left: 84, top: 82 },
  ],
};

function getSeatCoords(n: number): SeatCoord[] {
  return SEAT_COORDS_BY_N[n] ?? SEAT_COORDS_BY_N[6];
}

// Cycle index (BTN=0, SB=1, …) → visual slot (0=bottom-center hero).
function cycleToVisual(cycleIdx: number, heroPos: number, n: number): number {
  return (cycleIdx - heroPos + n) % n;
}

const POSITION_LABELS: Record<number, string[]> = {
  6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
  7: ["BTN", "SB", "BB", "UTG", "UTG+1", "HJ", "CO"],
  8: ["BTN", "SB", "BB", "UTG", "UTG+1", "MP", "HJ", "CO"],
};

export type VerticalFeltProps = {
  state: RecorderState;
  // Per-seat cumulative chips committed (from committedBySeat). Used to
  // compute current stacks shown on plates.
  committed: Record<number, number>;
  // Active seat (cycle index) — gets the emerald glow ring.
  activeSeat: number | null;
  // Folded seats by cycle index — dimmed.
  foldedSeats: Set<number>;
  // Per-seat per-street commits — drives bet bubble placement. Shape:
  // { [seatCycleIdx]: amount } for the *current* street only.
  streetBets: Record<number, number>;
  // Cycle indices that checked on the current street. Renders a no-chip
  // "check" pill in the bubble slot.
  checkedSeats: Set<number>;
  // True when betting is closed for the current street — drives the
  // emerald pulse on the next-to-deal board slot. Without this gate the
  // pulse would fire mid-betting too, which is misleading.
  streetClosed?: boolean;
  // Reserve this many pixels at the bottom for a floating dock so the
  // hero plate isn't occluded. 0 in the recorder; ~96 in the replayer.
  bottomInset?: number;
  // Recorder click handlers. In replay mode pass undefined.
  onHeroCardSlot?: (slotIdx: number) => void;
  onBoardSlot?: (slotIdx: number, boardIdx: 0 | 1) => void;
};

export function VerticalFelt({
  state,
  committed,
  activeSeat,
  foldedSeats,
  streetBets,
  checkedSeats,
  streetClosed = false,
  bottomInset = 0,
  onHeroCardSlot,
  onBoardSlot,
}: VerticalFeltProps) {
  const N = state.playerCount;
  const heroPos = state.heroPosition;
  const seatCoords = getSeatCoords(N);
  const labels = POSITION_LABELS[N] ?? POSITION_LABELS[6];
  // BTN cycle = 0; convert to its visual slot for the dealer button anchor.
  const btnVisual = cycleToVisual(0, heroPos, N);
  const btnSeatCoord = seatCoords[btnVisual] ?? seatCoords[0];

  // The dock-clearance compression — when bottomInset > 0, lift every
  // seat upward by a fraction of the inset so the hero plate sits
  // visibly above the dock instead of behind it. Per the handoff: hero
  // moves from top:92% to top:78%; side seats follow.
  const liftFactor = bottomInset > 0 ? 14 : 0; // % to subtract from top

  return (
    <div
      className="relative w-full h-full"
      style={{
        background:
          "radial-gradient(ellipse 70% 95% at 50% 50%, var(--smh-mobile-felt-top) 0%, var(--smh-mobile-felt-bottom) 100%)",
        borderRadius: 24,
        boxShadow:
          "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Pot label, centered above the board */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none"
        style={{ top: "30%" }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          POT
        </div>
        <div
          className="font-semibold"
          style={{
            fontSize: 22,
            color: "white",
            fontVariantNumeric: "tabular-nums",
            marginTop: 2,
          }}
        >
          ${potOf(streetBets, committed)}
        </div>
      </div>

      {/* Board cards — centered horizontally. Two stacked rows when
          double-board is on; both rows are visually identical (no B1/B2
          tag) so they read as a paired set rather than primary +
          secondary. The user knows which is which by spatial position. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ top: "42%", gap: 6 }}
      >
        <BoardRow
          board={state.board}
          phase={state.phase}
          boardIdx={0}
          streetClosed={streetClosed}
          onBoardSlot={onBoardSlot}
        />
        {state.doubleBoardOn && (
          <BoardRow
            board={state.board2}
            phase={state.phase}
            boardIdx={1}
            streetClosed={streetClosed}
            onBoardSlot={onBoardSlot}
          />
        )}
      </div>

      {/* Each seat */}
      {Array.from({ length: N }).map((_, visualSlot) => {
        const cycleIdx = (heroPos + visualSlot) % N;
        const player = state.players[cycleIdx];
        const isHero = cycleIdx === heroPos;
        const coord = seatCoords[visualSlot];
        if (!coord || !player) return null;

        const top = Math.max(4, coord.top - liftFactor);
        const folded = foldedSeats.has(cycleIdx);
        const acting = activeSeat === cycleIdx;
        const positionLabel = labels[cycleIdx];
        const stackLeft = (player.stack ?? 0) - (committed[cycleIdx] ?? 0);

        return (
          <div
            key={cycleIdx}
            className="absolute"
            style={{
              left: `${coord.left}%`,
              top: `${top}%`,
              transform: "translate(-50%, -50%)",
              opacity: folded ? 0.45 : 1,
              transition: "top 200ms ease",
            }}
          >
            {/* Hole cards — above the plate. PLO modes render in a
                fan; NLHE keeps the flat 2-card row. */}
            <div
              className="flex justify-center"
              style={{ marginBottom: 4 }}
            >
              {renderHoleCards({
                player,
                isHero,
                phase: state.phase,
                fan: isPotLimit(state.gameType),
                onHeroCardSlot: isHero ? onHeroCardSlot : undefined,
              })}
            </div>

            {/* Plate */}
            <Plate
              positionLabel={positionLabel}
              name={isHero ? "You" : player.name}
              stack={stackLeft}
              acting={acting}
              folded={folded}
              isHero={isHero}
            />
          </div>
        );
      })}

      {/* Bet / check bubbles — separate absolute layer so each bubble
          can be positioned geometrically *toward the felt center*
          rather than inline below its seat plate. Mirrors the desktop
          BetBubble's chipXY math: linear interpolation from the seat's
          position to (50, 50) by a per-seat factor t. Hero gets a
          larger pull (0.45) so the bubble clears the hole-card row;
          other seats get 0.30. */}
      {Array.from({ length: N }).map((_, visualSlot) => {
        const cycleIdx = (heroPos + visualSlot) % N;
        if (foldedSeats.has(cycleIdx)) return null;
        const amount = streetBets[cycleIdx];
        const checked = checkedSeats.has(cycleIdx);
        if (!amount && !checked) return null;
        const coord = seatCoords[visualSlot];
        if (!coord) return null;
        const isHero = cycleIdx === heroPos;
        const seatTop = Math.max(4, coord.top - liftFactor);
        const t = isHero ? 0.45 : 0.3;
        const left = coord.left + t * (50 - coord.left);
        const top = seatTop + t * (50 - seatTop);
        return (
          <div
            key={`bubble-${cycleIdx}`}
            className="absolute flex items-center"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transform: "translate(-50%, -50%)",
              gap: 3,
              zIndex: 25,
              pointerEvents: "none",
            }}
          >
            {amount ? (
              <BetChip amount={amount} />
            ) : (
              <span
                className="font-mono font-semibold"
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "rgba(9,9,11,0.85)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "white",
                }}
              >
                check
              </span>
            )}
          </div>
        );
      })}

      {/* Dealer button — orbits BTN seat */}
      <DealerChip seatCoord={btnSeatCoord} liftFactor={liftFactor} />
    </div>
  );
}

function potOf(
  streetBets: Record<number, number>,
  committed: Record<number, number>,
): number {
  // Display "live" pot — sum of cumulative committed (which already
  // includes streetBets). Mirrors the desktop felt's pot label.
  return Object.values(committed).reduce((s, v) => s + (v || 0), 0) +
    // streetBets that haven't been folded into committed yet contribute
    // visually too — but committedBySeat already includes them, so this
    // second term is normally 0. Kept defensively.
    0 * Object.values(streetBets).reduce((s, v) => s + (v || 0), 0);
}

function BoardRow({
  board,
  phase,
  boardIdx,
  streetClosed,
  onBoardSlot,
}: {
  board: (string | null)[];
  phase: string;
  boardIdx: 0 | 1;
  streetClosed: boolean;
  onBoardSlot?: (slotIdx: number, boardIdx: 0 | 1) => void;
}) {
  return (
    <div className="flex items-center" style={{ gap: 4 }}>
      {board.map((card, idx) => (
        <BoardCard
          key={idx}
          card={card}
          highlighted={
            !card &&
            onBoardSlot !== undefined &&
            streetClosed &&
            isNextBoardSlot(board, idx, phase)
          }
          onClick={
            onBoardSlot ? () => onBoardSlot(idx, boardIdx) : undefined
          }
        />
      ))}
    </div>
  );
}

function isNextBoardSlot(
  board: (string | null)[],
  idx: number,
  phase: string,
): boolean {
  // After a street closes, the NEXT street's slots become deal-able.
  // Map: phase X (with streetClosed) → next-street slot range.
  //   preflop closes → flop slots [0..2]
  //   flop closes    → turn slot [3]
  //   turn closes    → river slot [4]
  // The previous version mapped each phase to its own slots, which was
  // wrong — by the time the user is on the flop phase, the flop cards
  // are already on the felt and there's nothing to highlight there.
  const ranges: Record<string, [number, number]> = {
    preflop: [0, 2],
    flop: [3, 3],
    turn: [4, 4],
  };
  const range = ranges[phase];
  if (!range) return false;
  const [lo, hi] = range;
  if (idx < lo || idx > hi) return false;
  // Pulse only the first empty slot in the range so the user knows
  // exactly where to tap next.
  for (let i = lo; i <= idx; i++) {
    if (board[i]) return false;
    if (i === idx) return true;
  }
  return false;
}

function BoardCard({
  card,
  highlighted,
  onClick,
}: {
  card: string | null;
  highlighted?: boolean;
  onClick?: () => void;
}) {
  if (card) {
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    const suitColor =
      suit === "♠"
        ? "#0a0a0a"
        : suit === "♣"
          ? "oklch(0.5 0.16 145)"
          : suit === "♦"
            ? "oklch(0.5 0.18 250)"
            : "oklch(0.55 0.22 22)";
    return (
      <div
        className="flex flex-col items-center justify-center font-bold"
        style={{
          width: 38,
          height: 54,
          background: "#fafafa",
          borderRadius: 5,
          color: suitColor,
          fontSize: 14,
          boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
          lineHeight: 1,
        }}
      >
        <span>{rank}</span>
        <span style={{ fontSize: 12, marginTop: 1 }}>{suit}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center justify-center"
      style={{
        width: 38,
        height: 54,
        borderRadius: 5,
        background: "oklch(0.215 0 0)",
        border: highlighted
          ? `1.5px solid ${EMERALD_BRIGHT}`
          : "1.5px dashed rgba(255,255,255,0.18)",
        color: highlighted ? EMERALD_BRIGHT : "oklch(0.45 0 0)",
        fontSize: 14,
        boxShadow: highlighted
          ? `0 0 12px oklch(0.745 0.198 155 / 0.4)`
          : "none",
        cursor: onClick ? "pointer" : "default",
        animation: highlighted ? "pulse 1.5s ease-in-out infinite" : "none",
      }}
    >
      +
    </button>
  );
}

function renderHoleCards({
  player,
  isHero,
  phase,
  fan,
  onHeroCardSlot,
}: {
  player: { cards: (string | null)[] | null };
  isHero: boolean;
  phase: string;
  fan: boolean;
  onHeroCardSlot?: (slotIdx: number) => void;
}) {
  const cards = player.cards;
  // Villain pre-showdown: render face-down backs (one per expected card,
  // or two if cards is null). When fanned, backs use the larger
  // FannedPlayingCard dimensions so the fan doesn't visually shrink
  // the moment a villain mucks vs. shows.
  if (!isHero && phase !== "showdown" && phase !== "done") {
    const count = cards?.length ?? 2;
    const items = Array.from({ length: count }).map((_, i) =>
      fan ? <FannedCardBack key={i} size="sm" /> : <CardBack key={i} size="sm" />,
    );
    return fan ? <Fan size="sm">{items}</Fan> : <FlatRow gap={2}>{items}</FlatRow>;
  }
  if (!cards) return null;
  const items = cards.map((c, idx) => {
    if (!c) {
      return fan ? (
        <FannedSlot
          key={idx}
          size={isHero ? "md" : "sm"}
          onClick={onHeroCardSlot ? () => onHeroCardSlot(idx) : undefined}
          highlight={!!onHeroCardSlot && isHero}
        />
      ) : (
        <CardSlot
          key={idx}
          size={isHero ? "md" : "sm"}
          onClick={onHeroCardSlot ? () => onHeroCardSlot(idx) : undefined}
          highlight={!!onHeroCardSlot && isHero}
        />
      );
    }
    if (fan) {
      return (
        <FannedPlayingCard
          key={idx}
          rank={c.slice(0, -1)}
          suit={c.slice(-1)}
          size={isHero ? "md" : "sm"}
        />
      );
    }
    return <CardFace key={idx} card={c} size={isHero ? "md" : "sm"} />;
  });
  return fan ? (
    <Fan size={isHero ? "md" : "sm"}>{items}</Fan>
  ) : (
    <FlatRow gap={2}>{items}</FlatRow>
  );
}

// Fan-mode slot — empty placeholder that matches FannedPlayingCard's
// dimensions exactly so the fan stays visually coherent before all
// cards are picked. Clickable for hero hole cards during setup.
function FannedSlot({
  size,
  onClick,
  highlight,
}: {
  size: "sm" | "md";
  onClick?: () => void;
  highlight?: boolean;
}) {
  const dim = size === "md" ? { w: 50, h: 70 } : { w: 38, h: 54 };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center justify-center"
      style={{
        width: dim.w,
        height: dim.h,
        background: "oklch(0.205 0 0)",
        border: highlight
          ? `2px solid ${EMERALD_BRIGHT}`
          : "2px dashed rgba(255,255,255,0.18)",
        color: highlight ? EMERALD_BRIGHT : "oklch(0.45 0 0)",
        borderRadius: 6,
        fontSize: 16,
        cursor: onClick ? "pointer" : "default",
        boxShadow: highlight
          ? `0 0 12px oklch(0.745 0.198 155 / 0.4)`
          : "none",
        animation: highlight ? "pulse 1.5s ease-in-out infinite" : "none",
      }}
    >
      +
    </button>
  );
}

// Flat row layout — used by NLHE (2 cards) and any non-fan render.
function FlatRow({
  children,
  gap = 2,
}: {
  children: React.ReactNode;
  gap?: number;
}) {
  return (
    <div className="flex" style={{ gap }}>
      {children}
    </div>
  );
}

// Fan layout — children get rotated and offset around a center axis so
// 4-5 cards fit under a seat plate without a wide flat row. Dimensions
// match FannedPlayingCard so the corner-index card design stays
// readable when the right edge of one card overlaps the next.
function Fan({
  children,
  size,
}: {
  children: React.ReactNode;
  size: "sm" | "md";
}) {
  const arr = Array.isArray(children) ? children : [children];
  const n = arr.length;
  // Card dimensions mirror FannedPlayingCard exactly (sm=38×54,
  // md=50×70) so the empty-slot placeholders don't visually mismatch
  // filled cards.
  const cardW = size === "md" ? 50 : 38;
  const cardH = size === "md" ? 70 : 54;
  const angleStep = 7;
  // Wider step on hero cards for legibility; tighter on villain cards
  // so a 5-fan still fits under the 64pt-min plate.
  const offsetStep = size === "md" ? 18 : 14;
  const center = (n - 1) / 2;
  const totalWidth = cardW + (n - 1) * offsetStep;
  return (
    <div
      className="relative"
      style={{
        width: totalWidth,
        height: cardH + 12,
      }}
    >
      {arr.map((child, i) => {
        const angle = (i - center) * angleStep;
        const tx = (i - center) * offsetStep;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(-50%, -50%) translate(${tx}px, 0) rotate(${angle}deg)`,
              transformOrigin: "center",
              zIndex: i,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}

function CardFace({ card, size }: { card: string; size: "sm" | "md" }) {
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const dim = size === "md" ? { w: 38, h: 52, font: 14 } : { w: 22, h: 30, font: 10 };
  const suitColor =
    suit === "♠"
      ? "#0a0a0a"
      : suit === "♣"
        ? "oklch(0.5 0.16 145)"
        : suit === "♦"
          ? "oklch(0.5 0.18 250)"
          : "oklch(0.55 0.22 22)";
  return (
    <div
      className="flex flex-col items-center justify-center font-bold"
      style={{
        width: dim.w,
        height: dim.h,
        background: "#fafafa",
        borderRadius: 5,
        color: suitColor,
        fontSize: dim.font,
        boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
        lineHeight: 1,
      }}
    >
      <span>{rank}</span>
      <span style={{ fontSize: dim.font - 2, marginTop: 1 }}>{suit}</span>
    </div>
  );
}

function CardSlot({
  size,
  onClick,
  highlight,
}: {
  size: "sm" | "md";
  onClick?: () => void;
  highlight?: boolean;
}) {
  const dim = size === "md" ? { w: 38, h: 52 } : { w: 22, h: 30 };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center justify-center"
      style={{
        width: dim.w,
        height: dim.h,
        background: "oklch(0.215 0 0)",
        border: highlight
          ? `1.5px solid ${EMERALD_BRIGHT}`
          : "1.5px dashed rgba(255,255,255,0.18)",
        color: highlight ? EMERALD_BRIGHT : "oklch(0.45 0 0)",
        borderRadius: 5,
        fontSize: 12,
        cursor: onClick ? "pointer" : "default",
        boxShadow: highlight
          ? `0 0 12px oklch(0.745 0.198 155 / 0.4)`
          : "none",
        animation: highlight ? "pulse 1.5s ease-in-out infinite" : "none",
      }}
    >
      +
    </button>
  );
}

function CardBack({ size }: { size: "sm" | "md" }) {
  const dim = size === "md" ? { w: 38, h: 52 } : { w: 22, h: 30 };
  return (
    <div
      style={{
        width: dim.w,
        height: dim.h,
        background: "linear-gradient(135deg, #6b1722 0%, #2a0608 100%)",
        borderRadius: 5,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
      }}
    />
  );
}

// Card back at FannedPlayingCard dimensions — used in fan mode so the
// face-down stack matches the size of the face-up FannedPlayingCard.
function FannedCardBack({ size }: { size: "sm" | "md" }) {
  const dim = size === "md" ? { w: 50, h: 70 } : { w: 38, h: 54 };
  return (
    <div
      style={{
        width: dim.w,
        height: dim.h,
        background: "linear-gradient(135deg, #6b1722 0%, #2a0608 100%)",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 3px 8px rgba(0,0,0,0.5)",
      }}
    />
  );
}

function Plate({
  positionLabel,
  name,
  stack,
  acting,
  folded,
  isHero,
}: {
  positionLabel: string;
  name: string;
  stack: number;
  acting: boolean;
  folded: boolean;
  isHero: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center"
      style={{
        background: "oklch(0.18 0 0)",
        border: acting
          ? `1px solid ${EMERALD_BRIGHT}`
          : "1px solid rgba(255,255,255,0.10)",
        borderRadius: 999,
        padding: "5px 10px",
        minWidth: 64,
        gap: 1,
        boxShadow: acting
          ? `0 0 0 2px oklch(0.696 0.205 155 / 0.25), 0 6px 14px rgba(0,0,0,0.5)`
          : "0 6px 14px rgba(0,0,0,0.5)",
      }}
    >
      <span
        className="font-semibold"
        style={{
          fontSize: 8,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: EMERALD_BRIGHT,
          lineHeight: 1,
        }}
      >
        {positionLabel}
      </span>
      {!folded && (
        <>
          <span
            className="font-medium"
            style={{
              fontSize: 11,
              color: isHero ? "white" : "oklch(0.92 0 0)",
              lineHeight: 1.1,
              maxWidth: 80,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name || (isHero ? "You" : "—")}
          </span>
          <span
            className="font-semibold font-mono"
            style={{
              fontSize: 11,
              color: EMERALD_BRIGHT,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            ${stack.toLocaleString()}
          </span>
        </>
      )}
    </div>
  );
}

function BetChip({ amount }: { amount: number }) {
  return (
    <>
      <span
        className="rounded-full"
        style={{
          width: 14,
          height: 14,
          background: "linear-gradient(180deg, #fafaf9 0%, #d6d3d1 100%)",
          border: "1.5px dashed #57534e",
          boxShadow:
            "0 3px 6px rgba(0,0,0,0.55), inset 0 0 0 1.5px #ffffff",
        }}
      />
      <span
        className="font-semibold font-mono"
        style={{
          fontSize: 9,
          padding: "2px 5px",
          borderRadius: 4,
          background: "rgba(9,9,11,0.85)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "white",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        ${amount}
      </span>
    </>
  );
}

function DealerChip({
  seatCoord,
  liftFactor,
}: {
  seatCoord: SeatCoord;
  liftFactor: number;
}) {
  // Sit just inside the seat toward the table center, slightly offset
  // counter-clockwise so it doesn't collide with the bet bubble.
  const cx = 50;
  const cy = 50;
  const dx = seatCoord.left - cx;
  const dy = seatCoord.top - cy;
  const angle = 0.32; // radians, CCW
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const nx = dx * cos - dy * sin;
  const ny = dx * sin + dy * cos;
  const left = cx + nx * 0.78;
  const top = cy + ny * 0.78 - liftFactor * 0.78;
  return (
    <div
      className="absolute flex items-center justify-center font-black pointer-events-none"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: "translate(-50%, -50%)",
        width: 18,
        height: 18,
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 32% 28%, #ffffff 0%, #f1f0ee 60%, #c2bfbb 100%)",
        color: "#0a0a0a",
        fontSize: 10,
        boxShadow:
          "0 4px 10px rgba(0,0,0,0.6), inset 0 -2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        border: "1px solid rgba(0,0,0,0.2)",
        transition: "top 200ms ease",
      }}
    >
      D
    </div>
  );
}
