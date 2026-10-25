"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileText, RotateCcw, Settings } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import NumericInput from "@/components/poker/NumericInput";
import { startRouteProgress } from "@/lib/route-progress";
import {
  advanceStudPhase, recordStudAction, recordStudDeal, setStudMucked, setStudShownCards,
  setStudStartingCards, startStudHand, studBringInSeat, unavailableStudCards, updateStudPlayer, type StudState,
} from "@/components/poker/stud-engine";
import { changeStudSetup, missingStudSetupSeats, nextStudPhaseLabel, studGameLabel, studLogEntries, studSizing, studStakesLabel } from "@/components/poker/stud-ui";
import { studRoundLabel, type StudReplayCard } from "@/components/poker/stud-replay";
import type { StudRecorderController } from "@/components/poker/use-stud-recorder";
import { CardPickerSheet } from "./CardPickerSheet";
import VerticalStudFelt, { MobileStudCards, mobileStudFeltHeight } from "./VerticalStudFelt";

const primary = "h-12 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-semibold";
const selectClass = "mt-1 h-11 w-full rounded-md border border-white/15 bg-zinc-900 px-2 text-zinc-100";
const editorSlots = (cards: (string | null)[], state?: StudState, seat?: number): StudReplayCard[] => cards.map((card, index) => ({
  present: !!card, faceUp: !!card, visibility: state && seat !== undefined ? state.players[seat].cards[index].visibility : "up", ...(card ? { card } : {}),
}));

function MobileStudBetting({ recorder }: { recorder: StudRecorderController }) {
  const { state, betting, apply } = recorder;
  const current = betting!;
  const sizing = studSizing(state, current);
  const act = (action: "fold" | "check" | "call" | "bet" | "raise", amount?: number, bigBet?: boolean) => apply((value) => recordStudAction(value, { seat: current.activeSeat!, action, amount, bigBet }));
  return <>
    <p className="text-xs text-zinc-400">${current.limitBet} fixed bets · {current.betCount} bet{current.betCount === 1 ? "" : "s"}{current.raiseCapped ? " · capped" : ""}</p>
    <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-12 text-rose-300" onClick={() => act("fold")}>Fold</Button><Button variant="outline" className="h-12" onClick={() => act(current.canCheck ? "check" : "call")}>{current.canCheck ? "Check" : `Call $${sizing.call}`}</Button></div>
    <Button className={primary} disabled={!sizing.canRaise} onClick={() => act(current.lastBet ? "raise" : "bet", sizing.minimum)}>{current.canComplete ? "Complete" : current.lastBet ? "Raise" : "Bet"} to ${sizing.minimum}</Button>
    {sizing.bigTarget !== undefined && <><Button variant="outline" className="h-12 text-emerald-200" disabled={!sizing.canRaise} onClick={() => act(current.lastBet ? "raise" : "bet", sizing.bigTarget, true)}>{current.lastBet ? "Big raise" : "Big bet"} to ${sizing.bigTarget}</Button><p className="text-xs text-zinc-500">An open pair allows the bigger increment on fourth street.</p></>}
    {!sizing.canRaise && <p className="text-xs text-zinc-500">{current.raiseCapped ? "This street has reached its bet cap." : "Raising is not open, or no opponent can respond."}</p>}
  </>;
}

