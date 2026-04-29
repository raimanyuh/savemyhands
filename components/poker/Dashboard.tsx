"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteHandAction,
  deleteHandsAction,
  updateHandDetailsAction,
} from "@/lib/hands/actions";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings as SettingsIcon,
  Share2,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Header, Shell } from "@/components/Shell";
import { UsernamePicker } from "@/components/auth/UsernamePicker";
import { isMultiway, potTypeOf, type SavedHand } from "./hand";
import { generateSampleHands } from "./sample-hands-gen";

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
          ? "oklch(0.95 0 0)"
          : "transparent";

function MiniCard({ card }: { card: string }) {
  if (!card || card === "—") {
    return (
      <div
        style={{
          width: 22,
          height: 26,
          borderRadius: 4,
          border: "1px dashed oklch(1 0 0 / 8%)",
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
    <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium border border-[oklch(1_0_0_/_0.10)] bg-[oklch(1_0_0_/_0.04)] text-[oklch(0.85_0_0)]">
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
        background: "oklch(0.215 0 0)",
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
            ? "bg-[oklch(0.285_0_0)] text-foreground border-[oklch(1_0_0_/_0.14)]"
            : "bg-transparent text-[oklch(0.85_0_0)] border-border hover:bg-muted"
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
      className={`flex items-center h-9 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground ${
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
      className={`flex items-center gap-1 h-9 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors cursor-pointer ${
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
  "grid-cols-[28px_28px_minmax(160px,1.6fr)_88px_minmax(120px,1fr)_60px_64px_68px_80px_170px_minmax(140px,1.4fr)_90px_32px]";

function EditDetailsModal({
  hand,
  onSave,
  onClose,
}: {
  hand: SavedHand;
  onSave: (patch: Partial<SavedHand>) => void;
  onClose: () => void;
}) {
  // Seed date from the ISO _full.date if we have it; the top-level h.date is
  // a localized display string ("Apr 24, 25") that's lossy to round-trip.
  const initialIso =
    hand._full?.date ?? new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(hand.name);
  const [venue, setVenue] = useState(
    hand.loc && hand.loc !== "—" ? hand.loc : "",
  );
  const [date, setDate] = useState(initialIso);
  const [notes, setNotes] = useState(hand.notes ?? hand._full?.notes ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const commit = () => {
    const trimmedName = name.trim() || hand.name;
    const trimmedVenue = venue.trim();
    const trimmedNotes = notes.trim();

    // Recompute the display date string the same way the recorder does so
    // the dashboard column stays consistent.
    const [yy, mm, dd] = date.split("-").map(Number);
    const displayDate = Number.isFinite(yy)
      ? new Date(yy, (mm || 1) - 1, dd || 1).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "2-digit",
        })
      : hand.date;

    const patch: Partial<SavedHand> = {
      name: trimmedName,
      loc: trimmedVenue || "—",
      notes: trimmedNotes || undefined,
      date: displayDate,
    };
    if (hand._full) {
      patch._full = {
        ...hand._full,
        notes: trimmedNotes || undefined,
        venue: trimmedVenue || undefined,
        date,
      };
    }
    onSave(patch);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-xl border border-white/10 flex flex-col"
        style={{
          background: "oklch(0.205 0 0)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold tracking-tight">
            Edit details
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Hand name
            </span>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-col gap-1.5 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Venue
              </span>
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="—"
                className="h-9 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5 w-44">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Date
              </span>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-sm"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Articulate your read, decision points, anything you want the viewer to know."
              className="flex w-full min-h-[120px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 resize-y"
            />
          </label>
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={commit}
            style={{
              background: "oklch(0.696 0.205 155)",
              color: "oklch(0.145 0 0)",
              fontWeight: 600,
            }}
            className="hover:!bg-[oklch(0.745_0.198_155)]"
          >
            Save
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RowActionsMenu({
  onEditDetails,
  onDelete,
}: {
  onEditDetails: () => void;
  onDelete: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAnchor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAnchor(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  const close = () => setAnchor(null);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  let menuLeft = 0;
  let menuTop = 0;
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    const W = 180;
    menuLeft = Math.max(8, Math.min(window.innerWidth - W - 8, rect.right - W));
    menuTop = rect.bottom + 6;
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(anchor ? null : (e.currentTarget as HTMLElement));
        }}
        className="w-7 h-7 inline-flex items-center justify-center rounded text-[oklch(0.55_0_0)] hover:text-foreground hover:bg-[oklch(1_0_0_/_0.05)] cursor-pointer"
        aria-label="Hand actions"
      >
        <MoreHorizontal size={14} />
      </button>
      {anchor &&
        createPortal(
          <div
            ref={ref}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-[200] rounded-lg overflow-hidden flex flex-col py-1"
            style={{
              left: menuLeft,
              top: menuTop,
              width: 180,
              background: "oklch(0.215 0 0)",
              border: "1px solid oklch(1 0 0 / 0.12)",
              boxShadow:
                "0 24px 60px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.5)",
            }}
          >
            <button
              onClick={run(onEditDetails)}
              className="flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-200 hover:bg-white/5 cursor-pointer text-left"
            >
              <Pencil size={13} className="opacity-70" /> Edit details
            </button>
            <div className="my-1 border-t border-white/10" />
            <button
              onClick={run(onDelete)}
              className="flex items-center gap-2 px-3 py-2 text-[13px] text-[oklch(0.78_0.16_22)] hover:bg-[oklch(0.704_0.191_22.216_/_0.12)] cursor-pointer text-left"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function HandListRow({
  hand,
  selected,
  onSelect,
  onToggleFav,
  onOpen,
  onRename,
  onAddTag,
  onRemoveTag,
  isSample,
  onEditDetails,
  onDelete,
}: {
  hand: SavedHand;
  selected: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
  onOpen: () => void;
  onRename: (name: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  isSample: boolean;
  onEditDetails: () => void;
  onDelete: () => void;
}) {
  // Color class for the result amount, used in both desktop row + mobile card.
  const resultColor =
    hand.result > 0
      ? "text-[oklch(0.795_0.184_155)]"
      : hand.result < 0
        ? "text-[oklch(0.704_0.191_22.216)]"
        : "text-muted-foreground";
  const resultText = `${
    hand.result > 0 ? "+" : hand.result < 0 ? "−" : ""
  }$${Math.abs(hand.result).toLocaleString()}`;

  return (
    <div
      onClick={onOpen}
      className={`border-b border-[oklch(1_0_0_/_0.05)] cursor-pointer transition-colors ${
        selected
          ? "bg-[oklch(0.285_0_0_/_0.55)]"
          : "hover:bg-[oklch(1_0_0_/_0.03)]"
      }`}
    >
      {/* Desktop: 13-column grid. Hidden under md (768px). */}
      <div
        className={`hidden md:grid ${ROW_COLS} items-center gap-2 px-3 h-11`}
      >
        <div
          className="flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onChange={() => onSelect()}
            ariaLabel="Select row"
          />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          className="flex items-center justify-center text-[oklch(0.55_0_0)] hover:text-[oklch(0.85_0.15_85)] cursor-pointer"
          aria-label="Toggle favorite"
        >
          <Star
            size={14}
            fill={hand.fav ? "currentColor" : "none"}
            className={hand.fav ? "text-[oklch(0.85_0.15_85)]" : ""}
          />
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          <EditableName value={hand.name} onChange={onRename} />
          {isSample && (
            <span
              className="inline-flex items-center h-4 px-1 rounded text-[9px] font-semibold uppercase tracking-[0.16em] shrink-0"
              style={{
                background: "oklch(1 0 0 / 0.04)",
                border: "1px solid oklch(1 0 0 / 0.10)",
                color: "oklch(0.65 0 0)",
              }}
              title="This is a built-in demo hand. Record one to see it replaced by your own."
            >
              sample
            </span>
          )}
        </div>
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
          {multiwayOf(hand) === null ? "—" : multiwayOf(hand) ? "Yes" : "No"}
        </span>
        <span className="text-[12px] text-zinc-300 font-mono tracking-tight">
          {potTypeOf(hand)}
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
              className="text-[12px] text-[oklch(0.55_0_0)] hover:text-[oklch(0.85_0_0)] italic cursor-pointer"
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
                className="w-5 h-5 inline-flex items-center justify-center rounded text-[oklch(0.55_0_0)] hover:text-[oklch(0.85_0_0)] hover:bg-[oklch(1_0_0_/_0.05)] cursor-pointer"
                aria-label="Add tag"
              >
                <Plus size={11} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <span
            className={`text-[13px] font-semibold tabular-nums ${resultColor}`}
          >
            {resultText}
          </span>
        </div>
        <div
          className="flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {!isSample && (
            <RowActionsMenu onEditDetails={onEditDetails} onDelete={onDelete} />
          )}
        </div>
      </div>

      {/* Mobile: card layout. The 13-column grid is unreadable below ~768px,
          so each hand renders as a stacked card with the same data slimmed
          down. The whole card is the click target; inner controls
          stopPropagation. Visible only under md. */}
      <div className="md:hidden flex flex-col gap-2 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav();
            }}
            className="flex items-center justify-center mt-0.5 text-[oklch(0.55_0_0)] hover:text-[oklch(0.85_0.15_85)] cursor-pointer shrink-0"
            aria-label="Toggle favorite"
          >
            <Star
              size={16}
              fill={hand.fav ? "currentColor" : "none"}
              className={hand.fav ? "text-[oklch(0.85_0.15_85)]" : ""}
            />
          </button>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <EditableName value={hand.name} onChange={onRename} />
            {isSample && (
              <span
                className="inline-flex items-center h-4 px-1 rounded text-[9px] font-semibold uppercase tracking-[0.16em] shrink-0"
                style={{
                  background: "oklch(1 0 0 / 0.04)",
                  border: "1px solid oklch(1 0 0 / 0.10)",
                  color: "oklch(0.65 0 0)",
                }}
              >
                sample
              </span>
            )}
          </div>
          <div
            className={`text-[14px] font-semibold tabular-nums shrink-0 ${resultColor}`}
          >
            {resultText}
          </div>
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onChange={() => onSelect()}
              ariaLabel="Select row"
            />
            {!isSample && (
              <RowActionsMenu
                onEditDetails={onEditDetails}
                onDelete={onDelete}
              />
            )}
          </div>
        </div>

        {/* Meta row: date · venue · stakes · position · pot type · multiway */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
          <span className="tabular-nums">{hand.date}</span>
          {hand.loc && hand.loc !== "—" && (
            <>
              <span className="opacity-50">·</span>
              <span className="text-zinc-300 truncate max-w-[140px]" title={hand.loc}>
                {hand.loc}
              </span>
            </>
          )}
          <span className="opacity-50">·</span>
          <span className="tabular-nums text-zinc-300">${hand.stakes}</span>
          {heroPositionOf(hand) !== "—" && (
            <>
              <span className="opacity-50">·</span>
              <span className="font-mono text-zinc-300">{heroPositionOf(hand)}</span>
            </>
          )}
          <span className="opacity-50">·</span>
          <span className="font-mono text-zinc-300">{potTypeOf(hand)}</span>
          {multiwayOf(hand) === true && (
            <>
              <span className="opacity-50">·</span>
              <span className="text-[oklch(0.795_0.184_155)]">multiway</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {hand.board.map((c, i) => (
            <MiniCard key={i} card={c} />
          ))}
        </div>

        {/* Tags below — only render if there are any (hides "Assign tags"
            placeholder on mobile to keep the card uncluttered). */}
        {hand.tags.length > 0 && (
          <div
            className="flex items-center gap-1 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            {hand.tags.map((t) => (
              <TagChip key={t} onRemove={() => onRemoveTag(t)}>
                {t}
              </TagChip>
            ))}
            <button
              onClick={onAddTag}
              className="w-5 h-5 inline-flex items-center justify-center rounded text-[oklch(0.55_0_0)] hover:text-[oklch(0.85_0_0)] hover:bg-[oklch(1_0_0_/_0.05)] cursor-pointer"
              aria-label="Add tag"
            >
              <Plus size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({
  initialUsername,
  signOutAction,
  initialHands,
  showSamples,
  demoCount = 0,
}: {
  // The signed-in user's @username, or null if they haven't picked one yet.
  // Replaces the old `user: string` (email) prop — emails are private; the
  // username is the public identity surfaced on shared hand pages.
  initialUsername: string | null;
  signOutAction?: () => void | Promise<void>;
  // Hands fetched on the server for the signed-in user.
  initialHands: SavedHand[];
  // True when the user has no hands of their own; renders SAMPLE_HANDS as a
  // first-run demo. Hidden once they have any saved hand.
  showSamples: boolean;
  // When > 0 (driven by `?demo=N` on the page), inject N synthetic rows so
  // we can preview the dashboard with a populated library. Demo rows are
  // marked as samples (non-mutable, non-clickable through to replayer).
  demoCount?: number;
}) {
  const router = useRouter();

  // Local mirror of the server-fetched hands. Optimistic updates land here
  // immediately; server actions persist + revalidate behind the scenes.
  // Demo mode (?demo=N) appends N generated rows so we can preview the
  // dashboard with a populated library; demo rows behave like samples.
  const [hands, setHands] = useState<SavedHand[]>(() => {
    const demo = demoCount > 0 ? generateSampleHands(demoCount) : [];
    if (showSamples) return [...initialHands, ...SAMPLE_HANDS, ...demo];
    return [...initialHands, ...demo];
  });
  const [, startMutation] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<SavedHand | null>(null);
  // Pagination — render at most PAGE_SIZE rows at a time so dashboards with
  // hundreds of hands stay snappy on slower hardware. Filtering / sorting /
  // searching still operate on the full list (cheap in JS); only the DOM
  // render is paginated. We don't auto-reset to page 1 on filter changes —
  // `safePage` clamps below — so users keep their place when toggling
  // filters; if a filter shrinks the result set below the current page,
  // they're snapped back to a valid page on next render.
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;
  // Local mirror of the username so the header reflects the picker's save
  // immediately, before the next navigation revalidates.
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [usernameOpen, setUsernameOpen] = useState(false);
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
  // Starred is binary, so it's a plain boolean rather than a Set like the others.
  const [starredOnly, setStarredOnly] = useState(false);

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
        { value: "LP", label: "LP — limped pot" },
        { value: "SRP", label: "SRP — single raised" },
        { value: "3BP", label: "3BP — 3-bet pot" },
        { value: "4BP", label: "4BP — 4-bet pot" },
        { value: "5BP", label: "5BP — 5-bet pot" },
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
      if (starredOnly && !h.fav) return false;
      if (potTypeFilter.size && !potTypeFilter.has(potTypeOf(h))) return false;
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
    starredOnly,
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

  // Paginate the sorted set. `safePage` clamps so a stale `currentPage`
  // (e.g., the user was on page 5, then filtered to 2 pages of results)
  // collapses to the last valid page rather than rendering an empty list.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedHands = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // "Select all" semantics scoped to the current page — selecting/deselecting
  // touches only the visible rows. Bulk delete then operates on `selected`,
  // which can span pages if the user navigates and selects more.
  const allSelected =
    paginatedHands.length > 0 &&
    paginatedHands.every((h) => selected.has(h.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) {
        // Deselect just the visible page so cross-page selections survive.
        for (const h of paginatedHands) n.delete(h.id);
      } else {
        for (const h of paginatedHands) n.add(h.id);
      }
      return n;
    });

  // Sample IDs aren't backed by Postgres — mutations on them stay local-only
  // (they live in this component's state, but no server action fires).
  // Demo rows (id starting with "demo-") are treated identically.
  const sampleIds = useMemo(() => {
    const ids = new Set<string>(SAMPLE_HANDS.map((h) => h.id));
    for (const h of hands) if (h.id.startsWith("demo-")) ids.add(h.id);
    return ids;
  }, [hands]);

  // Optimistic-update helper. Updates the local mirror immediately; for
  // non-sample rows it also persists via a server action and reverts on
  // failure. Patch is restricted to the set of fields the dashboard ever
  // edits — name / venue / notes / date / tags / fav / _full.
  type DashboardPatch = Partial<
    Pick<
      SavedHand,
      "name" | "loc" | "notes" | "date" | "tags" | "fav" | "_full"
    >
  >;
  const update = (id: string, patch: DashboardPatch) => {
    let prev: SavedHand | undefined;
    setHands((hs) => {
      prev = hs.find((h) => h.id === id);
      return hs.map((h) => (h.id === id ? { ...h, ...patch } : h));
    });
    if (sampleIds.has(id)) return;
    startMutation(async () => {
      try {
        await updateHandDetailsAction(id, patch);
      } catch (e) {
        console.error("Failed to update hand", e);
        if (prev) {
          const restore = prev;
          setHands((hs) => hs.map((h) => (h.id === id ? restore : h)));
        }
        window.alert("Couldn't save those changes — try again.");
      }
    });
  };

  const deleteHand = (h: SavedHand) => {
    if (!window.confirm(`Delete "${h.name}"? This can't be undone.`)) return;
    setHands((hs) => hs.filter((x) => x.id !== h.id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(h.id);
      return n;
    });
    if (sampleIds.has(h.id)) return;
    startMutation(async () => {
      try {
        await deleteHandAction(h.id);
      } catch (e) {
        console.error("Failed to delete hand", e);
        window.alert("Couldn't delete that hand — refresh and try again.");
        router.refresh();
      }
    });
  };

  const deleteSelected = () => {
    const targets = [...selected];
    if (targets.length === 0) return;
    if (
      !window.confirm(
        `Delete ${targets.length} hand${targets.length === 1 ? "" : "s"}? This can't be undone.`,
      )
    )
      return;
    const targetSet = new Set(targets);
    setHands((hs) => hs.filter((h) => !targetSet.has(h.id)));
    setSelected(new Set());
    const persistable = targets.filter((id) => !sampleIds.has(id));
    if (persistable.length === 0) return;
    startMutation(async () => {
      try {
        await deleteHandsAction(persistable);
      } catch (e) {
        console.error("Failed to delete hands", e);
        window.alert(
          "Some hands couldn't be deleted — refresh to see the current state.",
        );
        router.refresh();
      }
    });
  };

  const totalResult = hands.reduce((s, h) => s + h.result, 0);

  return (
    <Shell
      header={
        <Header
          title="Hands"
          right={
            <>
              {username ? (
                <button
                  onClick={() => setUsernameOpen(true)}
                  className="text-sm text-muted-foreground hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Change username"
                >
                  @{username}
                </button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsernameOpen(true)}
                >
                  Set username
                </Button>
              )}
              <Button asChild variant="outline" size="sm">
                <Link href="/settings" title="Account settings">
                  <SettingsIcon />{" "}
                  <span className="hidden sm:inline">Settings</span>
                </Link>
              </Button>
              {signOutAction && (
                <form action={signOutAction}>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    title="Sign out"
                  >
                    <LogOut />{" "}
                    <span className="hidden sm:inline">Sign out</span>
                  </Button>
                </form>
              )}
            </>
          }
        />
      }
    >
      <div className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 gap-4">
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
              color: "oklch(0.145 0 0)",
              fontWeight: 600,
            }}
            className="hover:!bg-[oklch(0.745_0.198_155)]"
          >
            <Plus /> Record hand
          </Button>
        </div>

        {/* Soft username prompt — only renders for accounts that haven't picked
            a username yet. Disappears the moment they do; no manual dismiss
            because the banner is self-clearing once the action is taken. */}
        {!username && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: "oklch(0.696 0.205 155 / 0.35)",
              background: "oklch(0.696 0.205 155 / 0.06)",
            }}
          >
            <div className="text-sm">
              <span className="font-medium">Pick a username</span>
              <span className="text-muted-foreground">
                {" "}
                — others will see this in place of your email when you share
                hands.
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setUsernameOpen(true)}
              style={{
                background: "oklch(0.696 0.205 155)",
                color: "oklch(0.145 0 0)",
                fontWeight: 600,
              }}
              className="hover:!bg-[oklch(0.745_0.198_155)] shrink-0"
            >
              Set username
            </Button>
          </div>
        )}

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Starred toggle — binary, so it's a single button rather than a popover. */}
            <button
              type="button"
              onClick={() => setStarredOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] font-medium border transition-colors cursor-pointer ${
                starredOnly
                  ? "bg-[oklch(0.85_0.15_85_/_0.12)] text-[oklch(0.85_0.15_85)] border-[oklch(0.85_0.15_85_/_0.4)]"
                  : "bg-transparent text-[oklch(0.85_0_0)] border-border hover:bg-muted"
              }`}
              aria-pressed={starredOnly}
              title={starredOnly ? "Showing starred only" : "Show starred only"}
            >
              <Star
                size={13}
                fill={starredOnly ? "currentColor" : "none"}
              />
              Starred
            </button>
            <span className="w-px h-6 bg-border mx-1" />
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
          <div className="relative w-full sm:w-auto">
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search size={13} />
            </div>
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 sm:h-8 text-[13px] w-full sm:w-56"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
          {/* Header row — hidden on mobile because rows render as cards. */}
          <div
            className={`hidden md:grid ${ROW_COLS} items-center gap-2 px-3 h-9 border-b border-border bg-[oklch(0.245_0_0)]`}
          >
            <div className="flex items-center justify-center">
              <Checkbox
                checked={allSelected}
                onChange={() => toggleAll()}
                ariaLabel="Select all rows"
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
            <PlainHeader label="Pot type" />
            <PlainHeader label="Board" />
            <PlainHeader label="Tags" />
            <SortHeader
              label="Result"
              sortKey="result"
              sort={sort}
              setSort={setSort}
              align="right"
            />
            <div />
          </div>

          {/* Rows */}
          {sorted.length === 0 ? (
            <div className="text-sm text-muted-foreground py-16 text-center">
              No hands match.
            </div>
          ) : (
            paginatedHands.map((h) => (
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
                isSample={sampleIds.has(h.id)}
                onEditDetails={() => setEditing(h)}
                onDelete={() => deleteHand(h)}
              />
            ))
          )}

          {/* Footer — pagination + count summary. Hidden when there's no
              data; otherwise shows what's visible vs. total. The Prev/Next
              cluster collapses to just the count when everything fits on a
              single page. */}
          {sorted.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 sm:h-10 border-t border-border bg-[oklch(0.245_0_0)] text-[12px] text-muted-foreground tabular-nums flex-wrap">
              <span>
                {selected.size > 0
                  ? `${selected.size} selected`
                  : sorted.length === hands.length
                    ? `${sorted.length} ${sorted.length === 1 ? "hand" : "hands"}`
                    : `${sorted.length} of ${hands.length} ${hands.length === 1 ? "hand" : "hands"}`}
              </span>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <span>
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, sorted.length)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft />
                  </Button>
                  <span>
                    Page {safePage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={safePage >= totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              ) : (
                <span>
                  Showing 1–{sorted.length}
                </span>
              )}
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <div className="fixed bottom-4 sm:bottom-6 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-border bg-card shadow-2xl">
            <span className="text-[13px] font-medium px-2">
              {selected.size} selected
            </span>
            <span className="w-px h-5 bg-border hidden sm:block" />
            {/* Tag / Share / Duplicate are stubs (per v1.1 backlog) and only
                clutter the bar on mobile — hide under sm. */}
            <Button variant="outline" size="sm" className="hidden sm:inline-flex">
              <Tag /> Tag
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex">
              <Share2 /> Share
            </Button>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex">
              <Copy /> Duplicate
            </Button>
            <Button variant="destructive" size="sm" onClick={deleteSelected}>
              <Trash2 /> Delete
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-1 px-2 text-[12px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
        {editing && (
          <EditDetailsModal
            hand={editing}
            onSave={(patch) => update(editing.id, patch)}
            onClose={() => setEditing(null)}
          />
        )}
        {usernameOpen && (
          <UsernamePicker
            initial={username}
            onSaved={(u) => setUsername(u)}
            onClose={() => setUsernameOpen(false)}
          />
        )}
      </div>
    </Shell>
  );
}
