@AGENTS.md

# savemyhands — Project Brief

## What This App Does
savemyhands is a live poker hand history recorder and replayer.
Users record hands they played live (in-person) using a visual
GUI, then share them via unique URLs so anyone can watch the
hand play out like an online hand history.

## Core Features
- **Recording GUI** — visual poker table; add players (seat / name / stack), pick hole cards via card picker, log street-by-street actions (fold / check / call / raise / bet), record board cards.
- **Replayer** — animated step-by-step playback on a visual table. Public-facing, no login required.
- **Share URLs** — every saved hand gets a unique URL like `savemyhands.app/hand/abc123`. Shareable, no account to view.
- **Hand database** — logged-in users see all their hands, filtered by date / location / game type / pot type (SRP / 3BP / 4BP).

## Design
GTOWizard (clean, dark, professional) crossed with PokerNow (big card buttons). Dark theme, big tactile inputs in the recorder, clean minimal replayer.

## Tech
Next.js (App Router) · Supabase (Postgres + Auth) · shadcn · Tailwind · Vercel. TypeScript everywhere.

---

## Current State (as of 2026-05-02)

Live at savemyhands.app with real users. Three core surfaces — `/record`, `/dashboard`, `/hand/[id]` — now ship a complete mobile experience below 640px alongside the unchanged desktop UI. Recent batch on top of that: **action-annotation editing** in the replayer (desktop + mobile), **mid-hand card editing** in the mobile recorder (filled hero / board / villain cards are tappable to replace), **editable hand name** on the mobile recorder header, **"Deal next street" CTA** for between-street gaps, **mobile dashboard pagination**, **`BottomSheet` mouse drag-to-dismiss**, **picker suit memory** within multi-card flows, and a **`_full` payload mirror** that prevents sibling saves from clobbering each other.

The **mobile redesign is mostly done** on `dev`. Recorder, dashboard, and replayer all ship. Remaining: auth-page restyle (`/login`, `/signup`) and the separate landing redesign (`design_handoff_landing_page/`). Everything stays on `dev` until the auth/landing passes merge to `main`.