/** Dismissing a picker or editor never commits a partial shown hand. */
function MobileStudShowEditor({ state, seat, onCancel, onShow }: { state: StudState; seat: number; onCancel: () => void; onShow: (cards: string[]) => void }) {
  const [cards, setCards] = useState<(string | null)[]>(() => [...(state.shownCards[seat] ?? state.players[seat].cards.map((slot) => slot.card ?? null))]);
  const [slot, setSlot] = useState<number | null>(null);
  const editable = state.players[seat].cards.flatMap((entry, index) => entry.card ? [] : [index]);
  const used = unavailableStudCards(state, seat);
  cards.forEach((card, index) => { if (card && index !== slot) used.add(card); });
  return <>
    <p className="text-sm font-semibold">S{seat + 1} · Show downcards</p>
    <p className="text-xs text-zinc-400">Tap the missing downcards. Known cards are locked in their original slots.</p>
    <div className="flex justify-center py-2"><MobileStudCards hero slots={editorSlots(cards, state, seat)} onSlot={setSlot} editableIndexes={editable} labelPrefix="Shown card" /></div>
    <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-12" onClick={onCancel}>Cancel show</Button><Button className={primary} disabled={cards.some((card) => !card)} onClick={() => onShow(cards as string[])}>Confirm show</Button></div>
    <CardPickerSheet open={slot !== null} title={`S${seat + 1} · downcard ${(slot ?? 0) + 1}`} used={used} onClose={() => setSlot(null)} onPick={(card) => {
      if (slot === null) return;
      const next = cards.map((value, index) => index === slot ? card : value);
      setCards(next);
      const empty = editable.find((index) => !next[index]);
      setSlot(cards[slot] || empty === undefined ? null : empty);
    }} />
  </>;
}

function MobileStudDeal({ recorder }: { recorder: StudRecorderController }) {
  const { state, dealSeat, apply } = recorder;
  const [card, setCard] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const river = state.street === "seventh-street";
  if (dealSeat === null) return <Button className={primary} onClick={() => apply(advanceStudPhase)}>Start betting</Button>;
  const anonymous = river && dealSeat !== state.heroSeat;
  return <>
    <p className="text-sm text-zinc-300">{anonymous ? `S${dealSeat + 1} receives a downcard. Its identity stays unknown.` : river ? "Enter your seventh card, dealt face down." : `Enter S${dealSeat + 1}’s new upcard.`}</p>
    {anonymous ? <Button className={primary} onClick={() => apply((value) => recordStudDeal(value, { seat: dealSeat }))}>Deal downcard to S{dealSeat + 1}</Button>
      : <><Button variant="outline" className="h-14" onClick={() => setPicker(true)}>{card ? `Change ${card}` : river ? "Choose hero river card" : "Choose upcard"}</Button>
        <Button className={primary} disabled={!card} onClick={() => card && apply((value) => recordStudDeal(value, { seat: dealSeat, card }))}>Confirm dealt card</Button></>}
    <CardPickerSheet open={picker} title={river ? "Hero river card" : `S${dealSeat + 1} upcard`} used={unavailableStudCards(state)} onClose={() => setPicker(false)} onPick={(value) => { setCard(value); setPicker(false); }} />
  </>;
}

