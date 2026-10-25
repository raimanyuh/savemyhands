"use client";

import type { ReactNode } from "react";
import FannedPlayingCard from "./FannedPlayingCard";
import { scaled } from "./scale";
import { BetBubble, DealerButtonChip, NameDisplay, StackDisplay, TableSurface } from "./table-pieces";
import type { StudReplayCard } from "./stud-replay";
import type { StudVariant } from "./game-format";
import { formatStudAmount, studGameLabel } from "./stud-ui";

export function studSeatXY(visualSeat: number, count: number) {
  if (visualSeat === 0) return { left: 50, top: 89 };
  const angle = Math.PI / 2 + visualSeat * 2 * Math.PI / count;
  return { left: 50 + 35 * Math.cos(angle), top: 50 + 30 * Math.sin(angle) };
}
function CardBack({ hero }: { hero: boolean }) {
  return <div className="rounded-md flex items-center justify-center uppercase tracking-[.2em] font-medium" style={{
    width: scaled(hero ? 50 : 38), height: scaled(hero ? 70 : 54), fontSize: scaled(hero ? 10 : 8),
    background: "linear-gradient(135deg, #6b1722 0%, #2a0608 100%)", color: "rgba(255,255,255,.2)",
    border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 4px 10px rgba(0,0,0,.5)",
  }}>smh</div>;
}
/** Physical down/up orientation and visible identity are separate. Never
 * trust a card value on a face-down opponent slot, including animations. */
export function StudCards({ slots, previousSlots, hero = false }: {
  slots: StudReplayCard[]; previousSlots?: StudReplayCard[]; hero?: boolean;
}) {
  const width = hero ? 50 : 38;
  const height = hero ? 70 : 54;
  const offset = (index: number) => hero ? index * 56 : index < 2 ? index * 19 : 42 + (index - 2) * 41;
  const faceOf = (slot: StudReplayCard) => {
    const card = slot.faceUp ? slot.card : undefined;
    return card ? <FannedPlayingCard rank={card.slice(0, -1)} suit={card.slice(-1)} size={hero ? "md" : "sm"} /> : <CardBack hero={hero} />;
  };
  return <div className="relative" style={{ width: scaled(offset(6) + width), height: scaled(height + 16) }}>
    {slots.map((slot, index) => {
      const card = slot.faceUp ? slot.card : undefined;
      const label = slot.present ? card ?? "Hidden card" : "Empty card slot";
      return <div key={index} className="absolute" aria-label={label} data-card-slot={index + 1} data-dealt={slot.visibility}
        style={{ left: scaled(offset(index)), top: 0, width: scaled(width), height: scaled(height), zIndex: index }}>
        {slot.present ? <div key={card ?? "back"} className="smh-draw-card-enter">{faceOf(slot)}</div>
          : <><div className="rounded-md border border-dashed border-white/10" style={{ width: scaled(width), height: scaled(height) }} />
            {previousSlots?.[index]?.present && <div aria-hidden="true" className="smh-draw-card-leave">{faceOf(previousSlots[index])}</div>}</>}
        <span className={`absolute top-full mt-1 inset-x-0 text-center uppercase tracking-wider ${slot.visibility === "down" ? "text-rose-200/60" : "text-emerald-200/60"}`} style={{ fontSize: scaled(hero ? 8 : 7) }}>
          {hero || index >= 2 ? slot.visibility : index === 0 ? "down" : ""}
        </span>
      </div>;
    })}
  </div>;
}

