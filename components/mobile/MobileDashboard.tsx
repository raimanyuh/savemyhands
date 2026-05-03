"use client";

// Mobile dashboard — sibling of components/poker/Dashboard.tsx for
// viewports below 640px. Reuses the same server actions and data
// shape; only the UI is parallel.
//
// Layout (per design_handoff_mobile_redesign):
//   [48pt header — title left, ⋯ right]
//   [56pt sticky row — search input + filter pill]
//   [scrollable hand-card list]
//   [FAB bottom-right — + Record]
//
// Long-press on a card → enters select mode. Header morphs to
// "N selected" + cancel left + ⋯ right (overflow with Tag/Share/
// Delete). Tap toggles selection while in select mode; tap
// otherwise navigates to /hand/[id].

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Settings as SettingsIcon,
  Share2,
  SlidersHorizontal,
  Star,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { UsernamePicker } from "@/components/auth/UsernamePicker";
import {
  deleteHandsAction,
  setHandsPublicAction,
  updateHandDetailsAction,
} from "@/lib/hands/actions";
import { potTypeOf, type SavedHand } from "@/components/poker/hand";
import {
  GAME_LABEL,
  MiniCard,
  SAMPLE_HANDS,
  doubleBoardOf,
  gameTypeOf,
  heroPositionOf,
  holeCountOf,
  multiwayOf,
} from "@/components/poker/dashboard-shared";
import { DashboardFilterSheet, type FilterState } from "./DashboardFilterSheet";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const ROSE = "oklch(0.704 0.191 22.216)";
const STAR_GOLD = "oklch(0.85 0.15 85)";
const BG = "oklch(0.10 0 0)";
const BG_ELEVATED = "oklch(0.16 0 0)";

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_PX = 10;

