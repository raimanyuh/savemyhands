"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteHandAction,
  deleteHandsAction,
  setHandsPublicAction,
  updateHandDetailsAction,
} from "@/lib/hands/actions";
import {
  ChevronDown,
  ChevronUp,
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
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Header, Shell } from "@/components/Shell";
import { UsernamePicker } from "@/components/auth/UsernamePicker";
import { isMultiway, potTypeOf, type SavedHand } from "./hand";

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

// Game variant for a saved hand. Older saves predate `_full.gameType`
// and are always Hold'em.
function gameTypeOf(h: SavedHand): "NLHE" | "PLO4" | "PLO5" {
  return h._full?.gameType ?? "NLHE";
}
const GAME_LABEL: Record<"NLHE" | "PLO4" | "PLO5", string> = {
  NLHE: "NLHE",
  PLO4: "PLO4",
  PLO5: "PLO5",
};
function holeCountOf(h: SavedHand): 2 | 4 | 5 {
  const g = gameTypeOf(h);
  if (g === "PLO5") return 5;
  if (g === "PLO4") return 4;
  return 2;
}

// Double-board flag.
function doubleBoardOf(h: SavedHand): boolean {
  return !!h._full?.doubleBoardOn;
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
  align?: "left" | "center" | "right";
}) {
  return (
    <div
      className={`flex items-center h-9 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground ${
        align === "right"
          ? "justify-end"
          : align === "center"
            ? "justify-center"
            : ""
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
  "grid-cols-[28px_28px_minmax(120px,1.4fr)_88px_110px_60px_64px_56px_122px_68px_36px_80px_170px_minmax(110px,0.8fr)_90px_32px]";

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

// Tag popover used by both the bulk-action bar and individual rows. The
// existing-tag chips are quick-add shortcuts pulled from the user's whole
// library; the input adds a brand-new tag on Enter. `placement` controls
// whether the popover floats above the anchor (bulk bar at the bottom of
// the viewport) or below it (a row in the table).
function TagPopover({
  anchor,
  existingTags,
  onAdd,
  onClose,
  placement = "above",
}: {
  anchor: HTMLElement;
  existingTags: string[];
  onAdd: (tag: string) => void;
  onClose: () => void;
  placement?: "above" | "below";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Click on the anchor itself toggles in the parent — let that
        // handler run instead of double-firing close here.
        if (anchor.contains(e.target as Node)) return;
        onClose();
      }
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
  }, [onClose, anchor]);

  const rect = anchor.getBoundingClientRect();
  const W = 240;
  // Place above (bottom-pinned) or below (top-pinned) the anchor.
  const above = placement === "above";
  const positionStyle = above
    ? { bottom: window.innerHeight - rect.top + 6 }
    : { top: rect.bottom + 6 };
  let left = above
    ? rect.left + rect.width / 2 - W / 2
    : rect.left;
  left = Math.max(8, Math.min(window.innerWidth - W - 8, left));

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
  };

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[200] rounded-lg overflow-hidden flex flex-col"
      style={{
        left,
        ...positionStyle,
        width: W,
        background: "oklch(0.215 0 0)",
        border: "1px solid oklch(1 0 0 / 0.12)",
        boxShadow:
          "0 24px 60px rgba(0,0,0,0.7), 0 6px 18px rgba(0,0,0,0.5)",
      }}
    >
      <div className="px-3 pt-3 pb-2">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add tag…"
          className="h-8 text-[13px]"
        />
      </div>
      {existingTags.length > 0 && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Quick add
          </span>
          <div className="flex flex-wrap gap-1.5">
            {existingTags.map((t) => (
              <button
                key={t}
                onClick={() => onAdd(t)}
                className="px-2 h-6 rounded-md text-[11px] bg-white/5 hover:bg-white/10 text-zinc-200 cursor-pointer"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
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
  allTags,
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
  // Every distinct tag in the user's library — feeds the row tag popover's
  // quick-add chips so the user can re-apply existing tags in one click.
  allTags: string[];
  selected: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
  onOpen: () => void;
  onRename: (name: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  isSample: boolean;
  onEditDetails: () => void;
  onDelete: () => void;
}) {
  const [tagAnchor, setTagAnchor] = useState<HTMLElement | null>(null);
  const openTagPopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setTagAnchor(tagAnchor ? null : (e.currentTarget as HTMLElement));
  };
  return (
    <div
      onClick={onOpen}
      className={`grid ${ROW_COLS} items-center gap-2 px-3 min-h-11 py-1.5 border-b border-[oklch(1_0_0_/_0.05)] cursor-pointer transition-colors ${
        selected
          ? "bg-[oklch(0.285_0_0_/_0.55)]"
          : "hover:bg-[oklch(1_0_0_/_0.03)]"
      }`}
    >
      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onChange={() => onSelect()} ariaLabel="Select row" />
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
        className={`text-[12px] font-mono tracking-tight ${
          gameTypeOf(hand) === "NLHE"
            ? "text-zinc-300"
            : "text-[oklch(0.795_0.184_155)]"
        }`}
      >
        {GAME_LABEL[gameTypeOf(hand)]}
      </span>
      <div className="flex items-center gap-0.5">
        {(() => {
          const heroPos = hand._full?.heroPosition ?? 0;
          const heroCards = hand._full?.players[heroPos]?.cards;
          const count = holeCountOf(hand);
          // Older saves predate `_full.players`, and a few sample hands
          // don't carry hole cards either — render dashed placeholders
          // so the column doesn't shift when a row is missing them. The
          // 122px column fits 5 mini-cards (5×22 + 4×2) on a single
          // row, so PLO 4 / 5 stay flat alongside NLHE.
          return Array.from({ length: count }, (_, i) => (
            <MiniCard key={i} card={heroCards?.[i] ?? "—"} />
          ));
        })()}
      </div>
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
      <div
        className="flex justify-center"
        title={doubleBoardOf(hand) ? "Double board" : "Single board"}
      >
        <span
          className={`text-[12px] tabular-nums ${
            doubleBoardOf(hand)
              ? "text-[oklch(0.795_0.184_155)]"
              : "text-zinc-600"
          }`}
        >
          {doubleBoardOf(hand) ? "Yes" : "—"}
        </span>
      </div>
      <span className="text-[12px] text-zinc-300 font-mono tracking-tight">
        {potTypeOf(hand)}
      </span>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-0.5">
          {hand.board.map((c, i) => (
            <MiniCard key={i} card={c} />
          ))}
        </div>
        {hand._full?.doubleBoardOn && hand._full?.board2 && (
          <div className="flex items-center gap-0.5">
            {hand._full.board2.map((c, i) => (
              <MiniCard key={i} card={c ?? "—"} />
            ))}
          </div>
        )}
      </div>
      <div
        className="flex items-center gap-1 flex-wrap min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {hand.tags.length === 0 ? (
          <button
            onClick={openTagPopover}
            aria-expanded={tagAnchor !== null}
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
              onClick={openTagPopover}
              aria-expanded={tagAnchor !== null}
              className="w-5 h-5 inline-flex items-center justify-center rounded text-[oklch(0.55_0_0)] hover:text-[oklch(0.85_0_0)] hover:bg-[oklch(1_0_0_/_0.05)] cursor-pointer"
              aria-label="Add tag"
            >
              <Plus size={11} />
            </button>
          </>
        )}
        {tagAnchor && (
          <TagPopover
            anchor={tagAnchor}
            existingTags={allTags}
            placement="below"
            onAdd={(t) => {
              if (!hand.tags.includes(t)) onAddTag(t);
            }}
            onClose={() => setTagAnchor(null)}
          />
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
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
      <div
        className="flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {!isSample && (
          <RowActionsMenu
            onEditDetails={onEditDetails}
            onDelete={onDelete}
          />
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
}: {
  // The signed-in user's @username, or null if they haven't picked one yet.
  initialUsername: string | null;
  signOutAction?: () => void | Promise<void>;
  // Hands fetched on the server for the signed-in user.
  initialHands: SavedHand[];
  // True when the user has no hands of their own; renders SAMPLE_HANDS as a
  // first-run demo. Hidden once they have any saved hand.
  showSamples: boolean;
  // `?demo=N` URL param is accepted by the page wrapper but not yet wired
  // through to the Dashboard — the side-branch sample-hands-gen integration
  // wasn't part of the agreed forward-port scope.
  demoCount?: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  // Local mirror of the server-fetched hands. Optimistic updates land here
  // immediately; server actions persist + revalidate behind the scenes.
  const [hands, setHands] = useState<SavedHand[]>(() =>
    showSamples ? [...initialHands, ...SAMPLE_HANDS] : initialHands,
  );
  const [, startMutation] = useTransition();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<SavedHand | null>(null);
  const [tagAnchor, setTagAnchor] = useState<HTMLElement | null>(null);
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
  const [gameTypeFilter, setGameTypeFilter] = useState<Set<string>>(new Set());
  const [doubleBoardFilter, setDoubleBoardFilter] = useState<Set<string>>(
    new Set(),
  );
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
        { value: "BP", label: "BP — bomb pot" },
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
      gameType: [
        { value: "NLHE", label: "Hold'em" },
        { value: "PLO4", label: "PLO 4-card" },
        { value: "PLO5", label: "PLO 5-card" },
      ],
      doubleBoard: [
        { value: "single", label: "Single board" },
        { value: "double", label: "Double board" },
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
      if (gameTypeFilter.size && !gameTypeFilter.has(gameTypeOf(h))) {
        return false;
      }
      if (doubleBoardFilter.size) {
        const v = doubleBoardOf(h) ? "double" : "single";
        if (!doubleBoardFilter.has(v)) return false;
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
    gameTypeFilter,
    doubleBoardFilter,
    starredOnly,
    search,
  ]);

  // Every distinct tag in the user's library, sorted. Feeds the row + bulk
  // tag popovers' quick-add chips.
  const allTags = useMemo(
    () => [...new Set(hands.flatMap((h) => h.tags))].sort(),
    [hands],
  );

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

  // Sample IDs aren't backed by Postgres — mutations on them stay local-only
  // (they live in this component's state, but no server action fires).
  const sampleIds = useMemo(
    () => new Set(SAMPLE_HANDS.map((h) => h.id)),
    [],
  );

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

  const deleteHand = async (h: SavedHand) => {
    const ok = await confirm({
      title: `Delete "${h.name}"?`,
      message: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
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

  const deleteSelected = async () => {
    const targets = [...selected];
    if (targets.length === 0) return;
    const ok = await confirm({
      title: `Delete ${targets.length} hand${targets.length === 1 ? "" : "s"}?`,
      message: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
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

  // Bulk share: prompt → mark all selected hands public → copy newline-
  // separated "Name — URL" lines to clipboard. Sample hands are excluded
  // (their ids don't exist on the server, so the link would 404). Each
  // selected hand that's already public is left as-is.
  const shareSelected = async () => {
    const targets = [...selected];
    if (targets.length === 0) return;
    const targetSet = new Set(targets);
    const targetHands = hands.filter((h) => targetSet.has(h.id));
    const persistable = targetHands.filter((h) => !sampleIds.has(h.id));
    if (persistable.length === 0) {
      window.alert("Sample hands can't be shared. Save your own first.");
      return;
    }
    const ok = await confirm({
      title: `Share ${persistable.length} hand${persistable.length === 1 ? "" : "s"}?`,
      message: (
        <>
          Anyone with the link will be able to view{" "}
          {persistable.length === 1 ? "this hand" : "these hands"}. The links
          will be copied to your clipboard.
        </>
      ),
      confirmLabel: "Make public & copy links",
    });
    if (!ok) return;

    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const lines = persistable.map((h) => `${h.name} — ${origin}/hand/${h.id}`);
    const text = lines.join("\n");

    // Best-effort clipboard. The promise can reject when the page isn't
    // focused or when permissions are denied — fall back to a manual prompt
    // in that case so the user still gets the links.
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("Clipboard write failed", e);
      window.prompt("Copy these links manually:", text);
    }

    // Optimistically flip is_public locally so the lock icons match.
    setHands((hs) =>
      hs.map((h) => (targetSet.has(h.id) ? { ...h, isPublic: true } : h)),
    );

    const ids = persistable.map((h) => h.id);
    startMutation(async () => {
      try {
        await setHandsPublicAction(ids, true);
      } catch (e) {
        console.error("Failed to mark hands public", e);
        window.alert(
          "The links were copied, but we couldn't update sharing for some hands. Refresh to see the current state.",
        );
        router.refresh();
      }
    });
  };

  // Bulk-add a tag to every selected hand (deduped per hand). Used by the
  // tag popover. Each row's new tag list is computed from its current tag
  // set so we can patch it without a server-side merge.
  const bulkAddTag = (rawTag: string) => {
    const tag = rawTag.trim();
    if (!tag) return;
    const targets = [...selected];
    if (targets.length === 0) return;
    const targetSet = new Set(targets);
    // Compute the new tag list per hand once, before any state churn, so
    // the optimistic update and the server patch agree on the same value.
    const patches = new Map<string, string[]>();
    for (const h of hands) {
      if (!targetSet.has(h.id)) continue;
      if (h.tags.includes(tag)) continue;
      patches.set(h.id, [...h.tags, tag]);
    }
    if (patches.size === 0) return;
    setHands((hs) =>
      hs.map((h) => {
        const next = patches.get(h.id);
        return next ? { ...h, tags: next } : h;
      }),
    );
    startMutation(async () => {
      await Promise.all(
        [...patches.entries()]
          .filter(([id]) => !sampleIds.has(id))
          .map(async ([id, tags]) => {
            try {
              await updateHandDetailsAction(id, { tags });
            } catch (e) {
              console.error("Failed to update tags for", id, e);
            }
          }),
      );
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
                  <SettingsIcon /> Settings
                </Link>
              </Button>
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
              color: "oklch(0.145 0 0)",
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
              label="Game"
              options={filterOptions.gameType}
              selected={gameTypeFilter}
              onChange={setGameTypeFilter}
            />
            <FilterDropdown
              label="Multiway"
              options={filterOptions.multiway}
              selected={multiwayFilter}
              onChange={setMultiwayFilter}
            />
            <FilterDropdown
              label="DB"
              options={filterOptions.doubleBoard}
              selected={doubleBoardFilter}
              onChange={setDoubleBoardFilter}
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
            className={`grid ${ROW_COLS} items-center gap-2 px-3 h-9 border-b border-border bg-[oklch(0.245_0_0)]`}
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
            <PlainHeader label="Game" />
            <PlainHeader label="Hand" />
            <PlainHeader label="Multiway" />
            <PlainHeader label="DB" align="center" />
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
            sorted.map((h) => (
              <HandListRow
                key={h.id}
                hand={h}
                allTags={allTags}
                selected={selected.has(h.id)}
                onSelect={() => toggleSel(h.id)}
                onToggleFav={() => update(h.id, { fav: !h.fav })}
                onRename={(name) => update(h.id, { name })}
                onAddTag={(t) =>
                  update(h.id, { tags: [...h.tags, t] })
                }
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

          {/* Footer */}
          <div className="flex items-center justify-between px-3 h-9 border-t border-border bg-[oklch(0.245_0_0)] text-[12px] text-muted-foreground tabular-nums">
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
            <Button
              variant="outline"
              size="sm"
              onClick={(e) =>
                setTagAnchor(
                  tagAnchor ? null : (e.currentTarget as HTMLElement),
                )
              }
              aria-expanded={tagAnchor !== null}
            >
              <Tag /> Tag
            </Button>
            <Button variant="outline" size="sm" onClick={shareSelected}>
              <Share2 /> Share
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
        {tagAnchor && selected.size > 0 && (
          <TagPopover
            anchor={tagAnchor}
            existingTags={allTags}
            onAdd={(t) => bulkAddTag(t)}
            onClose={() => setTagAnchor(null)}
          />
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
