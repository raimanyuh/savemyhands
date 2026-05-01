// Renders an array of cards as either a flat row or a rotated fan.
// Used by the Replayer and the Recorder's villain face-down stacks —
// anywhere we need to display N hole cards consistently (face-up or
// face-down). The picker / interactive slots live in `CardPicker.tsx`;
// this is the read-only visual.

import PlayingCard from "./PlayingCard";
import FannedPlayingCard from "./FannedPlayingCard";

export default function HandFan({
  cards,
  size = "md",
  fan,
  faceDown,
}: {
  cards: (string | null | undefined)[];
  size?: "sm" | "md";
  fan: boolean;
  faceDown: boolean;
}) {
  if (!fan) {
    return (
      <div className={`flex ${size === "sm" ? "gap-1" : "gap-1.5"}`}>
        {cards.map((c, i) =>
          faceDown || !c ? (
            <PlayingCard key={i} faceDown size={size} />
          ) : (
            <PlayingCard
              key={i}
              rank={c.slice(0, -1)}
              suit={c.slice(-1)}
              size={size}
            />
          ),
        )}
      </div>
    );
  }
  // Fan dimensions match FannedPlayingCard + the picker's fan slots so
  // the seat plate's hole-card area looks coherent before, during, and
  // after a reveal.
  const w = size === "sm" ? 38 : 50;
  const h = size === "sm" ? 54 : 70;
  const angleStep = 7;
  const offsetStep = size === "sm" ? 14 : 18;
  const n = cards.length;
  const center = (n - 1) / 2;
  return (
    <div
      className="relative"
      style={{ width: w + (n - 1) * offsetStep, height: h + 12 }}
    >
      {cards.map((c, i) => {
        const angle = (i - center) * angleStep;
        const tx = (i - center) * offsetStep;
        const style: React.CSSProperties = {
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) translate(${tx}px, 0) rotate(${angle}deg)`,
          transformOrigin: "center",
          zIndex: i,
        };
        if (faceDown || !c) {
          return (
            <div key={i} style={style}>
              <PlayingCard faceDown size={size} />
            </div>
          );
        }
        return (
          <div key={i} style={style}>
            <FannedPlayingCard
              rank={c.slice(0, -1)}
              suit={c.slice(-1)}
              size={size}
            />
          </div>
        );
      })}
    </div>
  );
}
