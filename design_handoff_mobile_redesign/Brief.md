# Mobile redesign — savemyhands

**v2 · locked direction.** This brief follows the variant review with the maintainer:

| Surface | Pick | Notes |
|---|---|---|
| 01 / Record — table layout | **A · Vertical (PokerNow-style)** | Felt-centric, hero bottom-center, opponents on portrait oval |
| 02 / Record — action / sizer | **C · Full-screen modal** | Tapping Raise opens a dedicated sizing screen |
| 03 / Record — card picker | **Bottom sheet, content-height** | No longer 85%; sheet shrinks to just suit row + 7-col grid + footer |
| 04 / Replay — dock | **A · Persistent**, hero plate lifted clear | Dock floats; felt seats compress upward so dock can't occlude hero stack |
| 05 / Dashboard | **Card list as designed** | No changes |

The prototype at `prototypes/mobile/index.html` now shows the recorder in three states (idle, raising-with-modal, card-picker) and the replayer in three viewer states (annotated step, plain step, anon viewer with signup pill).

## Breakpoint strategy

Three tiers, container-aware where it matters:

| Range | Behavior |
|---|---|
| `< 640px` | **Mobile.** All redesigns below kick in. Single-column. Bottom-sheet patterns. Touch targets ≥ 44px. Portrait primary. |
| `640–1024px` | **Tablet / compact desktop.** Existing desktop UI but with the table allowed to letterbox horizontally; meta strip wraps to two lines if needed. |
| `≥ 1024px` | **Desktop.** Untouched. Current shipping UI. |

The recorder gets one **container-driven exception**: even at 1024px+, if the table container is < 900px wide (e.g. the user has a side panel open), it falls back to mobile-table behavior — the meta strip and action bar reflow, but the felt stays oval. This is what protects the keyboard-shortcut workflow on real desktops while gracefully handling sidebars.

The dashboard breaks at 768px — below that, it's the card list. No tablet middle ground for the table; 16 columns simply do not fit.

## /record — recorder

### Recommended primary direction
**Vertical (PokerNow-style) table + fixed action bar + bottom-sheet card picker + full-screen modal sizer.** Locked: variant A (table) + variant C (sizer). The full-screen sizer trades inline thumb-tuning for an unambiguous, focused screen — better at avoiding misclicks during fast live-game entry, and it leaves the felt unobscured for context-checking.

### Layout spec (390pt portrait, 6-handed NLHE)

```
┌─ 48 ─ Header: ‹  Friday $1/$2 — Aces cracked  ⚙ ─┐
├─ 36 ─ Meta:  [FLOP] $48        Whale to act  Log 11 ─┤
│                                                       │
│                ┌────────────────┐                     │
│                │   ●  UTG       │                     │
│                │  reg_3 (folded)│                     │
│                └────────────────┘                     │
│  ┌────────┐                       ┌────────┐          │
│  │  ●  HJ │       pot $48         │  CO ●  │          │
│  │ folded │                       │ folded │          │
│  └────────┘   [7♥] [2♠] [J♦]      └────────┘          │
│  ┌────────┐                       ┌────────┐          │
│  │ SB ●   │     ($24 bet)         │  ● BB  │          │
│  │ Whale  │       acting          │ fish_4 │          │
│  │ $1,240 │                       │  $210  │          │
│  └────────┘                       └────────┘          │
│                                                       │
│              ┌──────────┐                             │
│              │ BTN · You│  ★ dealer button            │
│              │   $412   │                             │
│              └──────────┘                             │
│                [A♥][A♠]                               │
│                                                       │
├─ Sizer drawer (when raising) ────────────────────────┤
│ $72  ─ slider ─                  1.50× pot · stk $412│
│ [½ pot] [⅔ pot] [Pot] [1.25×] [All-in]               │
├─ Action bar (fixed) ─────────────────────────────────┤
│  Step 4 / 11                              ↶ Undo     │
│  ┌────────┐ ┌────────┐ ┌──────────────────┐          │
│  │ Fold   │ │ Call   │ │ Raise to $72     │          │
│  │        │ │  $24   │ │ tap to confirm   │          │
│  └────────┘ └────────┘ └──────────────────┘          │
└──────────────────────────────────────────────────────┘
```

