"use client";

import type { CSSProperties } from "react";
import FannedPlayingCard from "@/components/poker/FannedPlayingCard";
import type { StudReplayCard } from "@/components/poker/stud-replay";
import type { StudVariant } from "@/components/poker/game-format";
import { studGameLabel } from "@/components/poker/stud-ui";

/** Seven ordered slots. Visibility is physical; faceUp controls identity. */
export function MobileStudCards({ slots, previousSlots, hero = false, onSlot, editableIndexes, labelPrefix = "Card" }: {
  slots: StudReplayCard[]; previousSlots?: StudReplayCard[]; hero?: boolean;
  onSlot?: (index: number) => void; editableIndexes?: number[]; labelPrefix?: string;
}) {
  const width = hero ? 44 : 28;
  const height = hero ? 62 : 40;
  const step = hero ? 47 : 19;
  const face = (slot: StudReplayCard) => {
    const card = slot.faceUp ? slot.card : undefined;
    return card ? <FannedPlayingCard rank={card.slice(0, -1)} suit={card.slice(-1)} size={hero ? "md" : "sm"} />
      : <div className="rounded-md border border-white/15 flex items-center justify-center text-white/20 text-[8px] tracking-widest" style={{ width, height, background: "linear-gradient(135deg, #6b1722, #2a0608)" }}>smh</div>;
  };
  return <div className="relative" style={{ width: width + step * (slots.length - 1), height: height + 13, "--smh-u": hero ? 44 / 50 : 28 / 38 } as CSSProperties}>
    {slots.map((slot, index) => {
      const card = slot.faceUp ? slot.card : undefined;
      const editable = !!onSlot && (!editableIndexes || editableIndexes.includes(index));
      const label = onSlot ? `${labelPrefix} ${index + 1}${card ? ` ${card}` : ""}${editable ? "" : " · locked"}` : slot.present ? card ?? "Hidden card" : "Empty card slot";
      const content = <>
        {slot.present ? <div key={card ?? "back"} className="smh-draw-card-enter">{face(slot)}</div>
          : <><div className="h-full rounded-md border border-dashed border-white/20 flex items-center justify-center text-white/35">{editable ? "+" : ""}</div>
            {previousSlots?.[index]?.present && <div aria-hidden="true" className="smh-draw-card-leave">{face(previousSlots[index])}</div>}</>}
        <span className={`absolute top-full inset-x-0 mt-0.5 text-center uppercase text-[7px] ${slot.visibility === "down" ? "text-rose-200/60" : "text-emerald-200/60"}`}>{hero || index === 0 || index === 2 || index === 6 ? slot.visibility : ""}</span>
      </>;
      const style = { left: step * index, width, height, zIndex: index };
      return editable ? <button key={index} type="button" aria-label={label} data-card-slot={index + 1} data-dealt={slot.visibility} className="absolute rounded-md focus-visible:ring-2 focus-visible:ring-emerald-300" style={style} onClick={() => onSlot!(index)}>{content}</button>
        : <div key={index} aria-label={label} data-card-slot={index + 1} data-dealt={slot.visibility} className="absolute" style={style}>{content}</div>;
    })}
  </div>;
}

export const mobileStudFeltHeight = (count: number) => count === 8 ? 640 : count === 7 ? 600 : count === 6 ? 560 : count === 5 ? 480 : count === 4 ? 450 : 400;
export function mobileStudSeatCoords(count: number): { left: number; top: number }[] {
  const hero = { left: 50, top: 90 };
  const left = (top: number) => ({ left: 23, top });
  const right = (top: number) => ({ left: 77, top });
  const top = { left: 50, top: count <= 4 ? 14 : 10 };
  switch (count) {
    case 2: return [hero, top];
    case 3: return [hero, left(25), right(25)];
    case 4: return [hero, left(43), top, right(43)];
    case 5: return [hero, left(54), left(22), right(22), right(54)];
    case 6: return [hero, left(57), left(28), top, right(28), right(57)];
    case 7: return [hero, left(64), left(40), left(16), right(16), right(40), right(64)];
    default: return [hero, left(64), left(46), left(28), top, right(28), right(46), right(64)];
  }
}

