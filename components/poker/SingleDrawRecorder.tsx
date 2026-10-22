"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, RotateCcw, Save, Settings, X } from "lucide-react";
import { Header, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useIsSideLayout } from "@/lib/use-is-side-layout";
import { useIsMobile } from "@/lib/use-is-mobile";
import MobileSingleDrawRecorder from "@/components/mobile/MobileSingleDrawRecorder";
import type { ActionType } from "./engine";
import { CardRow } from "./CardPicker";
import DrawTable from "./DrawTable";
import NumericInput from "./NumericInput";
import { POSITION_NAMES } from "./lib";
import {
  advanceSingleDrawPhase, deriveSingleDrawBetting, recordSingleDrawAction,
  recordSingleDrawDecision, setSingleDrawMucked, setSingleDrawShownCards,
  setSingleDrawStartingCards, startSingleDrawHand, updateSingleDrawPlayer, type SingleDrawState,
} from "./single-draw-engine";
import { changeSingleDrawSetup, drawRoundLabel, knownSingleDrawCards, singleDrawSizing, type SingleDrawDraft } from "./single-draw-ui";
import { useSingleDrawRecorder, type SingleDrawSaveOptions } from "./use-single-draw-recorder";

const emptyHand = () => Array<string | null>(5).fill(null);
const primary = "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-semibold";

function BettingPanel({ state, act }: { state: SingleDrawState; act: (action: ActionType, amount?: number) => void }) {
  const betting = deriveSingleDrawBetting(state)!;
  const sizing = singleDrawSizing(state, betting);
  const [amount, setAmount] = useState(String(sizing.minimum));
  const target = Number(amount);
  const valid = Number.isFinite(target) && target >= sizing.minimum && target <= sizing.maximum;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element?.closest("input, textarea, select, button, [contenteditable='true']") || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "f") { event.preventDefault(); act("fold"); }
      if (key === "c") { event.preventDefault(); act(betting.canCheck ? "check" : "call"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, betting.canCheck]);
  return <div className="flex flex-col gap-4">
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="h-11 text-rose-300 border-rose-400/30" onClick={() => act("fold")}>Fold <kbd className="opacity-40 ml-2">F</kbd></Button>
      <Button variant="outline" className="h-11" onClick={() => act(betting.canCheck ? "check" : "call")}>{betting.canCheck ? "Check" : `Call $${sizing.call}`} <kbd className="opacity-40 ml-2">C</kbd></Button>
    </div>
    <label className="text-xs text-zinc-400 flex flex-col gap-2">{betting.lastBet > 0 ? "Raise to" : "Bet amount"}
      <Input aria-label={betting.lastBet > 0 ? "Raise to" : "Bet amount"} inputMode="decimal" value={amount} disabled={!sizing.canRaise} onChange={(event) => setAmount(event.target.value)} className="text-xl font-mono h-12" />
    </label>
    <div className="grid grid-cols-4 gap-1.5">
      {[{ label: "Min", value: sizing.minimum }, { label: "½ pot", value: betting.lastBet + (betting.totalPot + betting.toCall) / 2 },
        { label: "Pot", value: betting.lastBet + betting.totalPot + betting.toCall }, { label: "All-in", value: sizing.maximum }].map((preset) =>
        <Button key={preset.label} variant="outline" size="sm" disabled={!sizing.canRaise} onClick={() => setAmount(String(Math.min(sizing.maximum, Math.max(sizing.minimum, preset.value))))}>{preset.label}</Button>)}
    </div>
    <Button className={`h-11 ${primary}`} disabled={!sizing.canRaise || !valid} onClick={() => act(betting.lastBet > 0 ? "raise" : "bet", target)}>
      {betting.lastBet > 0 ? "Raise" : "Bet"}{valid && sizing.canRaise ? ` to $${target}` : ""}
    </Button>
    {!sizing.canRaise && <p className="text-xs text-zinc-500">{sizing.maximum <= betting.lastBet ? "Your remaining stack is covered by the call." : "The short all-in did not reopen raising."}</p>}
  </div>;
}