### Element placement
- **Header (48pt)** — back, hand name + stakes-dot-handed subtitle, gear (opens setup sheet with stakes / seats / straddle / variant flags). Setup sheet replaces the desktop ⚙ Stakes & seats popover.
- **Meta strip (36pt)** — street pill (emerald), pot value, action hint (truncates first if cramped), Log button. The "Start hand" CTA from desktop becomes a one-time bottom sheet on first entry, then the bar takes over.
- **Felt (flex)** — vertical oval. 6 seat positions on a portrait ellipse. Hero anchored bottom-center, holes below the plate. Dealer button orbits at hero's seat for the button, otherwise tracks the seat to hero's right.
- **Sizer flow** — tapping Raise opens a **full-screen modal**: pot label at top, big tabular-nums amount, vertical slider with multiplier readout (`1.50× pot · stk $412`), 5-chip preset row, big confirm + cancel buttons. Returns to the felt on confirm.
- **Action bar (fixed bottom, 56pt buttons)** — Fold / Call (with amount) / Raise. Step counter + Undo above the row.
- **Card picker** — bottom sheet, **content-height** (no fixed 85% — sheet sizes to suit row + 7-col rank grid + footer). Suit row (4 buttons, 40pt) on top, 7-column rank grid (AA–22) with 48pt cells, Muck + Save buttons in a fixed footer. The sheet caps at 85% of the viewport for safety but otherwise hugs its content so the felt remains visible above it.

### Where things go on mobile (vs desktop)
| Desktop element | Mobile placement |
|---|---|
| ⚙ Stakes & seats popover | **Setup sheet** triggered from header gear |
| Inline editable hand name | **Header title** — tap to edit in a sheet |
| Single-line meta strip | Same row, but `Log` and `Start hand` collapse into icon buttons |
| 3-button action bar (below table) | Same buttons, **fixed bottom**, taller (56pt vs 44pt) |
| Bet sizing drawer | **Full-screen modal** (your pick) — opens on Raise tap, dismisses on confirm/cancel |
| Card picker popover | **Bottom sheet, content-height** (caps at 85%) |
| Hidden behind menus | None of this — mobile keeps every primary verb visible |

### State machine handling
The street pill is the source of truth. Bomb-pot variant skips the preflop pill. Double-board mode renders the felt with **two stacked board rows** (38px cards become 32px) and the pot label shows two values (`pot $48 / $48`). The state machine itself is unchanged from desktop; only the rendering reflows.

### PLO 4/5 + double board worst case
**Auto-reduce, don't side-scroll.** Confirmed direction:
- PLO4 — fan stays at 4, hole-card width drops from 22px to 18px.
- PLO5 — fan compresses to 5 cards within 60px (overlap factor 0.5 instead of 0.75).
- Double board — the two boards stack vertically inside the felt center, separated by a 1px white/8% rule. Pot label shows totals split.
- PLO5 + bomb pot + double board (the worst case) — fits, but the felt is dense. The action bar gets a "1 of 2" pot indicator so users know which board their action targets.

Side-scroll was rejected: it breaks the spatial map of the table, and you'd lose the dealer button orientation.

## /hand — replayer

### Locked dock direction
**Persistent dock**, bottom anchored, 16px from edge. The original draft had the dock floating over the hero plate; that's now fixed by reserving a `paddingBottom: 96px` on the felt and compressing the seat ellipse upward when a dock is present (`bottomInset > 0`). The hero plate sits at ~78% of the felt instead of 92%, the side seats follow it up, and the dealer button orbits accordingly. The dock then floats clear over empty space below the plate.

Auto-hiding (B) and split (C) are dropped from the prototype — persistent A is the locked direction.

### Dock anatomy
```
┌─ 12 ─ ⏮ ▶ ⏭   ●━━━━━○━━━━━━━●━━━●━━━   04 / 11 ─┐
└────────────── (annotation dots on track) ──────────┘
```
- 36pt transport icons.
- 6pt scrubber track with **annotation dots** (emerald, 8pt) at annotated steps.
- Step counter (mono, tabular-nums) right.
- Width: full minus 24px page gutters. Detached, floating with shadow + emerald glow tint.

### Annotation balloon placement
On mobile, **dock-attached** (above the dock) — small viewports can't reliably anchor a balloon to a specific seat without occluding the felt. The balloon shows step number and note text, slides in/out as the scrubber crosses annotation dots. On the felt itself, an emerald dot marks which seat/action the note is *about*; the balloon is the prose.

For PLO5 double-board hands, the balloon also tags which board (`note · step 04 · board 2`).

### Anon viewer signup CTA
Pill at top, beneath the header: `Save your own hands →`. Non-intrusive, dismissible (sets a cookie). Selected per your answer to that question.

### Owner-only edit panel
Owners get a `Notes / Venue / Date` strip *between* the header and the felt — collapsible, 44pt collapsed (just the venue + date in mono), expands to a sheet. Viewers don't see this row at all.

## /dashboard

