"use client";

import type { CSSProperties } from "react";
import PlayingCard from "@/components/poker/PlayingCard";
import FannedPlayingCard from "@/components/poker/FannedPlayingCard";
import { POSITION_NAMES } from "@/components/poker/lib";
import type { DrawReplayCard } from "@/components/poker/single-draw-replay";
import { getSeatCoords } from "./VerticalFelt";
import type { DrawVariant } from "@/components/poker/game-format";

/** Five stable slots; missing cards and anonymous backs remain distinct. */
export function MobileDrawCards({ slots, previousSlots, hero = true, selected = [], onSlot, discarding = false, labelPrefix = "Hero card" }: {
  slots: DrawReplayCard[]; previousSlots?: DrawReplayCard[]; hero?: boolean;
  selected?: number[]; onSlot?: (index: number) => void; discarding?: boolean; labelPrefix?: string;
}) {
  const width = hero ? 44 : 29;
  const height = hero ? 63 : 41;
  const step = hero ? 49 : 12;
  const face = (slot: DrawReplayCard) => {
    const card = slot.visibility === "up" ? slot.card : undefined;
    return hero ? <PlayingCard rank={card?.slice(0, -1)} suit={card?.slice(-1)} faceDown={!card} />
      : card ? <div style={{ "--smh-u": 29 / 38 } as CSSProperties}><FannedPlayingCard rank={card.slice(0, -1)} suit={card.slice(-1)} size="sm" /></div>
        : <PlayingCard faceDown size="sm" />;
  };
  return <div className="relative" style={{ width: width + step * (slots.length - 1), height: height + (discarding ? 22 : 0), "--smh-u": hero ? 44 / 56 : 29 / 44 } as CSSProperties}>
    {slots.map((slot, index) => {
      const card = slot.visibility === "up" ? slot.card : undefined;
      const discard = selected.includes(index);
      const label = discarding ? `Discard hero card ${index + 1}${card ? ` ${card}` : ""}`
        : onSlot ? `${labelPrefix} ${index + 1}${card ? ` ${card}` : ""}`
          : slot.present ? card ?? "Hidden card" : "Empty card slot";
      const style: CSSProperties = {
        left: step * index, top: 0, width, height, zIndex: index,
        transform: `translateY(${discard ? -10 : 0}px) rotate(${hero ? 0 : (index - 2) * 5}deg)`,
        transformOrigin: "center bottom",
      };
      const content = <>
        {slot.present ? <div key={card ?? "back"} className="smh-draw-card-enter">{face(slot)}</div>
          : <><div className="rounded-md border border-dashed border-white/25 h-full flex items-center justify-center text-white/30">{onSlot ? "+" : ""}</div>
            {previousSlots?.[index]?.present && <div className="smh-draw-card-leave" aria-hidden="true">{face(previousSlots[index])}</div>}</>}
        {discarding && <span className={`absolute top-full mt-1 inset-x-0 text-center text-[9px] font-semibold uppercase tracking-wide ${discard ? "text-rose-300" : "text-emerald-200"}`}>{discard ? "Discard" : "Keep"}</span>}
      </>;
      return onSlot ? <button key={index} type="button" aria-label={label} aria-pressed={discarding ? discard : undefined} onClick={() => onSlot(index)}
        className={`absolute rounded-md transition-transform focus-visible:ring-2 focus-visible:ring-emerald-300 ${discard ? "ring-2 ring-rose-400" : ""}`} style={style}>{content}</button>
        : <div key={index} aria-label={label} className="absolute" style={style}>{content}</div>;
    })}
  </div>;
}

