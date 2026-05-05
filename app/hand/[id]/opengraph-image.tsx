import { ImageResponse } from "next/og";
import { getHandForViewing } from "@/lib/hands/db";
import { SAMPLE_HAND_ID, getSampleHand } from "@/lib/sample-hand";
import type { SavedHand } from "@/components/poker/hand";

// Per-hand OpenGraph image. Renders when a savemyhands.app/hand/<id>
// link is pasted into Discord / iMessage / Slack / Twitter / etc. Falls
// back to the site-level image (app/opengraph-image.tsx) if the hand
// can't be loaded — Next caches misses too, so we want a fast no-op.

export const alt = "savemyhands hand replay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUIT_COLORS: Record<string, string> = {
  "♠": "#0a0a0a",
  "♣": "#1f8a4c",
  "♦": "#2563eb",
  "♥": "#dc2626",
};

function holeCardCount(gameType: string | undefined): number {
  if (gameType === "PLO5") return 5;
  if (gameType === "PLO4") return 4;
  return 2;
}

function Card({ id, w = 90, h = 130 }: { id: string; w?: number; h?: number }) {
  // Cards come in as `<rank><suit>`; ranks are single chars except "10" is
  // encoded as "T" so we can render the rank without a width gymnastic.
  const rank = id.slice(0, -1);
  const suit = id.slice(-1);
  const color = SUIT_COLORS[suit] ?? "#0a0a0a";
  return (
    <div
      style={{
        width: w,
        height: h,
        background: "#fafafa",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        color,
        fontWeight: 800,
      }}
    >
      <div style={{ fontSize: w * 0.55, lineHeight: 1 }}>{rank}</div>
      <div style={{ fontSize: w * 0.45, lineHeight: 1, marginTop: 4 }}>
        {suit}
      </div>
    </div>
  );
}

function CardRow({
  cards,
  w = 90,
  h = 130,
  gap = 10,
}: {
  cards: string[];
  w?: number;
  h?: number;
  gap?: number;
}) {
  return (
    <div style={{ display: "flex", gap }}>
      {cards.map((c, i) => (
        <Card key={`${c}-${i}`} id={c} w={w} h={h} />
      ))}
    </div>
  );
}

export default async function HandOgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Resolve the hand. Sample hand bypasses the DB. For real hands, RLS
  // filters out private rows for anonymous viewers — exactly what we
  // want here, since social-card crawlers visit unauthenticated.
  let hand: SavedHand | null = null;
  if (id === SAMPLE_HAND_ID) {
    hand = getSampleHand();
  } else {
    const fromDb = await getHandForViewing(id);
    if (fromDb) hand = fromDb.hand;
  }

  // Hand not found / private. Render a minimal branded card and let
  // social platforms move on.
  if (!hand) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#171717",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 200,
              fontWeight: 900,
              letterSpacing: -12,
              color: "#10b981",
              lineHeight: 1,
              display: "flex",
            }}
          >
            smh
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#a3a3a3",
              marginTop: 24,
              display: "flex",
            }}
          >
            savemyhands.app
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const full = hand._full;
  const gameType = full?.gameType ?? "NLHE";
  const playerCount = full?.playerCount;
  const heroSeat = full?.heroPosition ?? 0;
  const hero = full?.players?.find((p) => p.seat === heroSeat);
  const heroCards: string[] = hero?.cards
    ? (hero.cards.filter(Boolean) as string[]).slice(0, holeCardCount(gameType))
    : [];

  // Board(s). `hand.board` mirrors the row's column-store value (length 5
  // padded with "—"); strip the placeholder.
  const board = (hand.board ?? []).filter((c) => c && c !== "—") as string[];
  const board2 = (full?.board2 ?? []).filter(
    (c): c is string => !!c && c !== "—",
  );
  const isDouble = !!full?.doubleBoardOn && board2.length > 0;

  const subtitleParts: string[] = [];
  if (hand.stakes) subtitleParts.push(`$${hand.stakes}`);
  subtitleParts.push(gameType === "NLHE" ? "Hold'em" : `PLO ${gameType.slice(3)}-card`);
  if (full?.bombPotOn) subtitleParts.push("Bomb pot");
  if (isDouble) subtitleParts.push("Double board");
  if (playerCount) subtitleParts.push(`${playerCount}-handed`);
  const subtitle = subtitleParts.join("  ·  ");

  // Sizes — heroCards can be 2 / 4 / 5 wide; board can be 3-5. Pick a card
  // width that lets both fit comfortably on a 1200-wide canvas.
  const heroW = heroCards.length >= 4 ? 72 : 96;
  const heroH = Math.round(heroW * 1.45);
  const boardW = isDouble ? 88 : 108;
  const boardH = Math.round(boardW * 1.45);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle at 50% 60%, #1a3a2a 0%, #0a0a0a 75%)",
          display: "flex",
          flexDirection: "column",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        {/* Header — hand name on left, meta on right */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#fafafa",
              letterSpacing: -1.5,
              lineHeight: 1.1,
              maxWidth: 720,
              display: "flex",
            }}
          >
            {hand.name || "Untitled hand"}
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#a3a3a3",
              textAlign: "right",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
            }}
          >
            <div style={{ display: "flex" }}>{subtitle}</div>
            {hand.loc && hand.loc !== "—" && (
              <div style={{ display: "flex", color: "#737373", fontSize: 18 }}>
                {hand.loc}
              </div>
            )}
          </div>
        </div>

        {/* Body — hero left, board(s) right. Centered vertically in the
            remaining space. */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 20,
            paddingBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 18,
                color: "#737373",
                letterSpacing: 4,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              Hero
            </div>
            {heroCards.length > 0 ? (
              <CardRow cards={heroCards} w={heroW} h={heroH} gap={10} />
            ) : (
              <div style={{ color: "#525252", fontSize: 20, display: "flex" }}>
                Cards hidden
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                fontSize: 18,
                color: "#737373",
                letterSpacing: 4,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              Board
            </div>
            {board.length > 0 ? (
              <CardRow cards={board} w={boardW} h={boardH} gap={10} />
            ) : (
              <div style={{ color: "#525252", fontSize: 20, display: "flex" }}>
                Preflop
              </div>
            )}
            {isDouble && board2.length > 0 && (
              <CardRow cards={board2} w={boardW} h={boardH} gap={10} />
            )}
          </div>
        </div>

        {/* Footer — brand mark + URL */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 38,
              fontWeight: 900,
              letterSpacing: -2,
              color: "#10b981",
              lineHeight: 1,
              display: "flex",
            }}
          >
            smh
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#a3a3a3",
              display: "flex",
            }}
          >
            savemyhands.app/hand/{id}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
