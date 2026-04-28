"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  LogOut,
  Plus,
  Search,
  Share2,
  Star,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header, Shell } from "@/components/Shell";
import { isMultiway, type SavedHand } from "./hand";

const SAMPLE_HANDS: SavedHand[] = [
  { id: "k4n2zx", name: "River bluff vs reg",        date: "Apr 24, 25", stakes: "1/2",  loc: "Lucky Chances", positions: "BTN", multiway: false, board: ["K♠","7♥","2♣","Q♦","—"],  type: "SRP", tags: ["bluff","river"],   result: 148,    fav: false },
  { id: "q7p9aa", name: "QQ overplay",               date: "Apr 21, 25", stakes: "1/3",  loc: "Lucky Chances", positions: "CO", multiway: false, board: ["9♣","5♥","5♦","A♠","—"],  type: "3BP", tags: ["leak","review"],   result: -320,   fav: false },
  { id: "b2m1xy", name: "Aces hold",                 date: "Apr 20, 25", stakes: "2/5",  loc: "Bay 101",       positions: "BTN", multiway: true,  board: ["T♠","7♦","2♣","—","—"],   type: "4BP", tags: ["premium","win"],   result: 1250,   fav: true  },
  { id: "h6t3rs", name: "Suited connector flush",    date: "Apr 18, 25", stakes: "1/2",  loc: "Lucky Chances", positions: "BB",  multiway: true,  board: ["8♥","6♥","3♥","J♥","2♣"], type: "SRP", tags: ["draw","flush"],    result: 42,     fav: false },
  { id: "r9w2vc", name: "JJ vs ace-high",            date: "Apr 14, 25", stakes: "2/5",  loc: "Bay 101",       positions: "MP",  multiway: false, board: ["A♣","8♦","4♠","—","—"],   type: "SRP", tags: ["fold-equity"],     result: -200,   fav: false },
  { id: "a1c8bn", name: "Double-barrel BTN",         date: "Apr 10, 25", stakes: "1/3",  loc: "Hustler",       positions: "BTN", multiway: false, board: ["T♥","9♣","3♠","5♦","—"],  type: "3BP", tags: ["barrel","win"],    result: 615,    fav: true  },
  { id: "c4d8mp", name: "Set over set",              date: "Apr 08, 25", stakes: "2/5",  loc: "Bay 101",       positions: "CO",  multiway: true,  board: ["Q♣","Q♦","7♠","3♣","—"],  type: "SRP", tags: ["cooler","review"], result: -540,   fav: false },
];

// Hero's position only — older saves stored "X vs Y", strip back to the hero side.
function heroPositionOf(h: SavedHand): string {
  const raw = (h.positions || "").trim();
  if (!raw) return "—";
  const i = raw.toLowerCase().indexOf(" vs ");
  return i >= 0 ? raw.slice(0, i).trim() : raw;
}

// Multiway flag — derived on the fly when the row predates the field.
function multiwayOf(h: SavedHand): boolean | null {
  if (typeof h.multiway === "boolean") return h.multiway;
  if (h._full?.actions && typeof h._full.playerCount === "number") {
    return isMultiway({
      playerCount: h._full.playerCount,
      actions: h._full.actions,
    });
  }
  return null;
}

// Four-color deck on the dashboard's dark background:
//   ♠ near-white (the "black" suit), ♣ green, ♦ blue, ♥ red.
const suitColor = (s: string) =>
  s === "♥"
    ? "oklch(0.7 0.20 22)"
    : s === "♦"
      ? "oklch(0.72 0.16 250)"
      : s === "♣"
        ? "oklch(0.7 0.17 145)"
        : s === "♠"
          ? "oklch(0.95 0.005 60)"
          : "transparent";