export default function VerticalDrawFelt({ players, heroSeat, cards, previousCards, pot, round, active,
  committed = {}, bets = {}, folded = [], mucked = [], labels = {}, winnings = {}, selected,
  onHeroCardSlot, discarding, onEditSeat,
  variant = "2-7_SINGLE_DRAW",
}: {
  variant?: DrawVariant;
  players: { seat: number; name: string; stack: number }[]; heroSeat: number;
  cards: Record<number, DrawReplayCard[]>; previousCards?: Record<number, DrawReplayCard[]>;
  pot: number; round: string; active?: number | null; committed?: Record<number, number>;
  bets?: Record<number, number>; folded?: number[]; mucked?: number[]; labels?: Record<number, string>;
  winnings?: Record<number, number>; selected?: number[]; discarding?: boolean;
  onHeroCardSlot?: (index: number) => void; onEditSeat?: (seat: number) => void;
}) {
  const count = players.length;
  // Reserve a full-width band for hero's five touch targets. Community
  // coordinates put the lowest side plates in that same band.
  const denseRows: Record<number, { left: number; top: number }[]> = {
    6: [{ left: 50, top: 92 }, { left: 14, top: 60 }, { left: 14, top: 30 }, { left: 50, top: 13 }, { left: 86, top: 30 }, { left: 86, top: 60 }],
    7: [{ left: 50, top: 92 }, { left: 14, top: 58 }, { left: 14, top: 38 }, { left: 20, top: 18 }, { left: 80, top: 18 }, { left: 86, top: 38 }, { left: 86, top: 58 }],
    8: [{ left: 50, top: 92 }, { left: 14, top: 58 }, { left: 14, top: 38 }, { left: 14, top: 18 }, { left: 50, top: 13 }, { left: 86, top: 18 }, { left: 86, top: 38 }, { left: 86, top: 58 }],
  };
  const coords = denseRows[count] ?? getSeatCoords(count);
  return <div className="relative w-full h-full rounded-3xl overflow-hidden" aria-label={variant === "2-7_TRIPLE_DRAW" ? "Triple Draw table" : "Single Draw table"} style={{
    background: "radial-gradient(ellipse 70% 95% at 50% 50%, var(--smh-mobile-felt-top) 0%, var(--smh-mobile-felt-bottom) 100%)",
    boxShadow: "0 4px 24px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06)",
  }}>
    <div className="absolute left-1/2 top-[43%] -translate-x-1/2 text-center pointer-events-none">
      <p className="text-[9px] uppercase tracking-[.12em] text-emerald-100/45 whitespace-nowrap">{variant === "2-7_TRIPLE_DRAW" ? "Fixed-limit" : "No-limit"} 2–7{count >= 5 ? <br /> : " "}{variant === "2-7_TRIPLE_DRAW" ? "Triple" : "Single"} Draw</p>
      <p className="text-2xl font-semibold tabular-nums text-white mt-1">${pot.toLocaleString()}</p>
      <p className="text-[10px] uppercase tracking-[.15em] text-white/40 mt-1">{round}</p>
    </div>
    {players.map((player) => {
      const visual = (player.seat - heroSeat + count) % count;
      const coord = coords[visual];
      const hero = player.seat === heroSeat;
      const out = folded.includes(player.seat) || mucked.includes(player.seat);
      const position = POSITION_NAMES[count][player.seat];
      const plate = <>
        <div className="text-[9px] leading-[10px] text-zinc-400 font-semibold">{position}{hero && <span className="ml-1 text-emerald-300">YOU</span>}{player.seat === 0 && <span className="ml-1 inline-flex rounded-full bg-zinc-100 text-zinc-900 w-3 h-3 items-center justify-center text-[8px]">D</span>}</div>
        <div className="text-[11px] leading-[13px] font-medium text-zinc-100 truncate">{out ? folded.includes(player.seat) ? "Folded" : "Mucked" : player.name || position}</div>
        <div className="font-mono text-[11px] leading-[13px] text-emerald-300">${Math.max(0, player.stack - (committed[player.seat] ?? 0)).toLocaleString()}</div>
      </>;
      return <div key={player.seat} className="absolute flex flex-col items-center" style={{
        left: hero ? "50%" : `clamp(48px, ${coord.left}%, calc(100% - 48px))`,
        top: hero ? undefined : `min(${Math.max(13, coord.top)}%, calc(100% - 178px))`,
        bottom: hero ? 12 : undefined, transform: hero ? "translateX(-50%)" : "translate(-50%, -50%)",
      }}>
        {!out && <div className={hero ? "mb-2" : "mb-1"}><MobileDrawCards slots={cards[player.seat]} previousSlots={previousCards?.[player.seat]} hero={hero}
          selected={hero ? selected : undefined} onSlot={hero ? onHeroCardSlot : undefined} discarding={hero && discarding} /></div>}
        {onEditSeat ? <button type="button" aria-label={`Edit ${position} player`} onClick={() => onEditSeat(player.seat)} className="w-[92px] min-h-11 rounded-xl border border-white/15 bg-zinc-950/90 px-2 py-[3px]">{plate}</button>
          : <div className={`w-[92px] min-h-11 rounded-xl border px-2 py-[3px] text-center ${active === player.seat && !out ? "bg-zinc-950 border-emerald-300 ring-2 ring-emerald-400/25" : "bg-zinc-950/90 border-white/15"}`} style={{ opacity: out ? .4 : 1 }}>{plate}</div>}
        {((winnings[player.seat] ?? 0) > 0 || labels[player.seat] || bets[player.seat]) && !out && <span className={`absolute whitespace-nowrap rounded-md bg-zinc-950/95 border border-white/15 px-2 py-1 text-[10px] font-mono text-emerald-100 ${hero ? "bottom-full mb-[94px]" : "top-full mt-1"}`}>
          {(winnings[player.seat] ?? 0) > 0 ? `Wins $${winnings[player.seat]}` : labels[player.seat] || `$${bets[player.seat]}`}
        </span>}
      </div>;
    })}
  </div>;
}