export default function MobileDashboard({
  initialUsername,
  signOutAction,
  initialHands,
  showSamples,
}: {
  initialUsername: string | null;
  signOutAction?: () => void | Promise<void>;
  initialHands: SavedHand[];
  showSamples: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [hands, setHands] = useState<SavedHand[]>(() =>
    showSamples ? [...initialHands, ...SAMPLE_HANDS] : initialHands,
  );
  const [, startMutation] = useTransition();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilterState);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inSelectMode = selected.size > 0;

  const [overflowOpen, setOverflowOpen] = useState(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);

  const [username, setUsername] = useState<string | null>(initialUsername);
  const [usernameOpen, setUsernameOpen] = useState(false);

  const sampleIds = useMemo(
    () => new Set(SAMPLE_HANDS.map((h) => h.id)),
    [],
  );

  // Distinct filter values discovered from the dataset.
  const filterOptions = useMemo(
    () => buildFilterOptions(hands),
    [hands],
  );
  const allTags = useMemo(
    () => [...new Set(hands.flatMap((h) => h.tags))].sort(),
    [hands],
  );

  // Filter + search applied. Date desc by default — no sort UI on mobile;
  // the server returns hands ordered by date desc already, but we sort
  // again locally so optimistic updates don't disturb the order.
  const filtered = useMemo(() => {
    return hands.filter((h) => matchesFilters(h, filters, search));
  }, [hands, filters, search]);

  // Active-filter count for the pill badge.
  const activeFilterCount = countActiveFilters(filters);

  // Pagination — render in 100-hand chunks so a user with thousands of
  // saved hands doesn't ship every card on first paint. Resets to 100
  // whenever the filter set or search string changes (so a new filtered
  // view starts at the top, not partway through).
  const PAGE_SIZE = 100;
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  // Sort each set's values so the key only changes when the chip
  // selection truly differs (Set iteration is insertion-order, so
  // toggling chips off+back-on would otherwise produce a different
  // key and reset pagination unnecessarily).
  const sortJoin = (s: Set<string>) => [...s].sort().join(",");
  const filterKey = `${search}|${[
    sortJoin(filters.potType),
    sortJoin(filters.tags),
    sortJoin(filters.venue),
    sortJoin(filters.stakes),
    sortJoin(filters.players),
    sortJoin(filters.result),
    sortJoin(filters.positions),
    sortJoin(filters.multiway),
    sortJoin(filters.gameType),
    sortJoin(filters.doubleBoard),
  ].join("|")}|${filters.starredOnly}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setShownCount(PAGE_SIZE);
  }
  const visible = filtered.slice(0, shownCount);
  const hasMore = filtered.length > shownCount;

  // ── Mutations (mirrors desktop Dashboard) ──────────────────────────
  type DashboardPatch = Partial<
    Pick<SavedHand, "name" | "loc" | "notes" | "date" | "tags" | "fav" | "_full">
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
    setBulkActionsOpen(false);
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
    const lines = persistable.map(
      (h) => `${h.name} — ${origin}/hand/${h.id}`,
    );
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("Clipboard write failed", e);
      window.prompt("Copy these links manually:", text);
    }
    setHands((hs) =>
      hs.map((h) => (targetSet.has(h.id) ? { ...h, isPublic: true } : h)),
    );
    setBulkActionsOpen(false);

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

  const bulkAddTag = (rawTag: string) => {
    const tag = rawTag.trim();
    if (!tag) return;
    const targets = [...selected];
    if (targets.length === 0) return;
    const targetSet = new Set(targets);
    const patches = new Map<string, string[]>();
    for (const h of hands) {
      if (!targetSet.has(h.id)) continue;
      if (h.tags.includes(tag)) continue;
      patches.set(h.id, [...h.tags, tag]);
    }
    if (patches.size === 0) {
      setBulkTagOpen(false);
      return;
    }
    setHands((hs) =>
      hs.map((h) => {
        const next = patches.get(h.id);
        return next ? { ...h, tags: next } : h;
      }),
    );
    setBulkTagOpen(false);
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

  // ── Selection helpers ──────────────────────────────────────────────
  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const enterSelect = (id: string) => {
    setSelected(new Set([id]));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // some browsers throw on cross-origin or insecure contexts
      }
    }
  };
  const clearSelection = () => setSelected(new Set());

  return (
    <div
      className="flex flex-col h-[100dvh] w-full"
      style={{ background: BG, color: "oklch(0.92 0 0)" }}
    >
      {/* Header */}
      {inSelectMode ? (
        <SelectHeader
          count={selected.size}
          onCancel={clearSelection}
          onMore={() => setBulkActionsOpen(true)}
        />
      ) : (
        <DefaultHeader
          username={username}
          onMore={() => setOverflowOpen(true)}
        />
      )}

      {/* Sticky search + filter row */}
      <div
        className="shrink-0 flex items-center gap-2"
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: BG,
        }}
      >
        <div className="flex-1 relative">
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "oklch(0.55 0 0)",
              pointerEvents: "none",
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hands…"
            className="w-full"
            style={{
              height: 36,
              borderRadius: 10,
              background: BG_ELEVATED,
              border: "1px solid rgba(255,255,255,0.06)",
              color: "oklch(0.92 0 0)",
              fontSize: 14,
              padding: "0 32px 0 32px",
              outline: "none",
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 24,
                height: 24,
                borderRadius: 6,
                background: "transparent",
                color: "oklch(0.55 0 0)",
                border: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFilterSheetOpen(true)}
          aria-label="Filters"
          className="inline-flex items-center"
          style={{
            height: 36,
            padding: "0 12px",
            gap: 6,
            borderRadius: 10,
            background:
              activeFilterCount > 0
                ? "oklch(0.696 0.205 155 / 0.14)"
                : BG_ELEVATED,
            border: `1px solid ${activeFilterCount > 0 ? "oklch(0.696 0.205 155 / 0.4)" : "rgba(255,255,255,0.08)"}`,
            color: activeFilterCount > 0 ? EMERALD_BRIGHT : "oklch(0.85 0 0)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "0 5px",
                height: 16,
                minWidth: 16,
                borderRadius: 999,
                background: EMERALD,
                color: BG,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Hand list */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ padding: "10px 12px 96px" }}
      >
        {filtered.length === 0 ? (
          <EmptyState
            hasFilters={activeFilterCount > 0 || !!search}
            onClearFilters={() => {
              setFilters(emptyFilterState);
              setSearch("");
            }}
          />
        ) : (
          <div className="flex flex-col" style={{ gap: 8 }}>
            {visible.map((h) => (
              <HandCard
                key={h.id}
                hand={h}
                selected={selected.has(h.id)}
                inSelectMode={inSelectMode}
                isSample={sampleIds.has(h.id)}
                onTap={() => {
                  if (inSelectMode) {
                    toggleSel(h.id);
                  } else {
                    router.push(`/hand/${h.id}`);
                  }
                }}
                onLongPress={() => {
                  if (!inSelectMode) enterSelect(h.id);
                }}
                onToggleFav={() => update(h.id, { fav: !h.fav })}
              />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={() => setShownCount((n) => n + PAGE_SIZE)}
                style={{
                  marginTop: 4,
                  height: 44,
                  borderRadius: 10,
                  background: BG_ELEVATED,
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "oklch(0.92 0 0)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Load {Math.min(PAGE_SIZE, filtered.length - shownCount)} more
              </button>
            )}
            <div
              className="text-center"
              style={{
                fontSize: 11,
                color: "oklch(0.45 0 0)",
                padding: "12px 0 4px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Showing {visible.length} of {filtered.length}
              {filtered.length !== hands.length ? ` (${hands.length} total)` : ""}
            </div>
          </div>
        )}
      </div>

      {/* FAB — hidden in select mode (overflow has the actions instead) */}
      {!inSelectMode && (
        <Link
          href="/record"
          className="fixed flex items-center justify-center"
          style={{
            right: 18,
            bottom: "max(20px, env(safe-area-inset-bottom))",
            height: 52,
            paddingLeft: 18,
            paddingRight: 22,
            borderRadius: 999,
            background: EMERALD,
            color: BG,
            fontWeight: 600,
            fontSize: 15,
            gap: 6,
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px oklch(0.745 0.198 155 / 0.5)",
            zIndex: 30,
          }}
          aria-label="Record hand"
        >
          <Plus size={18} strokeWidth={2.5} />
          Record
        </Link>
      )}

      {/* Filter sheet */}
      <DashboardFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        options={filterOptions}
        filters={filters}
        onApply={(next) => {
          setFilters(next);
          setFilterSheetOpen(false);
        }}
        onClear={() => setFilters(emptyFilterState)}
        matchCount={
          // Live count when the sheet is open — applied filters mutate
          // immediately on chip-toggle, so this is just `filtered.length`.
          filtered.length
        }
      />

      {/* Default-mode overflow sheet — username, settings, sign out */}
      <BottomSheet
        open={overflowOpen}
        onOpenChange={setOverflowOpen}
        title="Account"
      >
        <div className="flex flex-col" style={{ padding: "4px 0 12px" }}>
          {username ? (
            <SheetButton
              icon={<UserGlyph />}
              label={`@${username}`}
              sub="Change username"
              onClick={() => {
                setOverflowOpen(false);
                setUsernameOpen(true);
              }}
            />
          ) : (
            <SheetButton
              icon={<UserGlyph />}
              label="Set username"
              onClick={() => {
                setOverflowOpen(false);
                setUsernameOpen(true);
              }}
            />
          )}
          <SheetButton
            icon={<SettingsIcon size={16} />}
            label="Settings"
            onClick={() => {
              setOverflowOpen(false);
              router.push("/settings");
            }}
          />
          {signOutAction && (
            <SheetButton
              icon={<LogOut size={16} />}
              label="Sign out"
              destructive
              onClick={async () => {
                setOverflowOpen(false);
                await signOutAction();
              }}
            />
          )}
        </div>
      </BottomSheet>

      {/* Select-mode overflow — Tag / Share / Delete */}
      <BottomSheet
        open={bulkActionsOpen}
        onOpenChange={setBulkActionsOpen}
        title={`${selected.size} selected`}
      >
        <div className="flex flex-col" style={{ padding: "4px 0 12px" }}>
          <SheetButton
            icon={<TagIcon size={16} />}
            label="Add tag"
            onClick={() => {
              setBulkActionsOpen(false);
              setBulkTagOpen(true);
            }}
          />
          <SheetButton
            icon={<Share2 size={16} />}
            label="Share (make public + copy links)"
            onClick={() => {
              shareSelected();
            }}
          />
          <SheetButton
            icon={<Trash2 size={16} />}
            label="Delete"
            destructive
            onClick={() => {
              deleteSelected();
            }}
          />
        </div>
      </BottomSheet>

      {/* Bulk tag sheet — quick-add chips + new-tag input */}
      <BulkTagSheet
        open={bulkTagOpen}
        onOpenChange={setBulkTagOpen}
        existingTags={allTags}
        onAdd={(t) => bulkAddTag(t)}
      />

      {/* Username picker — preserves desktop flow */}
      {usernameOpen && (
        <UsernamePicker
          initial={username}
          onSaved={(u) => setUsername(u)}
          onClose={() => setUsernameOpen(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Headers
// ─────────────────────────────────────────────────────────────────────

function DefaultHeader({
  username,
  onMore,
}: {
  username: string | null;
  onMore: () => void;
}) {
  return (
    <header
      className="flex items-center justify-between shrink-0"
      style={{
        height: 48,
        padding: "0 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ width: 40 }} />
      <div className="flex flex-col items-center leading-tight">
        <div
          className="font-semibold tracking-tight"
          style={{ fontSize: 15, color: "oklch(0.98 0 0)" }}
        >
          Hands
        </div>
        {username && (
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              color: "oklch(0.55 0 0)",
              letterSpacing: "0.06em",
            }}
          >
            @{username}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="More"
        onClick={onMore}
        className="flex items-center justify-center"
        style={{
          width: 40,
          height: 40,
          color: "oklch(0.715 0 0)",
          background: "transparent",
          border: 0,
          borderRadius: 10,
        }}
      >
        <MoreHorizontal size={20} />
      </button>
    </header>
  );
}

function SelectHeader({
  count,
  onCancel,
  onMore,
}: {
  count: number;
  onCancel: () => void;
  onMore: () => void;
}) {
  return (
    <header
      className="flex items-center justify-between shrink-0"
      style={{
        height: 48,
        padding: "0 4px 0 8px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "oklch(0.18 0 0)",
      }}
    >
      <button
        type="button"
        onClick={onCancel}
        style={{
          fontSize: 14,
          color: "oklch(0.92 0 0)",
          background: "transparent",
          border: 0,
          padding: "8px 12px",
          fontWeight: 500,
        }}
      >
        Cancel
      </button>
      <div
        className="font-semibold tracking-tight"
        style={{ fontSize: 15, color: "oklch(0.98 0 0)" }}
      >
        {count} selected
      </div>
      <button
        type="button"
        aria-label="Bulk actions"
        onClick={onMore}
        className="flex items-center justify-center"
        style={{
          width: 40,
          height: 40,
          color: "oklch(0.92 0 0)",
          background: "transparent",
          border: 0,
          borderRadius: 10,
        }}
      >
        <MoreHorizontal size={20} />
      </button>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hand card
// ─────────────────────────────────────────────────────────────────────

function HandCard({
  hand,
  selected,
  inSelectMode,
  isSample,
  onTap,
  onLongPress,
  onToggleFav,
}: {
  hand: SavedHand;
  selected: boolean;
  inSelectMode: boolean;
  isSample: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onToggleFav: () => void;
}) {
  // Long-press detection. Pointer events handle both touch and mouse;
  // we cancel the timer on movement above the threshold so a vertical
  // scroll doesn't trigger select.
  const timer = useRef<number | null>(null);
  const startXY = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);

  const cancel = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    startXY.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    longPressed.current = false;
    startXY.current = { x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      onLongPress();
      timer.current = null;
    }, LONG_PRESS_MS);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startXY.current) return;
    const dx = e.clientX - startXY.current.x;
    const dy = e.clientY - startXY.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) cancel();
  };
  const onPointerUp = () => {
    if (longPressed.current) {
      // Long-press already handled — don't also fire onTap.
      cancel();
      return;
    }
    cancel();
    onTap();
  };
  const onPointerCancel = () => cancel();

  const heroPos = hand._full?.heroPosition ?? 0;
  const heroCards = hand._full?.players?.[heroPos]?.cards;
  const holeCount = holeCountOf(hand);
  const game = gameTypeOf(hand);
  const dbOn = doubleBoardOf(hand);
  const heroPosName = heroPositionOf(hand);
  const multiway = multiwayOf(hand);

  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "relative",
        padding: "12px 14px",
        borderRadius: 12,
        background: selected
          ? "oklch(0.696 0.205 155 / 0.10)"
          : BG_ELEVATED,
        border: `1px solid ${
          selected
            ? "oklch(0.696 0.205 155 / 0.5)"
            : "rgba(255,255,255,0.06)"
        }`,
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
      }}
    >
      {/* Top row — hole cards · name · star */}
      <div
        className="flex items-center"
        style={{ gap: 10, minHeight: 32 }}
      >
        {inSelectMode ? (
          <SelectionDot selected={selected} />
        ) : (
          <div
            className="flex items-center"
            style={{ gap: 2, flexShrink: 0 }}
          >
            {Array.from({ length: holeCount }, (_, i) => (
              <MiniCard
                key={i}
                card={heroCards?.[i] ?? "—"}
                size="md"
              />
            ))}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div
            className="flex items-center"
            style={{ gap: 6, minWidth: 0 }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "oklch(0.98 0 0)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}
            >
              {hand.name}
            </div>
            {isSample && (
              <span
                className="shrink-0"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "oklch(1 0 0 / 0.04)",
                  border: "1px solid oklch(1 0 0 / 0.10)",
                  color: "oklch(0.65 0 0)",
                }}
              >
                sample
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Toggle favorite"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: 0,
            color: hand.fav ? STAR_GOLD : "oklch(0.45 0 0)",
            flexShrink: 0,
          }}
        >
          <Star
            size={18}
            fill={hand.fav ? "currentColor" : "none"}
          />
        </button>
      </div>

      {/* Meta row — stake · date · game · result */}
      <div
        className="flex items-center"
        style={{
          gap: 8,
          marginTop: 6,
          fontSize: 11,
          color: "oklch(0.55 0 0)",
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span style={{ color: "oklch(0.75 0 0)" }}>
          ${hand.stakes}
        </span>
        <Dot />
        <span>{hand.date}</span>
        {heroPosName && heroPosName !== "—" && (
          <>
            <Dot />
            <span>{heroPosName}</span>
          </>
        )}
        {game !== "NLHE" && (
          <>
            <Dot />
            <span style={{ color: EMERALD_BRIGHT }}>
              {GAME_LABEL[game]}
            </span>
          </>
        )}
        {dbOn && (
          <>
            <Dot />
            <span style={{ color: EMERALD_BRIGHT }}>2B</span>
          </>
        )}
        {multiway === true && (
          <>
            <Dot />
            <span>multi</span>
          </>
        )}
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color:
              hand.result > 0
                ? EMERALD_BRIGHT
                : hand.result < 0
                  ? ROSE
                  : "oklch(0.55 0 0)",
          }}
        >
          {hand.result > 0 ? "+" : hand.result < 0 ? "−" : ""}$
          {Math.abs(hand.result).toLocaleString()}
        </span>
      </div>

      {/* Pot type · tags · board (compact) */}
      {(hand.tags.length > 0 || potTypeOf(hand) !== "LP") && (
        <div
          className="flex items-center"
          style={{
            gap: 6,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.04em",
              padding: "2px 6px",
              borderRadius: 4,
              background: "oklch(1 0 0 / 0.04)",
              color: "oklch(0.85 0 0)",
              border: "1px solid oklch(1 0 0 / 0.06)",
            }}
          >
            {potTypeOf(hand)}
          </span>
          {hand.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: "2px 6px",
                borderRadius: 4,
                background: "oklch(0.696 0.205 155 / 0.10)",
                color: EMERALD_BRIGHT,
                border: "1px solid oklch(0.696 0.205 155 / 0.20)",
              }}
            >
              {t}
            </span>
          ))}
          {hand.tags.length > 3 && (
            <span
              style={{
                fontSize: 10,
                color: "oklch(0.55 0 0)",
              }}
            >
              +{hand.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  if (hasFilters) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ padding: "60px 24px 0", gap: 10 }}
      >
        <div
          style={{
            fontSize: 14,
            color: "oklch(0.7 0 0)",
            fontWeight: 500,
          }}
        >
          No hands match.
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          style={{
            fontSize: 13,
            color: EMERALD_BRIGHT,
            background: "transparent",
            border: 0,
            padding: "6px 10px",
          }}
        >
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: "80px 24px 0", gap: 12 }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "oklch(0.92 0 0)",
        }}
      >
        No hands yet
      </div>
      <div
        style={{
          fontSize: 13,
          color: "oklch(0.55 0 0)",
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        Tap <span style={{ color: EMERALD_BRIGHT, fontWeight: 600 }}>+ Record</span>{" "}
        to record your first hand. It only takes a minute at the table.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bulk tag sheet (separate so the parent doesn't re-render on every
// keystroke)
// ─────────────────────────────────────────────────────────────────────

function BulkTagSheet({
  open,
  onOpenChange,
  existingTags,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  existingTags: string[];
  onAdd: (tag: string) => void;
}) {
  const [draft, setDraft] = useState("");
  // Reset the draft when the sheet closes so the next open is a fresh
  // input. The setState-during-render pattern avoids the lint rule.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (!open) setDraft("");
  }
  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
  };
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add tag"
    >
      <div
        className="flex flex-col"
        style={{ padding: "12px 14px 16px", gap: 12 }}
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="New tag…"
          className="w-full"
          style={{
            height: 40,
            borderRadius: 10,
            background: BG_ELEVATED,
            border: "1px solid rgba(255,255,255,0.10)",
            color: "oklch(0.92 0 0)",
            fontSize: 14,
            padding: "0 12px",
            outline: "none",
          }}
        />
        {existingTags.length > 0 && (
          <div className="flex flex-col" style={{ gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "oklch(0.55 0 0)",
              }}
            >
              Quick add
            </span>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {existingTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onAdd(t)}
                  style={{
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "oklch(1 0 0 / 0.04)",
                    border: "1px solid oklch(1 0 0 / 0.10)",
                    color: "oklch(0.92 0 0)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 12,
            background: draft.trim() ? EMERALD : "oklch(0.215 0 0)",
            color: draft.trim() ? BG : "oklch(0.55 0 0)",
            fontWeight: 600,
            fontSize: 14,
            border: 0,
          }}
        >
          Add tag
        </button>
      </div>
    </BottomSheet>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Small atoms
// ─────────────────────────────────────────────────────────────────────

function Dot() {
  return (
    <span
      aria-hidden
      style={{
        width: 2,
        height: 2,
        borderRadius: 1,
        background: "oklch(0.4 0 0)",
        display: "inline-block",
      }}
    />
  );
}

function SelectionDot({ selected }: { selected: boolean }) {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 999,
        background: selected ? EMERALD : "transparent",
        border: `2px solid ${selected ? EMERALD : "oklch(0.45 0 0)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {selected && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
        >
          <path
            d="M2 6.5L4.5 9L10 3"
            stroke={BG}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

function UserGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle
        cx="8"
        cy="5.5"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M2.5 13.5C3 11 5.2 9.5 8 9.5s5 1.5 5.5 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SheetButton({
  icon,
  label,
  sub,
  destructive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center w-full"
      style={{
        gap: 12,
        padding: "12px 16px",
        background: "transparent",
        border: 0,
        color: destructive ? ROSE : "oklch(0.92 0 0)",
        fontSize: 14,
        textAlign: "left",
        minHeight: 48,
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 28,
          height: 28,
          color: destructive ? ROSE : "oklch(0.715 0 0)",
        }}
      >
        {icon}
      </span>
      <span className="flex-1 flex flex-col" style={{ gap: 2 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {sub && (
          <span
            style={{
              fontSize: 11,
              color: "oklch(0.55 0 0)",
              fontWeight: 400,
            }}
          >
            {sub}
          </span>
        )}
      </span>
      <ChevronRight size={14} style={{ color: "oklch(0.45 0 0)" }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Filter helpers
// ─────────────────────────────────────────────────────────────────────

const emptyFilterState: FilterState = {
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

function buildFilterOptions(hands: SavedHand[]) {
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
      { value: "LP", label: "LP — limped" },
      { value: "SRP", label: "SRP" },
      { value: "3BP", label: "3-bet" },
      { value: "4BP", label: "4-bet" },
      { value: "5BP", label: "5-bet" },
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
}

function matchesFilters(
  h: SavedHand,
  f: FilterState,
  search: string,
): boolean {
  if (f.starredOnly && !h.fav) return false;
  if (f.potType.size && !f.potType.has(potTypeOf(h))) return false;
  if (f.tags.size && !h.tags.some((t) => f.tags.has(t))) return false;
  if (f.venue.size && !f.venue.has(h.loc)) return false;
  if (f.stakes.size && !f.stakes.has(h.stakes)) return false;
  if (f.players.size) {
    const pc = String(h._full?.playerCount ?? "");
    if (!pc || !f.players.has(pc)) return false;
  }
  if (f.result.size) {
    const bucket =
      h.result > 0 ? "win" : h.result < 0 ? "loss" : "breakeven";
    if (!f.result.has(bucket)) return false;
  }
  if (f.positions.size && !f.positions.has(heroPositionOf(h))) return false;
  if (f.multiway.size) {
    const m = multiwayOf(h);
    if (m === null) return false;
    const tag = m ? "yes" : "no";
    if (!f.multiway.has(tag)) return false;
  }
  if (f.gameType.size && !f.gameType.has(gameTypeOf(h))) return false;
  if (f.doubleBoard.size) {
    const v = doubleBoardOf(h) ? "double" : "single";
    if (!f.doubleBoard.has(v)) return false;
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
}

function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.starredOnly) n++;
  if (f.potType.size) n++;
  if (f.tags.size) n++;
  if (f.venue.size) n++;
  if (f.stakes.size) n++;
  if (f.players.size) n++;
  if (f.result.size) n++;
  if (f.positions.size) n++;
  if (f.multiway.size) n++;
  if (f.gameType.size) n++;
  if (f.doubleBoard.size) n++;
  return n;
}
