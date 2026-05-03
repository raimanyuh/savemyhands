"use client";

// Bottom-sheet filter UI for the mobile dashboard. Mirrors the desktop
// dashboard's filter dropdowns but laid out as scrollable chip groups.
// The sheet edits a local *draft* of the filter state — chip toggles
// don't propagate to the parent until the user taps Apply. Clear all
// resets the draft. Dismissing the sheet without Apply discards the
// draft.

import { useState } from "react";
import { Star } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const STAR_GOLD = "oklch(0.85 0.15 85)";
const BG = "oklch(0.10 0 0)";
const BG_PANEL = "oklch(0.16 0 0)";

export type FilterState = {
  starredOnly: boolean;
  potType: Set<string>;
  tags: Set<string>;
  venue: Set<string>;
  stakes: Set<string>;
  players: Set<string>;
  result: Set<string>;
  positions: Set<string>;
  multiway: Set<string>;
  gameType: Set<string>;
  doubleBoard: Set<string>;
};

type Option = { value: string; label: string };

export type FilterOptions = {
  potType: Option[];
  tags: Option[];
  venue: Option[];
  stakes: Option[];
  players: Option[];
  result: Option[];
  positions: Option[];
  multiway: Option[];
  gameType: Option[];
  doubleBoard: Option[];
};

function cloneFilters(f: FilterState): FilterState {
  return {
    starredOnly: f.starredOnly,
    potType: new Set(f.potType),
    tags: new Set(f.tags),
    venue: new Set(f.venue),
    stakes: new Set(f.stakes),
    players: new Set(f.players),
    result: new Set(f.result),
    positions: new Set(f.positions),
    multiway: new Set(f.multiway),
    gameType: new Set(f.gameType),
    doubleBoard: new Set(f.doubleBoard),
  };
}

const EMPTY_DRAFT: FilterState = {
  starredOnly: false,
  potType: new Set(),
  tags: new Set(),
  venue: new Set(),
  stakes: new Set(),
  players: new Set(),
  result: new Set(),
  positions: new Set(),
  multiway: new Set(),
  gameType: new Set(),
  doubleBoard: new Set(),
};

export function DashboardFilterSheet({
  open,
  onOpenChange,
  options,
  filters,
  onApply,
  onClear,
  matchCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: FilterOptions;
  filters: FilterState;
  // Commits the draft. Parent typically also dismisses the sheet inside
  // this callback.
  onApply: (next: FilterState) => void;
  // Optional reset hook — currently the sheet handles "clear all"
  // internally by zeroing the draft, but we expose this in case the
  // parent wants to know.
  onClear?: () => void;
  // Live count of hands matching the *applied* filters. The sheet
  // doesn't compute it itself because the matcher lives upstream — we
  // just display whatever the parent passes. While the user is staging
  // changes, the parent's `filters` prop is still the applied state, so
  // this number reflects what's currently on screen behind the sheet.
  matchCount: number;
}) {
  // Draft state — initialized from props.filters when the sheet opens.
  // Re-syncs each time `open` flips true via setState-during-render
  // sentinel (sidesteps `react-hooks/set-state-in-effect`).
  const [draft, setDraft] = useState<FilterState>(() => cloneFilters(filters));
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(cloneFilters(filters));
  }

  const toggle = (group: keyof Omit<FilterState, "starredOnly">, value: string) => {
    setDraft((d) => {
      const next = cloneFilters(d);
      const set = next[group];
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return next;
    });
  };

  const clearAll = () => {
    setDraft(cloneFilters(EMPTY_DRAFT));
    onClear?.();
  };

  const apply = () => onApply(draft);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filters"
      maxHeightVh={88}
      footer={
        <div className="flex items-center" style={{ gap: 10 }}>
          <button
            type="button"
            onClick={clearAll}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "oklch(0.85 0 0)",
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={apply}
            style={{
              flex: 1.4,
              height: 48,
              borderRadius: 12,
              background: EMERALD,
              border: 0,
              color: BG,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Apply{matchCount >= 0 ? ` (${matchCount})` : ""}
          </button>
        </div>
      }
    >
      <div
        className="flex flex-col"
        style={{ padding: "12px 14px 18px", gap: 18 }}
      >
        {/* Starred toggle — single boolean, rendered as a row */}
        <button
          type="button"
          onClick={() =>
            setDraft((d) => ({ ...d, starredOnly: !d.starredOnly }))
          }
          className="flex items-center"
          style={{
            gap: 12,
            padding: "12px 14px",
            borderRadius: 12,
            background: draft.starredOnly
              ? "oklch(0.85 0.15 85 / 0.10)"
              : BG_PANEL,
            border: `1px solid ${draft.starredOnly ? "oklch(0.85 0.15 85 / 0.40)" : "rgba(255,255,255,0.06)"}`,
            color: draft.starredOnly ? STAR_GOLD : "oklch(0.92 0 0)",
          }}
        >
          <Star
            size={16}
            fill={draft.starredOnly ? "currentColor" : "none"}
          />
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            Starred only
          </span>
        </button>

        <Group
          title="Position"
          options={options.positions}
          selected={draft.positions}
          onToggle={(v) => toggle("positions", v)}
        />
        <Group
          title="Stakes"
          options={options.stakes}
          selected={draft.stakes}
          onToggle={(v) => toggle("stakes", v)}
        />
        <Group
          title="Players"
          options={options.players}
          selected={draft.players}
          onToggle={(v) => toggle("players", v)}
        />
        <Group
          title="Game"
          options={options.gameType}
          selected={draft.gameType}
          onToggle={(v) => toggle("gameType", v)}
        />
        <Group
          title="Multiway"
          options={options.multiway}
          selected={draft.multiway}
          onToggle={(v) => toggle("multiway", v)}
        />
        <Group
          title="Double board"
          options={options.doubleBoard}
          selected={draft.doubleBoard}
          onToggle={(v) => toggle("doubleBoard", v)}
        />
        <Group
          title="Result"
          options={options.result}
          selected={draft.result}
          onToggle={(v) => toggle("result", v)}
        />
        <Group
          title="Pot type"
          options={options.potType}
          selected={draft.potType}
          onToggle={(v) => toggle("potType", v)}
        />
        <Group
          title="Tags"
          options={options.tags}
          selected={draft.tags}
          onToggle={(v) => toggle("tags", v)}
        />
        <Group
          title="Venue"
          options={options.venue}
          selected={draft.venue}
          onToggle={(v) => toggle("venue", v)}
        />
      </div>
    </BottomSheet>
  );
}

function Group({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Option[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "oklch(0.55 0 0)",
          }}
        >
          {title}
        </span>
        {selected.size > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 999,
              background: "oklch(0.696 0.205 155 / 0.18)",
              color: EMERALD_BRIGHT,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {selected.size}
          </span>
        )}
      </div>
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        {options.map((opt) => {
          const active = selected.has(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              style={{
                fontSize: 13,
                padding: "8px 12px",
                minHeight: 36,
                borderRadius: 999,
                background: active
                  ? "oklch(0.696 0.205 155 / 0.18)"
                  : BG_PANEL,
                border: `1px solid ${active ? "oklch(0.696 0.205 155 / 0.5)" : "rgba(255,255,255,0.10)"}`,
                color: active ? EMERALD_BRIGHT : "oklch(0.92 0 0)",
                fontWeight: active ? 600 : 500,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
