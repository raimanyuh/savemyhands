"use client";

import type { ReactNode } from "react";
import PlayingCard from "./PlayingCard";
import FannedPlayingCard from "./FannedPlayingCard";
import { POSITION_NAMES, seatXY } from "./lib";
import { scaled } from "./scale";
import { BetBubble, DealerButtonChip, NameDisplay, StackDisplay, TableSurface } from "./table-pieces";
import type { DrawReplayCard } from "./single-draw-replay";

type TablePlayer = { seat: number; name: string; stack: number };

/** Fixed slots keep hero's discards spatially stable during selection/replay. */
function DrawCards({ slots, previousSlots, hero, selected, onToggle }: {
  slots: DrawReplayCard[]; previousSlots?: DrawReplayCard[]; hero: boolean; selected?: number[]; onToggle?: (index: number) => void;
}) {
  const w = hero ? 56 : 38;
  const h = hero ? 80 : 54;
  const step = hero ? 63 : 16;
  return (
    <div className="relative" style={{ width: scaled(w + step * 4), height: scaled(h + (onToggle ? 28 : 10)) }}>
      {slots.map((slot, index) => {
        const discard = selected?.includes(index) ?? false;
        const card = slot.visibility === "up" ? slot.card : undefined;
        const faceOf = (entry: DrawReplayCard) => {
          const value = entry.visibility === "up" ? entry.card : undefined;
          return hero ? <PlayingCard rank={value?.slice(0, -1)} suit={value?.slice(-1)} faceDown={!value} />
            : value ? <FannedPlayingCard rank={value.slice(0, -1)} suit={value.slice(-1)} size="sm" />
            : <PlayingCard faceDown size="sm" />;
        };
        const face = faceOf(slot);
        const style = {
          left: scaled(index * step), top: 0, width: scaled(w), height: scaled(h),
          transform: `translateY(${discard ? scaled(-12) : "0px"}) rotate(${hero ? 0 : (index - 2) * 6}deg)`,
          transformOrigin: "center bottom", zIndex: index,
        };
        return onToggle ? (
          <button key={index} type="button" aria-pressed={discard}
            aria-label={`Discard hero card ${index + 1}${card ? ` ${card}` : ""}`}
            onClick={() => onToggle(index)} className={`absolute rounded-md transition-transform cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${discard ? "ring-2 ring-rose-400" : "hover:-translate-y-1"}`} style={style}>
            {face}
            <span className={`absolute inset-x-0 top-full mt-1 text-center font-semibold uppercase tracking-wider ${discard ? "text-rose-300" : "text-emerald-200"}`} style={{ fontSize: scaled(9) }}>
              {discard ? "Discard" : "Keep"}
            </span>
          </button>
        ) : (
          <div key={index} className="absolute" style={style} aria-label={slot.present ? card ?? "Hidden card" : "Empty card slot"}>
            {slot.present ? <div key={card ?? "back"} className="smh-draw-card-enter">{face}</div>
              : <><div className="rounded-md border border-dashed border-white/15" style={{ width: scaled(w), height: scaled(h) }} />
                {previousSlots?.[index]?.present && <div aria-hidden="true" className="smh-draw-card-leave">{faceOf(previousSlots[index])}</div>}</>}
          </div>
        );
      })}
    </div>
  );
}