function MiniCard({ card }: { card: string }) {
  if (!card || card === "—") {
    return (
      <div
        style={{
          width: 22,
          height: 26,
          borderRadius: 4,
          border: "1px dashed oklch(0.95 0.04 60 / 12%)",
        }}
      />
    );
  }
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const color = suitColor(suit);
  return (
    <div
      style={{
        width: 22,
        height: 26,
        borderRadius: 4,
        background: color.replace(")", " / 0.18)"),
        color,
        border: `1px solid ${color.replace(")", " / 0.35)")}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {rank}
    </div>
  );
}

function TagChip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium border border-[oklch(0.95_0.04_60_/_0.14)] bg-[oklch(0.95_0.04_60_/_0.05)] text-[oklch(0.85_0.005_60)]">
      {children}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Remove tag"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

type FilterOption = { value: string; label: string };

function FilterPopover({
  anchor,
  options,
  selected,
  onChange,
  onClose,
}: {
  anchor: HTMLElement;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const rect = anchor.getBoundingClientRect();
  const W = 220;
  const top = rect.bottom + 6;
  let left = rect.left;
  left = Math.max(8, Math.min(window.innerWidth - W - 8, left));

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };
  const clearAll = () => onChange(new Set());

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[200] rounded-lg overflow-hidden flex flex-col"
      style={{
        left,
        top,
        width: W,
        background: "oklch(0.215 0.010 60)",
        border: "1px solid oklch(1 0 0 / 0.12)",
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      <div className="max-h-[260px] overflow-auto py-1">
        {options.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-muted-foreground italic">
            No options
          </div>
        ) : (
          options.map((opt) => {
            const checked = selected.has(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-zinc-200 cursor-pointer hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="w-3.5 h-3.5 rounded-sm accent-[oklch(0.696_0.205_155)] cursor-pointer"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            );
          })
        )}
      </div>
      {selected.size > 0 && (
        <button
          onClick={clearAll}
          className="text-left px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground border-t border-white/10 cursor-pointer"
        >
          Clear ({selected.size})
        </button>
      )}
    </div>,
    document.body,
  );
}

function FilterDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const count = selected.size;
  const active = !!anchor;
  return (
    <>
      <button
        onClick={(e) => setAnchor(e.currentTarget)}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] font-medium border transition-colors cursor-pointer ${
          count > 0 || active
            ? "bg-[oklch(0.285_0.012_60)] text-foreground border-[oklch(0.95_0.04_60_/_0.2)]"
            : "bg-transparent text-[oklch(0.85_0.005_60)] border-border hover:bg-muted"
        }`}
      >
        {label}
        {count > 0 && (
          <span className="text-[10px] font-semibold px-1 rounded bg-[oklch(0.696_0.205_155_/_0.2)] text-[oklch(0.795_0.184_155)] tabular-nums">
            {count}
          </span>
        )}
        <ChevronDown size={12} className="opacity-60" />
      </button>
      {anchor && (
        <FilterPopover
          anchor={anchor}
          options={options}
          selected={selected}
          onChange={onChange}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}

type SortKey = keyof Pick<
  SavedHand,
  "name" | "date" | "stakes" | "loc" | "result"
>;

function PlainHeader({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center h-9 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {label}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  setSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  setSort: (s: { key: SortKey; dir: "asc" | "desc" }) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const dir = active ? sort.dir : null;
  return (
    <button
      onClick={() =>
        setSort({
          key: sortKey,
          dir: active && dir === "asc" ? "desc" : "asc",
        })
      }
      className={`flex items-center gap-1 h-9 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors cursor-pointer ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      } ${align === "right" ? "justify-end" : ""}`}
    >
      {label}
      {active &&
        (dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </button>
  );
}

function EditableName({
  value,
  onChange,
}: {
  value: string;
  onChange: (n: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = () => {
    if (draft.trim()) onChange(draft.trim());
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="h-6 -my-px px-1.5 text-[13px] bg-background text-foreground rounded border border-ring outline-none ring-2 ring-ring/40 w-full max-w-[260px]"
      />
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      className="text-[13px] text-zinc-100 hover:text-foreground truncate max-w-[260px] text-left cursor-text"
    >
      {value}
    </button>
  );
}

const ROW_COLS =
  "grid-cols-[28px_28px_minmax(160px,1.6fr)_92px_minmax(120px,1fr)_70px_70px_80px_180px_minmax(140px,1.4fr)_90px]";

function HandListRow({
  hand,
  selected,
  onSelect,
  onToggleFav,
  onOpen,
  onRename,
  onAddTag,
  onRemoveTag,
}: {
  hand: SavedHand;
  selected: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
  onOpen: () => void;
  onRename: (name: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
}) {
  return (
    <div
      onClick={onOpen}
      className={`grid ${ROW_COLS} items-center gap-2 px-3 h-11 border-b border-[oklch(0.95_0.04_60_/_0.06)] cursor-pointer transition-colors ${
        selected
          ? "bg-[oklch(0.285_0.012_60_/_0.55)]"
          : "hover:bg-[oklch(0.95_0.04_60_/_0.04)]"
      }`}
    >
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="w-3.5 h-3.5 rounded-sm border border-[oklch(0.95_0.04_60_/_0.2)] bg-transparent accent-[oklch(0.696_0.205_155)] cursor-pointer"
        />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav();
        }}
        className="flex items-center justify-center text-[oklch(0.55_0.005_60)] hover:text-[oklch(0.85_0.15_85)] cursor-pointer"
        aria-label="Toggle favorite"
      >
        <Star
          size={14}
          fill={hand.fav ? "currentColor" : "none"}
          className={hand.fav ? "text-[oklch(0.85_0.15_85)]" : ""}
        />
      </button>
      <EditableName value={hand.name} onChange={onRename} />
      <span className="text-[12px] text-muted-foreground tabular-nums">
        {hand.date}
      </span>
      <span
        className={`text-[12px] truncate ${
          hand.loc && hand.loc !== "—"
            ? "text-zinc-300"
            : "text-muted-foreground italic"
        }`}
        title={hand.loc}
      >
        {hand.loc && hand.loc !== "—" ? hand.loc : "—"}
      </span>
      <span className="text-[12px] text-zinc-300 tabular-nums">
        ${hand.stakes}
      </span>
      <span className="text-[12px] text-zinc-300 font-mono tracking-tight">
        {heroPositionOf(hand)}
      </span>
      <span
        className={`text-[12px] tabular-nums ${
          multiwayOf(hand) === null
            ? "text-muted-foreground italic"
            : multiwayOf(hand)
              ? "text-[oklch(0.795_0.184_155)]"
              : "text-zinc-400"
        }`}
      >
        {multiwayOf(hand) === null
          ? "—"
          : multiwayOf(hand)
            ? "Yes"
            : "No"}
      </span>
      <div className="flex items-center gap-0.5">
        {hand.board.map((c, i) => (
          <MiniCard key={i} card={c} />
        ))}
      </div>
      <div
        className="flex items-center gap-1 flex-wrap min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {hand.tags.length === 0 ? (
          <button
            onClick={onAddTag}
            className="text-[12px] text-[oklch(0.55_0.005_60)] hover:text-[oklch(0.85_0.005_60)] italic cursor-pointer"
          >
            Assign tags
          </button>
        ) : (
          <>
            {hand.tags.map((t) => (
              <TagChip key={t} onRemove={() => onRemoveTag(t)}>
                {t}
              </TagChip>
            ))}
            <button
              onClick={onAddTag}
              className="w-5 h-5 inline-flex items-center justify-center rounded text-[oklch(0.55_0.005_60)] hover:text-[oklch(0.85_0.005_60)] hover:bg-[oklch(0.95_0.04_60_/_0.06)] cursor-pointer"
              aria-label="Add tag"
            >
              <Plus size={11} />
            </button>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 pr-1">
        <span
          className={`text-[13px] font-semibold tabular-nums ${
            hand.result > 0
              ? "text-[oklch(0.795_0.184_155)]"
              : hand.result < 0
                ? "text-[oklch(0.704_0.191_22.216)]"
                : "text-muted-foreground"
          }`}
        >
          {hand.result > 0 ? "+" : hand.result < 0 ? "−" : ""}$
          {Math.abs(hand.result).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default function Dashboard({
  user,
  signOutAction,
}: {
  user: string;
  signOutAction?: () => void | Promise<void>;
}) {
  const router = useRouter();

  // Pull saved hands from localStorage on mount; merge with samples for first-run vibes.
  // Lazy initializer reads localStorage once on the client; SSR sees only the samples.
  const [hands, setHands] = useState<SavedHand[]>(() => {
    if (typeof window === "undefined") return SAMPLE_HANDS;
    try {
      const saved = JSON.parse(
        localStorage.getItem("smh:hands") || "[]",
      ) as SavedHand[];
      return [...saved, ...SAMPLE_HANDS];
    } catch {
      return SAMPLE_HANDS;
    }
  });

  // Persist updates back to localStorage (only the user's own hands — sample IDs aren't persisted).
  const persistUserHands = (next: SavedHand[]) => {
    const sampleIds = new Set(SAMPLE_HANDS.map((h) => h.id));
    const userHands = next.filter((h) => !sampleIds.has(h.id));
    localStorage.setItem("smh:hands", JSON.stringify(userHands));
  };

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });
  const [search, setSearch] = useState("");

  // Filter state — each filter holds the set of selected values; intersected with AND across.
  const [potTypeFilter, setPotTypeFilter] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [venueFilter, setVenueFilter] = useState<Set<string>>(new Set());
  const [stakesFilter, setStakesFilter] = useState<Set<string>>(new Set());
  const [playersFilter, setPlayersFilter] = useState<Set<string>>(new Set());
  const [resultFilter, setResultFilter] = useState<Set<string>>(new Set());
  const [positionsFilter, setPositionsFilter] = useState<Set<string>>(new Set());
  const [multiwayFilter, setMultiwayFilter] = useState<Set<string>>(new Set());

  // Distinct values discovered from the dataset, used to populate dropdowns.
  const filterOptions = useMemo(() => {
    const venues = new Set<string>();
    const stakes = new Set<string>();
    const tags = new Set<string>();
    const players = new Set<string>();
    const positions = new Set<string>();
    for (const h of hands) {
      if (h.loc && h.loc !== "—") venues.add(h.loc);
      if (h.stakes) stakes.add(h.stakes);
      h.tags.forEach((t) => tags.add(t));
      const pc = h._full?.playerCount;
      if (typeof pc === "number") players.add(String(pc));
      const hp = heroPositionOf(h);
      if (hp && hp !== "—") positions.add(hp);
    }
    const toOpts = (s: Set<string>) =>
      [...s].sort().map((v) => ({ value: v, label: v }));
    return {
      potType: [
        { value: "SRP", label: "SRP — single raised" },
        { value: "3BP", label: "3BP — 3-bet pot" },
        { value: "4BP", label: "4BP — 4-bet pot" },
      ],
      tags: toOpts(tags),
      venue: toOpts(venues),
      stakes: toOpts(stakes),
      players: [...players]
        .sort((a, b) => Number(a) - Number(b))
        .map((v) => ({ value: v, label: `${v}-handed` })),
      result: [
        { value: "win", label: "Wins" },
        { value: "loss", label: "Losses" },
        { value: "breakeven", label: "Break-even" },
      ],
      positions: toOpts(positions),
      multiway: [
        { value: "yes", label: "Multiway" },
        { value: "no", label: "Heads-up" },
      ],
    };
  }, [hands]);

  const filtered = useMemo(() => {
    return hands.filter((h) => {
      if (potTypeFilter.size && !potTypeFilter.has(h.type)) return false;
      if (tagFilter.size && !h.tags.some((t) => tagFilter.has(t))) return false;
      if (venueFilter.size && !venueFilter.has(h.loc)) return false;
      if (stakesFilter.size && !stakesFilter.has(h.stakes)) return false;
      if (playersFilter.size) {
        const pc = String(h._full?.playerCount ?? "");
        if (!pc || !playersFilter.has(pc)) return false;
      }
      if (resultFilter.size) {
        const bucket =
          h.result > 0 ? "win" : h.result < 0 ? "loss" : "breakeven";
        if (!resultFilter.has(bucket)) return false;
      }
      if (
        positionsFilter.size &&
        !positionsFilter.has(heroPositionOf(h))
      )
        return false;
      if (multiwayFilter.size) {
        const m = multiwayOf(h);
        if (m === null) return false;
        const tag = m ? "yes" : "no";
        if (!multiwayFilter.has(tag)) return false;
      }
      if (
        search &&
        !`${h.name} ${h.loc} ${h.positions} ${h.tags.join(" ")} ${h.notes ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [
    hands,
    potTypeFilter,
    tagFilter,
    venueFilter,
    stakesFilter,
    playersFilter,
    resultFilter,
    positionsFilter,
    multiwayFilter,
    search,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const k = sort.key;
      const va: unknown = (a as Record<string, unknown>)[k];
      const vb: unknown = (b as Record<string, unknown>)[k];
      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * (sort.dir === "asc" ? 1 : -1);
      }
      return ((va as number) - (vb as number)) * (sort.dir === "asc" ? 1 : -1);
    });
    return arr;
  }, [filtered, sort]);


  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = selected.size === sorted.length && sorted.length > 0;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(sorted.map((h) => h.id)));

  const update = (id: string, patch: Partial<SavedHand>) =>
    setHands((hs) => {
      const next = hs.map((h) => (h.id === id ? { ...h, ...patch } : h));
      persistUserHands(next);
      return next;
    });
  const totalResult = hands.reduce((s, h) => s + h.result, 0);

  return (
    <Shell
      header={
        <Header
          title="Hands"
          right={
            <>
              <span className="text-sm text-muted-foreground">{user}</span>
              {signOutAction && (
                <form action={signOutAction}>
                  <Button type="submit" variant="outline" size="sm">
                    <LogOut /> Sign out
                  </Button>
                </form>
              )}
            </>
          }
        />
      }
    >
      <div className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto px-6 py-6 gap-4">
        {/* Top bar */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">Hand library</h2>
            <p className="text-sm text-muted-foreground tabular-nums">
              {hands.length} hands · net{" "}
              <span
                className={
                  totalResult >= 0
                    ? "text-[oklch(0.795_0.184_155)]"
                    : "text-[oklch(0.704_0.191_22.216)]"
                }
              >
                {totalResult >= 0 ? "+" : "−"}$
                {Math.abs(totalResult).toLocaleString()}
              </span>
            </p>
          </div>
          <Button
            onClick={() => router.push("/record")}
            size="lg"
            style={{
              background: "oklch(0.696 0.205 155)",
              color: "oklch(0.145 0.008 60)",
              fontWeight: 600,
            }}
            className="hover:!bg-[oklch(0.745_0.198_155)]"
          >
            <Plus /> Record hand
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <FilterDropdown
              label="Positions"
              options={filterOptions.positions}
              selected={positionsFilter}
              onChange={setPositionsFilter}
            />
            <FilterDropdown
              label="Stakes"
              options={filterOptions.stakes}
              selected={stakesFilter}
              onChange={setStakesFilter}
            />
            <FilterDropdown
              label="Players"
              options={filterOptions.players}
              selected={playersFilter}
              onChange={setPlayersFilter}
            />
            <FilterDropdown
              label="Multiway"
              options={filterOptions.multiway}
              selected={multiwayFilter}
              onChange={setMultiwayFilter}
            />
            <FilterDropdown
              label="Result"
              options={filterOptions.result}
              selected={resultFilter}
              onChange={setResultFilter}
            />
            <FilterDropdown
              label="Tags"
              options={filterOptions.tags}
              selected={tagFilter}
              onChange={setTagFilter}
            />
            <span className="w-px h-6 bg-border mx-1" />
            <FilterDropdown
              label="Pot type"
              options={filterOptions.potType}
              selected={potTypeFilter}
              onChange={setPotTypeFilter}
            />
            <FilterDropdown
              label="Venue"
              options={filterOptions.venue}
              selected={venueFilter}
              onChange={setVenueFilter}
            />
          </div>
          <div className="relative">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search size={13} />
            </div>
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-[13px] w-56"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
          {/* Header row */}
          <div
            className={`grid ${ROW_COLS} items-center gap-2 px-3 h-9 border-b border-border bg-[oklch(0.245_0.011_60)]`}
          >
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="w-3.5 h-3.5 rounded-sm border border-[oklch(0.95_0.04_60_/_0.25)] bg-transparent accent-[oklch(0.696_0.205_155)] cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-center text-muted-foreground">
              <Star size={12} />
            </div>
            <SortHeader label="Name" sortKey="name" sort={sort} setSort={setSort} />
            <SortHeader label="Date" sortKey="date" sort={sort} setSort={setSort} />
            <SortHeader label="Venue" sortKey="loc" sort={sort} setSort={setSort} />
            <SortHeader label="Stakes" sortKey="stakes" sort={sort} setSort={setSort} />
            <PlainHeader label="Position" />
            <PlainHeader label="Multiway" />
            <PlainHeader label="Board" />
            <PlainHeader label="Tags" />
            <SortHeader
              label="Result"
              sortKey="result"
              sort={sort}
              setSort={setSort}
              align="right"
            />
          </div>

          {/* Rows */}
          {sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground py-16 text-center">
              No hands match.
            </div>
          ) : (
            sorted.map((h) => (
              <HandListRow
                key={h.id}
                hand={h}
                selected={selected.has(h.id)}
                onSelect={() => toggleSel(h.id)}
                onToggleFav={() => update(h.id, { fav: !h.fav })}
                onRename={(name) => update(h.id, { name })}
                onAddTag={() => {
                  const t = window.prompt("Add tag");
                  if (t && t.trim())
                    update(h.id, { tags: [...h.tags, t.trim()] });
                }}
                onRemoveTag={(t) =>
                  update(h.id, { tags: h.tags.filter((x) => x !== t) })
                }
                onOpen={() => router.push(`/hand/${h.id}`)}
              />
            ))
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-3 h-9 border-t border-border bg-[oklch(0.245_0.011_60)] text-[12px] text-muted-foreground tabular-nums">
            <span>
              {selected.size > 0
                ? `${selected.size} selected`
                : `${sorted.length} hands`}
            </span>
            <span>
              Showing 1–{sorted.length} of {hands.length}
            </span>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card shadow-2xl">
            <span className="text-[13px] font-medium px-2">
              {selected.size} selected
            </span>
            <span className="w-px h-5 bg-border" />
            <Button variant="outline" size="sm">
              <Tag /> Tag
            </Button>
            <Button variant="outline" size="sm">
              <Share2 /> Share
            </Button>
            <Button variant="outline" size="sm">
              <Copy /> Duplicate
            </Button>
            <Button variant="destructive" size="sm">
              <X /> Delete
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-1 px-2 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
