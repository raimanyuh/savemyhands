"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, RotateCcw, Save, Settings, X } from "lucide-react";
import { Header, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useIsSideLayout } from "@/lib/use-is-side-layout";
import { useIsMobile } from "@/lib/use-is-mobile";
import MobileStudRecorder from "@/components/mobile/MobileStudRecorder";
import type { ActionType } from "./engine";
import { CardRow } from "./CardPicker";
import NumericInput from "./NumericInput";
import StudTable from "./StudTable";
import {
  advanceStudPhase, recordStudAction, recordStudDeal,
  setStudMucked, setStudShownCards, setStudStartingCards, startStudHand,
  studBringInSeat, unavailableStudCards, updateStudPlayer, type StudState,
} from "./stud-engine";
import { studRoundLabel } from "./stud-replay";
import { changeStudSetup, missingStudSetupSeats, nextStudPhaseLabel, studGameLabel, studLogEntries, studSizing, studStakesLabel, type StudDraft } from "./stud-ui";
import { useStudRecorder, type StudRecorderController, type StudSaveOptions } from "./use-stud-recorder";

const primary = "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-semibold";
const selectClass = "mt-1 h-10 w-full rounded-md border border-white/15 bg-zinc-900 px-2 text-zinc-100";

function StudBettingPanel({ recorder }: { recorder: StudRecorderController }) {
  const { state, betting, apply } = recorder;
  const current = betting!;
  const sizing = studSizing(state, current);
  const act = (action: ActionType, amount?: number, bigBet?: boolean) => apply((value) => recordStudAction(value, { seat: current.activeSeat!, action, amount, bigBet }));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, button, [contenteditable='true']") || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "f") { event.preventDefault(); act("fold"); }
      if (key === "c") { event.preventDefault(); act(current.canCheck ? "check" : "call"); }
      if ((key === "b" || key === "r") && sizing.canRaise) { event.preventDefault(); act(current.lastBet ? "raise" : "bet", sizing.minimum); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const verb = current.canComplete ? "Complete" : current.lastBet ? "Raise" : "Bet";
  return <div className="flex flex-col gap-3">
    <p className="text-xs text-zinc-400">${current.limitBet} fixed bets · {current.betCount} bet{current.betCount === 1 ? "" : "s"}{current.raiseCapped ? " · capped" : ""}</p>
    <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-12 text-rose-300" onClick={() => act("fold")}>Fold <kbd className="ml-2 opacity-40">F</kbd></Button><Button variant="outline" className="h-12" onClick={() => act(current.canCheck ? "check" : "call")}>{current.canCheck ? "Check" : `Call $${sizing.call}`}<kbd className="ml-2 opacity-40">C</kbd></Button></div>
    <Button className={`h-12 ${primary}`} disabled={!sizing.canRaise} onClick={() => act(current.lastBet ? "raise" : "bet", sizing.minimum)}>{verb} to ${sizing.minimum}</Button>
    {sizing.bigTarget !== undefined && <><Button variant="outline" className="h-11 border-emerald-400/30 text-emerald-200" disabled={!sizing.canRaise} onClick={() => act(current.lastBet ? "raise" : "bet", sizing.bigTarget, true)}>{current.lastBet ? "Big raise" : "Big bet"} to ${sizing.bigTarget}</Button><p className="text-xs text-zinc-500">An open pair allows the bigger increment on fourth street.</p></>}
    {!sizing.canRaise && <p className="text-xs text-zinc-500">{current.raiseCapped ? "This street has reached its bet cap." : "Raising is not open, or no opponent can respond."}</p>}
  </div>;
}

function StudShowEditor({ state, seat, onCancel, onShow }: { state: StudState; seat: number; onCancel: () => void; onShow: (cards: string[]) => void }) {
  const [cards, setCards] = useState<(string | null)[]>(() => [...(state.shownCards[seat] ?? state.players[seat].cards.map((slot) => slot.card ?? null))]);
  const locked = state.players[seat].cards.flatMap((slot, index) => slot.card ? [index] : []);
  const used = unavailableStudCards(state, seat);
  cards.forEach((card) => { if (card) used.add(card); });
  return <div className="rounded-xl border border-emerald-500/30 p-3 flex flex-col gap-4">
    <p className="text-sm font-semibold">S{seat + 1} · Show downcards</p>
    <p className="text-xs text-zinc-400">Enter the missing cards in their original slots. Exposed cards are locked.</p>
    <div className="overflow-x-auto py-3 flex justify-center"><CardRow cards={cards} lockedIndexes={locked} used={used} size="sm" highlight autoAdvanceCount={cards.length} ariaLabelPrefix="Shown card"
      onPick={(index, card) => setCards((current) => current.map((value, i) => i === index ? card : value))}
      onClear={(card) => setCards((current) => current.map((value, index) => value === card && !locked.includes(index) ? null : value))} /></div>
    <div className="flex gap-2"><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button className={`flex-1 ${primary}`} disabled={cards.some((card) => !card)} onClick={() => onShow(cards as string[])}>Confirm show</Button></div>
  </div>;
}

function StudDealPanel({ recorder }: { recorder: StudRecorderController }) {
  const { state, dealSeat, apply } = recorder;
  const [card, setCard] = useState<string | null>(null);
  const river = state.street === "seventh-street";
  if (dealSeat === null) return <Button className={primary} onClick={() => apply(advanceStudPhase)}>Start betting <ChevronRight size={14} /></Button>;
  if (river && dealSeat !== state.heroSeat) return <div className="flex flex-col gap-3">
    <p className="text-sm text-zinc-400">S{dealSeat + 1} receives a downcard. Its identity stays unknown.</p>
    <Button className={`h-12 ${primary}`} onClick={() => apply((value) => recordStudDeal(value, { seat: dealSeat }))}>Deal downcard to S{dealSeat + 1}</Button>
  </div>;
  return <div className="flex flex-col gap-4">
    <p className="text-sm text-zinc-300">{river ? "Enter your seventh card, dealt face down." : `Enter S${dealSeat + 1}’s new upcard.`}</p>
    <div className="flex justify-center py-2"><CardRow cards={[card]} used={unavailableStudCards(state)} ariaLabelPrefix={river ? "Hero river card" : "Upcard"} highlight
      onPick={(_index, picked) => setCard(picked)} onClear={() => setCard(null)} /></div>
    <Button className={`h-11 ${primary}`} disabled={!card} onClick={() => card && apply((value) => recordStudDeal(value, { seat: dealSeat, card }))}>Confirm dealt card</Button>
  </div>;
}

/** Keep the controller mounted when switching between phone and desktop. */
export default function StudRecorder({ initialDraft, onSwitchGame, onSaveAction, onSavedAction }: {
  initialDraft: StudDraft; onSwitchGame: () => void;
} & StudSaveOptions) {
  const recorder = useStudRecorder(initialDraft, { onSaveAction, onSavedAction });
  const { isMobile } = useIsMobile();
  if (isMobile) return <MobileStudRecorder recorder={recorder} onSwitchGame={onSwitchGame} />;
  return <DesktopStudRecorder recorder={recorder} onSwitchGame={onSwitchGame} />;
}

export function DesktopStudRecorder({ recorder, onSwitchGame }: { recorder: StudRecorderController; onSwitchGame: () => void }) {
  const confirm = useConfirm();
  const side = useIsSideLayout();
  const [setupOpen, setSetupOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [setupSeat, setSetupSeat] = useState(recorder.state.heroSeat);
  const { state, name, setName, notes, setNotes, venue, setVenue, date, setDate, setup, finished, saving,
    betting, activeSeat, folded, cards, committed, pot, labels, editingSeat, setEditingSeat, openFullBet, setOpenFullBet,
    resolution, apply, undo, save,
  } = recorder;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSetupOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const seat = Math.min(setupSeat, state.playerCount - 1);
  const setupCards = seat === state.heroSeat ? state.players[seat].cards.map((slot) => slot.card ?? null) : [state.players[seat].cards[2].card ?? null];
  const missing = missingStudSetupSeats(state);
  const bringInSeat = studBringInSeat(state);
  const changeSetup = (patch: Parameters<typeof changeStudSetup>[1]) => apply((value) => changeStudSetup(value, patch));
  const round = setup ? "Setup" : state.phase === "showdown" ? "Showdown" : state.phase === "done" ? "Result" : studRoundLabel(state.street);
  return <Shell header={<Header title="" back="Dashboard" backHref="/dashboard" onBack={() => confirm({ title: "Leave without saving?", message: "Your in-progress recording will be lost.", confirmLabel: "Leave", destructive: true })}
    right={<><span className="text-xs font-mono text-zinc-500">draft · {round}</span><Button className={primary} disabled={!resolution.payload || editingSeat !== null || saving} onClick={save}>{saving ? "Saving…" : "Save hand"}</Button></>} />}>
    <div className="w-full max-w-[1600px] mx-auto p-6 flex flex-col gap-4">
      <Input aria-label="Hand name" value={name} disabled={saving} onChange={(event) => setName(event.target.value)} className="text-xl font-semibold border-transparent px-0 max-w-lg" />
      <div className="flex flex-wrap items-center gap-3 text-sm relative z-30">
        <Button variant="outline" size="sm" disabled={!setup || saving} onClick={() => setSetupOpen(!setupOpen)}><Settings size={14} /> Stakes &amp; seats</Button>
        <span className="text-emerald-300 font-semibold">{studGameLabel(state.variant)}</span><span className="text-zinc-500">{studStakesLabel(state)}</span>
        <span className="text-xs uppercase tracking-wider rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">{round}</span>
        <div className="flex-1" /><Button variant="ghost" size="sm" onClick={() => setLogOpen(!logOpen)}>Log {state.events.length}</Button>
        {setup && <Button className={primary} disabled={missing.length > 0 || saving} onClick={() => apply((value) => startStudHand(value, { complete: openFullBet }))}>Start hand <ChevronRight size={14} /></Button>}
        {setupOpen && setup && <><button className="fixed inset-0 z-0 cursor-default" aria-label="Dismiss setup" onClick={() => setSetupOpen(false)} />
          <div role="dialog" aria-label="Stud setup" className="absolute z-10 left-0 top-full mt-2 w-[440px] max-w-[90vw] max-h-[75vh] overflow-y-auto p-4 rounded-xl border border-white/15 bg-zinc-950 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between"><span className="font-medium">Stakes &amp; seats</span><Button variant="ghost" size="icon-sm" aria-label="Close setup" onClick={() => setSetupOpen(false)}><X size={16} /></Button></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400">Players<select aria-label="Players" className={selectClass} value={state.playerCount} onChange={(event) => changeSetup({ playerCount: Number(event.target.value) })}>{[2,3,4,5,6,7,8].map((count) => <option key={count}>{count}</option>)}</select></label>
              <label className="text-xs text-zinc-400">Hero seat<select aria-label="Hero seat" className={selectClass} value={state.heroSeat} onChange={(event) => changeSetup({ heroSeat: Number(event.target.value) })}>{state.players.map((player) => <option key={player.seat} value={player.seat}>S{player.seat + 1}</option>)}</select></label>
              <label className="text-xs text-zinc-400">Last seat dealt<select aria-label="Last seat dealt" className={selectClass} value={state.dealerSeat} onChange={(event) => changeSetup({ dealerSeat: Number(event.target.value) })}>{state.players.map((player) => <option key={player.seat} value={player.seat}>S{player.seat + 1}</option>)}</select></label>
              <label className="text-xs text-zinc-400">Small bet<NumericInput aria-label="Small bet" value={state.smallBet} min={.01} step="any" onCommit={(smallBet) => changeSetup({ smallBet })} /></label>
              <label className="text-xs text-zinc-400">Ante<NumericInput aria-label="Ante" value={state.ante} min={0} step="any" onCommit={(ante) => changeSetup({ ante })} /></label>
              <label className="text-xs text-zinc-400">Bring-in<NumericInput aria-label="Bring-in" value={state.bringIn} min={.01} max={state.smallBet} step="any" onCommit={(bringIn) => changeSetup({ bringIn })} /></label>
            </div>
            <p className="text-xs text-zinc-500">The big bet is ${state.smallBet * 2}. Cards are dealt clockwise after the last seat dealt; equal exposed boards use this order.</p>
            <label className="text-xs text-zinc-400">Bet cap<select aria-label="Bet cap" className={selectClass} value={state.limitRules.maxBets} onChange={(event) => changeSetup({ limitRules: { ...state.limitRules, maxBets: Number(event.target.value) as 4 | 5 } })}><option value={4}>4 bets (bet + 3 raises)</option><option value={5}>5 bets (bet + 4 raises)</option></select></label>
            <div className="flex items-center gap-3 text-xs text-zinc-300"><Checkbox checked={state.limitRules.headsUpUncapped} ariaLabel="Uncapped when a round starts heads-up" onChange={(headsUpUncapped) => changeSetup({ limitRules: { ...state.limitRules, headsUpUncapped } })} className="size-5" /><span>Uncapped when a round starts heads-up</span></div>
            {state.variant === "STUD_HIGH" && <div className="flex items-center gap-3 text-xs text-zinc-300"><Checkbox checked={state.limitRules.fourthStreetBigBet} ariaLabel="Allow a fourth-street big bet with an open pair" onChange={(fourthStreetBigBet) => changeSetup({ limitRules: { ...state.limitRules, fourthStreetBigBet } })} className="size-5" /><span>Allow a fourth-street big bet with an open pair</span></div>}
            {state.variant === "RAZZ" && <p className="text-xs text-emerald-200">Lowest five-card hand wins; aces are low and straights/flushes do not count. The highest door card brings in, then the lowest exposed hand acts first.</p>}
            <p className="text-xs text-zinc-500">Click each seat’s name or stack on the table to edit it.</p>
            <Button variant="outline" onClick={onSwitchGame}><ArrowLeft size={14} /> Hold’em / Omaha</Button>
          </div></>}
      </div>
      <div className={`flex items-start gap-6 ${side ? "flex-row" : "flex-col"}`}>
        <div className="flex-1 w-full min-w-0 flex justify-center pt-5 pb-4"><div className="w-full" style={{ maxWidth: `calc((100vh - ${side ? 240 : 440}px) * ${state.playerCount >= 6 ? 1.5 : 2})`, minWidth: "min(100%, 640px)" }}>
          <StudTable variant={state.variant} players={state.players} heroSeat={state.heroSeat} dealerSeat={state.dealerSeat} cards={cards} pot={pot} round={round} active={activeSeat}
            committed={committed} bets={betting?.bets} folded={folded} mucked={state.muckedSeats} labels={labels}
            onEditPlayer={setup ? (seat, patch) => apply((value) => updateStudPlayer(value, seat, patch)) : undefined}
            onEditCards={setup ? setSetupSeat : undefined} />
        </div></div>
        <div className={`flex flex-col gap-4 ${side ? "w-[400px] shrink-0" : "w-full max-w-3xl self-center"}`}>
          <section aria-label="Hand controls" className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 flex flex-col gap-4 min-h-[270px]">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{activeSeat !== null ? `S${activeSeat + 1}${state.players[activeSeat].name ? ` · ${state.players[activeSeat].name}` : ""} ${state.phase === "deal" ? "to receive a card" : "to act"}` : round}</h2><Button variant="ghost" size="sm" disabled={!state.history.length || saving} onClick={undo}><RotateCcw size={13} /> Undo</Button></div>
            <fieldset disabled={saving} className="contents">
              {setup ? <>
                <div className="flex flex-wrap gap-1.5">{state.players.map((player) => <Button key={player.seat} variant={seat === player.seat ? "secondary" : "ghost"} size="sm" aria-pressed={seat === player.seat} onClick={() => setSetupSeat(player.seat)}>S{player.seat + 1}{missing.includes(player.seat) ? " ·" : " ✓"}</Button>)}</div>
                <p className="text-sm text-zinc-300">{seat === state.heroSeat ? "Choose your two downcards and door card, in order." : `Choose S${seat + 1}’s door card. Their downcards stay hidden.`}</p>
                <div className="flex justify-center py-2"><CardRow key={`${seat}:${state.heroSeat}`} cards={setupCards} used={unavailableStudCards(state)} highlight autoAdvanceCount={setupCards.length} ariaLabelPrefix={seat === state.heroSeat ? "Hero starting card" : "Door card"}
                  onPick={(index, card) => apply((value) => setStudStartingCards(value, seat, seat === state.heroSeat ? setupCards.map((entry, i) => i === index ? card : entry) : [null,null,card]))}
                  onClear={(card) => apply((value) => setStudStartingCards(value, seat, seat === state.heroSeat ? setupCards.map((entry) => entry === card ? null : entry) : [null,null,null]))} /></div>
                {missing.length ? <Button variant="outline" onClick={() => setSetupSeat(missing[0])}>{missing.includes(state.heroSeat) ? "Choose hero cards" : `Next missing door card · S${missing[0] + 1}`}</Button> : <p className="text-xs text-emerald-200">All starting cards are ready.</p>}
                {bringInSeat !== null && <p className="text-xs text-zinc-400">S{bringInSeat + 1} brings in with {state.players[bringInSeat].cards[2].card} showing.</p>}
                <div className="flex items-center gap-3 text-xs text-zinc-300"><Checkbox checked={openFullBet} ariaLabel="Bring-in player opened for a full bet" onChange={setOpenFullBet} className="size-5" /><span>Bring-in player opened for a full bet (${state.smallBet})</span></div>
              </> : betting && !betting.roundClosed ? <StudBettingPanel recorder={recorder} />
                : betting ? <><p className="text-sm text-zinc-400">{betting.handOver ? "One player remains." : "Betting is complete."}</p><Button className={`h-11 ${primary}`} onClick={() => apply(advanceStudPhase)}>{nextStudPhaseLabel(state, betting.handOver)}<ChevronRight size={14} /></Button></>
                : state.phase === "deal" ? <StudDealPanel key={`${state.street}:${state.history.length}`} recorder={recorder} />
                : finished ? <>
                  {editingSeat !== null ? <StudShowEditor key={`${editingSeat}:${state.history.length}`} state={state} seat={editingSeat} onCancel={() => setEditingSeat(null)} onShow={(cards) => apply((value) => setStudShownCards(value, editingSeat, cards))} />
                    : state.players.filter((player) => !folded.includes(player.seat) && state.playerCount - folded.length > 1).map((player) => {
                      const mucked = state.muckedSeats.includes(player.seat);
                      const shown = player.seat === state.heroSeat || !!state.shownCards[player.seat];
                      return <div key={player.seat} className="flex items-center gap-2 text-xs"><span className="w-9 text-zinc-300">S{player.seat + 1}</span><span className="flex-1 text-zinc-500">{mucked ? "Mucked" : shown ? "Shown" : "Undecided"}</span>
                        {player.seat !== state.heroSeat && <Button variant="outline" size="sm" onClick={() => setEditingSeat(player.seat)}>{shown && !mucked ? "Edit downcards" : "Show downcards"}</Button>}
                        <Button variant="ghost" size="sm" onClick={() => apply((value) => setStudMucked(value, player.seat, !mucked))}>{mucked ? "Undo muck" : "Muck"}</Button>
                      </div>;
                    })}
                  {resolution.payload && editingSeat === null ? <><p className="text-sm text-emerald-300">Hero result: {resolution.payload.result >= 0 ? "+" : "−"}${Math.abs(resolution.payload.result).toLocaleString()}</p><Button className={`h-11 ${primary}`} onClick={save}><Save size={14} /> Save &amp; replay</Button></>
                    : <p className="text-xs text-zinc-500">{editingSeat !== null ? "Confirm or cancel the shown hand before saving." : resolution.reason}</p>}
                </> : null}
            </fieldset>
          </section>
          <section className="rounded-xl border border-white/10 p-4 flex flex-col gap-3">
            <label className="text-xs text-zinc-400 flex flex-col gap-2">Notes<textarea value={notes} disabled={saving} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Reads, decisions, anything to remember…" className="rounded-md bg-transparent border border-white/10 p-2 text-sm resize-y" /></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-xs text-zinc-400">Venue<Input value={venue} disabled={saving} onChange={(event) => setVenue(event.target.value)} /></label><label className="text-xs text-zinc-400">Date<Input aria-label="Hand date" type="date" value={date} disabled={saving} onChange={(event) => setDate(event.target.value)} /></label></div>
          </section>
        </div>
      </div>
      {logOpen && <section aria-label="Action log" className="rounded-xl border border-white/10 p-4 text-sm flex flex-col gap-2"><h2 className="font-semibold">Hand log</h2>{studLogEntries(state).map((entry) => <p key={entry.id} className="text-zinc-400">{entry.round === "showdown" ? "Showdown" : studRoundLabel(entry.round as StudState["street"])} · {entry.seat !== undefined ? `S${entry.seat + 1} ` : ""}{entry.label}</p>)}</section>}
    </div>
  </Shell>;
}