export default function DrawTable({ players, heroSeat, cards, pot, round, active, committed = {}, bets = {},
  folded = [], mucked = [], labels = {}, winnings = {}, heroCards, selected, onToggleHero, onEditPlayer, previousCards,
}: {
  players: TablePlayer[]; heroSeat: number; cards: Record<number, DrawReplayCard[]>;
  previousCards?: Record<number, DrawReplayCard[]>;
  pot: number; round: string; active?: number | null; committed?: Record<number, number>;
  bets?: Record<number, number>; folded?: number[]; mucked?: number[]; labels?: Record<number, string>;
  winnings?: Record<number, number>; heroCards?: ReactNode; selected?: number[];
  onToggleHero?: (index: number) => void;
  onEditPlayer?: (seat: number, patch: { name?: string; stack?: number }) => void;
}) {
  const count = players.length;
  const visualOf = (seat: number) => (seat - heroSeat + count) % count;
  return (
    <TableSurface>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none" style={{ transform: "translateY(-10%)" }}>
        <span className="uppercase tracking-[0.2em] text-emerald-100/45 font-semibold" style={{ fontSize: scaled(12) }}>No-limit 2–7 Single Draw</span>
        <div className="rounded-lg bg-zinc-950/80 border border-white/15 text-white font-semibold tabular-nums" style={{ padding: `${scaled(6)} ${scaled(16)}`, fontSize: scaled(24) }}>${pot.toLocaleString()}</div>
        <span className="uppercase tracking-[0.2em] text-white/35" style={{ fontSize: scaled(11) }}>{round}</span>
      </div>
      {players.map((player) => {
        const hero = player.seat === heroSeat;
        const out = folded.includes(player.seat) || mucked.includes(player.seat);
        const pos = seatXY(visualOf(player.seat), count);
        const position = POSITION_NAMES[count]?.[player.seat];
        return (
          <div key={player.seat} className="absolute z-10" style={{ left: `${pos.left}%`, top: `${pos.top}%`, transform: "translate(-50%,-50%)" }}>
            {!out && <div className="absolute left-1/2 -translate-x-1/2" style={{ top: scaled(hero ? -104 : -72) }}>
              {hero && heroCards ? heroCards : <DrawCards slots={cards[player.seat]} previousSlots={previousCards?.[player.seat]} hero={hero} selected={hero ? selected : undefined} onToggle={hero ? onToggleHero : undefined} />}
            </div>}
            <div className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border shadow-xl ${active === player.seat && !out ? "border-emerald-300/80 bg-zinc-950 ring-2 ring-emerald-400/25" : "border-white/15 bg-zinc-950/90"}`}
              style={{ width: scaled(146), minHeight: scaled(68), padding: scaled(8), opacity: out ? 0.4 : 1 }}>
              <div className="flex gap-1.5 items-center" style={{ fontSize: scaled(10) }}>
                <span className="font-bold text-zinc-300">{position}</span>{hero && <span className="text-emerald-300">HERO</span>}
                {out && <span className="text-zinc-400">{folded.includes(player.seat) ? "FOLD" : "MUCK"}</span>}
              </div>
              {onEditPlayer ? <NameDisplay value={player.name} onCommit={(name) => onEditPlayer(player.seat, { name })} />
                : <span className="text-zinc-100 font-medium truncate max-w-full" style={{ fontSize: scaled(14) }}>{player.name || position}</span>}
              {onEditPlayer ? <StackDisplay value={player.stack} onCommit={(stack) => onEditPlayer(player.seat, { stack })} />
                : <span className="text-emerald-300 font-semibold tabular-nums" style={{ fontSize: scaled(14) }}>${Math.max(0, player.stack - (committed[player.seat] ?? 0)).toLocaleString()}</span>}
            </div>
            {(winnings[player.seat] ?? 0) > 0 && <div className="absolute top-full mt-1 inset-x-0 text-center font-semibold text-emerald-200" style={{ fontSize: scaled(12) }}>Wins ${winnings[player.seat].toLocaleString()}</div>}
          </div>
        );
      })}
      {players.filter((player) => !folded.includes(player.seat) && !mucked.includes(player.seat)).map((player) => {
        const pos = seatXY(visualOf(player.seat), count);
        return labels[player.seat] ? <BetBubble key={player.seat} seatPos={pos} isHero={player.seat === heroSeat} label={labels[player.seat]} t={player.seat === heroSeat ? 0.74 : 0.3} />
          : (bets[player.seat] ?? 0) > 0 ? <BetBubble key={player.seat} seatPos={pos} isHero={player.seat === heroSeat} amount={bets[player.seat]} t={player.seat === heroSeat ? 0.74 : 0.3} /> : null;
      })}
      {(() => {
        const buttonSeat = seatXY(visualOf(0), count);
        return <DealerButtonChip seatPos={buttonSeat} position={{
          left: buttonSeat.left + (buttonSeat.left > 50 ? -8 : 8), top: buttonSeat.top,
        }} />;
      })()}
    </TableSurface>
  );
}
