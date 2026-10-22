"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileText, RotateCcw, Settings } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import NumericInput from "@/components/poker/NumericInput";
import { POSITION_NAMES } from "@/components/poker/lib";
import {
  advanceSingleDrawPhase, recordSingleDrawAction, recordSingleDrawDecision, setSingleDrawMucked,
  setSingleDrawShownCards, setSingleDrawStartingCards, startSingleDrawHand, updateSingleDrawPlayer,
} from "@/components/poker/single-draw-engine";
import { changeSingleDrawSetup, drawRoundLabel, knownSingleDrawCards, singleDrawSizing } from "@/components/poker/single-draw-ui";
import type { SingleDrawRecorderController } from "@/components/poker/use-single-draw-recorder";
import { startRouteProgress } from "@/lib/route-progress";
import { CardPickerSheet } from "./CardPickerSheet";
import VerticalDrawFelt, { MobileDrawCards } from "./VerticalDrawFelt";

const primary = "h-12 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-semibold";
const blank = (count = 5) => Array<string | null>(count).fill(null);

function MobileBetting({ recorder }: { recorder: SingleDrawRecorderController }) {
  const { state, betting, apply } = recorder;
  const sizing = singleDrawSizing(state, betting!);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(sizing.minimum));
  const value = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(value) && value >= sizing.minimum && value <= sizing.maximum;
  const raise = betting!.lastBet > 0;
  const act = (action: "fold" | "check" | "call" | "raise" | "bet", target?: number) =>
    apply((current) => recordSingleDrawAction(current, { seat: betting!.activeSeat!, action, amount: target }));
  return <>
    <div className="grid grid-cols-3 gap-2">
      <Button className="h-12 text-rose-300 border-rose-400/30" variant="outline" onClick={() => act("fold")}>Fold</Button>
      <Button className="h-12" variant="outline" onClick={() => act(betting!.canCheck ? "check" : "call")}>{betting!.canCheck ? "Check" : `Call $${sizing.call}`}</Button>
      <Button className={primary} disabled={!sizing.canRaise} onClick={() => setOpen(true)}>{raise ? "Raise" : "Bet"}</Button>
    </div>
    {!sizing.canRaise && <p className="text-xs text-zinc-500">{sizing.maximum <= betting!.lastBet ? "Your stack is covered by the call." : "The short all-in did not reopen raising."}</p>}
    <BottomSheet open={open} onOpenChange={setOpen} title={raise ? "Raise to" : "Bet amount"} footer={
      <Button className={`w-full ${primary}`} disabled={!valid || !sizing.canRaise} onClick={() => { if (act(raise ? "raise" : "bet", value)) setOpen(false); }}>{raise ? "Raise" : "Bet"}{valid ? ` to $${value}` : ""}</Button>
    }>
      <div className="p-4 flex flex-col gap-4">
        <Input aria-label={raise ? "Raise to" : "Bet amount"} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-14 text-2xl! font-mono" />
        <div className="grid grid-cols-4 gap-2">{[
          { label: "Min", value: sizing.minimum }, { label: "½ pot", value: betting!.lastBet + (betting!.totalPot + betting!.toCall) / 2 },
          { label: "Pot", value: betting!.lastBet + betting!.totalPot + betting!.toCall }, { label: "All-in", value: sizing.maximum },
        ].map((preset) => <Button key={preset.label} variant="outline" className="h-11" onClick={() => setAmount(String(Math.max(sizing.minimum, Math.min(sizing.maximum, preset.value))))}>{preset.label}</Button>)}</div>
        <p className="text-xs text-zinc-500">Min ${sizing.minimum} · Max ${sizing.maximum}</p>
      </div>
    </BottomSheet>
  </>;
}

/** Staged edits commit together, so dismissing a picker never records a partial draw/show. */
function CardEditor({ initial, used, title, onConfirm, onCancel, confirmLabel }: {
  initial: (string | null)[]; used: Set<string>; title: string; confirmLabel: string;
  onConfirm: (cards: string[]) => void; onCancel: () => void;
}) {
  const [cards, setCards] = useState(initial);
  const [slot, setSlot] = useState<number | null>(null);
  const unavailable = new Set(used);
  cards.forEach((card, index) => { if (card && index !== slot) unavailable.add(card); });
  return <div className="flex flex-col gap-4">
    <p className="text-sm text-zinc-300">{title}</p>
    <div className="flex justify-center py-1"><MobileDrawCards labelPrefix="Entered card" slots={cards.map((card) => ({ present: !!card, visibility: "up", ...(card ? { card } : {}) }))} onSlot={setSlot} /></div>
    <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-12" onClick={onCancel}>Cancel</Button><Button className={primary} disabled={cards.some((card) => !card)} onClick={() => onConfirm(cards as string[])}>{confirmLabel}</Button></div>
    <CardPickerSheet open={slot !== null} title={`${title} · card ${(slot ?? 0) + 1} of ${cards.length}`} used={unavailable} onClose={() => setSlot(null)} onPick={(card) => {
      if (slot === null) return;
      const next = cards.map((value, index) => index === slot ? card : value);
      setCards(next);
      const empty = next.findIndex((value) => !value);
      setSlot(cards[slot] || empty < 0 ? null : empty);
    }} />
  </div>;
}

