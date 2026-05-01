@AGENTS.md

# savemyhands — Project Brief

## What This App Does
savemyhands is a live poker hand history recorder and replayer.
Users record hands they played live (in-person) using a visual
GUI, then share them via unique URLs so anyone can watch the
hand play out like an online hand history.

## Core Features

### 1. Hand Recording GUI
- Visual poker table interface (not text input)
- User can add players, assign seat positions, names, stack sizes
- Input hole cards using a card picker UI (like PokerNow's big
  card buttons)
- Record street-by-street actions: fold, check, call, raise,
  bet with amounts
- Support for preflop, flop, turn, river
- Record board cards for each street

### 2. Hand Replayer
- Replay recorded hands like an online poker hand history
- Animated, step-by-step playback on a visual poker table
- Show actions, pot size, stack sizes updating in real time
- Public-facing — no login required to view a shared hand

### 3. Unique Share URLs
- Every saved hand gets a unique URL (e.g. savemyhands.vercel.app/hand/abc123)
- Shareable on social media
- Anyone can view without an account

### 4. User Hand Database
- Each logged-in user sees all their recorded hands
- Filter by: date, location, game type
- Filter by hand type: SRP (single raised pot), 3BP (3-bet pot),
  4BP (4-bet pot)
- Eventually: win/loss tracking, notes per hand

## Design Direction
- Visual style: mix of GTOWizard (clean, dark, professional)
  and PokerNow (big card UI, easy to use)
- Dark theme
- Big, tactile card and action buttons for the recording GUI
- Clean minimal replayer

## Tech Stack
- **Framework**: Next.js (App Router)
- **Database & Auth**: Supabase (PostgreSQL)
- **UI Components**: Shadcn
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

## Database Tables (to be created in Supabase)
- `users` — handled by Supabase Auth
- `hands` — one row per recorded hand
- `hand_players` — players in each hand (seat, name, stack)
- `hand_actions` — action-by-action log per hand
- `hand_streets` — board cards per street

## Coding Conventions
- Use TypeScript throughout
- Use Supabase client for all database operations
- Use Shadcn components for all UI elements where possible
- Keep components small and reusable
- Pages go in /app directory following Next.js App Router conventions

## Build Priority Order
1. Auth (login/signup via Supabase)
2. Hand recording GUI
3. Hand save + unique URL generation
4. Hand replayer
5. User hand database/dashboard
6. Filtering

---

## Current State (as of 2026-05-15)

The app is live at savemyhands.app with real users. Major batch of work since the 2026-04-28 snapshot has shipped: **bug fixes from user feedback** (all-in-for-less display, dashboard / replayer result mismatch), a **custom confirm-dialog primitive** replacing every `window.confirm`, **viewport-aware sizing** so the recorder + replayer don't overflow on laptop screens, **branding / SEO metadata** (favicon, OG image, Twitter card, manifest, theme color), and three new game variants: **Bomb pots**, **Double board**, and **PLO 4 / 5** (Pot-Limit Omaha) with proper pot-limit raise math, the must-use-2-from-hand evaluator, and a fanned-card hole-card layout. The dashboard gained a Hand column (hole cards), a Game column + filter, and a DB (double-board) column + filter.

