"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
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
import type { SavedHand } from "./hand";

const SAMPLE_HANDS: SavedHand[] = [
  { id: "k4n2zx", name: "River bluff vs reg",        date: "Apr 24, 25", stakes: "1/2",  loc: "Lucky Chances", positions: "UTG vs BB",  board: ["K♠","7♥","2♣","Q♦","—"],  type: "SRP", tags: ["bluff","river"],   result: 148,    fav: false },
  { id: "q7p9aa", name: "QQ overplay",               date: "Apr 21, 25", stakes: "1/3",  loc: "Lucky Chances", positions: "CO vs BTN",  board: ["9♣","5♥","5♦","A♠","—"],  type: "3BP", tags: ["leak","review"],   result: -320,   fav: false },
  { id: "b2m1xy", name: "Aces hold",                 date: "Apr 20, 25", stakes: "2/5",  loc: "Bay 101",       positions: "BTN vs UTG", board: ["T♠","7♦","2♣","—","—"],   type: "4BP", tags: ["premium","win"],   result: 1250,   fav: true  },
  { id: "h6t3rs", name: "Suited connector flush",    date: "Apr 18, 25", stakes: "1/2",  loc: "Lucky Chances", positions: "BB vs UTG",  board: ["8♥","6♥","3♥","J♥","2♣"], type: "SRP", tags: ["draw","flush"],    result: 42,     fav: false },
  { id: "r9w2vc", name: "JJ vs ace-high",            date: "Apr 14, 25", stakes: "2/5",  loc: "Bay 101",       positions: "MP vs BB",   board: ["A♣","8♦","4♠","—","—"],   type: "SRP", tags: ["fold-equity"],     result: -200,   fav: false },
  { id: "a1c8bn", name: "Double-barrel BTN",         date: "Apr 10, 25", stakes: "1/3",  loc: "Hustler",       positions: "BTN vs SB",  board: ["T♥","9♣","3♠","5♦","—"],  type: "3BP", tags: ["barrel","win"],    result: 615,    fav: true  },
  { id: "c4d8mp", name: "Set over set",              date: "Apr 08, 25", stakes: "2/5",  loc: "Bay 101",       positions: "CO vs BB",   board: ["Q♣","Q♦","7♠","3♣","—"],  type: "SRP", tags: ["cooler","review"], result: -540,   fav: false },
];

const suitColor = (s: string) =>
  s === "♥"
    ? "oklch(0.65 0.20 22)"
    : s === "♦"
      ? "oklch(0.7 0.18 35)"
      : s === "♣"
        ? "oklch(0.7 0.16 145)"
        : s === "♠"
          ? "oklch(0.92 0.005 60)"
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

function FilterDropdown({ label }: { label: string }) {
  return (
    <button className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] font-medium border bg-transparent text-[oklch(0.85_0.005_60)] border-border hover:bg-muted transition-colors cursor-pointer">
      {label}
      <ChevronDown size={12} className="opacity-60" />
    </button>
  );
}

type SortKey = keyof Pick<
  SavedHand,
  "name" | "date" | "stakes" | "positions" | "tags" | "result"
> | "board";

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
  "grid-cols-[28px_28px_28px_minmax(160px,1.6fr)_92px_70px_110px_180px_minmax(140px,1.4fr)_90px]";

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
      <button
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-center text-[oklch(0.55_0.005_60)] hover:text-[oklch(0.85_0.005_60)] cursor-pointer"
        aria-label="Hand info"
      >
        <Info size={14} />
      </button>
      <EditableName value={hand.name} onChange={onRename} />
      <span className="text-[12px] text-muted-foreground tabular-nums">
        {hand.date}
      </span>
      <span className="text-[12px] text-zinc-300 tabular-nums">
        ${hand.stakes}
      </span>
      <span className="text-[12px] text-zinc-300 font-mono tracking-tight">
        {hand.positions}
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

  const sorted = useMemo(() => {
    const arr = hands.filter(
      (h) =>
        !search ||
        `${h.name} ${h.loc} ${h.positions} ${h.tags.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
    arr.sort((a, b) => {
      const k = sort.key;
      let va: unknown = (a as Record<string, unknown>)[k];
      let vb: unknown = (b as Record<string, unknown>)[k];
      if (k === "tags") {
        va = a.tags.join(" ");
        vb = b.tags.join(" ");
      }
      if (k === "board") {
        va = a.board.join("");
        vb = b.board.join("");
      }
      if (typeof va === "string" && typeof vb === "string") {
        return va.localeCompare(vb) * (sort.dir === "asc" ? 1 : -1);
      }
      return ((va as number) - (vb as number)) * (sort.dir === "asc" ? 1 : -1);
    });
    return arr;
  }, [hands, sort, search]);

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
            <FilterDropdown label="Positions" />
            <FilterDropdown label="Stakes" />
            <FilterDropdown label="Players" />
            <FilterDropdown label="Result" />
            <FilterDropdown label="Tags" />
            <span className="w-px h-6 bg-border mx-1" />
            <FilterDropdown label="Pot type" />
            <FilterDropdown label="Venue" />
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
            <div className="flex items-center justify-center text-muted-foreground">
              <Info size={12} />
            </div>
            <SortHeader label="Name" sortKey="name" sort={sort} setSort={setSort} />
            <SortHeader label="Date" sortKey="date" sort={sort} setSort={setSort} />
            <SortHeader label="Stakes" sortKey="stakes" sort={sort} setSort={setSort} />
            <SortHeader label="Positions" sortKey="positions" sort={sort} setSort={setSort} />
            <SortHeader label="Board" sortKey="board" sort={sort} setSort={setSort} />
            <SortHeader label="Tags" sortKey="tags" sort={sort} setSort={setSort} />
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