function HeroExchange({ recorder }: { recorder: SingleDrawRecorderController }) {
  const { state, selected, setSelected, apply } = recorder;
  const [replacing, setReplacing] = useState(false);
  const record = (replacementCards: string[]) => apply((current) => recordSingleDrawDecision(current, {
    seat: current.heroSeat, count: selected.length, discardIndexes: selected, replacementCards,
  }));
  return replacing ? <CardEditor initial={blank(selected.length)} used={knownSingleDrawCards(state)} title={`Replacement${selected.length === 1 ? "" : "s"} for slot${selected.length === 1 ? "" : "s"} ${selected.map((index) => index + 1).join(", ")}`}
    confirmLabel={`Draw ${selected.length}`} onConfirm={record} onCancel={() => setReplacing(false)} />
    : <>
      <p className="text-sm text-zinc-300">Tap your cards to discard. {selected.length ? `Keep ${5 - selected.length} · draw ${selected.length}.` : "Keep all five to stand pat."}</p>
      <Button className={primary} onClick={() => selected.length ? setReplacing(true) : record([])}>{selected.length ? `Choose ${selected.length} replacement${selected.length === 1 ? "" : "s"}` : "Stand pat"}</Button>
      {selected.length > 0 && <Button variant="ghost" className="h-11" onClick={() => setSelected([])}>Keep all five</Button>}
    </>;
}