### What's working
- **Landing page** (`/`) — anon visitors get a marketing page (hero with mini 6-handed felt, How it works, Annotations card, FAQ, footer). Signed-in visitors redirect to `/dashboard`. Lives in `components/landing/`.
- **Branding / metadata** — `app/icon.svg`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`, `app/manifest.ts`, theme color + OG defaults in `app/layout.tsx`. `metadataBase = https://savemyhands.app` (localhost links never unfurl — push to Vercel preview to test).
- **Auth** — Supabase login / signup / logout, plus Google + Discord OAuth (callback at `/auth/callback`). Pages still default-ish (v1.1).
- **Recorder** (`/record`) — state machine setup → preflop → flop → turn → river → showdown. Top: editable hand name + meta strip (`⚙ Stakes & seats` button with live summary, street pill, pot, Geist-Mono action hint, `Log {N} ▾`, Start CTA). The Stakes-&-seats trigger goes read-only outside `phase === "setup"`. Below table: 3-button action bar (Fold rose / Check-or-Call neutral / Bet-or-Raise emerald) + Undo + collapsible sizing drawer. **Pot-limit cap** in PLO: slider stops at `lastBet + (pot + toCall)`, the 1.25× chip is removed, "All-in" → "Max" capped at the pot ceiling. Keyboard: `f` fold · `c` check/call · `r`/`b` open drawer · `1-4` sizing fractions · `a` all-in (capped in PLO) · `Cmd/Ctrl-Z` undo · `Space`/`Enter` starts hand. Shortcuts skip when an input is focused. Pot type auto-classified on save (LP / SRP / 3BP / 4BP / 5BP / **BP** for bomb pots).
- **Mobile recorder** (`/record` below 640px) — sibling under `components/mobile/`, branched at the route via `RecorderShell`. Vertical felt: hero anchored bottom-center, opponents fanned counter-clockwise, hand-tuned 6/7/8-handed seat coords (cap 8). Header title is tappable → opens a rename bottom sheet. 36pt meta strip with `⚙ Setup` chip during setup, replaced by street pill once started (settings locked mid-hand). Bottom region morphs by phase: Pick-cards CTA → action bar → showdown panel → Save. When betting closes mid-hand and there's no active seat (bomb-pot preflop, between-street gaps), the action bar swaps to a single "Deal flop / turn / river (board 2)" emerald CTA. Filled hero / board / villain cards are tappable to re-open the picker for that exact slot — replacement closes the picker without auto-advancing through the rest of the row. Bet bubbles in a separate absolute layer interpolating each seat's coords toward `(50, 50)` via `chipXY`-style math. Card picker is a content-height `<BottomSheet>` (suit-then-rank); auto-advances through hero / villain / flop and persists active suit across opens. Raise sizer is full-screen modal at vh<700, inline drawer at vh≥700. Big amount field is a typeable `inputMode="numeric"` input. After a betting round closes, the picker auto-opens on the next-to-deal board slot (ref-tracked sentinel). River close auto-advances to showdown. Tablet (640-1024) reuses desktop.
- **Mobile dashboard** (`/dashboard` below 640px) — sibling `MobileDashboard` branched via `DashboardShell`. Slim 48pt header with overflow ⋯ menu (account / settings / sign out via `BottomSheet`). Sticky 56pt search row + filter pill with active-filter count badge. Card-per-hand list: hole cards · name · stake · date · result · star, plus pot-type chip and the first 3 tags when present. Long-press (500ms hold, 10px movement-cancel) enters select mode — header morphs to "N selected" with Cancel + ⋯ overflow (Tag / Share / Delete). Tap toggles selection in select mode, navigates to `/hand/[id]` otherwise. Filter sheet (chip multi-select for Position / Stakes / Players / Game / Multiway / DB / Result / Pot type / Tags / Venue + Starred-only toggle) stages edits in a draft and commits on Apply. List paginates in 100-card chunks with a "Load N more" button to keep first paint fast for power users. Emerald `+ Record` FAB bottom-right.
- **Mobile replayer** (`/hand/[id]` below 640px) — sibling `MobileReplayer` branched via `ReplayerShell`. Slim 48pt header (back · hand name + stakes/handed subtitle · share icon). Anonymous-viewer CTA pill below header, dismissible via 90-day cookie (`smh_anon_cta_dismissed`). Same `VerticalFelt` as the recorder with `bottomInset={96}` so seats compress upward and clear the floating dock. Synthesizes a `FeltViewState` per replay step (hides villain hole cards pre-showdown, reveals at showdown unless mucked / folded). Floating dock pinned to viewport bottom: street pill + truncated action label, prev / play-pause / next transport, scrubber with annotation dots (tap to jump), step counter. Annotation balloon slides up + fades in (200ms ease-out) when the current step has a note; persists during fade-out via a pinned-state pattern. Share sheet (`BottomSheet`): copy link + (owner-only) Public/Private toggle (auto-copies link when going public).
- **Action annotation editing** (desktop + mobile) — owner-only Edit pencil inside the balloon. Desktop edits inline (Esc cancels, Cmd/Ctrl+Enter saves; auto-cancels if user scrubs to a different step). Mobile opens an edit `BottomSheet` with a textarea + Save/Cancel. Empty-text + Save deletes the annotation. Optimistic local override via `useAnnotationEdit`; server roundtrip merges all in-session edits to avoid clobbering. Uses a lifted `livePayload` mirror so subsequent unrelated saves (notes, etc.) build their patches off the latest annotations.
- **Card picker** — single-click row + stable picker + active-slot gesture. Click anywhere on a hero / villain / board row → opens picker on first empty slot, anchored to the row container, stays put through auto-advance (only the active-slot emerald pulse moves). Keyboard: rank-letter (A/K/Q/J/T/9-2) jumps to that rank in the same suit column, arrow keys navigate the 4×13 grid, Enter picks, Esc closes. X-button clears one card; all-filled rows ignore clicks (force X-first edit).
- **Game variants** — **Bomb pot** (every player antes a flat amount, no preflop, action opens on flop). **Double board** (two boards stacked, parallel reveals each street, even split with quartering on chops). **PLO 4 / 5** (4 or 5 hole cards, `evaluateBestOmaha` enforces 2-from-hand + 3-from-board, fanned hole-card render, pot-limit raise math). All three compose — a PLO5 bomb-pot double-board hand records, replays, and pays out correctly.
- **Showdown** — per-villain Show / Muck. Auto-determined winner via 7-card eval (NLHE) or `evaluateBestOmaha` (PLO). Side-pot decomposition handles multi-way all-ins (`computeSidePots` + `awardPots` / `awardPotsMultiBoard` + `seatWinnings`); pot-by-pot breakdown rendered when there are 2+ pots. Double-board step gets a verbose label (`BTN wins board 1 ($X) · UTG wins board 2 ($Y)` with split / quartering variants). Pot reflects uncalled-bet refunds. Save disabled until all villains decided AND boards complete.
- **Replayer** (`/hand/[id]`) — server-rendered, public-readable. Floating media-player dock at the bottom (action summary, transport, scrubber with annotation dots, step counter, Log popover). Anchored note balloon for annotated steps. Hand-level Notes / Venue / Date panel; owners get inline edit. Both boards stack when `_full.doubleBoardOn`. Hero / villain hole cards render as fan when PLO. Card backs match hole-card count. 4-color deck, SMH wordmark on backs.
- **Bet / check bubbles** — `BetBubble` in `components/poker/table-pieces.tsx` is the single source. Omit `label` for chip+pill `$X`; pass `label="check"` for no-chip pill. Both reset between streets and disappear when the seat folds.
- **Equity** — replayer header toggle reveals showed villains and overlays per-seat equity badges at the current step's board. Two badges per seat in double-board mode. Precomputed at save time (`_full.equityByStep` + `equityByStep2`). PLO equity uses the Omaha evaluator. Skipped pre-flop (1.7M runouts).
- **Custom dialogs** — `components/ui/confirm-dialog.tsx` exports `ConfirmDialogProvider` + `useConfirm()`. Imperative async API. Mounted at root via `app/providers.tsx`. Replaces every `window.confirm`. `Header.onBack` accepts an async return so back-link can hold navigation.
- **Sharing** — hands default private. Owners flip Lock/Globe in replayer header (auto-copies URL on Public). Bulk Share from `/dashboard` marks selected hands public via `setHandsPublicAction`, then copies `Name — URL\n…` to clipboard (`window.prompt` fallback if clipboard write denied). Anon viewers get a "Save your own hands → Sign up" CTA.
- **Dashboard** (`/dashboard`) — 16-column layout: select / star / Name / Date / Venue / Stakes / Position / Game / Hand / Multiway / DB / Pot type / Board / Tags / Result / ⋯. Hand column shows hero's 2 / 4 / 5 mini-cards in a single 122px row. Board column stacks board1 + board2 mini-cards in DB mode. Sortable, filterable (Positions / Stakes / Players / Multiway / Result / Tags / Pot type / Venue / Game / DB), search, inline rename, click-through. Bulk action bar: Tag / Share / Delete / Clear. Per-row `⋯` menu (Edit details / Delete). `SAMPLE_HANDS` shown only at zero saved hands.
- **Sizing** — recorder + replayer wrap the table in `max-width: calc((100vh - chrome) * 2)`. Recorder chrome = 440px, replayer chrome = 280px. Notes textarea defaults `min-h-[80px]`. `z-20` on the meta strip stacks above seat plates' `-top-14` card-back overflow.
- **Design tokens** — `app/globals.css` `.dark` block uses pure neutral charcoal (chroma 0). Inter as `--font-sans`. Emerald `oklch(0.696 0.205 155)` is the only saturated UI accent. Wood-rail / emerald-felt gradients stay warm hex literals. Some inline `text-[oklch(... 60)]` arbitrary classes still live in `Recorder.tsx` / `Replayer.tsx` (intentional, dashboard-only neutralization sweep).