### Card-per-hand list
Six visible fields per row: **hole cards · name · stake · date · result · star**. Pot type, position, tags, board, multiway, DB — all behind a row tap that opens a detail sheet (or navigates to /hand).

```
┌────────────────────────────────────────────────────┐
│ [A♥][A♠]  Friday $1/$2 — Aces cracked          ★  │
│           $1/$2  ·  Oct 11           −$412         │
└────────────────────────────────────────────────────┘
```

### Filter UI
Bottom sheet, triggered by the pill in the search row. The pill shows a small emerald badge with the count of active filters. Filters group: Stakes / Position / Game / Pot type / Tags / Date range / Result sign. Multi-select chips. "Apply" + "Clear" in fixed footer.

### Search
Always visible at top (sticky). 36pt input. Filter pill to the right.

### Bulk actions
Long-press a card → enters select mode. The header morphs to "N selected" with a Cancel left and a ⋯ overflow right (Delete / Tag / Export). This replaces the desktop bulk-action bar.

### FAB
Single emerald FAB bottom-right: `＋ Record`. Pinned to scroll, 52pt tall.

## Cross-cutting patterns

### Bottom sheet (the universal escape hatch)
- Triggered by anything that on desktop would be a popover or a wide drawer.
- Default heights: `40%` (filters), `60%` (sizer modal, setup), `85%` (card picker).
- 36×4 grabber, 18px corner radius, 1px white/10% top border + radius shadow.
- Header row: title left, Cancel right (text button, no background).
- Footer row when there's a primary action: full-width emerald button.

### Action bar (3-button)
- Always Fold / Call / Raise. Always 56pt tall on mobile.
- Disabled buttons gray out without dimming the bar (so the layout doesn't shift).
- `Undo` lives in the step-counter row above the buttons, not inline (avoids accidental misfires).
- Bet sizing drawer always animates in/out; never replaces the bar.

### Card picker
- Bottom sheet, 85%.
- Suit row (4 large buttons, 40pt) at the top — toggling the suit re-renders only the rank grid (no re-mount).
- Rank grid 7 columns, AA–22 reading order. 56pt min cell height. Last cell of last row reserved for **Muck**.
- Footer: Cancel + `Save · A♥` (the second updates as you tap).

### Header
Slim 48pt as you picked. Three slots: back / title / overflow. Title doubles as a short subtitle slot (mono, 9pt, `$1/$2 · 6-handed`) — this saved a row vs putting stakes on the meta strip.

## Trade-offs and open questions

1. **Vertical-oval seat math at 7+ handed.** I designed the layouts file with explicit coordinates for 6-handed. 7, 8, 9-handed layouts need their own coordinate maps — at 9-handed, side seats start to crowd the dealer button. Decision needed: cap mobile at 8-handed (auto-hide one seat as a "+1" pill that opens a sheet), or compress the y-axis further? My instinct is to cap.

2. **Sizing drawer vs modal at small phone heights.** On a 568pt iPhone SE, the drawer + action bar + meta + header eats > 240pt. Drawer wins my vote everywhere ≥ 700pt; below that, the modal pattern (variant C) is strictly better. I recommend a **height-aware fallback**: drawer if `vh ≥ 700`, modal if smaller.

3. **Dock placement during annotation**. When a balloon is showing, the dock can either *stay put* or *get pushed up* by the balloon. I went with stay-put + balloon-floats-above. This means the balloon overlaps the bottom of the felt. Alternative: push the dock down 4–6pt and shrink. Worth a hallway test.

4. **Game-mode flag visibility on mobile.** Bomb pot / double board / PLO are fundamental but invisible until you open the setup sheet. On the desktop meta strip there's room for a `BP · 2B · PLO5` mono badge. Consider adding the same badge to mobile, far-left of the meta strip — it's two characters typically. I left it out of the prototype to avoid clutter; want your call.

5. **Landscape orientation.** Portrait is primary. Landscape on mobile is *better* for the table itself (wider felt) but worse for the action bar (thumb travel). I'd hold off on a custom landscape layout until usage tells you it matters; auto-rotate the existing tablet layout for now.

6. **Anon CTA placement when split-dock is in play.** The top scrubber bar in split-dock conflicts with the anon CTA pill. If we converge on persistent-dock A, this becomes moot. Otherwise we'd move the pill down to dock-row level.

## What's in the prototype

- `prototypes/mobile/index.html` — section-by-section presentation of all variants, in iPhone frames at 390×844.
- 5 sections: table layout (3 variants), action bar (3 variants), card picker (1), replayer dock (3 variants), dashboard (1).
- Each phone is a fully-rendered React mock — interactions are static where they don't change layout, live where they do (sizer slider, picker suit toggle).