export default function VerticalStudFelt({ players, heroSeat, dealerSeat, cards, previousCards, sharedCard, pot, round, active, variant = "STUD_HIGH",
  committed = {}, bets = {}, folded = [], mucked = [], labels = {}, winnings = {}, onEditSeat, onHeroCardSlot,
}: {
  players: { seat: number; name: string; stack: number }[]; heroSeat: number; dealerSeat: number;
  variant?: StudVariant;
  cards: Record<number, StudReplayCard[]>; previousCards?: Record<number, StudReplayCard[]>; sharedCard?: StudReplayCard;
  pot: number; round: string; active?: number | null; committed?: Record<number, number>; bets?: Record<number, number>;
  folded?: number[]; mucked?: number[]; labels?: Record<number, string>; winnings?: Record<number, number>;
  onEditSeat?: (seat: number) => void; onHeroCardSlot?: (index: number) => void;
}) {
  const coords = mobileStudSeatCoords(players.length);
  return <div aria-label={`${studGameLabel(variant)} table`} className="relative w-full h-full rounded-3xl overflow-hidden" style={{
    background: "radial-gradient(ellipse 70% 95% at 50% 50%, var(--smh-mobile-felt-top), var(--smh-mobile-felt-bottom))",
    boxShadow: "0 4px 24px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06)",
  }}>
    <div className="absolute left-1/2 top-[41%] -translate-x-1/2 text-center pointer-events-none">
      <p className="text-[8px] uppercase tracking-widest text-emerald-100/45">{studGameLabel(variant, true)}</p><p className="text-lg font-semibold text-white tabular-nums">${pot.toLocaleString()}</p>
      <p className="text-[8px] uppercase text-white/45 max-w-16 mx-auto">{round}</p>
      {sharedCard?.present && <div aria-label="Shared seventh card" className="mt-2 flex flex-col items-center gap-1"><span className="text-[8px] text-emerald-200">Shared 7th</span><MobileStudCards slots={[sharedCard]} /></div>}
    </div>
    {players.map((player) => {
      const hero = player.seat === heroSeat;
      const coord = coords[(player.seat - heroSeat + players.length) % players.length];
      const out = folded.includes(player.seat) || mucked.includes(player.seat);
      const status = (winnings[player.seat] ?? 0) > 0 ? `Wins $${winnings[player.seat].toLocaleString()}` : labels[player.seat] || ((bets[player.seat] ?? 0) > 0 ? `$${bets[player.seat]}` : "");
      const plate = <>
        <p className="text-[9px] leading-3 text-zinc-400 font-semibold">S{player.seat + 1}{hero && <span className="ml-1 text-emerald-300">YOU</span>}{player.seat === dealerSeat && <span className="ml-1 text-zinc-200" title="Last seat dealt">D</span>}</p>
        <p className="text-[11px] leading-[13px] font-medium truncate text-zinc-100">{out ? folded.includes(player.seat) ? "Folded" : "Mucked" : player.name || `Seat ${player.seat + 1}`}</p>
        <p className="text-[11px] leading-[13px] font-mono text-emerald-300 flex items-center justify-center gap-1"><span>${Math.max(0, player.stack - (committed[player.seat] ?? 0)).toLocaleString()}</span>{!!status && !out && !hero && <span className="text-[8px] text-emerald-100 truncate">{status}</span>}</p>
        {!!status && !out && hero && <p className="text-[9px] leading-3 font-mono text-emerald-100 truncate">{status}</p>}
      </>;
      return <div key={player.seat} data-stud-seat={player.seat} className="absolute flex flex-col items-center" style={{ left: hero ? "50%" : `${coord.left}%`, top: hero ? undefined : `${coord.top}%`, bottom: hero ? 12 : undefined, transform: hero ? "translateX(-50%)" : "translate(-50%, -50%)" }}>
        <div className="mb-1" style={{ width: hero ? 326 : 142, height: hero ? 75 : 53 }}>
          {!out ? <MobileStudCards slots={cards[player.seat]} previousSlots={previousCards?.[player.seat]} hero={hero}
            onSlot={hero ? onHeroCardSlot : undefined} editableIndexes={hero && onHeroCardSlot ? [0,1,2] : undefined} labelPrefix="Hero starting card" />
            : mucked.includes(player.seat) && previousCards?.[player.seat] ? <MobileStudCards slots={cards[player.seat].map((slot) => ({ present: false, faceUp: false, visibility: slot.visibility }))} previousSlots={previousCards[player.seat]} hero={hero} /> : null}
        </div>
        {onEditSeat ? <button type="button" aria-label={`Edit S${player.seat + 1} player`} className="w-[100px] min-h-11 rounded-xl border border-white/15 bg-zinc-950/90 px-2 py-1" onClick={() => onEditSeat(player.seat)}>{plate}</button>
          : <div className={`w-[100px] min-h-11 rounded-xl border px-2 py-1 text-center ${active === player.seat && !out ? "border-emerald-300 ring-2 ring-emerald-400/25 bg-zinc-950" : "border-white/15 bg-zinc-950/90"}`} style={{ opacity: out ? .4 : 1 }}>{plate}</div>}
      </div>;
    })}
  </div>;
}
