import type { StudPotAward } from "./stud-engine";
import { formatStudAmount } from "./stud-ui";

/** Each amount is an awarded portion, so tied winners divide that amount. */
export default function StudAwards({ awards }: { awards?: StudPotAward[] }) {
  if (!awards?.length) return null;
  const pots = new Map<string, StudPotAward[]>();
  for (const award of awards) {
    const key = award.eligibleSeats.join(",");
    pots.set(key, [...(pots.get(key) ?? []), award]);
  }
  return <section aria-label="High and low payouts" className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-xs flex flex-col gap-3">
    <h3 className="text-sm font-semibold text-emerald-200">Payouts</h3>
    {[...pots.entries()].map(([key, portions], index) => <div key={key} className="flex flex-col gap-2">
      <p className="text-zinc-400">{pots.size === 1 ? "Pot" : index === 0 ? "Main pot" : `Side pot ${index}`} · ${formatStudAmount(portions.reduce((total, award) => total + award.amount, 0))}</p>
      {portions.map((award, i) => <div key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
        <span className="text-zinc-300">{award.portion === "high" ? "High" : award.portion === "low" ? "Low" : "Uncontested"} · ${formatStudAmount(award.amount)}</span>
        <span className="text-emerald-200 tabular-nums">{award.winners.map((seat) => `S${seat + 1} +$${formatStudAmount(award.amount / award.winners.length)}`).join(" · ")}</span>
      </div>)}
      {portions.some((award) => award.portion === "high") && !portions.some((award) => award.portion === "low") && <p className="text-zinc-500">Low: no qualifying hand</p>}
    </div>)}
  </section>;
}