export default function MobileSingleDrawRecorder({ recorder, onSwitchGame }: {
  recorder: SingleDrawRecorderController; onSwitchGame: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [setupOpen, setSetupOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [heroSlot, setHeroSlot] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const { state, name, setName, notes, setNotes, venue, setVenue, date, setDate, selected, setSelected,
    editingSeat, setEditingSeat, saving, betting, drawSeat, activeSeat, setup, finished, folded,
    committed, pot, resolution, apply, undo, cards, labels, save } = recorder;
  const positions = POSITION_NAMES[state.playerCount];
  const heroCards = state.players[state.heroSeat].cards ?? blank();
  const heroUsed = knownSingleDrawCards(state);
  if (heroSlot !== null && heroCards[heroSlot]) heroUsed.delete(heroCards[heroSlot]!);
  const changeSetup = (patch: Parameters<typeof changeSingleDrawSetup>[1]) => apply((current) => changeSingleDrawSetup(current, patch));
  const heroDrawing = state.phase === "draw" && drawSeat === state.heroSeat;
  return <div className="min-h-[100dvh] bg-background text-zinc-100 flex flex-col">
    <header className="h-14 px-2 flex items-center gap-2 border-b border-white/10 shrink-0">
      <Button variant="ghost" size="icon" className="size-11" aria-label="Back to dashboard" onClick={async () => {
        if (await confirm({ title: "Leave without saving?", message: "Your in-progress recording will be lost.", confirmLabel: "Leave", destructive: true })) { startRouteProgress(); router.push("/dashboard"); }
      }}><ChevronLeft size={22} /></Button>
      <button type="button" aria-label="Edit hand details" className="flex-1 min-w-0 text-left" disabled={saving} onClick={() => setDetailsOpen(true)}><p className="text-sm font-semibold truncate">{name || "Untitled hand"}</p><p className="text-[10px] text-emerald-300">2–7 Single Draw · ${state.sb}/${state.bb}</p></button>
      <Button variant="ghost" size="icon" className="size-11" aria-label="Notes and hand details" onClick={() => setDetailsOpen(true)} disabled={saving}><FileText size={18} /></Button>
    </header>
    <div className="flex items-center gap-2 px-3 py-2 text-xs">
      {setup ? <Button variant="outline" className="h-9" onClick={() => setSetupOpen(true)}><Settings size={14} /> Setup</Button> : <span className="rounded-md bg-emerald-500/10 px-2 py-2 text-emerald-200">{drawRoundLabel(state.phase)}</span>}
      <span className="text-zinc-500">{state.playerCount}-handed</span><div className="flex-1" />
      <Button variant="ghost" className="h-9" onClick={() => setLogOpen(true)}>Log {state.actions.length + state.draws.length}</Button>
    </div>
    <fieldset disabled={saving} className="contents">
      <div className="px-2 shrink-0" style={{ height: `max(${state.playerCount >= 6 ? 440 : state.playerCount === 5 ? 400 : 360}px, calc(100dvh - 330px))` }}>
        <VerticalDrawFelt players={state.players} heroSeat={state.heroSeat} cards={cards} pot={pot} round={drawRoundLabel(state.phase)} active={activeSeat}
          committed={committed} bets={betting?.bets} folded={folded} mucked={state.muckedSeats} labels={labels} selected={selected} discarding={heroDrawing}
          onEditSeat={setup ? () => setSetupOpen(true) : undefined} onHeroCardSlot={setup ? setHeroSlot : heroDrawing ? (index) => setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index].sort((a,b) => a-b)) : undefined} />
      </div>
      <section aria-label="Hand controls" className="flex flex-col gap-3 p-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold truncate">{activeSeat !== null ? `${positions[activeSeat]}${state.players[activeSeat].name ? ` · ${state.players[activeSeat].name}` : ""} ${state.phase === "draw" ? "to draw" : "to act"}` : drawRoundLabel(state.phase)}</h2><Button variant="ghost" className="h-11 shrink-0" disabled={!state.history.length} onClick={undo}><RotateCcw size={14} /> Undo</Button></div>
        {setup ? <><p className="text-xs text-zinc-400">Tap your five cards to enter them. Set names and stacks in Setup.</p><Button className={primary} disabled={heroCards.some((card) => !card)} onClick={() => apply(startSingleDrawHand)}>Start hand</Button></>
          : betting && !betting.roundClosed ? <MobileBetting key={`${state.phase}-${state.actions.length}`} recorder={recorder} />
            : betting ? <Button className={primary} onClick={() => apply(advanceSingleDrawPhase)}>{betting.handOver ? "Confirm result" : state.phase === "predraw" ? "Go to draw" : "Go to showdown"}</Button>
              : state.phase === "draw" ? drawSeat === null ? <Button className={primary} onClick={() => apply(advanceSingleDrawPhase)}>Finish draw</Button>
                : heroDrawing ? <HeroExchange key={`${state.history.length}:${selected.join("-")}`} recorder={recorder} />
                  : <><p className="text-xs text-zinc-400">How many cards did this player draw?</p><div className="grid grid-cols-3 gap-2">{[0,1,2,3,4,5].map((count) => <Button key={count} variant="outline" className="h-12" onClick={() => apply((current) => recordSingleDrawDecision(current, { seat: drawSeat, count }))}>{count ? `Draw ${count}` : "Stand pat"}</Button>)}</div></>
                : finished ? <>
                  {editingSeat !== null ? <CardEditor key={`${editingSeat}-${state.history.length}`} initial={[...(state.players[editingSeat].cards ?? blank())]} used={knownSingleDrawCards(state, editingSeat)} title={`${positions[editingSeat]} shows five cards`} confirmLabel="Confirm show"
                    onCancel={() => setEditingSeat(null)} onConfirm={(shown) => apply((current) => setSingleDrawShownCards(current.muckedSeats.includes(editingSeat) ? setSingleDrawMucked(current, editingSeat, false) : current, editingSeat, shown))} />
                    : state.players.filter((player) => !folded.includes(player.seat) && state.playerCount - folded.length > 1).map((player) => {
                      const mucked = state.muckedSeats.includes(player.seat);
                      const shown = !!player.cards?.every(Boolean);
                      return <div key={player.seat} className="flex items-center gap-2 text-xs border-b border-white/5 pb-2"><div className="flex-1"><p className="font-semibold">{positions[player.seat]}</p><p className="text-zinc-500 mt-1">{mucked ? "Mucked" : shown ? "Shown" : "Undecided"}</p></div>
                        {player.seat !== state.heroSeat && <Button variant="outline" className="h-11" onClick={() => setEditingSeat(player.seat)}>{shown && !mucked ? "Edit cards" : "Show cards"}</Button>}
                        <Button variant="ghost" className="h-11" onClick={() => apply((current) => setSingleDrawMucked(current, player.seat, !mucked))}>{mucked ? "Undo muck" : "Muck"}</Button>
                      </div>;
                    })}
                  {resolution.payload && editingSeat === null ? <p className="text-sm text-emerald-300">Hero result: {resolution.payload.result >= 0 ? "+" : "−"}${Math.abs(resolution.payload.result).toLocaleString()}</p> : <p className="text-xs text-zinc-500">{editingSeat !== null ? "Confirm or cancel the shown hand before saving." : resolution.reason}</p>}
                  <Button className={primary} disabled={!resolution.payload || editingSeat !== null} onClick={save}>{saving ? "Saving…" : "Save & replay"}</Button>
                </> : null}
      </section>
    </fieldset>
    <CardPickerSheet open={heroSlot !== null && setup} title={`Hero card ${(heroSlot ?? 0) + 1} of 5`} used={heroUsed} onClose={() => setHeroSlot(null)} onPick={(card) => {
      if (heroSlot === null) return;
      const next = heroCards.map((value, index) => index === heroSlot ? card : value);
      if (apply((current) => setSingleDrawStartingCards(current, current.heroSeat, next))) {
        const empty = next.findIndex((value) => !value);
        setHeroSlot(heroCards[heroSlot] || empty < 0 ? null : empty);
      }
    }} />
    <BottomSheet open={setupOpen && setup} onOpenChange={setSetupOpen} title="Single Draw setup" cancelLabel="Done">
      <div className="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-zinc-400">Players<select aria-label="Players" className="mt-1 h-11 w-full rounded-md border border-white/15 bg-zinc-900 px-2" value={state.playerCount} onChange={(event) => changeSetup({ playerCount: Number(event.target.value) })}>{[2,3,4,5,6,7,8].map((count) => <option key={count}>{count}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Hero position<select aria-label="Hero position" className="mt-1 h-11 w-full rounded-md border border-white/15 bg-zinc-900 px-2" value={state.heroSeat} onChange={(event) => changeSetup({ heroSeat: Number(event.target.value) })}>{positions.map((position, index) => <option key={position} value={index}>{position}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Small blind<NumericInput aria-label="Small blind" className="h-11 mt-1" value={state.sb} min={0.01} step="any" onCommit={(sb) => changeSetup({ sb })} /></label>
          <label className="text-xs text-zinc-400">Big blind<NumericInput aria-label="Big blind" className="h-11 mt-1" value={state.bb} min={state.sb} step="any" onCommit={(bb) => changeSetup({ bb })} /></label>
        </div>
        {state.players.map((player) => <div key={player.seat} className="grid grid-cols-[48px_1fr_84px] items-center gap-2"><span className="text-xs text-zinc-400">{positions[player.seat]}</span><Input aria-label={`${positions[player.seat]} name`} className="h-11" value={player.name} onChange={(event) => apply((current) => updateSingleDrawPlayer(current, player.seat, { name: event.target.value }))} /><NumericInput aria-label={`${positions[player.seat]} stack`} className="h-11" value={player.stack} min={0.01} step="any" onCommit={(stack) => apply((current) => updateSingleDrawPlayer(current, player.seat, { stack }))} /></div>)}
        <Button variant="outline" className="h-12" onClick={onSwitchGame}>Hold’em / Omaha</Button>
      </div>
    </BottomSheet>
    <BottomSheet open={detailsOpen} onOpenChange={setDetailsOpen} title="Hand details" cancelLabel="Done">
      <fieldset disabled={saving} className="p-4 flex flex-col gap-4">
        <label className="text-xs text-zinc-400">Name<Input aria-label="Hand name" className="h-11 mt-1" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="text-xs text-zinc-400">Notes<textarea aria-label="Notes" className="w-full rounded-md border border-white/15 p-3 mt-1 text-sm" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        <label className="text-xs text-zinc-400">Venue<Input aria-label="Venue" className="h-11 mt-1" value={venue} onChange={(event) => setVenue(event.target.value)} /></label>
        <label className="text-xs text-zinc-400">Date<Input aria-label="Hand date" className="h-11 mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </fieldset>
    </BottomSheet>
    <BottomSheet open={logOpen} onOpenChange={setLogOpen} title="Hand log"><div className="p-4 flex flex-col gap-3 text-sm text-zinc-400">
      {state.actions.filter((action) => action.round === "predraw").map((action) => <p key={action.id}>Predraw · {positions[action.seat]} {action.action}{action.amount !== undefined ? ` $${action.amount}` : ""}</p>)}
      {state.draws.map((draw) => <p key={draw.seat} className="text-emerald-300">Draw · {positions[draw.seat]} {draw.count ? `draws ${draw.count}` : "stands pat"}</p>)}
      {state.actions.filter((action) => action.round === "postdraw").map((action) => <p key={action.id}>Postdraw · {positions[action.seat]} {action.action}{action.amount !== undefined ? ` $${action.amount}` : ""}</p>)}
    </div></BottomSheet>
  </div>;
}
