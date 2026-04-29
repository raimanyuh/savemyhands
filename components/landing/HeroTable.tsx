import type { CSSProperties } from "react";

const RING_A = 39;
const RING_B = 32;
const CX = 50;
const CY = 50;

const heroSeatXY = (i: number, total: number) => {
  const theta = Math.PI / 2 + (i * 2 * Math.PI) / total;
  return {
    left: CX + RING_A * Math.cos(theta),
    top: CY + RING_B * Math.sin(theta),
  };
};

const HeroSuitColor: Record<string, string> = {
  "♠": "#0a0a0a",
  "♣": "oklch(0.5 0.16 145)",
  "♦": "oklch(0.5 0.18 250)",
  "♥": "oklch(0.55 0.22 22)",
};

type CardSpec = { rank: string; suit: string };

type HeroPlayingCardProps = {
  rank?: string;
  suit?: string;
  faceDown?: boolean;
  size?: number;
};

export function HeroPlayingCard({
  rank,
  suit,
  faceDown,
  size = 1,
}: HeroPlayingCardProps) {
  const w = 44 * size;
  const h = 62 * size;
  if (faceDown) {
    const back: CSSProperties = {
      width: w,
      height: h,
      borderRadius: 5,
      background: "linear-gradient(135deg, #4a2511 0%, #190a02 100%)",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "rgba(255,255,255,0.18)",
      fontSize: 9 * size,
      letterSpacing: "0.28em",
      fontWeight: 500,
      textTransform: "uppercase",
    };
    return <div style={back}>smh</div>;
  }
  const face: CSSProperties = {
    width: w,
    height: h,
    borderRadius: 5,
    background: "#fafafa",
    color: HeroSuitColor[suit ?? ""] || "#0a0a0a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
    border: "1px solid rgba(0,0,0,0.1)",
    fontWeight: 700,
  };
  return (
    <div style={face}>
      <div style={{ fontSize: 18 * size, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{rank}</div>
      <div style={{ fontSize: 16 * size, lineHeight: 1 }}>{suit}</div>
    </div>
  );
}

type SeatPos = { left: number; top: number };

function HeroBetBubble({ seatPos, amount }: { seatPos: SeatPos; amount: number }) {
  const isBottom = seatPos.top > 60;
  const t = isBottom ? 0.72 : 0.4;
  const left = seatPos.left + t * (50 - seatPos.left);
  const top = seatPos.top + t * (50 - seatPos.top);
  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: `${top}%`,
        transform: "translate(-50%,-50%)",
        display: "flex",
        alignItems: "center",
        gap: 6,
        zIndex: 20,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "linear-gradient(180deg, #fafaf9 0%, #d6d3d1 100%)",
          border: "1.5px dashed #57534e",
          boxShadow: "0 3px 8px rgba(0,0,0,0.55), inset 0 0 0 2px #ffffff",
        }}
      />
      <span
        style={{
          padding: "0 8px",
          height: 22,
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 5,
          fontSize: 11,
          fontWeight: 600,
          color: "#fff",
          background: "rgba(9,9,11,0.85)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.55)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        ${amount}
      </span>
    </div>
  );
}

function HeroDealerButton({ seatPos }: { seatPos: SeatPos }) {
  const dx = seatPos.left - 50;
  const dy = seatPos.top - 50;
  const cos = Math.cos(0.32);
  const sin = Math.sin(0.32);
  const nx = dx * cos - dy * sin;
  const ny = dx * sin + dy * cos;
  const left = 50 + nx * 0.78;
  const top = 50 + ny * 0.78;
  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: `${top}%`,
        transform: "translate(-50%,-50%)",
        zIndex: 30,
        width: 24,
        height: 24,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 32% 28%, #ffffff 0%, #f1f0ee 60%, #c2bfbb 100%)",
        color: "#0a0a0a",
        fontWeight: 900,
        fontSize: 12,
        boxShadow:
          "0 4px 10px rgba(0,0,0,0.6), inset 0 -2px 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        border: "1px solid rgba(0,0,0,0.2)",
      }}
    >
      D
    </div>
  );
}

type HeroSeat = {
  name: string;
  pos: string;
  stack: number;
  cards?: CardSpec[];
  folded: boolean;
  betAmount?: number;
};

