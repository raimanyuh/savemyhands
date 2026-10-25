"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { SingleDrawState } from "./single-draw-engine";
import type { changeSingleDrawSetup } from "./single-draw-ui";

export default function DrawFormatSettings({ state, onChange }: {
  state: SingleDrawState; onChange: (patch: Parameters<typeof changeSingleDrawSetup>[1]) => void;
}) {
  return <div className="flex flex-col gap-3">
    <label className="text-xs text-zinc-400">Format<select aria-label="Draw format" value={state.variant} onChange={(event) => onChange({ variant: event.target.value as SingleDrawState["variant"] })} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-zinc-900 px-2 text-zinc-100">
      <option value="2-7_SINGLE_DRAW">No-limit 2–7 Single Draw</option>
      <option value="2-7_TRIPLE_DRAW">Fixed-limit 2–7 Triple Draw</option>
    </select></label>
    {state.variant === "2-7_TRIPLE_DRAW" && <div className="rounded-lg border border-white/10 p-3 flex flex-col gap-3">
      <p className="text-xs text-emerald-200">${state.bb} bets before/after draw 1 · ${state.bb * 2} after draws 2 and 3</p>
      <label className="text-xs text-zinc-400">Bet cap per round<select aria-label="Bet cap" value={state.limitRules.maxBets} onChange={(event) => onChange({ limitRules: { ...state.limitRules, maxBets: Number(event.target.value) as 4 | 5 } })} className="mt-1 h-11 w-full rounded-md border border-white/15 bg-zinc-900 px-2 text-zinc-100"><option value={4}>4 bets (bet + 3 raises)</option><option value={5}>5 bets (bet + 4 raises)</option></select></label>
      <div className="flex items-center gap-3 text-xs text-zinc-300"><Checkbox ariaLabel="Uncapped when a round starts heads-up" checked={state.limitRules.headsUpUncapped} onChange={(headsUpUncapped) => onChange({ limitRules: { ...state.limitRules, headsUpUncapped } })} className="size-5" /><span>Uncapped when a round starts heads-up</span></div>
    </div>}
  </div>;
}
