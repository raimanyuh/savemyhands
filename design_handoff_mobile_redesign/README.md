# Handoff: savemyhands mobile redesign

## Overview

savemyhands currently has a desktop-tuned web UI for three core surfaces — `/record` (the hand recorder), `/hand/:id` (the replayer), and `/dashboard` (the hand list). All three break down badly below ~640px: the felt squeezes, the action bar gets unreachable, the card picker popover anchors to a keyboard that isn't there, and the dashboard's wide-table layout reflows into something unreadable.

This handoff redesigns all three surfaces for mobile (portrait, ≥320px wide), with desktop UI explicitly **untouched** above 1024px. Tablet (640–1024px) reuses the existing desktop UI with minor reflow.

The redesigned surfaces are:

| Surface | Locked direction |
|---|---|
| `/record` | Vertical (PokerNow-style) felt, hero anchored bottom-center, fixed 3-button action bar (Fold/Call/Raise), full-screen modal raise sizer, bottom-sheet card picker |
| `/hand/:id` | Same vertical felt, persistent floating dock at bottom (transport + scrubber + step counter), annotation balloons that slide up from the dock |
| `/dashboard` | Card-per-hand list, sticky search + filter pill, filters as bottom sheet, long-press for select mode, FAB to start a new hand |

## About the design files

**The HTML, JSX, and CSS files in `prototype/` are design references, not production code.** They were built to communicate intended look, layout, sizing, and interaction patterns. They use plain React-via-Babel + a hand-rolled CSS file with no build step.

The task is to **recreate these designs in the savemyhands codebase** using its existing patterns — its component library, its theme system, its routing, its state management. Do not lift the JSX or CSS verbatim. Read the prototype, understand the intent, and rebuild it idiomatically.

If the codebase already has primitives that map onto these patterns (a `<Sheet>` component, a `<Button>` system, a media-query hook), use them. Only build new primitives when nothing existing fits.

## Fidelity