const HERO_SEATS: HeroSeat[] = [
  { name: "Hero", pos: "BTN", stack: 412, cards: [{ rank: "A", suit: "♥" }, { rank: "K", suit: "♠" }], folded: false },
  { name: "", pos: "SB", stack: 198, folded: true },
  { name: "Whale", pos: "BB", stack: 1240, folded: false },
  { name: "", pos: "UTG", stack: 305, folded: true },
  { name: "reg_3", pos: "HJ", stack: 287, folded: false, betAmount: 24 },
  { name: "", pos: "CO", stack: 410, folded: true },
];

type HeroTableProps = {
  pot?: number;
  board?: CardSpec[];
};

export function HeroTable({
  pot = 76,
  board = [
    { rank: "A", suit: "♣" },
    { rank: "7", suit: "♦" },
    { rank: "2", suit: "♣" },
  ],
}: HeroTableProps) {
  const seatPositions = HERO_SEATS.map((_, i) => heroSeatXY(i, HERO_SEATS.length));
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "2 / 1" }}>
      {/* Wood rail + felt */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "linear-gradient(180deg, #4a2511 0%, #2c1505 55%, #190a02 100%)",
          boxShadow:
            "0 28px 80px rgba(0,0,0,0.75), 0 6px 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            bottom: 14,
            left: 14,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 50% 30%, #1f7a47 0%, #0e3d22 65%, #082818 100%)",
            boxShadow: "inset 0 0 100px rgba(0,0,0,0.55), inset 0 2px 6px rgba(0,0,0,0.45)",
          }}
        />
      </div>

      {/* Center: pot, wordmark, board */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "clamp(8px, 0.7vw, 11px)",
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Pot
          </span>
          <span
            style={{
              color: "rgba(255,255,255,0.95)",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              fontSize: "clamp(18px, 2.2vw, 32px)",
              lineHeight: 1,
            }}
          >
            ${pot}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {board.map((c, i) => (
            <HeroPlayingCard key={i} rank={c.rank} suit={c.suit} size={0.9} />
          ))}
          {[0, 1].map((i) => (
            <div
              key={`p${i}`}
              style={{
                width: 39.6,
                height: 55.8,
                borderRadius: 5,
                background: "rgba(0,0,0,0.25)",
                border: "1.5px dashed rgba(255,255,255,0.18)",
              }}
            />
          ))}
        </div>
        <span
          style={{
            color: "rgba(255,255,255,0.13)",
            fontWeight: 500,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            fontSize: "clamp(7px, 0.85vw, 11px)",
            marginTop: 4,
          }}
        >
          savemyhands
        </span>
      </div>

      {/* Dealer + bet bubbles */}
      <HeroDealerButton seatPos={seatPositions[0]} />
      {HERO_SEATS.map((s, i) =>
        s.betAmount ? (
          <HeroBetBubble key={`bb${i}`} seatPos={seatPositions[i]} amount={s.betAmount} />
        ) : null,
      )}

      {/* Seat plates */}
      {seatPositions.map((p, i) => {
        const seat = HERO_SEATS[i];
        const isHero = i === 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: `${p.top}%`,
              transform: "translate(-50%,-50%)",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            {!seat.folded && (
              <div style={{ display: "flex", gap: 3, marginBottom: -4 }}>
                {isHero && seat.cards
                  ? seat.cards.map((c, ci) => (
                      <HeroPlayingCard key={ci} rank={c.rank} suit={c.suit} size={0.78} />
                    ))
                  : (
                    <>
                      <HeroPlayingCard faceDown size={0.78} />
                      <HeroPlayingCard faceDown size={0.78} />
                    </>
                  )}
              </div>
            )}
            <div
              style={{
                minWidth: 92,
                padding: "8px 14px",
                borderRadius: 12,
                background: "rgba(9,9,11,0.85)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 8px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                opacity: seat.folded ? 0.45 : 1,
                filter: seat.folded ? "grayscale(0.6)" : "none",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#d4d4d8",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                {seat.pos}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1,
                  color: seat.name ? "#f4f4f5" : "#71717a",
                  fontStyle: seat.name ? "normal" : "italic",
                }}
              >
                {seat.name || (isHero ? "Hero" : "Player")}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: seat.folded ? "#71717a" : "oklch(0.745 0.198 155)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ${seat.stack.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