### What's working
- **Landing page** (`/`) — anon visitors get a real marketing page (hero with miniature 6-handed felt, How it works in 3 cards, Annotations feature card, FAQ accordion, footer). Signed-in visitors still redirect to `/dashboard`. Lives at `components/landing/`.
- **Branding / metadata** — `app/icon.svg` (charcoal rounded square with bold lowercase "smh" in emerald), `app/apple-icon.tsx` (180×180 PNG via `next/og`), `app/opengraph-image.tsx` + `app/twitter-image.tsx` (1200×630 social cards), `app/manifest.ts` (PWA web-app-manifest), and `viewport.themeColor` + Open Graph defaults in `app/layout.tsx`. `metadataBase` is `https://savemyhands.app`, so social unfurls work in prod once changes ship to main. Default Next.js `favicon.ico` placeholder was deleted.
- **Auth** — Supabase login / signup / logout, plus OAuth via Google and Discord (buttons on `/login` and `/signup`, callback at `/auth/callback`). Still uses default-ish styling (one of the v1.1 polish items).
- **Recorder** (`/record`) — full state machine: setup → preflop → flop → turn → river → showdown. Top of page: editable hand name, then a single-line **meta strip** with `⚙ Stakes & seats` button (live summary like `PLO5 · Bomb pot $20 · 8-max` or `$1/$2 · 6-max · straddle $5`, opens a popover with every setup control + Hero position picker + Save/Load default; **the trigger goes read-only outside `phase === "setup"`** so settings can't be flipped mid-hand), street pill, pot, Geist-Mono action hint, `Log {N} ▾` button (opens the action-log popover), and a **Start hand CTA** visible only during setup. **`Space` / `Enter` starts the hand** when hero hole cards are filled (skips when an input or button is focused). Below the table: 3-button action bar (Fold rose / Check-or-Call neutral / Bet-or-Raise emerald) with `Undo` ghost on the right and a collapsible **sizing drawer** above it. **Pot-limit cap**: in PLO mode the slider hard-stops at `lastBet + (pot + toCall)`, the 1.25× chip is removed, and the All-in chip is renamed "Max" with its amount capped at the pot ceiling. NLHE is unchanged. Keyboard shortcuts: `f` fold, `c` check/call, `r`/`b` open drawer + focus amount, `Enter` in input commits, `1`-`4` set sizing fractions (4 falls back to pot in PLO), `a` all-in (capped to pot in PLO), `Cmd/Ctrl-Z` undo. Shortcuts skip when an input is focused. Pot type auto-classified on save (LP / SRP / 3BP / 4BP / 5BP / **BP** for bomb pots).
- **Card picker UX** — single-click row + stable picker + active-slot gesture. Clicking *anywhere* on a hand / board row opens the picker on the first empty slot; the picker anchors to the row container and **stays put** through auto-advance, with an emerald pulsing ring on the active slot to gesture toward what the next pick will fill. Inside the picker, **keyboard navigation**: rank-letter (A / K / Q / J / T / 9-2) jumps to that rank in the same suit column when possible, arrow keys move within the 4×13 grid, `Enter` picks, `Esc` closes, modifier keys (Cmd/Ctrl-Z) pass through. Picker auto-opens after a betting round closes. X-button on a filled card clears it. All-filled rows ignore clicks (force X-first edit). Applies uniformly to hero hole cards, villain reveal cards, and the flop / turn / river slots.
- **Game variants** — **Bomb pot** (every player antes a flat amount, no preflop, action opens on flop / SB-equivalent). **Double board** (two boards stacked vertically on the felt; auto-open chains board 1 → board 2 each street; pot splits evenly with quartering on chops). **PLO 4 / 5** (4 or 5 hole cards, `evaluateBestOmaha` enforces the 2-from-hand + 3-from-board rule, hero / villain hole cards render as a fanned hand using `FannedPlayingCard` corner-indices design, pot-limit raise math). All three variants compose: a PLO5 bomb-pot double-board hand records, replays, and pays out correctly.
- **Showdown** — per-villain Show / Muck. Auto-determined winner via 7-card evaluator (NLHE) or `evaluateBestOmaha` (PLO 4 / 5). Side-pot decomposition handles multi-way all-ins (`computeSidePots` + `awardPots` / **`awardPotsMultiBoard`** + `seatWinnings`); pot-by-pot breakdown rendered when there are 2+ pots. Double-board showdown step gets a verbose label (`BTN wins board 1 ($X) · UTG wins board 2 ($Y)` with split / quartering variants). Pot displayed reflects uncalled-bet refunds. Save disabled until all villains decided AND boards are complete (both boards in double-board mode).
- **Replayer** (`/hand/[id]`) — server-rendered, public-readable. Floating media-player dock at the bottom (action summary, transport, inline scrubber with annotation dots, step counter, Log popover). Anchored note balloon for annotated steps. Hand-level Notes/Venue/Date panel; owners get inline edit. **Renders both boards** stacked when `_full.doubleBoardOn`. **Renders hero / villain hole cards as a fan** when game is PLO. Card backs match the hole-card count (5 face-down for PLO5 villains pre-showdown). 4-color deck, SMH wordmark on card backs.
- **Action / check bubbles** — players that put chips in the pot get a chip+pill `$amount` bubble between their seat and the felt center. Players that **check** get the same dark pill labeled `check` (no chip token) in the same spot. Both reset between streets and disappear when the seat folds. Lives in `components/poker/table-pieces.tsx` `BetBubble`.
- **Equity** — replayer header toggle reveals showed villains and overlays per-seat equity badges at the current step's board. **Two badges per seat** in double-board mode (board 1 / board 2). Equity is precomputed at save time (`_full.equityByStep` + `_full.equityByStep2` for double board), so back/forth nav is a pure lookup. PLO equity uses the Omaha evaluator. Skipped pre-flop (1.7M runouts).
- **Custom dialogs (no `window.confirm`)** — `components/ui/confirm-dialog.tsx` exports `ConfirmDialogProvider` + `useConfirm()`. Imperative API (`await confirm({ title, message, destructive })`). Mounted at the root via `app/providers.tsx`. Used for delete / discard / leave-without-saving / bulk-share confirmation. Shell `Header.onBack` accepts an async return so the back link can hold navigation while the dialog resolves.
- **Sharing** — hands default private. Owners see a Lock/Globe toggle in the replayer header; toggling Public also auto-copies the URL to clipboard. Anon viewers can open a public hand directly; private hands and unknown ids return 404. **Bulk Share from `/dashboard`** marks every selected hand public via `setHandsPublicAction`, then copies a `Name — URL\n…` newline-separated list to the clipboard (with `window.prompt` fallback if clipboard write is denied). Anon viewers see a "Save your own hands → Sign up" CTA in place of owner controls.
- **Dashboard** (`/dashboard`) — server-fetches the signed-in user's hands. **16-column layout**: select / star / Name / Date / Venue / Stakes / Position / Game / Hand / Multiway / DB / Pot type / Board / Tags / Result / ⋯. The **Hand column** renders hero's 2 / 4 / 5 mini-cards in a single 122px row. **Board column** stacks board1 + board2 mini-cards when `_full.doubleBoardOn`. Sortable Name/Date/Venue/Stakes/Result columns, a Starred toggle, filter popovers (Positions / Stakes / Players / Multiway / Result / Tags / Pot type / Venue / **Game** / **DB**), search, inline rename, favorite star, click-through to replayer. **Bulk action bar** at the bottom when rows are selected: `{N} selected | Tag (popover w/ existing-tag chips + new-tag input) | Share | Delete | Clear`. Per-row `⋯` menu (Edit details / Delete). Inline tag-add per row uses the same `TagPopover` (anchored *below* the row's `+` chip). Bundled `SAMPLE_HANDS` shown only when the user has zero saved hands.
- **Numeric inputs** — `NumericInput` helper in `Recorder.tsx` is uncontrolled (`defaultValue` + blur-to-commit), so deleting all digits leaves the field blank instead of snapping to "0". Empty/invalid commits to 0 on blur. Used for SB / BB / Straddle / Bomb-pot ante.
- **Sizing** — recorder + replayer wrap the table in a viewport-height-aware container (`max-width: calc((100vh - chrome) * 2)`). Recorder's chrome estimate is **440px** (header + meta strip + below-table action bar with drawer open + paddings); replayer's is **280px** (no action-bar / notes row, dock is fixed-position). Container `py-4` / `gap-3` keeps chrome compact; the action bar's Fold/Call/Raise row is guaranteed visible at any reasonable laptop size. Notes textarea defaults to `min-h-[80px]` (was 200) so the below-table row doesn't dominate. `z-20` on the meta strip ensures it always stacks above seat plates' `-top-14` card-back overflow.
- **Design tokens** — `app/globals.css` `.dark` block uses **pure neutral charcoal** (chroma 0, hue 0). Inter as `--font-sans`. Emerald `oklch(0.696 0.205 155)` is the only saturated UI accent. The wood-rail and emerald-felt gradients on the table surface stay warm hex literals. A handful of inline `text-[oklch(... 60)]` arbitrary classes still live in `Recorder.tsx` / `Replayer.tsx` — left intentionally during the dashboard-only neutralization sweep.

### Code map (key files)
- `components/poker/engine.ts` — `RecorderState`, reducer, `deriveStreet`, `formatAction`. Chip math: `committedBySeat` (raw, for live recorder display) / `committedBySeatFinal` (with per-street uncalled-bet refund), `totalPot` / `totalPotFinal`, `computeSidePots`. All commit math is stack-aware (caps at `stack[seat] − prev-commit`; short-stack all-ins for less than the current bet don't lower `lastBet`). State is cycle-indexed (BTN=0, SB=1, BB=2, …). **Game-variant flags**: `bombPotOn` / `bombPotAmt` (skip preflop, every player antes), `doubleBoardOn` / `board2` (parallel board), `gameType: "NLHE" | "PLO4" | "PLO5"`. Helpers `holeCardCount(gameType)` and `isPotLimit(gameType)`. `setBombPot`, `setDoubleBoard`, `setGameType` reducer events; the last resizes every player's `cards` array. `setupDefaults` localStorage round-trip (key `smh:defaults`) includes all variant flags. `loadSetup` honors gameType-driven card resize.
- `components/poker/hand.ts` — `SavedHand` (row + `_full` payload), `ReplayHand` (replayer input), `recordedToHand` (per-step `streetBetsAfter` / `committedAfter` snapshots so the replayer reads chips with stack caps already applied; embeds bomb-pot ante step + double-board parallel reveals + verbose double-board showdown labels), `computeStreetBets`, `committedThroughStep` (now lookup helpers reading the embedded snapshots), `hasFolded`, `derivePotType` (LP / SRP / 3BP / 4BP / 5BP), `potTypeOf` (returns "BP" first when `_full.bombPotOn`).
- `components/poker/hand-eval.ts` — `evaluateBest` (best 5-of-7, NLHE) and **`evaluateBestOmaha`** (must-use-2-from-hand + 3-from-board, PLO 4 / 5). `determineWinner`, `awardPots`, **`awardPotsMultiBoard`** (splits each pot evenly across boards; quartering falls out of `seatWinnings` automatically), `seatWinnings` — all accept an optional `gameType` (default `"NLHE"`) for evaluator dispatch.
- `components/poker/equity.ts` — `computeEquity(contestants, board, gameType)` enumerates runouts. `precomputeEquityByStep(hand, boardKey, gameType)` runs at save time; called once for board 1 and again for board 2 in double-board mode. Stored as `_full.equityByStep` + `_full.equityByStep2`.
- `components/poker/lib.ts` — `seatXY`, `chipXY`, `POSITION_NAMES`, `preflopOrder`, `postflopOrder`. Seats on ellipse `RING_A=43, RING_B=40`. Visual rotation: `cycleIdx = (heroPosition + visualI) % N`.
- `components/poker/table-pieces.tsx` — `BetBubble` (chip+pill, with `isHero` nudge; `label` prop swaps to no-chip mode for check bubbles), `DealerButtonChip`, `NameDisplay`, `StackDisplay`, `TableSurface`.
- `components/poker/PlayingCard.tsx` — 4-color deck primitive (♠ black, ♣ green, ♦ blue, ♥ red). NLHE / flat-row mode.
- `components/poker/FannedPlayingCard.tsx` — corner-indices card design (rank + suit pinned top-left, larger center suit watermark, white face). Used **only** when fanned (PLO 4 / 5 hole cards). Sizes `sm` / `md` match flat `PlayingCard`.
- `components/poker/HandFan.tsx` — shared read-only renderer. Takes `cards`, `size`, `fan`, `faceDown`. Used by Replayer (hero / villain hole cards, pre-showdown card backs) and by Recorder (pre-showdown villain card backs). Fan layout uses `±7° per card` rotation + `14 / 18px offset step` so 4-5 cards fit inside a seat plate.
- `components/poker/CardPicker.tsx` — `CardSlot` (single slot, legacy) and `CardRow` (multi-slot row + picker). **Single-click model**: row is a single hit area, opens picker on first empty slot, X button per filled card to clear individually. **Stable picker anchor**: anchors to the row container (`containerRef`), stays put across auto-advance — only the active slot's emerald ring slides between cards. **Fan mode**: `fan` prop renders cards in a rotated overlap using `FannedPlayingCard`. Picker keyboard nav lives inside `CardPicker`: rank-letter jumps, arrow keys, Enter, Esc.
- `components/poker/Recorder.tsx` — Inline components: `NumericInput` (uncontrolled, blank-while-typing, blur-commits-or-zero), `Kbd`, `StreetPill`, `MetaStrip` (locks to read-only outside `setup`), `SetupPopover` (Game chips at top: NLHE / PLO4 / PLO5; Players / Blinds [disabled in bomb pot] / Straddle [disabled in bomb pot] / Bomb pot / Double board / Stack + Apply to all / Hero position [setup-only] / Save & Load default footer), `ActionBar` (`maxAllowed = isPotLimit(gameType) ? min(allIn, lastBet + (pot + toCall)) : allIn`; chips are `½/⅔/Pot/1.25×/All-in` for NLHE and `½/⅔/Pot/Max` for PLO; slider hard-stops at `maxAllowed`), `ActionLog`. `resolvedAwards` memo dispatches to `awardPots` / `awardPotsMultiBoard` based on `state.doubleBoardOn`, threading `state.gameType`.
- `components/poker/Replayer.tsx` — Inline `ReplayerInner` owns transport, dock, log popover, anchored note balloon. Renders both boards stacked when `_full.doubleBoardOn`; renders fanned hands via `HandFan` when `gameType` is PLO. Two equity badges per seat in double-board mode. Header shows `Bomb pot $X NLHE` / `$sb/$bb NLHE` with PLO label cases.
- `components/poker/Dashboard.tsx` — 16-column grid (`ROW_COLS` arity = 16). Helpers `gameTypeOf` / `holeCountOf` / `doubleBoardOf` derive variant flags from `_full`. Hand column shows mini-cards in a single 122px row. `BulkTagPopover` renamed to `TagPopover` and shared between bulk and per-row tag editing. Bulk action bar wires `Tag` / `Share` / `Delete` (Duplicate dropped). `setHandsPublicAction` for bulk-share atomic update. New filters: `gameTypeFilter`, `doubleBoardFilter`. `PlainHeader` accepts `align: "left" | "center" | "right"`.
- `components/ui/confirm-dialog.tsx` — `<ConfirmDialogProvider>` + `useConfirm()`. Imperative API: `await confirm({ title, message?, confirmLabel?, cancelLabel?, destructive? })`. Esc cancels, Enter confirms, click-outside cancels, focus auto-routes to Cancel for destructive prompts. Replaces every `window.confirm`.
- `components/ui/checkbox.tsx` — `<button role="checkbox">` with an overlaid `Check` glyph. Don't use native `<input type="checkbox">` (sizing inherits from inline-layout context).
- `components/Shell.tsx` — page shell + header. **`Header.onBack` accepts a `Promise<boolean | void>`** so async confirmations (the new ConfirmDialog) can hold navigation while the dialog resolves.
- `components/landing/HeroTable.tsx` — presentational 6-handed felt for the landing hero. Exports `HeroTable` and `HeroPlayingCard`.
- `components/landing/Faq.tsx`, `components/landing/LandingPage.tsx` — landing composition.
- `components/auth/OAuthButtons.tsx` — Google + Discord buttons.
- `app/layout.tsx` — wraps `<Providers>` + sets `viewport.themeColor` / `metadata.metadataBase` / `metadata.title.template` / OG defaults / `appleWebApp` / `applicationName`.
- `app/providers.tsx` — `"use client"` wrapper hosting `<ConfirmDialogProvider>` (and any future client-wide providers).
- `app/icon.svg` — favicon (charcoal rounded square + emerald "smh" wordmark).
- `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/twitter-image.tsx` — dynamic `next/og` `ImageResponse` routes.
- `app/manifest.ts` — web app manifest (PWA).
- `app/record/page.tsx`, `app/dashboard/page.tsx`, `app/hand/[id]/page.tsx`, `app/page.tsx` — routes (all server components; recorder/dashboard/replayer surfaces are client children).
- `app/auth/callback/route.ts` — OAuth code-for-session exchange.
- `lib/hands/db.ts` — `listMyHands`, `getHand`, `getHandForViewing`, `countMyHands`, `insertHand`, `updateHandDetails`, `setHandPublic`, **`setHandsPublic`** (bulk via `IN (...)`), `deleteHand`, `deleteHands`.
- `lib/hands/actions.ts` — `'use server'` wrappers: `saveHandAction`, `updateHandDetailsAction`, `setHandPublicAction`, **`setHandsPublicAction`**, `deleteHandAction`, `deleteHandsAction`. All revalidate `/dashboard` (+ `/hand/<id>` where relevant).
- `supabase/migrations/` — `0001_hands.sql` (table + RLS + `updated_at` trigger), `0002_private_by_default.sql` (`is_public` + owner-or-public SELECT policy), **`0003_bomb_pot_type.sql`** (drops + recreates the `pot_type` CHECK constraint to include `'BP'`). Apply via Supabase Dashboard → SQL Editor (no CLI installed). **0003 must be applied before any bomb-pot save will succeed in prod.**

### Persistence
- **Postgres-backed** via Supabase. Single `hands` table with column-mirrored metadata (name, stakes, date_display, hero_position, multiway, board, pot_type, tags, result, fav, notes, is_public) plus a `payload` jsonb column carrying the full RecorderState (`_full` shape: players, actions, board with nulls, blinds, heroPosition, straddle, **bombPotOn / bombPotAmt**, **doubleBoardOn / board2**, **gameType** (`"NLHE" | "PLO4" | "PLO5"`), muckedSeats, notes, venue, date, annotations, **equityByStep / equityByStep2**).
- **`pot_type` CHECK constraint**: `('BP', 'LP', 'SRP', '3BP', '4BP', '5BP')` — `BP` is set explicitly by the recorder when `state.bombPotOn`, otherwise `derivePotType(actions)` runs. **Migration 0003 must be applied before bomb-pot saves succeed.**
- **All `_full` variant fields are optional** — older saves predate them and round-trip cleanly as standard NLHE single-board hands. The replayer / hand-eval / equity helpers all default to NLHE / single-board when fields are missing.
- **RLS**: SELECT is `is_public OR auth.uid() = user_id` (anon + authenticated). INSERT/UPDATE/DELETE are owner-only via `auth.uid() = user_id`.
- **Privacy**: hands default `is_public = false`. Owners flip via the Share button in the replayer header. Bulk-share from the dashboard does the same atomically (`setHandsPublic(ids, true)` over an `IN (...)` update).
- **Setup defaults** live in localStorage under `smh:defaults`. Shape: `{ playerCount, sb, bb, straddleOn, straddleAmt, bombPotOn, bombPotAmt, doubleBoardOn, gameType, defaultStack }`. Read/write via `engine.readSetupDefaults` / `engine.writeSetupDefaults`. `readSetupDefaults` provides safe defaults for older browsers' partial JSON.
- **Result backfill outstanding.** Hands saved before the resolvedAwards-from-state fix have `result = -heroPaid` even when hero won. Two ways to repair: (1) one-time server action that walks every hand's `_full` and rewrites `result`, or (2) compute result at render-time from `_full` everywhere. Decision deferred.

---

## Blocking user testing (must-fix before real users)

1. **Mobile-passable layout.** Recorder assumes ~1600px width. The viewport-aware sizing pass keeps things on-screen on laptops, but phones still get a broken layout. The meta strip + dock + popovers are desktop-shaped. At least add a "best viewed on desktop" notice if a real responsive pass isn't shipping.

## v1.1 backlog (defer past first user test)

Top = most leverage:

1. **Result backfill for old hands.** Hands saved before the `resolvedAwards`-from-state fix persisted `result = -heroPaid` regardless of who actually won. The replayer renders the right winner because it recomputes via `awardPots` at view time, but the dashboard `result` column is wrong for those rows. Either (a) one-time server action that walks every hand and rewrites `result`, or (b) make the dashboard compute `result` at render-time from `_full`. (a) is cleaner; (b) is more resilient.
2. **Action-annotation editing in the replayer.** Annotations are written in `/record` and surfaced in `/hand` as anchored note balloons, but the balloon has no edit affordance. Sketch: an `Edit ✎` ghost link inside the balloon; new server action that patches `_full.annotations[index]`; optimistic local state mirroring the hand-level Notes pencil flow already in `Replayer.tsx`. Also unblocks the deferred `n` keyboard shortcut.
3. **Mobile recorder layout** — see "Blocking" above.
4. **Auth-page styling** — `/login` and `/signup` are still default-ish. Bring them into the neutral charcoal + Inter system.
5. **Bet-sizing presets aware of blinds** — at 1/2 stakes, opens are usually 5-10. A `2.5×` / `3×` / `pot + 1bb per limper` chip would cut entry time. The drawer's chip array is already trivially extensible (`chips: { id, label, amount }[]`); the PLO branch already takes a different chip set, so per-game chip overrides are wired.
6. **Edit gameplay actions on a saved hand.** Today only metadata (name / venue / date / notes / tags / fav) is editable. Re-recording is the workaround.
7. **Action-only stepping toggle in the replayer** — skip board-reveal steps, hop action-to-action.
8. **Replay speed control** — 1.1s/step is hardcoded.
9. **Per-hand OG image** — `/hand/[id]` social-share unfurl currently uses the generic `app/opengraph-image.tsx`. A per-route variant could show the specific hand's name + board cards in the unfurl. New `app/hand/[id]/opengraph-image.tsx` reading from `getHandForViewing`.
10. **Per-route titles** — `/record` → "Record", `/dashboard` → "Dashboard", `/hand/[id]` → the hand name. The `metadata.title.template` is already wired (`%s — savemyhands`); each route just needs `export const metadata = { title: "..." }`.
11. **`robots.ts` / `sitemap.ts`** — public hands as a sitemap → SEO. Not a v1 blocker.
12. **Player-name autocomplete across hands** — record "Whale" once → suggest at the same venue.
13. **Toast primitive** — six `window.alert` calls remain (auth error, save / delete / update fail, share partial fail, notes fail). Build a non-modal toast (similar shape to `confirm-dialog`'s provider + hook) to replace them.
14. **Single-row "Add tag" still uses `window.prompt`** — there's a `TagPopover` already wired for the bulk action bar; the row-level Add tag button can re-use it. Smaller win since the per-row tag flow is rare.
15. **Sweep remaining warm `oklch(... 60)` arbitrary classes** in `Recorder.tsx` / `Replayer.tsx` for full neutral parity. Mechanical.

### Done since 2026-04-28
- ✅ All-in-for-less display bug (replayer step bubbles + running pot were uncapped).
- ✅ Dashboard `result` mismatch (header Save button passed `null` awards; now `resolvedAwards` is a memo and both Save buttons use it).
- ✅ Bulk action bar wired (Tag / Share / Delete; Duplicate dropped).
- ✅ Custom ConfirmDialog replaced every `window.confirm`.
- ✅ Mouseless replay creation: auto-open picker after street, keyboard nav inside picker, `Space` / `Enter` starts the hand.
- ✅ Bomb pot.
- ✅ Double board.
- ✅ PLO 4 / 5 with pot-limit, fanned-card design, must-use-2-from-hand evaluator.
- ✅ Branding: favicon, OG image, Twitter card, manifest, theme color, Apple touch icon.
- ✅ Viewport-aware sizing for recorder + replayer.
- ✅ Single-click row + stable picker + active-slot gesture (universal).
- ✅ Dashboard: Hand column (hole cards, single-row up to 5), Game column + filter, DB column + filter.

## Long-term wishlist (poker-player ask)

These shape the product into a teaching tool, not just a recorder. Not committed; here so future agents know the direction.

- **Hand-history import.** Paste a PokerNow text dump or upload a Stars hand history → parsed into a saved hand. Probably the biggest velocity unlock for real users.
- **Annotations per action.** Sticky-note "I should have folded here" on a specific bet, visible in the replayer. Differentiates this from every other history app.
- **Equity at each street.** Equilab-style hot/cold % under the pot. Doesn't need to be a solver.
- **Live hand-strength label** in the replayer ("Top Pair Top Kicker", "OESD + flush draw") that updates as the board changes. The hand evaluator can already produce these strings.
- **Action-shape filters** ("hands where I 3-bet from BB and folded the flop"). Right now filters are metadata-only.
- **Range pre-fills** for villain (Pio-style 13×13 grid) feeding the equity calc.
- **Session grouping** + per-session net result + session-filtered dashboard.
- **Stat dashboard** (VPIP/PFR/AF/win-rate-by-position) once a user has ~50 hands.
- **PLO mode** (4 hole cards). `CardRow.autoAdvanceCount` already supports n-card chaining; biggest work is in the hand evaluator.

## Operating notes for future agents

- Every interactive surface is `"use client"`. Server components only fetch auth + render shell.
- Don't ship hands data in `useEffect(() => setState(...), [])` — the lint rule (`react-hooks/set-state-in-effect`) blocks it. Use `useState(() => readLocalStorage())` lazy initializers with a `typeof window !== "undefined"` guard.
- Refs accessed during render trip the lint rule too. For popovers anchored to clicked elements, set `anchor` from `e.currentTarget` in the click handler instead of reading `ref.current` in JSX.
- React 19's `react-hooks/refs` rule also forbids *writing* a ref during render, which rules out the pattern `const cacheRef = useRef(new Map()); useMemo(() => { cacheRef.current.set(k, ...) }, [k])`. The way around it is to compute the whole cache eagerly inside `useMemo` (return a `Map` directly) — see the equity precompute path in `Replayer.tsx` for the canonical example.
- Engine is cycle-indexed throughout. Don't conflate visual seat slots and cycle positions — every render-time conversion goes through `(heroPosition + visualI) % N` (cycle from visual) or `(cycleIdx - heroPosition + N) % N` (visual from cycle).
- Hero is always at visual slot 0 (bottom-center). Hero's *cycle* index is `state.heroPosition` and changes when the user picks a different position in setup (via a record swap in the reducer).
- The 7-card evaluator only runs once `state.board.filter(Boolean).length === 5`. The showdown panel surfaces a hint when the board is incomplete.
- **Never use native `<input type="checkbox">`.** Its rendered size inherits from the surrounding inline-layout context, so the same checkbox renders differently in `h-9` header rows vs `h-11` data rows. Use `components/ui/checkbox.tsx`.
- **Recorder popover state is lifted to the `Recorder` component** (`setupPopoverOpen`, `logOpen`). `MetaStrip` is a controlled component — it owns no popover state itself — because the parent needs `setupPopoverOpen` to dim the table behind the Stakes & seats popover. Outside-click handlers live inside `MetaStrip` next to each ref, but the boolean lives upstream.
- **Recorder/Replayer keyboard shortcuts skip when an input/textarea/contenteditable is focused.** Don't add new shortcuts without preserving that guard — the recorder's bet-amount input and the replayer's notes textarea both rely on it. The recorder's per-action keys (`f`/`c`/`r`/`b`/`1-4`/`a`) live inside `ActionBar` (auto-mounts with the right phases via the parent's `key={...activeSeat...}`); `Cmd/Ctrl-Z` lives at the `Recorder` level so it works during showdown / deal CTAs too.
- **`BetBubble` is the single source for both bet and check bubbles.** Pass `amount` for chip+pill `$X` (default), or `label="check"` (or any other text) to render a no-chip pill. The chip token is gated on `label === undefined`, so callers who want the chip just omit `label`.
- **Action annotations are recorder-only today.** `_full.annotations` is keyed by index into `state.actions` and is editable inside the recorder's `ActionLog`. The replayer surfaces them as anchored note balloons but has no edit path; if you wire one, mirror the hand-level Notes pencil pattern (lift `fullPayload` from page → patch via `updateHandDetailsAction({ _full: { ...fullPayload, annotations: { ...annotations, [idx]: text } } })`).
- **Setup defaults localStorage key is `smh:defaults`** (preserved across the V4b redesign — the handoff's `smh:recorderDefaults` was renamed back to keep existing user defaults working). Shape: `{ playerCount, sb, bb, straddleOn, straddleAmt, bombPotOn, bombPotAmt, doubleBoardOn, gameType, defaultStack }`. Read/write via `engine.readSetupDefaults` / `engine.writeSetupDefaults`. `readSetupDefaults` provides safe defaults for older partial JSON.
- **Game-variant flags compose.** Bomb pot, Double board, and PLO 4 / 5 are independent toggles — a PLO5 bomb-pot double-board hand is valid and tested. Each flag's reducer is independent: `setGameType` resizes player.cards, `setDoubleBoard` blanks board2 on toggle-off, `setBombPot` only flips its flag (the `streetCommits` preflop branch checks `bombPotOn` and skips SB/BB/straddle). When you add a new variant, follow this pattern: optional `_full` field, default-off in `initialState`, optional in `SetupDefaults`, dispatch from `SetupPopover`, branch in the helpers that need it.
- **Picker single-click + stable anchor.** `CardRow` is a single click target — clicking anywhere on the row opens the picker on the first empty slot, anchored to the row container (`containerRef`). The picker stays put across auto-advance; only the active slot's emerald ring slides between cards. **All-filled rows ignore clicks** — force X-first edit. The X buttons stop propagation. If you add a new picker call site, just pass `cards` / `onPick` / `onClear` / `autoAdvanceCount` / optional `fan`. Don't add per-slot `onClick` handlers — the row owns clicks now.
- **Hand-eval / award helpers all take an optional `gameType`** (default `"NLHE"`). When wiring a new caller, pass `state.gameType` (or `f.gameType ?? "NLHE"` from a saved hand). Forgetting to thread it silently uses NLHE eval against PLO hole cards — you'll get wrong winners without warnings.
- **Pot-limit slider clamp.** ActionBar computes `maxAllowed = isPotLimit(gameType) ? min(allInAmount, lastBet + (pot + toCall)) : allInAmount`. Slider, amount input, chip set, and keyboard shortcuts (`a`, `4`) all key off `maxAllowed`. The "All-in" chip is renamed "Max" in PLO and the 1.25× chip is removed. When you add new chips or shortcuts, check both branches.
- **`useConfirm` is async — `Header.onBack` returns `Promise<boolean | void>`** so a back-link click can wait on the dialog before navigating. The Link `onClick` checks `result instanceof Promise` and `e.preventDefault()` + `router.push(href)` on resolve. If you add a similar destructive flow elsewhere (close-tab, navigate, etc.), follow the same pattern: preventDefault, await, then proceed.
- **Stacking context: `z-20` on the meta strip** is load-bearing. Top-seat hole-card backs sit at `-top-14` from their seat plate's transform, which puts them ~25-37px above the table's top edge — directly underneath the strip. Without `z-20` the seat wrappers' `z-10` would intercept clicks on the strip's bottom half. Don't lower it unless you also rework the seat plate overflow.
- **Numeric inputs in the SetupPopover use `<NumericInput>`** (uncontrolled, blank-while-typing, blur-commits). Don't use plain `<Input type="number" value={x} onChange={...}>` for numeric state that the user should be able to clear — `Number("")` is `0` and React snaps the field back. The pattern: `<NumericInput value={x} onCommit={(n) => dispatch(...)} />`.
- **Recorder showdown panel + replayer recordedToHand both run `awardPots` (or `awardPotsMultiBoard`) — keep them in sync.** When a new variant changes how pots are awarded, both call sites need updating. Same for `determineWinner` (used for the "shows X · top pair" descriptions).
- **`metadataBase` is hardcoded to `https://savemyhands.app`.** Localhost links never unfurl on Discord/iMessage etc. — the crawler can't reach localhost, AND the meta tags point to prod. To preview unfurl behavior, push to a Vercel preview deployment.