function HeroDrawPanel({ state, selected, onClear, onRecord }: {
  state: SingleDrawState; selected: number[]; onClear: () => void;
  onRecord: (indexes: number[], replacements: string[]) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const [replacements, setReplacements] = useState<(string | null)[]>(() => selected.map(() => null));
  const used = knownSingleDrawCards(state);
  replacements.forEach((card) => { if (card) used.add(card); });
  return <div className="flex flex-col gap-4">
    {!choosing ? <>
      <p className="text-sm text-zinc-300">Click the cards in your hand to discard them. Keep the rest.</p>
      <p className="text-xs text-zinc-500">{selected.length ? `Keeping ${5 - selected.length} · drawing ${selected.length}` : "Keeping all five cards"}</p>
      <Button className={`h-11 ${primary}`} onClick={() => {
        if (!selected.length) onRecord([], []);
        else { setReplacements(selected.map(() => null)); setChoosing(true); }
      }}>{selected.length ? `Choose ${selected.length} replacement${selected.length === 1 ? "" : "s"}` : "Stand pat"}</Button>
      {selected.length > 0 && <Button variant="ghost" onClick={onClear}>Keep all five</Button>}
    </> : <>
      <p className="text-sm text-zinc-300">Enter {selected.length} replacement{selected.length === 1 ? "" : "s"}. Each goes into its discarded slot.</p>
      <div className="flex justify-center py-3"><CardRow cards={replacements} used={used} autoAdvanceCount={selected.length} size="sm" ariaLabelPrefix="Replacement card" highlight
        onPick={(index, card) => setReplacements((current) => current.map((value, i) => i === index ? card : value))}
        onClear={(card) => setReplacements((current) => current.map((value) => value === card ? null : value))} /></div>
      <Button className={primary} disabled={replacements.some((card) => !card)} onClick={() => onRecord(selected, replacements as string[])}>Confirm draw {selected.length}</Button>
      <Button variant="ghost" onClick={() => setChoosing(false)}>Back to discards</Button>
    </>}
  </div>;
}

function ShowHandEditor({ state, seat, onShow, onCancel }: { state: SingleDrawState; seat: number; onShow: (cards: string[]) => void; onCancel: () => void }) {
  const [cards, setCards] = useState<(string | null)[]>(() => [...(state.players[seat].cards ?? emptyHand())]);
  const used = knownSingleDrawCards(state, seat);
  cards.forEach((card) => { if (card) used.add(card); });
  return <div className="flex flex-col gap-4 p-3 border border-emerald-500/30 rounded-lg">
    <p className="text-sm font-medium">{POSITION_NAMES[state.playerCount][seat]} shows five cards</p>
    <div className="flex justify-center"><CardRow cards={cards} used={used} autoAdvanceCount={5} size="sm" ariaLabelPrefix="Shown card" highlight
      onPick={(index, card) => setCards((current) => current.map((value, i) => i === index ? card : value))}
      onClear={(card) => setCards((current) => current.map((value) => value === card ? null : value))} /></div>
    <div className="flex gap-2"><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button className={`flex-1 ${primary}`} disabled={cards.some((card) => !card)} onClick={() => onShow(cards as string[])}>Confirm show</Button></div>
  </div>;
}

export default function SingleDrawRecorder({ initialDraft, onSwitchGame, onSaveAction, onSavedAction }: {
  initialDraft: SingleDrawDraft; onSwitchGame: () => void;
} & SingleDrawSaveOptions) {
  const recorder = useSingleDrawRecorder(initialDraft, { onSaveAction, onSavedAction });
  const { isMobile } = useIsMobile();
  return isMobile ? <MobileSingleDrawRecorder recorder={recorder} onSwitchGame={onSwitchGame} />
    : <DesktopSingleDrawRecorder recorder={recorder} onSwitchGame={onSwitchGame} />;
}

function DesktopSingleDrawRecorder({ recorder, onSwitchGame }: {
  recorder: ReturnType<typeof useSingleDrawRecorder>; onSwitchGame: () => void;
}) {
  const confirm = useConfirm();
  const side = useIsSideLayout();
  const [setupOpen, setSetupOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const {
    state, name, setName, notes, setNotes, venue, setVenue, date, setDate, selected, setSelected,
    editingSeat, setEditingSeat, saving, betting, drawSeat, activeSeat, setup, finished,
    folded, committed, pot, resolution, apply, undo, cards, labels, save,
  } = recorder;
  const positions = POSITION_NAMES[state.playerCount];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSetupOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const heroCards = state.players[state.heroSeat].cards ?? emptyHand();
  const changeSetup = (patch: Parameters<typeof changeSingleDrawSetup>[1]) => apply((current) => changeSingleDrawSetup(current, patch));
  return <Shell header={<Header title="" back="Dashboard" backHref="/dashboard" onBack={() =>
    confirm({ title: "Leave without saving?", message: "Your in-progress recording will be lost.", confirmLabel: "Leave", destructive: true })}
    right={<><span className="text-xs font-mono text-muted-foreground">draft · {drawRoundLabel(state.phase)}</span><Button className={primary} onClick={save} disabled={!resolution.payload || editingSeat !== null || saving}>{saving ? "Saving…" : "Save hand"}</Button></>} />}>
    <div className="w-full max-w-[1600px] mx-auto p-6 flex flex-col gap-4">
      <Input aria-label="Hand name" value={name} disabled={saving} onChange={(event) => setName(event.target.value)} className="text-xl font-semibold border-transparent px-0 max-w-lg" />
      <div className="flex flex-wrap items-center gap-3 text-sm relative z-30">
        <Button variant="outline" size="sm" disabled={!setup || saving} onClick={() => setSetupOpen(!setupOpen)}><Settings size={14} /> Stakes &amp; seats</Button>
        <span className="text-emerald-300 font-semibold">2–7 Single Draw</span><span className="text-zinc-500">${state.sb}/${state.bb} · {state.playerCount}-handed</span>
        <span className="text-xs uppercase tracking-wider rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">{drawRoundLabel(state.phase)}</span>
        <span className="text-zinc-400">Pot <strong className="text-zinc-100">${pot}</strong></span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setLogOpen(!logOpen)}>Log {state.actions.length + state.draws.length}</Button>
        {setup && <Button className={primary} disabled={heroCards.some((card) => !card) || saving} onClick={() => apply(startSingleDrawHand)}>Start hand <ChevronRight size={14} /></Button>}
        {setupOpen && setup && <><button type="button" className="fixed inset-0 z-0 cursor-default" aria-label="Dismiss setup" onClick={() => setSetupOpen(false)} />
          <div className="absolute z-10 left-0 top-full mt-2 w-[420px] max-w-[90vw] p-4 rounded-xl border border-white/15 bg-zinc-950 shadow-2xl flex flex-col gap-4" role="dialog" aria-label="Single Draw setup">
          <div className="flex items-center justify-between"><span className="font-medium">Stakes &amp; seats</span><Button variant="ghost" size="icon-sm" aria-label="Close setup" onClick={() => setSetupOpen(false)}><X size={16} /></Button></div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-zinc-400">Players<select aria-label="Players" className="mt-1 h-9 w-full rounded-md border border-white/15 bg-zinc-900 px-2 text-zinc-100" value={state.playerCount} onChange={(event) => changeSetup({ playerCount: Number(event.target.value) })}>{[2,3,4,5,6,7,8].map((count) => <option key={count}>{count}</option>)}</select></label>
            <label className="text-xs text-zinc-400">Hero position<select aria-label="Hero position" className="mt-1 h-9 w-full rounded-md border border-white/15 bg-zinc-900 px-2 text-zinc-100" value={state.heroSeat} onChange={(event) => changeSetup({ heroSeat: Number(event.target.value) })}>{positions.map((position, index) => <option key={position} value={index}>{position}</option>)}</select></label>
            <label className="text-xs text-zinc-400">Small blind<NumericInput aria-label="Small blind" value={state.sb} min={0.01} step="any" onCommit={(sb) => changeSetup({ sb })} /></label>
            <label className="text-xs text-zinc-400">Big blind<NumericInput aria-label="Big blind" value={state.bb} min={state.sb} step="any" onCommit={(bb) => changeSetup({ bb })} /></label>
          </div>
          <p className="text-xs text-zinc-500">Click each seat’s name or stack on the table to edit it.</p>
          <Button variant="outline" onClick={onSwitchGame}><ArrowLeft size={14} /> Hold’em / Omaha</Button>
        </div></>}
      </div>
      <div className={`flex gap-6 items-start ${side ? "flex-row" : "flex-col"}`}>
        <div className="flex-1 w-full min-w-0 flex justify-center pt-7 pb-4">
          <div className="w-full" style={{ maxWidth: side ? "calc((100vh - 220px) * 2)" : "calc((100vh - 440px) * 2)", minWidth: "min(100%, 640px)" }}>
            <DrawTable players={state.players} heroSeat={state.heroSeat} cards={cards} pot={pot} round={drawRoundLabel(state.phase)} active={activeSeat}
              committed={committed} bets={betting?.bets} folded={folded} mucked={state.muckedSeats} labels={labels}
              selected={selected} onToggleHero={state.phase === "draw" && drawSeat === state.heroSeat ? (index) => setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index].sort((a,b) => a-b)) : undefined}
              onEditPlayer={setup ? (seat, patch) => apply((current) => updateSingleDrawPlayer(current, seat, patch)) : undefined}
              heroCards={setup ? <CardRow cards={heroCards} used={knownSingleDrawCards(state)} autoAdvanceCount={5} ariaLabelPrefix="Hero card" highlight
                onPick={(index, card) => apply((current) => setSingleDrawStartingCards(current, current.heroSeat, heroCards.map((value, i) => i === index ? card : value)))}
                onClear={(card) => apply((current) => setSingleDrawStartingCards(current, current.heroSeat, heroCards.map((value) => value === card ? null : value)))} /> : undefined} />
          </div>
        </div>
        <div className={`flex flex-col gap-4 ${side ? "w-[360px] shrink-0" : "w-full max-w-3xl self-center"}`}>
          <section className="rounded-xl border border-white/10 bg-zinc-950/40 p-4 flex flex-col gap-4 min-h-[260px]" aria-label="Hand controls">
            <div className="flex justify-between items-center"><h2 className="font-semibold text-sm">{activeSeat !== null ? `${positions[activeSeat]}${state.players[activeSeat].name ? ` · ${state.players[activeSeat].name}` : ""} ${state.phase === "draw" ? "to draw" : "to act"}` : drawRoundLabel(state.phase)}</h2>
              <Button variant="ghost" size="sm" disabled={!state.history.length || saving} onClick={undo}><RotateCcw size={13} /> Undo</Button></div>
            <fieldset disabled={saving} className="contents">
              {setup ? <p className="text-sm text-zinc-400">Pick your five starting cards on the table, set the stacks, then start the hand.</p>
                : betting && !betting.roundClosed ? <BettingPanel key={`${state.phase}-${state.actions.length}`} state={state} act={(action, amount) => apply((current) => recordSingleDrawAction(current, { seat: betting.activeSeat!, action, amount }))} />
                : betting ? <><p className="text-sm text-zinc-400">{betting.handOver ? "One player remains." : "Betting is complete."}</p><Button className={primary} onClick={() => apply(advanceSingleDrawPhase)}>{betting.handOver ? "Confirm result" : state.phase === "predraw" ? "Go to draw" : "Go to showdown"}<ChevronRight size={14} /></Button></>
                : state.phase === "draw" ? drawSeat === null ? <Button className={primary} onClick={() => apply(advanceSingleDrawPhase)}>Finish draw <ChevronRight size={14} /></Button>
                  : drawSeat === state.heroSeat ? <HeroDrawPanel key={`${state.history.length}:${selected.join("-")}`} state={state} selected={selected} onClear={() => setSelected([])} onRecord={(discardIndexes, replacementCards) => apply((current) => recordSingleDrawDecision(current, { seat: current.heroSeat, count: discardIndexes.length, discardIndexes, replacementCards }))} />
                  : <><p className="text-sm text-zinc-400">How many cards did this player draw?</p><div className="grid grid-cols-3 gap-2">{[0,1,2,3,4,5].map((count) => <Button key={count} variant="outline" className="h-12" onClick={() => apply((current) => recordSingleDrawDecision(current, { seat: drawSeat, count }))}>{count === 0 ? "Stand pat" : `Draw ${count}`}</Button>)}</div><p className="text-xs text-zinc-500">Only the public count is recorded.</p></>
                : finished ? <>
                  {editingSeat !== null ? <ShowHandEditor key={`${editingSeat}-${state.history.length}`} state={state} seat={editingSeat} onCancel={() => setEditingSeat(null)} onShow={(shownCards) => apply((current) => setSingleDrawShownCards(current.muckedSeats.includes(editingSeat) ? setSingleDrawMucked(current, editingSeat, false) : current, editingSeat, shownCards))} />
                    : state.players.filter((player) => !folded.includes(player.seat) && state.playerCount - folded.length > 1).map((player) => {
                      const mucked = state.muckedSeats.includes(player.seat);
                      const shown = !!player.cards?.every(Boolean);
                      return <div key={player.seat} className="flex gap-2 items-center text-xs"><span className="w-14 text-zinc-300">{positions[player.seat]}</span><span className="flex-1 text-zinc-500">{mucked ? "Mucked" : shown ? "Shown" : "Undecided"}</span>
                        {player.seat !== state.heroSeat && <Button variant="outline" size="sm" onClick={() => setEditingSeat(player.seat)}>{shown && !mucked ? "Edit cards" : "Show cards"}</Button>}
                        <Button variant="ghost" size="sm" onClick={() => apply((current) => setSingleDrawMucked(current, player.seat, !mucked))}>{mucked ? "Undo muck" : "Muck"}</Button>
                      </div>;
                    })}
                  {resolution.payload && editingSeat === null ? <><p className="text-sm text-emerald-300">Hero result: {resolution.payload.result >= 0 ? "+" : "−"}${Math.abs(resolution.payload.result).toLocaleString()}</p><Button className={primary} onClick={save}><Save size={14} /> Save &amp; replay</Button></>
                    : <p className="text-xs text-zinc-500">{editingSeat !== null ? "Confirm or cancel the shown hand before saving." : resolution.reason}</p>}
                </> : null}
            </fieldset>
          </section>
          <section className="rounded-xl border border-white/10 p-4 flex flex-col gap-3">
            <label className="text-xs text-zinc-400 flex flex-col gap-2">Notes<textarea value={notes} disabled={saving} onChange={(event) => setNotes(event.target.value)} rows={3} className="rounded-md bg-transparent border border-white/10 p-2 text-sm resize-y" placeholder="Reads, decisions, anything to remember…" /></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-xs text-zinc-400">Venue<Input value={venue} disabled={saving} onChange={(event) => setVenue(event.target.value)} /></label><label className="text-xs text-zinc-400">Date<Input aria-label="Hand date" type="date" value={date} disabled={saving} onChange={(event) => setDate(event.target.value)} /></label></div>
          </section>
        </div>
      </div>
      {logOpen && <section aria-label="Action log" className="rounded-xl border border-white/10 p-4 text-sm flex flex-col gap-2">
        <h2 className="font-semibold">Hand log</h2>
        {state.actions.filter((action) => action.round === "predraw").map((action) => <p key={action.id} className="text-zinc-400">Predraw · {positions[action.seat]} {action.action}{action.amount !== undefined ? ` $${action.amount}` : ""}</p>)}
        {state.draws.map((draw) => <p key={draw.seat} className="text-emerald-300/80">Draw · {positions[draw.seat]} {draw.count ? `draws ${draw.count}` : "stands pat"}</p>)}
        {state.actions.filter((action) => action.round === "postdraw").map((action) => <p key={action.id} className="text-zinc-400">Postdraw · {positions[action.seat]} {action.action}{action.amount !== undefined ? ` $${action.amount}` : ""}</p>)}
      </section>}
    </div>
  </Shell>;
}