export default function MobileStudRecorder({ recorder, onSwitchGame }: { recorder: StudRecorderController; onSwitchGame: () => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [setupOpen, setSetupOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [target, setTarget] = useState<{ seat: number; index: number } | null>(null);
  const { state, name, setName, notes, setNotes, venue, setVenue, date, setDate, editingSeat, setEditingSeat, saving, setup, finished,
    betting, activeSeat, folded, committed, pot, cards, labels, resolution, apply, undo, save, openFullBet, setOpenFullBet } = recorder;
  const round = finished ? "Showdown" : studRoundLabel(state.street);
  const missing = missingStudSetupSeats(state);
  const bringIn = setup && !missing.length ? studBringInSeat(state) : null;
  const changeSetup = (patch: Parameters<typeof changeStudSetup>[1]) => { setTarget(null); apply((current) => changeStudSetup(current, patch)); };
  const chooseStarting = (seat: number, index?: number) => {
    setSetupOpen(false);
    setTarget({ seat, index: index ?? (seat === state.heroSeat ? Math.max(0, state.players[seat].cards.findIndex((slot) => !slot.card)) : 2) });
  };
  const used = unavailableStudCards(state);
  const currentCard = target && state.players[target.seat]?.cards[target.index]?.card;
  if (currentCard) used.delete(currentCard);
  return <div className="min-h-[100dvh] bg-background text-zinc-100 flex flex-col">
    <header className="h-14 px-2 flex items-center gap-2 border-b border-white/10 shrink-0">
      <Button variant="ghost" size="icon" className="size-11" aria-label="Back to dashboard" onClick={async () => {
        if (await confirm({ title: "Leave without saving?", message: "Your in-progress recording will be lost.", confirmLabel: "Leave", destructive: true })) { startRouteProgress(); router.push("/dashboard"); }
      }}><ChevronLeft size={22} /></Button>
      <button type="button" aria-label="Edit hand details" className="flex-1 min-w-0 text-left" disabled={saving} onClick={() => setDetailsOpen(true)}><p className="text-sm font-semibold truncate">{name || "Untitled hand"}</p><p className="text-[9px] text-emerald-300 truncate">{studGameLabel(state.variant, true)} · {studStakesLabel(state)}</p></button>
      <Button variant="ghost" size="icon" className="size-11" aria-label="Notes and hand details" disabled={saving} onClick={() => setDetailsOpen(true)}><FileText size={18} /></Button>
    </header>
    <div className="flex items-center gap-2 px-3 py-2 text-xs">
      {setup ? <Button variant="outline" className="h-9" onClick={() => setSetupOpen(true)}><Settings size={14} /> Setup</Button> : <span className="rounded-md bg-emerald-500/10 px-2 py-2 text-emerald-200">{round}</span>}
      <span className="text-zinc-500">{state.playerCount}-handed</span><div className="flex-1" /><Button variant="ghost" className="h-9" onClick={() => setLogOpen(true)}>Log {state.events.length}</Button>
    </div>
    <fieldset disabled={saving} className="contents">
      <div className="px-2 shrink-0" style={{ height: `max(${mobileStudFeltHeight(state.playerCount)}px, calc(100dvh - 350px))` }}>
        <VerticalStudFelt variant={state.variant} players={state.players} heroSeat={state.heroSeat} dealerSeat={state.dealerSeat} cards={cards} pot={pot} round={round} active={activeSeat}
          committed={committed} bets={betting?.bets} folded={folded} mucked={state.muckedSeats} labels={labels}
          onEditSeat={setup ? () => setSetupOpen(true) : undefined} onHeroCardSlot={setup ? (index) => chooseStarting(state.heroSeat, index) : undefined} />
      </div>
      <section aria-label="Hand controls" className="flex flex-col gap-3 p-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold truncate">{activeSeat !== null ? `S${activeSeat + 1}${state.players[activeSeat].name ? ` · ${state.players[activeSeat].name}` : ""} ${state.phase === "deal" ? "to receive a card" : "to act"}` : round}</h2><Button variant="ghost" className="h-11 shrink-0" disabled={!state.history.length} onClick={undo}><RotateCcw size={14} /> Undo</Button></div>
        {setup ? <>
          <p className="text-xs text-zinc-400">Enter your two downcards and door card, and every opponent’s door card. Names, stacks and stakes are in Setup.</p>
          <div className="flex flex-wrap gap-2">{state.players.map((player) => <Button key={player.seat} variant="outline" className="h-11" onClick={() => chooseStarting(player.seat)}>S{player.seat + 1} {player.seat === state.heroSeat ? "cards" : "door"}{missing.includes(player.seat) ? " ·" : " ✓"}</Button>)}</div>
          {bringIn !== null && <p className="text-xs text-zinc-400">S{bringIn + 1} brings in with {state.players[bringIn].cards[2].card} showing.</p>}
          <div className="flex items-center gap-3 text-xs text-zinc-300"><Checkbox checked={openFullBet} ariaLabel="Bring-in player opened for a full bet" onChange={setOpenFullBet} className="size-5" /><span>Bring-in player opened for a full bet (${state.smallBet})</span></div>
          <Button className={primary} disabled={missing.length > 0} onClick={() => apply((value) => startStudHand(value, { complete: openFullBet }))}>Start hand</Button>
        </> : betting && !betting.roundClosed ? <MobileStudBetting recorder={recorder} />
          : betting ? <Button className={primary} onClick={() => apply(advanceStudPhase)}>{nextStudPhaseLabel(state, betting.handOver)}</Button>
            : state.phase === "deal" ? <MobileStudDeal key={`${state.street}:${state.history.length}`} recorder={recorder} />
              : finished ? <>
                {editingSeat !== null ? <MobileStudShowEditor key={`${editingSeat}:${state.history.length}`} state={state} seat={editingSeat} onCancel={() => setEditingSeat(null)} onShow={(shown) => apply((value) => setStudShownCards(value, editingSeat, shown))} />
                  : state.players.filter((player) => !folded.includes(player.seat) && state.playerCount - folded.length > 1).map((player) => {
                    const mucked = state.muckedSeats.includes(player.seat);
                    const shown = player.seat === state.heroSeat || !!state.shownCards[player.seat];
                    return <div key={player.seat} className="flex items-center gap-2 text-xs border-b border-white/5 pb-2"><div className="flex-1"><p className="font-semibold">S{player.seat + 1}</p><p className="text-zinc-500 mt-1">{mucked ? "Mucked" : shown ? "Shown" : "Undecided"}</p></div>
                      {player.seat !== state.heroSeat && <Button variant="outline" className="h-11" onClick={() => setEditingSeat(player.seat)}>{shown && !mucked ? "Edit downcards" : "Show downcards"}</Button>}
                      <Button variant="ghost" className="h-11" onClick={() => apply((value) => setStudMucked(value, player.seat, !mucked))}>{mucked ? "Undo muck" : "Muck"}</Button></div>;
                  })}
                {resolution.payload && editingSeat === null ? <p className="text-sm text-emerald-300">Hero result: {resolution.payload.result >= 0 ? "+" : "−"}${Math.abs(resolution.payload.result).toLocaleString()}</p> : <p className="text-xs text-zinc-500">{editingSeat !== null ? "Confirm or cancel the shown hand before saving." : resolution.reason}</p>}
                <Button className={primary} disabled={!resolution.payload || editingSeat !== null} onClick={save}>{saving ? "Saving…" : "Save & replay"}</Button>
              </> : null}
      </section>
    </fieldset>
    <CardPickerSheet open={!!target && setup} title={target ? `S${target.seat + 1} · ${target.seat === state.heroSeat ? `starting card ${target.index + 1} of 3` : "door card"}` : "Starting card"} used={used} onClose={() => setTarget(null)} onPick={(card) => {
      if (!target) return;
      const next = state.players[target.seat].cards.map((entry, index) => index === target.index ? card : entry.card ?? null);
      if (apply((value) => setStudStartingCards(value, target.seat, next))) {
        const empty = target.seat === state.heroSeat ? next.findIndex((value) => !value) : -1;
        setTarget(currentCard || empty < 0 ? null : { seat: target.seat, index: empty });
      }
    }} />
    <BottomSheet open={setupOpen && setup} onOpenChange={setSetupOpen} title="Stud setup" cancelLabel="Done">
      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-zinc-400">Players<select aria-label="Players" className={selectClass} value={state.playerCount} onChange={(event) => changeSetup({ playerCount: Number(event.target.value) })}>{[2,3,4,5,6,7,8].map((count) => <option key={count}>{count}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Hero seat<select aria-label="Hero seat" className={selectClass} value={state.heroSeat} onChange={(event) => changeSetup({ heroSeat: Number(event.target.value) })}>{state.players.map((player) => <option key={player.seat} value={player.seat}>S{player.seat + 1}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Last seat dealt<select aria-label="Last seat dealt" className={selectClass} value={state.dealerSeat} onChange={(event) => changeSetup({ dealerSeat: Number(event.target.value) })}>{state.players.map((player) => <option key={player.seat} value={player.seat}>S{player.seat + 1}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Small bet<NumericInput aria-label="Small bet" className="h-11 mt-1" value={state.smallBet} min={.01} step="any" onCommit={(smallBet) => changeSetup({ smallBet })} /></label>
          <label className="text-xs text-zinc-400">Ante<NumericInput aria-label="Ante" className="h-11 mt-1" value={state.ante} min={0} step="any" onCommit={(ante) => changeSetup({ ante })} /></label>
          <label className="text-xs text-zinc-400">Bring-in<NumericInput aria-label="Bring-in" className="h-11 mt-1" value={state.bringIn} min={.01} max={state.smallBet} step="any" onCommit={(bringIn) => changeSetup({ bringIn })} /></label>
        </div>
        <p className="text-xs text-zinc-500">Big bet: ${state.smallBet * 2}. Cards are dealt clockwise after the last seat dealt; tied exposed boards use this order.</p>
        <label className="text-xs text-zinc-400">Bet cap<select aria-label="Bet cap" className={selectClass} value={state.limitRules.maxBets} onChange={(event) => changeSetup({ limitRules: { ...state.limitRules, maxBets: Number(event.target.value) as 4 | 5 } })}><option value={4}>4 bets (bet + 3 raises)</option><option value={5}>5 bets (bet + 4 raises)</option></select></label>
        <div className="flex items-center gap-3 text-xs text-zinc-300"><Checkbox checked={state.limitRules.headsUpUncapped} ariaLabel="Uncapped when a round starts heads-up" onChange={(headsUpUncapped) => changeSetup({ limitRules: { ...state.limitRules, headsUpUncapped } })} className="size-5" /><span>Uncapped when a round starts heads-up</span></div>
        {state.variant === "STUD_HIGH" && <div className="flex items-center gap-3 text-xs text-zinc-300"><Checkbox checked={state.limitRules.fourthStreetBigBet} ariaLabel="Allow a fourth-street big bet with an open pair" onChange={(fourthStreetBigBet) => changeSetup({ limitRules: { ...state.limitRules, fourthStreetBigBet } })} className="size-5" /><span>Allow a fourth-street big bet with an open pair</span></div>}
        {state.variant === "RAZZ" && <p className="text-xs text-emerald-200">Lowest five-card hand wins; aces are low and straights/flushes do not count. Highest door card brings in; lowest exposed hand acts first afterward.</p>}
        {state.players.map((player) => <div key={player.seat} className="grid grid-cols-[28px_1fr_84px] items-center gap-2"><span className="text-xs text-zinc-400">S{player.seat + 1}</span><Input aria-label={`S${player.seat + 1} name`} className="h-11" value={player.name} onChange={(event) => apply((value) => updateStudPlayer(value, player.seat, { name: event.target.value }))} /><NumericInput aria-label={`S${player.seat + 1} stack`} className="h-11" value={player.stack} min={.01} step="any" onCommit={(stack) => apply((value) => updateStudPlayer(value, player.seat, { stack }))} /></div>)}
        <Button variant="outline" className="h-11" onClick={onSwitchGame}>Hold’em / Omaha</Button>
      </div>
    </BottomSheet>
    <BottomSheet open={detailsOpen} onOpenChange={setDetailsOpen} title="Hand details" cancelLabel="Done"><div className="p-4 flex flex-col gap-4">
      <label className="text-xs text-zinc-400">Hand name<Input aria-label="Hand name" className="h-11" value={name} disabled={saving} onChange={(event) => setName(event.target.value)} /></label>
      <label className="text-xs text-zinc-400">Notes<textarea aria-label="Hand notes" rows={4} className="mt-1 w-full rounded-md border border-white/15 bg-transparent p-3 text-sm" value={notes} disabled={saving} onChange={(event) => setNotes(event.target.value)} /></label>
      <label className="text-xs text-zinc-400">Venue<Input aria-label="Venue" className="h-11" value={venue} disabled={saving} onChange={(event) => setVenue(event.target.value)} /></label>
      <label className="text-xs text-zinc-400">Date<Input aria-label="Hand date" type="date" className="h-11" value={date} disabled={saving} onChange={(event) => setDate(event.target.value)} /></label>
    </div></BottomSheet>
    <BottomSheet open={logOpen} onOpenChange={setLogOpen} title="Hand log" cancelLabel="Done"><div className="p-4 flex flex-col gap-3 text-xs text-zinc-400">{studLogEntries(state).map((entry) => <p key={entry.id}>{entry.round === "showdown" ? "Showdown" : studRoundLabel(entry.round as StudState["street"])} · {entry.seat !== undefined ? `S${entry.seat + 1} ` : ""}{entry.label}</p>)}</div></BottomSheet>
  </div>;
}