### Code map
- `components/poker/engine.ts` — `RecorderState`, reducer, `deriveStreet`, `formatAction`. Chip math: `committedBySeat` / `committedBySeatFinal` (with per-street uncalled-bet refund), `totalPot` / `totalPotFinal`, `computeSidePots`. Stack-aware throughout. **Cycle-indexed** (BTN=0, SB=1, BB=2, …). Variant flags: `bombPotOn` / `bombPotAmt`, `doubleBoardOn` / `board2`, `gameType: "NLHE" | "PLO4" | "PLO5"`. Helpers `holeCardCount(gameType)`, `isPotLimit(gameType)`. localStorage key `smh:defaults`.
- `components/poker/hand.ts` — `SavedHand` (row + `_full`), `ReplayHand`, `recordedToHand` (per-step `streetBetsAfter` / `committedAfter` snapshots embedded for the replayer; bomb-pot ante step + double-board parallel reveals + verbose DB showdown labels), `derivePotType`, `potTypeOf` ("BP" first if `bombPotOn`).
- `components/poker/hand-eval.ts` — `evaluateBest` (NLHE) and `evaluateBestOmaha` (PLO 4 / 5; must-use-2-from-hand + 3-from-board). `determineWinner`, `awardPots`, `awardPotsMultiBoard`, `seatWinnings` — all take optional `gameType` (default `"NLHE"`).
- `components/poker/equity.ts` — `computeEquity`, `precomputeEquityByStep`. Run twice in DB mode → `_full.equityByStep` + `equityByStep2`.
- `components/poker/lib.ts` — `seatXY`, `chipXY`, `POSITION_NAMES`, `preflopOrder`, `postflopOrder`. Ring `RING_A=43, RING_B=40`. Visual rotation: `cycleIdx = (heroPosition + visualI) % N`.
- `components/poker/table-pieces.tsx` — `BetBubble`, `DealerButtonChip`, `NameDisplay`, `StackDisplay`, `TableSurface`.
- `components/poker/PlayingCard.tsx` — flat 4-color deck (♠ black, ♣ green, ♦ blue, ♥ red).
- `components/poker/FannedPlayingCard.tsx` — corner-indices design used **only** when fanned (PLO).
- `components/poker/HandFan.tsx` — shared read-only renderer (`cards`, `size`, `fan`, `faceDown`). Used by Replayer and Recorder. `±7°` rotation + 14/18px offset step.
- `components/poker/CardPicker.tsx` — `CardSlot` (legacy single) + `CardRow` (multi-slot row + picker, stable anchor, optional `fan`). Picker keyboard nav lives here.
- `components/poker/Recorder.tsx` — desktop recorder. Inline `NumericInput`, `Kbd`, `StreetPill`, `MetaStrip`, `SetupPopover`, `ActionBar` (PLO: `½/⅔/Pot/Max`; NLHE: `½/⅔/Pot/1.25×/All-in`), `ActionLog`. `resolvedAwards` memo dispatches to `awardPots` / `awardPotsMultiBoard`.
- `components/poker/RecorderShell.tsx` — branches `/record` between `Recorder` and `MobileRecorder` via `useIsMobile`.
- `components/mobile/MobileRecorder.tsx` — top-level mobile recorder. Reuses engine reducer + derivations; only UI is parallel. Owns auto-advance effects, picker auto-open sentinel, `nextDealSlot` memo (shared by auto-open and the Deal CTA), rename sheet, and the `usedCards` memo that excludes the current picker target's card so replacement isn't blocked.
- `components/mobile/VerticalFelt.tsx` — portrait-ellipse felt. Local `MobileFannedCard` (PLO) and `CardFace`/`CardBack` (NLHE) sized off `CARD_DIM` (sm 30×42 villain, md 44×62 hero). `bottomInset` lifts seats for the replayer dock. Bet bubbles in a separate absolute layer. Filled card faces accept `onClick` so the recorder can re-open the picker on a specific slot. Exports `FeltViewState` — a `Pick<RecorderState, …>` subset of the engine state — so the replayer can drive the same felt with a synthesized state object instead of a real reducer.
- `components/mobile/CardPickerSheet.tsx` — bottom-sheet picker, suit-then-rank with Unicode glyphs (engine format). `SUIT_COLOR_ON_DARK` / `SUIT_COLOR_ON_LIGHT` split. Active suit persists across opens (no per-open reset) so multi-card flows in the same suit save taps.
- `components/mobile/RaiseSizer.tsx` — `ModalSizer` at vh<700, `DrawerSizer` at vh≥700. Shared `useSizerControls` mirrors desktop ActionBar math.
- `components/mobile/SetupSheet.tsx` — bottom-sheet replacement for desktop `SetupPopover`. Same controls + Save/Load defaults.
- `components/mobile/MobileDashboard.tsx` — top-level mobile dashboard. Owns search / filters / select-mode / pagination state; delegates mutations to the same server actions as desktop. Long-press detection via pointer events with a 10px movement-cancel threshold. Pagination resets on filter/search change via a sorted filter-key sentinel.
- `components/mobile/DashboardFilterSheet.tsx` — bottom-sheet filter UI. Stages chip toggles in a draft; Apply commits, Clear all resets the draft. Match-count footer reflects the parent's currently-applied count.
- `components/mobile/MobileReplayer.tsx` — top-level mobile replayer. Owns step + transport state, anon-CTA dismissal cookie, share-sheet open state, annotation edit-sheet state, and the `livePayload` payload mirror for save coherence. Synthesizes a `FeltViewState` per step.
- `components/mobile/ReplayDock.tsx` — fixed-position floating dock (12px from edges, respects safe-area-inset-bottom). Two rows: street pill + truncated action label, then transport + scrubber + step counter. 4pt scrubber track with emerald annotation dots (tap to jump).
- `components/mobile/AnnotationBalloon.tsx` — slide-up balloon above the dock when the current step has a note. setState-during-render mount + delayed unmount sidesteps the React 19 lint rule. `pinned`-state pattern keeps the text visible during fade-out. Optional `onEdit` callback (owner-only) renders the Edit pencil.
- `components/ui/bottom-sheet.tsx` — generic `<BottomSheet>`. setState-during-render with sentinel + delayed-unmount via setTimeout (sidesteps `react-hooks/set-state-in-effect` while still rendering during slide-down). Drag-to-dismiss uses pointer events (with `setPointerCapture`) so mouse drags work in DevTools alongside real touch.
- `lib/use-is-mobile.ts` — `useIsMobile()` via `useSyncExternalStore` subscribed to **both** `resize` and `matchMedia`. SSR snapshot = `desktop`. Breakpoints: `<640` mobile, `640-1024` tablet, `≥1024` desktop.
- `lib/recorder/save-hand.ts` — `buildAndSaveHand({ state, resolvedAwards, heroPos, heroPosName })`. Build payload → yield frame for "Saving…" paint → precompute equity (board1, board2 if DB) → `saveHandAction` → return id. Shared by desktop + mobile recorders. No React, no router, no alerts — call sites wrap in their own `useTransition` + navigation.
- `lib/replayer/use-annotation-edit.ts` — shared hook for action-annotation editing. Owns the local override map, builds patches that merge all in-session edits, calls `updateHandDetailsAction`, and lifts the resulting `_full` back to the parent's mirror so sibling saves stay coherent. Used by both desktop `Replayer` and `MobileReplayer`.
- `components/poker/Replayer.tsx` — `ReplayerInner` owns transport, dock, log popover, anchored note balloon. Renders both boards / fanned PLO hands / two equity badges per seat as needed. Annotation balloon now has an owner-only Edit pencil with inline textarea (auto-cancels on step change). Holds `livePayload` mirror so notes-and-annotation saves don't clobber each other's `_full` writes.
- `components/poker/Dashboard.tsx` — 16-column grid (`ROW_COLS` arity 16). Helpers (`gameTypeOf` / `holeCountOf` / `doubleBoardOf` / `MiniCard` / `SAMPLE_HANDS`) live in `dashboard-shared.tsx` and are re-imported here so the mobile sibling can use the same derivations. `TagPopover` shared between bulk and per-row.
- `components/poker/dashboard-shared.tsx` — derivation helpers + `MiniCard` + `SAMPLE_HANDS` shared between the desktop `Dashboard` and `MobileDashboard`. `MiniCard` accepts an optional `size: "sm" | "md"` (default `sm` matches desktop dimensions).
- `components/poker/RecorderShell.tsx`, `DashboardShell.tsx`, `ReplayerShell.tsx` — route-level branches via `useIsMobile`. Mount the mobile sibling below 640px, otherwise mount the desktop component. All three follow the same pattern.
- `components/ui/confirm-dialog.tsx` — `ConfirmDialogProvider` + `useConfirm()`. Esc cancels, Enter confirms, click-outside cancels, focus auto-routes to Cancel for destructive prompts.
- `components/ui/checkbox.tsx` — `<button role="checkbox">` (don't use native; size inherits inline-layout context).
- `components/Shell.tsx` — page shell + header. `Header.onBack` accepts `Promise<boolean | void>`.
- `components/landing/{HeroTable,Faq,LandingPage}.tsx` — landing composition.
- `components/auth/OAuthButtons.tsx` — Google + Discord buttons.
- `app/layout.tsx` — wraps `<Providers>` + sets `viewport.themeColor` / `metadata.metadataBase` / `metadata.title.template` / OG defaults / `appleWebApp` / `applicationName`.
- `app/providers.tsx` — `"use client"` wrapper hosting `<ConfirmDialogProvider>`.
- `app/icon.svg`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx`, `app/manifest.ts` — branding routes.
- `app/{record,dashboard,hand/[id],page,auth/callback}` — routes (server components; surfaces are client children).
- `lib/hands/db.ts` — `listMyHands`, `getHand`, `getHandForViewing`, `countMyHands`, `insertHand`, `updateHandDetails`, `setHandPublic`, `setHandsPublic` (bulk via `IN (...)`), `deleteHand`, `deleteHands`.
- `lib/hands/actions.ts` — `'use server'` wrappers; revalidate `/dashboard` (+ `/hand/<id>` where relevant).
- `supabase/migrations/` — `0001_hands.sql`, `0002_private_by_default.sql`, `0003_bomb_pot_type.sql` (must be applied before any bomb-pot save succeeds in prod). Apply via Supabase Dashboard → SQL Editor (no CLI installed).

### Persistence
- Single `hands` table: column-mirrored metadata (name, stakes, date_display, hero_position, multiway, board, pot_type, tags, result, fav, notes, is_public) + `payload` jsonb (full RecorderState shape: players, actions, board with nulls, blinds, heroPosition, straddle, **bombPotOn / bombPotAmt**, **doubleBoardOn / board2**, **gameType**, muckedSeats, notes, venue, date, annotations, **equityByStep / equityByStep2**).
- `pot_type` CHECK: `('BP', 'LP', 'SRP', '3BP', '4BP', '5BP')`. Migration 0003 must be applied or bomb-pot saves fail.
- All `_full` variant fields are optional — older saves round-trip cleanly as NLHE single-board.
- RLS: SELECT = `is_public OR auth.uid() = user_id`. INSERT/UPDATE/DELETE = owner-only via `auth.uid() = user_id`.
- Hands default `is_public = false`. Bulk-share via `setHandsPublic(ids, true)` over an `IN (...)` update.
- `smh:defaults` localStorage shape: `{ playerCount, sb, bb, straddleOn, straddleAmt, bombPotOn, bombPotAmt, doubleBoardOn, gameType, defaultStack }`. Read/write via `engine.readSetupDefaults` / `writeSetupDefaults`.
- **Result backfill outstanding.** Hands saved before the `resolvedAwards`-from-state fix have `result = -heroPaid` even when hero won. Replayer reconstructs winners correctly via `awardPots` at view time, but the dashboard column is wrong for those rows. Either rewrite via one-time server action, or compute at render-time. Decision deferred.

---

## Mobile redesign — in progress

Multi-PR rollout on `dev`, periodically merged to `main`. Specs in `design_handoff_mobile_redesign/` (recorder / replayer / dashboard) and `design_handoff_landing_page/` (landing). Architecture: sibling components under `components/mobile/`, branched at the route via `useIsMobile` (≥640 → desktop, <640 → mobile). Tablet (640-1024) reuses desktop. State lives in the engine reducer (recorder) or in the existing server-fetched data (dashboard / replayer); only UI is parallel.

### Shipped
- ✅ **Foundation** — `lib/use-is-mobile.ts`, `<BottomSheet>` (with pointer-event drag-to-dismiss for mouse + touch), mobile design tokens.
- ✅ **Mobile recorder** (`/record`). `saveHand` extracted to `lib/recorder/save-hand.ts` for sharing.
- ✅ **Mobile dashboard** (`/dashboard`). Card-per-hand list, search + filter sheet, long-press select mode + bulk Tag/Share/Delete, FAB → `/record`, paginated in 100-card chunks. Helpers extracted to `dashboard-shared.tsx`.
- ✅ **Mobile replayer** (`/hand/[id]`). `VerticalFelt` with `bottomInset={96}`, floating `ReplayDock`, `AnnotationBalloon` slide-up, anon-CTA pill (cookie-dismissible), share sheet (copy link + owner-only public toggle). Owner Notes/Venue/Date strip is deferred to v1.1.
- ✅ **Action-annotation editing** in both replayers. Inline textarea on desktop, bottom-sheet textarea on mobile. Optimistic + server-merged via `useAnnotationEdit`.

### Remaining (suggested order, separate PRs)
1. **Auth pages** (`/login`, `/signup`) — neutral charcoal + Inter; mobile-friendly responsive pass. OAuth buttons already lay out fine; form chrome needs work.
2. **Landing redesign** — separate scope. New design in `design_handoff_landing_page/` (sample hand embedded, simpler structure). New app-icon font from that handoff to apply across favicon / OG / Twitter / manifest as a polish pass.

### Open questions deferred
- 9+ handed mobile felt — capped at 8.
- Owner Notes/Venue/Date on mobile replayer — punted from v1, mirror desktop pattern if user feedback asks.
- Tuned mobile-landscape recorder layout — not built; auto-rotates the tablet layout.

## v1.1 backlog (post first user test)

1. **Result backfill** — see Persistence note.
2. **Auth-page styling.** (Tied to the mobile rollout — see "Mobile redesign — in progress".)
3. **Owner Notes/Venue/Date strip on the mobile replayer.** Deferred from v1; mirror the desktop pattern.
4. **Bet-sizing presets aware of blinds** (`2.5×` / `3×` / `pot + 1bb per limper`). Drawer's `chips: { id, label, amount }[]` is already extensible; mobile `RaiseSizer` shares the shape via `useSizerControls`.
5. **Edit gameplay actions on a saved hand** (today only metadata + annotations are editable; re-recording is the workaround for actual play changes).
6. **Add new annotations from the replayer.** Edit currently only fires when a balloon is visible (existing annotation). Adding a brand-new annotation to an unannotated step still requires going back to the recorder.
7. **Action-only stepping** in the replayer (skip board reveals).
8. **Replay speed control** (1.1s/step is hardcoded).
9. **Per-hand OG image** at `app/hand/[id]/opengraph-image.tsx`.
10. **Per-route titles** (template `%s — savemyhands` already wired).
11. **`robots.ts` / `sitemap.ts`.**
12. **Player-name autocomplete across hands.**
13. **Toast primitive** to replace ~6 remaining `window.alert` calls.
14. **Per-row Add tag** still uses `window.prompt`; can reuse `TagPopover`.
15. **Sweep remaining warm `oklch(... 60)` arbitrary classes** in Recorder/Replayer.
16. **Apply new app-icon font** across branding assets.

### Done since 2026-04-28 snapshot
- ✅ Mobile dashboard (`/dashboard` <640px) — `MobileDashboard` + `DashboardFilterSheet` + `DashboardShell`. Helpers extracted to `dashboard-shared.tsx`.
- ✅ Mobile replayer (`/hand/[id]` <640px) — `MobileReplayer` + `ReplayDock` + `AnnotationBalloon` + `ReplayerShell`. `VerticalFelt`'s state prop loosened to a `FeltViewState` subset so the replayer can synthesize one per step.
- ✅ Action-annotation editing in desktop + mobile replayers — `useAnnotationEdit` hook with optimistic local override, in-session edit merge, and a lifted `livePayload` mirror that prevents notes-and-annotation saves from clobbering each other.
- ✅ Mobile recorder card editing — filled hero / board / villain cards are tappable to re-open the picker for that slot. Replacement closes the picker without auto-advancing. `usedCards` excludes the current target so re-picking the same card isn't blocked.
- ✅ Mobile recorder editable hand name — header title is a button that opens a rename `BottomSheet`.
- ✅ Mobile recorder "Deal next street" CTA — when betting is closed and there's no active seat (bomb-pot preflop, between-street gaps after the picker is dismissed), the action bar swaps to a single emerald CTA that re-opens the picker on the next-to-deal slot. Extracted `nextDealSlot` shared by the auto-open effect and the CTA.
- ✅ Mobile recorder picker suit memory — picker no longer resets to ♠ on every open; suit persists across multi-card flows.
- ✅ Mobile dashboard pagination — first 100 hands rendered with a "Load N more" button to extend in 100-hand chunks. Sorted filter-key sentinel for stable resets.
- ✅ `BottomSheet` mouse drag-to-dismiss — pointer events with `setPointerCapture` replace the touch-only handlers.

## Long-term wishlist

Direction notes, not committed:
- **Hand-history import** (PokerNow / Stars text dumps) — biggest velocity unlock.
- **Live hand-strength label** in the replayer ("Top Pair Top Kicker", "OESD + flush draw").
- **Action-shape filters** ("3-bet from BB and folded the flop"). Today filters are metadata-only.
- **Range pre-fills** for villain (Pio 13×13) feeding equity.
- **Session grouping** + per-session net + filters.
- **Stat dashboard** (VPIP/PFR/AF/win-rate-by-position) once a user has ~50 hands.

---

## Operating notes for future agents

### General
- Every interactive surface is `"use client"`. Server components only fetch auth + render shell.
- Don't ship hands data via `useEffect(() => setState(...), [])` — `react-hooks/set-state-in-effect` blocks it. Use `useState(() => readLocalStorage())` lazy init with a `typeof window !== "undefined"` guard.
- Refs accessed during render trip the lint rule too. For popovers anchored to clicked elements, set `anchor` from `e.currentTarget` in the click handler — don't read `ref.current` in JSX.
- React 19's `react-hooks/refs` also forbids *writing* a ref during render (rules out `cacheRef.current.set(k, …)` inside `useMemo`). Compute the whole cache eagerly inside `useMemo` and return a `Map` directly — see equity precompute in `Replayer.tsx`.
- Engine is **cycle-indexed** end to end. Every render-time conversion goes through `(heroPosition + visualI) % N` (cycle from visual) or `(cycleIdx - heroPosition + N) % N` (visual from cycle). Hero is always visual slot 0; hero's *cycle* index is `state.heroPosition` and changes via record-swap when the user picks a different position in setup.
- The 7-card evaluator only runs once `state.board.filter(Boolean).length === 5`.
- **Never use native `<input type="checkbox">`.** Use `components/ui/checkbox.tsx` — native inherits sizing from inline-layout context, so it renders different sizes in `h-9` vs `h-11` rows.
- **Recorder popover state lives on the `Recorder` component** (`setupPopoverOpen`, `logOpen`). `MetaStrip` is controlled — the parent dims the table behind the popover. Outside-click handlers live inside `MetaStrip` next to each ref, but the boolean lives upstream.
- **Keyboard shortcuts skip when input/textarea/contenteditable is focused.** Don't add new shortcuts without preserving that guard. Per-action keys (`f`/`c`/`r`/`b`/`1-4`/`a`) live in `ActionBar`; `Cmd/Ctrl-Z` lives at the `Recorder` level so it works during showdown / deal CTAs too.
- **`BetBubble` is the single source for both bet and check bubbles.** Omit `label` for chip+pill `$X`; pass `label="check"` (or any text) for no-chip pill. Chip token is gated on `label === undefined`.
- **Action annotations** — `_full.annotations` is keyed by *action index* (the action's position in `_full.actions`), NOT by step index. `ReplayStep.actionIndex` carries the original index for action steps so the replayer can patch the right key. Editing flow lives in `lib/replayer/use-annotation-edit.ts`; both desktop `Replayer` and `MobileReplayer` use it. New annotations can only be entered via the recorder today; the replayer balloon's Edit/Add only renders when a note already exists for that step.
- **`_full` payload coherence — lift-and-mirror.** Each `updateHandDetailsAction` call that includes `_full` overwrites the `payload` jsonb column entirely. If a feature builds its patch from the stable `fullPayload` *prop*, a later sibling save will revert the first save's `_full` writes (e.g. a notes save after an annotation edit silently rolled back the annotation in the database). Both `Replayer` and `MobileReplayer` keep a `livePayload` state mirror initialized from the prop and updated after every successful save. All `_full`-touching saves read from and write back to `livePayload`. When adding a new feature that patches `_full`, do the same — never use `fullPayload` directly in a save.
- **Setup defaults localStorage key is `smh:defaults`** (the V4b handoff renamed it to `smh:recorderDefaults` and got reverted to keep existing user defaults working). `readSetupDefaults` provides safe defaults for partial JSON.
- **Game-variant flags compose.** A PLO5 bomb-pot double-board hand is valid and tested. Each flag's reducer is independent (`setGameType` resizes player.cards; `setDoubleBoard` blanks board2 on toggle-off; `setBombPot` only flips the flag — `streetCommits` preflop branch checks `bombPotOn` and skips SB/BB/straddle). New variant pattern: optional `_full` field, default-off in `initialState`, optional in `SetupDefaults`, dispatch from `SetupPopover`, branch in helpers that need it.
- **Picker single-click + stable anchor.** `CardRow` is one click target. All-filled rows ignore clicks (force X-first edit). X buttons stop propagation. New picker call sites: pass `cards` / `onPick` / `onClear` / `autoAdvanceCount` / optional `fan`. Don't add per-slot `onClick`.
- **Hand-eval / award helpers all take optional `gameType`** (default `"NLHE"`). When wiring a new caller, pass `state.gameType` (or `f.gameType ?? "NLHE"` from a saved hand). Forgetting silently runs NLHE eval against PLO hole cards — wrong winners with no warnings.
- **Pot-limit clamp.** ActionBar uses `maxAllowed = isPotLimit(gameType) ? min(allInAmount, lastBet + (pot + toCall)) : allInAmount`. Slider, amount input, chip set, shortcuts (`a`, `4`) all key off `maxAllowed`. PLO chip set: `½/⅔/Pot/Max`.
- **`useConfirm` is async — `Header.onBack` returns `Promise<boolean | void>`.** Link click pattern: `e.preventDefault()`, await, then `router.push(href)`. Mirror this for any destructive flow elsewhere.
- **`z-20` on the meta strip is load-bearing.** Top-seat hole-card backs sit at `-top-14` from their seat-plate transform, overflowing into the strip's bottom half. Without `z-20`, seat wrappers' `z-10` intercept clicks.
- **Numeric inputs use `<NumericInput>`** (uncontrolled, blank-while-typing, blur-commits). Don't use `<Input type="number" value={x} onChange={...}>` — `Number("")` is `0` and React snaps the field back.
- **Recorder showdown panel and replayer `recordedToHand` both run `awardPots` / `awardPotsMultiBoard`.** Keep them in sync when adding a variant. Same for `determineWinner`.
- **`metadataBase = https://savemyhands.app`.** Localhost links never unfurl. Push to a Vercel preview to test social cards.

### Mobile-specific
- **Card-id format is rank + Unicode-glyph suit (`"K♠"`)** everywhere — engine, equity, hand-eval, picker, felt. Letter suits (`"Ks"`) are silently rejected by the engine and present as cards-never-appearing-on-felt. New picker call sites mirror `SUITS = ["♠", "♥", "♦", "♣"]`.
- **Spade glyph color depends on background.** Dark surface (suit row) → near-white. White card face → near-black. `SUIT_COLOR_ON_DARK` / `SUIT_COLOR_ON_LIGHT` split. A single shared color collapsed spades to white-on-white the first time around.
- **`useIsMobile` subscribes to BOTH `resize` and `matchMedia`.** Chrome DevTools' device toolbar sometimes doesn't fire `resize` when swapping presets; `matchMedia` fires reliably.
- **`<BottomSheet>` mount/unmount uses setState-during-render with sentinel + delayed-unmount via setTimeout** to sidestep `react-hooks/set-state-in-effect` while still rendering during the slide-down animation.
- **Mobile and desktop recorders share state ONLY via the engine reducer.** Sibling component trees, no shared instance. Shared surface: `lib/recorder/save-hand.ts` (save) + `engine.ts` (reducer + derivations). To share UI logic, prefer a hook over a shared component.
- **Default villains have `cards: null`.** Don't derive expected hole-card count from `villain.cards.length` — use `holeCardCount(state.gameType)`. The mobile recorder hit this twice (PLO villain backs as 2 cards; villain showdown picker auto-advance closing after first card on length-0 array).
- **Mobile felt's bet bubbles render in a separate absolute layer**, interpolating each seat toward `(50, 50)` (`t = 0.45` for hero so it clears the hole-card row, `0.30` elsewhere) — same idea as desktop's `chipXY`.
- **Picker auto-open uses a `useRef` sentinel** keyed on `(phase, slot, boardIdx)` so dismissing doesn't trigger immediate re-open. Manual taps on a board slot bypass via `openBoardSlot`.
- **Settings access hides during play.** Gear button only in `phase === "setup"` (matches desktop's `SetupPopover` going read-only outside setup).
- **Mobile fanned cards use `MobileFannedCard` (local to `VerticalFelt.tsx`)**, not the shared `FannedPlayingCard`. Tuned smaller so 5-card PLO5 fans on 8-handed side seats fit. Don't bump the shared component to "fix" mobile — it'll break the desktop replayer.
- **`VerticalFelt` is shared across recorder + replayer via `FeltViewState`** — a `Pick<RecorderState, …>` subset of the engine state. The recorder passes its full reducer state (assignable to the subset); the replayer synthesizes one per step (hides villain hole cards pre-showdown by setting their `cards` to null, sets `phase` to either `"showdown"` or any non-showdown value to drive face-down/face-up branching). When you add a felt feature that needs a new state field, update `FeltViewState` to include it AND update the replayer's synthesizer to populate it.
- **Long-press on mobile dashboard cards** uses pointer events with a 500ms timer and a 10px movement-cancel threshold. iOS callout/selection is suppressed via `WebkitTouchCallout: "none"` + `WebkitUserSelect: "none"`. The Star button on each card stops pointer-event propagation so tapping the star doesn't start a long-press. Don't drop those guards.
- **Mobile dashboard pagination resets on filter/search change** via a sorted filter-key sentinel. Set iteration is insertion-order, so the key sorts each set's values before joining — without that, toggling the same chip off + back on would churn the key and reset the page count for no semantic change.
- **Vercel preview is attached to `dev`** — push and the preview rebuilds. Mobile redesign all lands there before merging to `main`.