export default function StudTable({ players, heroSeat, dealerSeat, cards, sharedCard, pot, round, active, variant = "STUD_HIGH",
  committed = {}, bets = {}, folded = [], mucked = [], labels = {}, winnings = {}, previousCards,
  onEditPlayer, onEditCards, heroCards,
}: {
  players: { seat: number; name: string; stack: number }[];
  variant?: StudVariant;
  heroSeat: number; dealerSeat: number; cards: Record<number, StudReplayCard[]>; sharedCard?: StudReplayCard;
  previousCards?: Record<number, StudReplayCard[]>; pot: number; round: string; active?: number | null;
  committed?: Record<number, number>; bets?: Record<number, number>; folded?: number[]; mucked?: number[];
  labels?: Record<number, string>; winnings?: Record<number, number>; heroCards?: ReactNode;
  onEditPlayer?: (seat: number, patch: { name?: string; stack?: number }) => void;
  onEditCards?: (seat: number) => void;
}) {
  const count = players.length;
  const visual = (seat: number) => (seat - heroSeat + count) % count;
  return <TableSurface className={count >= 6 ? "smh-stud-dense" : undefined} aspectRatio={count >= 6 ? "var(--smh-stud-aspect)" : "2 / 1"}>
    <div className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none" style={{ left: "50%", top: "48%", gap: scaled(22) }}>
      <div className="flex flex-col items-center text-center" style={{ gap: scaled(7) }}>
        <span className="uppercase tracking-[.18em] font-semibold text-emerald-100/45" style={{ fontSize: scaled(11) }}>{studGameLabel(variant)}</span>
        <span className="rounded-lg border border-white/15 bg-zinc-950/80 text-white tabular-nums font-semibold" style={{ padding: `${scaled(6)} ${scaled(15)}`, fontSize: scaled(24) }}>${pot.toLocaleString()}</span>
        <span className="uppercase tracking-wider text-white/40 whitespace-nowrap" style={{ fontSize: scaled(10) }}>{round}</span>
      </div>
      {sharedCard?.present && <div className="flex flex-col items-center" style={{ gap: scaled(5) }} aria-label="Shared seventh card">
        <div className="smh-draw-card-enter">{sharedCard.faceUp && sharedCard.card ? <FannedPlayingCard rank={sharedCard.card.slice(0, -1)} suit={sharedCard.card.slice(-1)} /> : <CardBack hero />}</div>
        <span className="text-emerald-200 uppercase tracking-wider whitespace-nowrap" style={{ fontSize: scaled(8) }}>Shared 7th</span>
      </div>}
    </div>
    {players.map((player) => {
      const hero = player.seat === heroSeat;
      const out = folded.includes(player.seat) || mucked.includes(player.seat);
      const pos = studSeatXY(visual(player.seat), count);
      return <div key={player.seat} className="absolute z-10" style={{ left: `${pos.left}%`, top: hero ? "var(--smh-stud-hero-top, 89%)" : `${pos.top}%`, transform: "translate(-50%,-50%)" }}>
        {!out && <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: hero ? `var(--smh-stud-hero-cards-bottom, calc(100% + ${scaled(8)}))` : `calc(100% + ${scaled(8)})`, top: hero ? "var(--smh-stud-hero-cards-top, auto)" : undefined }}>
          {hero && heroCards ? heroCards : <StudCards slots={cards[player.seat]} previousSlots={previousCards?.[player.seat]} hero={hero} />}
        </div>}
        <div className={`flex flex-col leading-none items-center justify-center rounded-xl border shadow-xl ${active === player.seat && !out ? "border-emerald-300/80 bg-zinc-950 ring-2 ring-emerald-400/25" : "border-white/15 bg-zinc-950/90"}`}
          style={{ width: scaled(146), minHeight: scaled(64), padding: scaled(7), gap: scaled(4), opacity: out ? .4 : 1 }}>
          <div className="flex items-center gap-2" style={{ fontSize: scaled(9) }}><span className="font-semibold text-zinc-400">S{player.seat + 1}</span>{hero && <span className="text-emerald-300">HERO</span>}{out && <span className="text-zinc-500">{folded.includes(player.seat) ? "FOLD" : "MUCK"}</span>}</div>
          {onEditPlayer ? <NameDisplay value={player.name} onCommit={(name) => onEditPlayer(player.seat, { name })} /> : <span className="text-zinc-100 font-medium truncate max-w-full" style={{ fontSize: scaled(13) }}>{player.name || `Seat ${player.seat + 1}`}</span>}
          {onEditPlayer ? <StackDisplay value={player.stack} onCommit={(stack) => onEditPlayer(player.seat, { stack })} /> : <span className="text-emerald-300 font-semibold tabular-nums" style={{ fontSize: scaled(13) }}>${Math.max(0, player.stack - (committed[player.seat] ?? 0)).toLocaleString()}</span>}
          {onEditCards && <button type="button" onClick={() => onEditCards(player.seat)} className="text-emerald-200 hover:text-white cursor-pointer underline underline-offset-2" style={{ fontSize: scaled(9) }} aria-label={`Choose ${hero ? "hero cards" : `S${player.seat + 1} door card`}`}>{hero ? "Choose cards" : "Choose door card"}</button>}
        </div>
        {(winnings[player.seat] ?? 0) > 0 && <div className="absolute mt-1 inset-x-0 text-center text-emerald-200 font-semibold whitespace-nowrap" style={{ top: hero ? "var(--smh-stud-hero-award-top, 100%)" : "100%", fontSize: scaled(11) }}>Wins ${formatStudAmount(winnings[player.seat])}</div>}
      </div>;
    })}
    {players.filter((player) => !folded.includes(player.seat) && !mucked.includes(player.seat)).map((player) => {
      const hero = player.seat === heroSeat;
      const pos = studSeatXY(visual(player.seat), count);
      const bubblePos = hero ? { left: 18, top: 86 } : pos;
      return labels[player.seat] ? <BetBubble key={player.seat} seatPos={bubblePos} isHero={hero} label={labels[player.seat]} t={hero ? .1 : .35} />
        : (bets[player.seat] ?? 0) > 0 ? <BetBubble key={player.seat} seatPos={bubblePos} isHero={hero} amount={bets[player.seat]} t={hero ? .1 : .35} /> : null;
    })}
    {(() => { const pos = studSeatXY(visual(dealerSeat), count); return <DealerButtonChip seatPos={pos} position={{ left: pos.left + (pos.left > 50 ? -8 : 8), top: pos.top + 5 }} />; })()}
  </TableSurface>;
}