**High fidelity.** The prototype shows final colors (savemyhands emerald + neutrals from `reference/colors_and_type.css`), final typography (Inter / IBM Plex Mono), final spacing, final touch-target sizes, and final interaction states. Exact values are listed in the [Design tokens](#design-tokens) section below.

The one place the prototype is *not* pixel-perfect is the iPhone bezel — that's a presentation device. Ignore it. The actual mobile design is the page content rendered inside the bezel (390×844 viewport).

## Scope boundaries

**In scope:**
- New mobile layouts for `/record`, `/hand/:id`, `/dashboard` below 640px
- New shared mobile primitives where needed: `<BottomSheet>`, mobile `<ActionBar>`, mobile felt component, `<Dock>`, `<HandCard>` for dashboard
- Tablet (640–1024px) gets a one-line check: existing desktop layout + allow horizontal letterboxing of the table; meta strip wraps to two lines if cramped
- Reuse of all existing logic: state machine, hand serialization, replay annotation model, dashboard data fetching

**Out of scope — do not modify:**
- Desktop UI ≥1024px (one container-aware exception, see below)
- The hand state machine
- Keyboard shortcuts (desktop-only)
- Backend, schema, or any non-UI logic
- Authentication / signup flows (other than the anonymous-viewer CTA pill described below)
- Existing route definitions — mobile UIs render at the same routes

**Container-aware exception (≥1024px):** If the recorder's table container is rendered narrower than ~900px (e.g. user has a side panel open), the meta strip and action bar should reflow toward the mobile pattern (stacked, full-width). The felt itself stays an oval. This is an existing-logic preserve, not a new feature; verify against current behavior before making it stricter.

## Suggested file layout

I don't know the exact structure of the savemyhands repo, so these are **best-guess targets** — adjust to whatever convention the codebase actually uses. The maintainer should confirm before you start moving files.

```
apps/web/src/
  routes/
    record.tsx                  ← existing — add mobile-branch render
    hand.[id].tsx               ← existing — add mobile-branch render
    dashboard.tsx               ← existing — add mobile-branch render
  components/
    mobile/                     ← NEW — all mobile-only primitives
      MobileRecorder.tsx        ← NEW
      MobileReplayer.tsx        ← NEW
      MobileDashboard.tsx       ← NEW
      VerticalFelt.tsx          ← NEW — shared between recorder + replayer
      ActionBar.tsx             ← NEW — Fold/Call/Raise fixed bottom
      RaiseSizerModal.tsx       ← NEW — full-screen modal sizer
      CardPickerSheet.tsx       ← NEW — content-height bottom sheet
      ReplayDock.tsx            ← NEW — persistent dock with scrubber
      AnnotationBalloon.tsx     ← NEW
      HandCard.tsx              ← NEW — dashboard list row
      DashboardFilterSheet.tsx  ← NEW
      BottomSheet.tsx           ← NEW — generic primitive
    Table.tsx                   ← existing — leave alone, used desktop ≥640
  hooks/
    useIsMobile.ts              ← NEW — { isMobile, isTablet, isDesktop }
  styles/
    mobile-tokens.css           ← NEW — see Design tokens below
```

Each route file becomes a thin branch:

```tsx
// record.tsx
export default function RecordRoute() {
  const { isMobile } = useIsMobile();
  if (isMobile) return <MobileRecorder />;
  return <DesktopRecorder /* existing */ />;
}
```

Don't try to share a single component across mobile and desktop. The layouts diverge enough that a unified component becomes a switch statement. Two siblings with shared sub-primitives (Card, Plate, Bet bubble) is cleaner.

## Breakpoint mechanism

Three tiers:

| Range | Behavior |
|---|---|
| `< 640px` | Mobile. New layouts. |
| `640–1024px` | Tablet. Existing desktop layout, allow horizontal letterboxing. |
| `≥ 1024px` | Desktop. Untouched. |

**Use whatever the codebase already does.** If you find Tailwind, use `sm:` / `md:` / `lg:` modifiers and a single `useIsMobile` hook for JS branching. If you find a `useMediaQuery` already, reuse it. If there's nothing, add a small SSR-safe hook:

```tsx
// useIsMobile.ts — example only, match codebase style
export function useIsMobile() {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth
  );
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
  };
}
```

For the recorder's container-aware fallback (≥1024px but container <900px), use a `ResizeObserver` on the table wrapper or a CSS container query if the codebase already uses them. Don't refactor a JS-driven solution into CSS containers just to be modern — match what's there.

## Screens

### Screen 1 — `/record` mobile recorder

**Purpose:** Live entry of a poker hand from the felt at the casino. Speed and one-handed thumb operation matter more than anything else.

**Layout (390pt-wide reference):**

```
┌─ 48 ─ Header: ‹  Friday $1/$2 — Aces cracked     ⚙ ─┐
├─ 36 ─ Meta:  [FLOP] $48        Whale to act  Log 11 ─┤
│                                                       │
│                  felt (flex: 1)                       │
│   – portrait oval                                     │
│   – pot label + value at center-top of felt           │
│   – board cards at center                             │
│   – 6 seats positioned around the oval                │
│   – hero anchored bottom-center                       │
│   – dealer button orbits BTN seat                     │
│                                                       │
├─ 56 ─ Action bar (Fold / Call $24 / Raise) ─────────┤
└──────────────────────────────────────────────────────┘
```

**Components:**

- **Header** (48pt tall)
  - Back chevron (32×32 hit area, 24pt icon)
  - Title: hand name (16pt, weight 600, letter-spacing -0.01em, color `--fg-strong`)
  - Subtitle below title: `$1/$2 · 6-handed` (10pt, mono, color `--fg-subtle`)
  - Right: gear icon (32×32) → opens setup sheet
  - Title is tappable → opens rename sheet
  - Bottom border: 1px solid `rgba(255,255,255,0.06)`

- **Meta strip** (36pt tall)
  - Street pill (left): emerald background `oklch(0.30 0.10 155 / 0.45)`, emerald border, white text "FLOP"
  - Pot value: tabular-nums, 14pt, weight 600
  - Action hint (truncates first under pressure): "Whale to act"
  - Right: "Log 11" pill (text + count badge)
  - Background: `oklch(0.18 0 0)`

- **Felt** (`flex: 1`, fills remaining space)
  - Background: vertical gradient `oklch(0.36 0.06 155)` to `oklch(0.28 0.05 155)` with subtle radial highlight
  - Border-radius: 24px
  - Inset 1px shadow at top: `inset 0 1px 0 rgba(255,255,255,0.08)`
  - Drop shadow: `0 4px 24px rgba(0,0,0,0.4)`
  - Margin: 8px from screen edges (page bg shows around the felt)

- **Pot label** (absolute, centered horizontally, ~85px above felt center)
  - "POT" eyebrow: 10pt mono, letter-spacing 0.18em, uppercase, white at 55%
  - Amount: 22pt, weight 700, white, tabular-nums

- **Board cards** (absolute, centered)
  - 38pt × 52pt cards with 6pt corner radius
  - 4pt gap
  - Empty slots show as outlined placeholders (1pt border, white at 12%)
  - Suit colors: spades/clubs `#0a0a0a`, hearts `#dc2626`, diamonds `#dc2626` (single red for accessibility)

- **Seats** (absolute, positioned by % on portrait oval)
  - 6-handed coordinate map (in % of felt area):
    - Hero (BTN): `left: 50%, top: 92%`
    - SB: `left: 12%, top: 78%`
    - BB: `left: 12%, top: 38%`
    - UTG: `left: 50%, top: 10%`
    - HJ: `left: 88%, top: 38%`
    - CO: `left: 88%, top: 78%`
  - Seat = "plate": pill-shaped element with position abbrev + name + stack
  - Plate: background `oklch(0.18 0 0)`, border 1px `rgba(255,255,255,0.08)`, padding `4px 10px`, border-radius 999px, drop shadow `0 2px 8px rgba(0,0,0,0.4)`
  - Position label: 9pt mono, uppercase, color emerald-bright
  - Name: 12pt, weight 600, white at 92%
  - Stack: 11pt mono, tabular-nums, white at 70%
  - **Folded** state: opacity 0.45, name+stack hidden, just position pill remains
  - **Acting** state: emerald 1px ring outside the plate, soft emerald glow `box-shadow: 0 0 0 1px var(--emerald-bright), 0 0 16px oklch(0.745 0.198 155 / 0.4)`
  - Hole cards render **above** the plate for every seat, including hero
    - Other seats: 22×30 face-down or face-up (depending on showdown state)
    - Hero: 38×52 face-up
  - Bet bubble:
    - For non-hero seats: positioned **below** the plate (offset: `top: 100%, marginTop: 4px`)
    - For hero (because the board is above): positioned **below** the plate as well
    - Bubble: chip-stack icon + amount, emerald background

- **Dealer button**
  - Small white disc, 18pt diameter, "D" centered
  - Positioned on felt (not attached to any seat) — `left: 62%, top: 82%` for 6-handed BTN-as-hero
  - Animates to next position when button moves between hands

- **Action bar** (56pt tall, fixed bottom, `position: sticky`)
  - 3 buttons in a row, equal flex (or 2:2:3 ratio if call has long amount)
  - Step counter + Undo above the buttons (12pt, mono, gray, "Step 4 / 11" left, "↶ Undo" right)
  - **Fold:** background `oklch(0.20 0 0)`, border 1px `oklch(0.30 0 0)`, white text
  - **Call:** same dark style; shows amount in second line `Call · $24`
  - **Raise:** emerald background `oklch(0.696 0.205 155)`, near-black text `oklch(0.145 0 0)`, weight 600
  - Tapping Raise → opens RaiseSizerModal
  - Disabled state: opacity 0.4, no pointer events, **don't** change layout
  - Background of bar: `oklch(0.10 0 0)` with top border 1px `rgba(255,255,255,0.08)`
  - Padding: `12px 12px max(12px, env(safe-area-inset-bottom))` — respect iOS home indicator

**RaiseSizerModal (full-screen):**

- Slides up from bottom, covers whole screen
- Header: "← Cancel" left, "Raise" title centered, invisible right slot for symmetry
- Big amount display (centered): 64pt tabular-nums, "$72"
- Below amount: pot multiplier readout `1.50× pot · stk $412` (12pt mono, gray)
- Vertical slider (or horizontal, designer's choice — prototype uses horizontal)
- 5-chip preset row: `½ pot` `⅔ pot` `Pot` `1.25×` `All-in`
- Confirm button at bottom (full-width emerald, 56pt tall): "Raise to $72"
- Tapping cancel or backdrop dismisses; tapping confirm dismisses + applies

**CardPickerSheet:**

- Bottom sheet, **content-height** (NOT 85% — sheet shrinks to fit content; only caps at 85% as a safety bound)
- Grabber bar (36×4, gray, centered) at top
- Header row: "Pick a card · Hero hole 1 of 2" + Cancel button right
- Suit row: 4 buttons in a `grid-template-columns: repeat(4, 1fr)` row, 40pt tall
  - Active suit: emerald-tinted background, emerald border
  - Inactive: dark background, neutral border
- Rank grid: `grid-template-columns: repeat(7, 1fr)`, 13 ranks A→2 (last row has 6 cells, OK)
  - Each cell: 48pt min height, large rank letter (18pt) + suit symbol (14pt)
  - Card colors follow suit (red/black)
- Footer: 1px top border, two buttons row
  - "Mark as muck" (left, neutral, 44pt)
  - "Save · A♥" (right, emerald, 44pt) — label updates as the user taps

### Screen 2 — `/hand/:id` mobile replayer

**Purpose:** Read-only replay of a recorded hand, with annotations the owner has added. Anonymous viewers (link recipients) can read and get a CTA to start their own savemyhands account.

**Layout:**

```
┌─ 48 ─ Header: ‹  Friday $1/$2 — Aces cracked       ↗ ─┐
├ Anonymous-viewer CTA pill (only if not signed in) ─────┤
│                                                        │
│                  felt (flex: 1, paddingBottom: 96)     │
│   – same vertical oval as recorder                     │
│   – BUT seats compressed upward to clear the dock      │
│   – hero plate sits at top: 78% (not 92%)              │
│   – side seats sit at top: 66% (not 78%)               │
│   – dealer button at top: 70% (not 82%)                │
│                                                        │
│   – annotation balloon (when present) floats here,     │
│     between hero plate and dock, above any felt area   │
│                                                        │
├─ Persistent dock (16px from bottom, floating) ────────┤
└────────────────────────────────────────────────────────┘
```

The **dock-clearance compression** is the key insight: the felt's seat coordinates are conditional on whether a dock is present (`bottomInset > 0`). With a dock, all bottom-region seats lift by ~14% and the hero plate sits well above the dock instead of behind it. See `prototype/screens.jsx` `TableVertical()` for the exact `bottomInset`-driven coordinate swap.

**Components:**

- **Header** (48pt) — same as recorder, but right slot is share icon (↗) instead of gear
- **Anonymous-viewer CTA pill** — between header and felt, only when `!user`
  - Full-width emerald-tinted pill: "Save your own hands →"
  - 36pt tall, dismissible (sets cookie, never shows again for that visitor)
- **Felt** — same as recorder *except* the seat layout uses the lifted coordinates above
- **Annotation balloon** (when scrubber lands on an annotated step)
  - Absolute positioned, `left: 12, right: 12, bottom: 96` (just above persistent dock)
  - Background: dark with subtle emerald top border
  - Header line: emerald + dot + `note · step 04` (10pt mono)
  - Body: annotation text (13pt, weight 400, line-height 1.5)
  - Slides in from bottom with 200ms ease-out
- **Persistent dock** (floating, `position: absolute, bottom: 16, left: 12, right: 12`)
  - Background: `rgba(9,9,11,0.92)` with backdrop-blur 12px
  - Border-radius: 14px
  - Padding: 10px 12px
  - 1px border `rgba(255,255,255,0.08)`
  - Soft drop shadow + emerald glow tint
  - Layout: `[⏮] [▶] [⏭] [scrubber track] [04 / 11]`
    - Transport icons: 36pt × 36pt buttons, emerald play button
    - Scrubber track: 6pt tall, 3pt radius, gray track + emerald fill
    - Annotation dots on track: 8pt emerald discs, soft glow
    - Step counter: 11pt mono, tabular-nums, "now" segment in emerald-bright

**Owner-only edit panel (defer to maintainer):**

The brief originally called for a collapsible "Notes / Venue / Date" strip between the header and the felt for owners. **Don't implement this in v1** unless the maintainer asks — viewer parity is the priority. If you do implement it, add it as a 44pt collapsed bar below the header that expands to a sheet on tap.

### Screen 3 — `/dashboard` mobile hand list

**Purpose:** Browse, search, filter, and reopen previously recorded hands.

**Layout:**

```
┌─ 48 ─ Header: savemyhands         ☰ ──────────────────┐
├─ 56 ─ [🔍 Search hands...]   [⚙ Filters · 2] ────────┤
│                                                        │
│   Hand cards (scroll) — 6 fields per row              │
│                                                        │
│   ┌──────────────────────────────────────────────┐     │
│   │ [A♥][A♠]  Friday $1/$2 — Aces cracked    ★  │     │
│   │           $1/$2  ·  Oct 11           −$412   │     │
│   └──────────────────────────────────────────────┘     │
│   ...                                                  │
│                                                        │
│                                          ┌────────────┐│
│                                          │ ＋ Record  ││ ← FAB
│                                          └────────────┘│
└────────────────────────────────────────────────────────┘
```

**Components:**

- **Header** (48pt) — wordmark left, hamburger right (settings/account)
- **Search + filter row** (56pt, sticky below header)
  - Search input: 36pt tall, dark background, magnifying glass icon left, "Search hands..." placeholder
  - Filter pill button right: gear icon + "Filters" + count badge
  - Count badge: small emerald disc with white digit if any filters active
- **Hand card** (one per recorded hand)
  - Padding 14pt, gap 12pt between rows
  - Top row: hole cards (24×34) + hand title (15pt, weight 600) + star (right, 18pt, gold if starred)
  - Bottom row: stake (11pt mono) + date (11pt mono) + result (right, 14pt mono, emerald for win, red for loss)
  - Background: `oklch(0.16 0 0)`, border 1px `rgba(255,255,255,0.06)`, radius 12pt
  - Tap → navigates to `/hand/:id`
  - Long-press → enters select mode (header morphs to "N selected" with cancel + overflow menu)
- **Filter sheet** (bottom sheet, 40% height)
  - Triggered by the filters pill
  - Groups: Stakes / Position / Game type / Pot type / Tags / Date range / Result sign
  - Each group: title row + chip multi-select
  - Footer: "Clear all" + "Apply (12)" (count of matches)
- **FAB** (bottom-right, 24px from edges)
  - 52pt tall, full emerald, white "＋" icon + "Record" label
  - Drop shadow, sticks to scroll
  - Tap → navigates to `/record`

## Interactions & behavior

- **Sheets** (card picker, raise sizer, filter sheet, setup sheet)
  - Slide up from bottom, 280ms cubic-bezier(0.32, 0.72, 0, 1)
  - Backdrop fades in to `rgba(0,0,0,0.55)` simultaneously
  - Tap backdrop → dismiss
  - Drag grabber down 60+ pt → dismiss
  - When dismissing: reverse animation, 240ms

- **Action bar disabled states**
  - Opacity 0.4, no pointer events, **don't** change layout (same height, same gaps)
  - "Call $0" becomes "Check" when amount-to-call is 0

- **Dock annotation transitions**
  - When the scrubber crosses an annotation dot, the balloon slides up from the dock with 200ms ease-out
  - When the scrubber leaves the annotated step, balloon fades out (180ms) then unmounts

- **Long-press on dashboard cards**
  - 500ms hold to enter select mode
  - Haptic feedback on iOS (`navigator.vibrate(10)` on Android)
  - Header morphs: back → cancel; title → "3 selected"; right slot → ⋯ (Delete / Tag / Export)

- **Anonymous viewer CTA**
  - Sticky pill below header
  - Dismiss button on the right (small ×)
  - On dismiss: set cookie `smh_anon_cta_dismissed=1` (90-day expiry); pill never shows again

- **Pull-to-refresh** on dashboard list — implement if the codebase has a pattern for it; otherwise skip.

## State management

Reuse the existing state. The redesign is presentation-only.

Specifically:
- **Recorder state machine** — unchanged. The action bar reads from the same `nextActions` selector the desktop bar reads from. Tapping Raise opens the modal which writes to the same sizing reducer.
- **Replayer state** — unchanged. The dock's transport buttons drive the same `gotoStep` action the desktop buttons drive.
- **Dashboard data** — unchanged. The card list reads from the same query as the desktop table.
- **Anonymous viewer cookie** — new local state, but trivially small. A single boolean derived from `document.cookie`.

The only **new** state that's worth flagging:
- **Mobile sheet open/closed states** — local `useState` per sheet. Don't put these in global state.
- **Long-press select-mode** — local to dashboard route. Array of selected hand IDs in `useState`.

## Design tokens

Pull these into `mobile-tokens.css` (or merge with the existing theme file, whichever the codebase uses). All values are taken from `reference/colors_and_type.css` plus the prototype's mobile-specific additions.

### Colors

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.10 0 0)` | App background |
| `--bg-elevated` | `oklch(0.16 0 0)` | Cards, dock |
| `--bg-plate` | `oklch(0.18 0 0)` | Seat plates, meta strip |
| `--fg` | `oklch(0.92 0 0)` | Body text |
| `--fg-strong` | `oklch(0.98 0 0)` | Headings, titles |
| `--fg-muted` | `oklch(0.70 0 0)` | Secondary text |
| `--fg-subtle` | `oklch(0.55 0 0)` | Tertiary text |
| `--emerald` | `oklch(0.696 0.205 155)` | Primary CTA |
| `--emerald-bright` | `oklch(0.745 0.198 155)` | Highlights, dock fill, glow |
| `--felt-top` | `oklch(0.36 0.06 155)` | Felt gradient start |
| `--felt-bottom` | `oklch(0.28 0.05 155)` | Felt gradient end |
| `--border` | `rgba(255,255,255,0.06)` | 1px borders |
| `--border-strong` | `rgba(255,255,255,0.10)` | Emphasized borders |
| `--suit-red` | `#dc2626` | Hearts + diamonds (unified for accessibility) |
| `--suit-black` | `#0a0a0a` | Spades + clubs |

### Typography

| Token | Value |
|---|---|
| `--font-sans` | `Inter, -apple-system, system-ui, sans-serif` |
| `--font-mono` | `"IBM Plex Mono", ui-monospace, "SF Mono", monospace` |

Sizes used in mobile (use these, don't invent new ones):
- 22pt — pot value, section heads
- 18pt — picker rank cell rank
- 16pt — header title
- 15pt — dashboard card title
- 14pt — picker suit symbols, meta pot value
- 13pt — body text, annotation body
- 12pt — small labels, position abbrev, plate name
- 11pt — mono labels, dashboard stake/date
- 10pt — eyebrow labels, mono captions
- 9pt — pill labels, position pip

### Spacing scale

Use whatever the codebase already has (likely a 4pt or 8pt grid). The prototype uses ad-hoc values; here are the ones that matter:

- 4 — gap between card and plate
- 8 — page horizontal margin around felt; gap between board cards
- 12 — sheet/dock horizontal padding; row gap
- 16 — dock bottom inset; section vertical padding
- 24 — felt border radius
- 96 — `bottomInset` reserved for dock on the felt

### Radii

- 6 — playing card corners
- 10 — buttons in dock
- 12 — hand cards, sheet header
- 14 — dock body
- 18 — bottom sheet top corners
- 24 — felt
- 999 — pills, plates

### Shadows

- Plate: `0 2px 8px rgba(0,0,0,0.4)`
- Felt: `0 4px 24px rgba(0,0,0,0.4)` + inset highlight
- Dock: `0 8px 24px rgba(0,0,0,0.5)`
- Acting glow: `0 0 0 1px var(--emerald-bright), 0 0 16px oklch(0.745 0.198 155 / 0.4)`

### Touch targets

**Minimum 44pt** for any tap target. The prototype uses these:
- Plate (tap to edit player) — pill, height 28pt — **bump to 44pt hit area** with invisible padding when implementing
- Action bar buttons — 56pt
- Picker rank cells — 48pt min height
- Picker suit buttons — 40pt — **bump to 44pt** when implementing
- Dock transport buttons — 36pt — **bump to 44pt hit area** with invisible padding

## Test cases

Verify these scenarios work before declaring done:

1. **Recorder, 6-handed flop, BTN-as-hero, one folded villain.** Hero's pocket aces visible. Whale (SB) acting (emerald glow on plate). Pot $48, board `7♥ 2♠ J♦`. Action bar shows Fold / Call $24 / Raise.
2. **Recorder, modal sizer open, Raise tapped.** Slider, presets, confirm-to-raise. Tapping Cancel returns to felt at the same step.
3. **Recorder, card picker open, hero hole 1 of 2.** Bottom sheet hugging content (NOT 85% tall — should be ~360pt tall). Tap suit, tap rank, "Save · A♥" updates as you tap.
4. **Replayer, owner viewing, scrubber on annotated step.** Annotation balloon visible above dock. Hero plate clearly above the dock (not occluded).
5. **Replayer, anonymous viewer, no annotation.** "Save your own hands →" pill visible below header. Dock transport works.
6. **Dashboard, search "aces", 1 result, then long-press to select.** Header morphs to "1 selected" with cancel + overflow.
7. **Dashboard, FAB tap.** Navigates to `/record` for a new hand.
8. **Resize from 320px to 1280px continuously.** At 640px, layout transitions from mobile to desktop (existing). At 1024px, transitions from tablet to full desktop. No layout breaks.
9. **iPhone SE (375×667).** All sheets fit, action bar reachable, action sheet doesn't overflow viewport.
10. **iOS PWA / safe areas.** Action bar respects `env(safe-area-inset-bottom)`. Dock floats above the home indicator.

## Assets

The prototype uses no external image assets. Everything is rendered from CSS + SVG inline. Specifically:

- **Playing cards** — rendered as styled divs with rank + suit glyphs (♠ ♥ ♦ ♣)
- **Dealer button** — circular div with "D"
- **Chip stack icons in bet bubbles** — small pure-CSS or inline SVG
- **App wordmark** — text only, "savemyhands" in Inter weight 600

If the savemyhands codebase already has SVG assets for cards, the dealer button, or chip stacks, prefer those over re-rendering from CSS.

## Files in this bundle

```
design_handoff_mobile_redesign/
├── README.md                            ← this file
├── Brief.md                             ← original design brief, locked decisions, trade-offs
├── prototype/
│   ├── index.html                       ← entry point, open in browser
│   ├── screens.jsx                      ← all screen + table + sheet components
│   ├── _mobile.css                      ← mobile-specific styles (felt, plate, dock, sheet, etc.)
│   └── ios-frame.jsx                    ← iPhone bezel (presentation-only — ignore)
└── reference/
    ├── colors_and_type.css              ← full design system token sheet
    └── design_system_README.md          ← brand, voice, type system docs
```

To preview the prototype locally:
```bash
cd design_handoff_mobile_redesign/prototype
python3 -m http.server 8000  # or any static server
# Open http://localhost:8000
```

## Open questions for the maintainer

These came up during the design phase and weren't decided. Confirm before implementing:

1. **7+ handed seat coordinates.** The prototype only specifies coordinates for 6-handed. For 7, 8, 9-handed, do you want me to extend the coordinate map (cap at 8-handed feels right) or compress the y-axis further?
2. **Game-mode flag visibility on mobile meta strip.** Bomb pot / double board / PLO5 currently aren't shown on the mobile meta strip — they're only in the setup sheet. Do you want a `BP · 2B · PLO5` mono badge on the meta strip's left edge?
3. **Owner-only Notes/Venue/Date strip on the replayer.** Originally drafted but punted from v1. Implement now, or after launch?
4. **Landscape orientation.** Portrait is primary. Should we support a tuned landscape layout, or just rotate the existing tablet view?
5. **PLO 4/5 hole-card rendering.** The card-picker grid handles single cards fine; for PLO the recorder needs to capture 4 (or 5) hole cards per seat. Confirm we're using the same picker sheet sequentially (4 invocations) vs. a multi-card variant.
