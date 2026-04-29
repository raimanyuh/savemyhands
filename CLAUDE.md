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

## Database Tables (in Supabase)
- `users` — handled by Supabase Auth
- `hands` — one row per recorded hand (with `_full` jsonb payload)
- `profiles` — public-facing username per user

## Coding Conventions
- Use TypeScript throughout
- Use Supabase client for all database operations
- Use Shadcn components for all UI elements where possible
- Keep components small and reusable
- Pages go in /app directory following Next.js App Router conventions

## Build Priority Order
1. Auth (login/signup via Supabase) ✅
2. Hand recording GUI ✅
3. Hand save + unique URL generation ✅
4. Hand replayer ✅
5. User hand database/dashboard ✅
6. Filtering ✅
7. Public deployment ✅

---

## Current State (as of 2026-04-29)

The app is **deployed publicly on Vercel** with end-to-end functionality. All six route surfaces (`/`, `/login`, `/signup`, `/dashboard`, `/record`, `/hand/[id]`, `/settings`) have had a mobile pass and are usable on phones (recorder shows a "tablet+ recommended" hint under sm because seat plates get cramped). User profiles ship with public-facing usernames, account self-management lives at `/settings` (incl. account deletion), and a bundled sample hand at `/hand/sample` exercises every replayer feature for new users.

The deployment walkthrough lives in `DEPLOY.md` at the repo root — self-contained, hand to any Claude chat for re-deploys or troubleshooting.

### What's working
- **Landing page** (`/`) — anon visitors get a real marketing page (hero with miniature 6-handed felt, How it works in 3 cards, Annotations feature card, FAQ accordion, footer). Signed-in visitors still redirect to `/dashboard`. Lives at `components/landing/`. Mobile: nav anchors + hero replay-table card hide under sm; section padding shrinks; FAQ answer right-padding zeroes out.
- **Auth** — Supabase login / signup / logout, plus OAuth via Google and Discord (buttons on `/login` and `/signup`, callback at `/auth/callback`). Form inputs and primary buttons bumped to `h-11` for mobile tap-target sizing; full visual polish past defaults still pending in v1.1 backlog.
- **Username system** — public-facing handle that replaces the email on the dashboard header and surfaces as "by @{username}" on shared hand replayer pages. Stored in a separate `profiles` table. Users without a username see a "Set username" button in the header **plus** a soft prompt banner above the hand library. The `UsernamePicker` modal validates against `^[a-z0-9_]{3,20}$`, debounces a server-side availability probe (350ms), and rejects taken names inline.
- **Settings** (`/settings`) — three sections. **Profile**: username (delegates to `UsernamePicker`). **Account**: email (read-only), sign-in method label (`Email & password` / `Google` / `Discord`, with linked-providers list when multiple), password change (8+ chars). **Danger zone**: delete account behind a typed-DELETE confirmation modal → calls the `delete_my_account` SECURITY DEFINER RPC → cascades clean up profile + hands. Dashboard header has a Settings cog Button next to Sign out (icon-only under sm).
- **Recorder** (`/record`) — full state machine: setup → preflop → flop → turn → river → showdown. Top of page: editable hand name, then a single-line **meta strip** with `⚙ Stakes & seats` button (live summary of `$sb/$bb · N-max [· straddle $X]`, opens a popover with every setup control + Hero position picker + Save/Load default), street pill, pot, Geist-Mono action hint, `Log {N} ▾` button (opens the action-log popover), and a Start hand CTA visible only during setup. Below the table: trimmed 3-button action bar (Fold rose / Check-or-Call neutral / Bet-or-Raise emerald 200px wide) with `Undo` ghost on the right and a collapsible **sizing drawer** above it (½ pot / ⅔ pot / Pot / 1.25× / All-in chips, slider with min/max/manual input). Bet button: collapsed → opens drawer; open → commits. Cancel button (header right) is `disabled` while not dirty so a fresh load doesn't make it look broken. Keyboard shortcuts during play: `f` fold, `c` check/call, `r`/`b` open drawer + focus amount, `Enter` in input commits, `1`-`4` set sizing fractions, `a` all-in, `Cmd/Ctrl-Z` undo (works at any phase). All shortcuts skip when an input is focused. Pot type auto-classified on save from preflop raise count (LP / SRP / 3BP / 4BP / 5BP). Mobile: action bar stacks; meta strip wraps; popovers cap at `calc(100vw - 24px)`; "tablet+ recommended" banner at <640px.
- **Click-to-annotate** in the recorder — bet/check bubbles on the felt are interactive (rendered as `<button>` when `onClick` is provided). Clicking opens an annotation editor modal (autofocused textarea, ⌘+Enter saves, Esc cancels, save empty to remove). Bubbles whose action already has an annotation render with an emerald-tinted pill so it's visible at a glance. The original action-log popover entry point still works.
- **Showdown** — per-villain Show / Muck. Auto-determined winner via 7-card evaluator. Side-pot decomposition handles multi-way all-ins (`engine.computeSidePots` + `hand-eval.awardPots` + `seatWinnings`); pot-by-pot breakdown rendered when there are 2+ pots. Pot displayed reflects uncalled-bet refunds. Save disabled until all villains decided. Header save disabled outside showdown so half-played hands can't be persisted.
- **Replayer** (`/hand/[id]`) — server-rendered, public-readable. **Floating media-player dock** fixed to the bottom of the viewport (action summary on the left at fixed `w-[260px]` so transport buttons don't shift between steps, transport `⟲ ‹ ▶/⏸ ›`, inline scrubber with **emerald dots at every annotated step** for click-to-jump, step counter, `Log ▾` button). Dock action summary is hidden under sm to make room. **Note balloon** is anchored to the seat **nameplate** via a 56px dashed emerald connector and sits on the side of the seat that faces *into the table interior* — left-side seats (pos.left < 40) → balloon right; right-side seats (pos.left > 60) → balloon left; center seats (hero, top-center) → balloon right (avoids dealer button). Width is responsive (`min(280px, calc(...))`) so it never overflows. **Log popover** opens above the dock, lists every step grouped by street with annotated dots and current-step highlight; click-to-jump on every row. Keyboard: `Space`/`←`/`→`/`Home`/`End` plus `[` (prev annotated), `]` (next annotated), `l` (toggle log), `Esc` (close popover). Hand-level Notes/Venue/Date panel below the table; **owners get a pencil to edit notes inline** (textarea + Save/Cancel; `⌘/Ctrl+Enter` saves, `Esc` cancels). Mobile: header buttons collapse to icon-only; dock fits at 375px.
- **Sample hand fixture** — `/hand/sample` is intercepted in the page route and served from `lib/sample-hand.ts` (no DB call). One polished 6-handed 1/2 hand with five per-action annotations, hand-level notes, and an opponent reveal at showdown — exercises every replayer feature. New users with zero saved hands see a single sample row on the dashboard linking here (replaces the earlier seven hardcoded broken-id rows).
- **Action / check bubbles** — players that put chips in the pot get a chip+pill `$amount` bubble between their seat and the felt center. Players that **check** get the same dark pill labeled `check` (no chip token) in the same spot. Both reset between streets and disappear when the seat folds. Bubbles in the recorder accept `onClick` (annotation editor entry) and `hasAnnotation` (emerald pill tint). Replayer omits both → bubbles stay non-interactive.
- **Equity** — header toggle in the replayer reveals every villain who showed at showdown and overlays a per-seat equity badge at the current step's board. Equity is precomputed at save time (`_full.equityByStep`) so back/forth navigation is a pure lookup; older hands without it fall back to live runout enumeration. Skipped pre-flop (1.7M-runout enum is too slow for a synchronous toggle).
- **Sharing** — hands default private. Owners see a Lock/Globe toggle in the replayer header; toggling Public also auto-copies the URL to clipboard. Anon viewers can open a public hand directly; private hands and unknown ids return 404. Anon viewers see a "Sign up" CTA in place of owner controls; the dashboard back-link is hidden for them.
- **Dashboard** (`/dashboard`) — server-fetches the signed-in user's hands. **Pagination**: 50 hands/page, footer below the table shows "Showing N-M of P" + Prev/Next buttons. Filter / sort / search operate on the full set; only the DOM render is paginated. Bulk-select "select all" is scoped to the visible page so cross-page selections survive. Sortable Name/Date/Venue/Stakes/Result columns, a Starred toggle, filter popovers (Positions / Stakes / Players / Multiway / Result / Tags / Pot type / Venue), search, inline rename, favorite star, four-color mini-cards. Per-row "⋯" menu with Edit details (modal: name/venue/date/notes) and Delete (with confirm). Bulk-select Delete in the action bar. Mobile: hand table collapses to **stacked cards** under md (header row + 13-column grid hide; each hand becomes a card with name/star/result, meta row, mini-board, tags); Settings/Sign out collapse to icon-only; bulk action bar trims to Delete + Clear.
- **Demo data flag** — `/dashboard?demo=N` injects N synthetic rows via `generateSampleHands(N)` (capped at 500). Deterministic seeded RNG so refreshes show the same data; rows are prefixed `demo-` and treated as samples (no DB writes on edit/delete; click navigates to a dead route, intentionally — this is for visual review of dashboard density only).
- **Input length caps** — server-side. `lib/hands/limits.ts` `clampSavedHand` truncates every user-input string field on save (hand name 100, notes 4k, venue 60, tags 24×8, player names 32, annotations 500×200). `assertPayloadSize` hard-rejects any payload over 64KB. Both run inside `saveHandAction` and `updateHandDetailsAction`.
- **Design tokens** — `app/globals.css` `.dark` block uses **pure neutral charcoal** (chroma 0, hue 0). Inter as `--font-sans`. Emerald `oklch(0.696 0.205 155)` is the only saturated UI accent in the chrome. The wood-rail and emerald-felt gradients on the actual table surface are unchanged (warm hex literals). Note: a handful of inline `text-[oklch(... 60)]` Tailwind arbitrary classes still live in `Recorder.tsx` and `Replayer.tsx` — left intentionally during the dashboard-only neutralization sweep.

### Code map (key files)
- `components/poker/engine.ts` — `RecorderState`, reducer, `deriveStreet`, `formatAction`. Chip math: `committedBySeat` (raw, for live recorder display) / `committedBySeatFinal` (with per-street uncalled-bet refund), `totalPot` / `totalPotFinal`, `computeSidePots` (main + side pot decomposition with eligible seats; consecutive same-eligibility layers merge so dead-blind contributions roll into the main pot instead of fragmenting into ghost side pots). All commit math is stack-aware: a "call" or "raise" is capped at `stack[seat] − previous-streets-commit`, and a short-stack all-in for less than the current bet doesn't lower `lastBet` for downstream callers. The `CommitState` structural type lets these helpers also accept a `SavedHand._full` payload. State is cycle-indexed (BTN=0, SB=1, BB=2, …); `state.heroPosition` is hero's cycle index.
- `components/poker/hand.ts` — `SavedHand` (the row + payload shape that round-trips through Postgres), `ReplayHand` (replayer input), `recordedToHand` (uses refund-adjusted pot + per-pot eval to label the showdown step; passes `_full.equityByStep` through to the replayer), `computeStreetBets`, `committedThroughStep`, `hasFolded`, `derivePotType`, `potTypeOf`.
- `components/poker/hand-eval.ts` — best-5-of-7 evaluator with proper kickers + the wheel. `awardPots` resolves winners per side pot (returning `PotAward[][]` so future hi-lo / multi-board games can append additional awards per pot). `seatWinnings(awards, seat)` sums a player's allocations across pots.
- `components/poker/equity.ts` — `computeEquity(contestants, board)` enumerates every runout for a given partial board (flop/turn/river only — pre-flop is skipped because 5-card runouts are too slow for a synchronous toggle). `precomputeEquityByStep(hand)` walks every step in a `ReplayHand` and produces the `_full.equityByStep` map saved alongside the hand.
- `components/poker/lib.ts` — `seatXY`, `chipXY`, `POSITION_NAMES`, `preflopOrder`, `postflopOrder`. Seats live on an ellipse with `RING_A=43, RING_B=40`. The visual rotation is `cycleIdx = (heroPosition + visualI) % N`.
- `components/poker/table-pieces.tsx` — `BetBubble` (with `isHero` flag for the hero-only nudge; pass `label` for arbitrary text + drop the chip token; pass `onClick` to make the bubble interactive — recorder uses this for the annotation editor; pass `hasAnnotation` to tint the pill emerald). `bubblePos(seatPos, isHero)` exposes the same placement math for callers that want to anchor to the bubble's coordinates. Plus `DealerButtonChip`, `NameDisplay`, `StackDisplay`, `TableSurface`.
- `components/poker/PlayingCard.tsx` — 4-color deck primitive (♠ black, ♣ green, ♦ blue, ♥ red).
- `components/poker/CardPicker.tsx` — `CardSlot` (single slot) and `CardRow` (multi-slot, `autoAdvanceCount` controls flop / hole-card chaining; `highlight` enables emerald glow).
- `components/poker/Recorder.tsx` — V4b layout. Inline components: `MetaStrip`, `SetupPopover`, `ActionBar` (3 buttons + sizing drawer), `Kbd` (small keyboard hint badge), `ActionLog`, **`AnnotationModal`** (opened by clicking a bet/check bubble; saves via `setAnnotation` reducer event). Recorder-level state includes `annotateIdx` (the action index being edited).
- `components/poker/Replayer.tsx` — V3 layout. Inline `ReplayerInner` owns transport state plus the floating dock + log popover + nameplate-anchored note balloon (opposite-side rule, dashed connector). Receives `fullPayload` so the owner notes-edit patch can update both the top-level `notes` column and `_full.notes`.
- `components/poker/Dashboard.tsx` — dashboard surface; pure neutral charcoal palette throughout. Pagination (`PAGE_SIZE = 50`), demo-flag injection (`generateSampleHands`), single-row `SAMPLE_HANDS` sourced from `getSampleHand()`. Mobile card layout under md.
- `components/poker/sample-hands-gen.ts` — deterministic seeded-PRNG generator for the `?demo=N` flag.
- `components/Shell.tsx` — page shell + header.
- `components/landing/HeroTable.tsx` — presentational 6-handed felt for the landing hero. Hidden under sm via `.smh-hero-card` because seat plates overlap below ~480px.
- `components/landing/Faq.tsx` — `"use client"` accordion; only landing-page client component.
- `components/landing/LandingPage.tsx` — main composition: `Nav`, `Hero`, `HowItWorks`, `AnnotationsSection`, `Footer` + page atmosphere/grain overlays. Inline `<style>` block carries the responsive media queries (sm: hide hero card, hide nav anchors, shrink section padding).
- `components/ui/checkbox.tsx` — `<button role="checkbox">` with an overlaid `Check` glyph. We don't use native `<input type="checkbox">` because its sizing inherits from inline-layout context.
- `components/auth/OAuthButtons.tsx` — Google + Discord buttons. Bumped to `h-11` during the mobile pass.
- `components/auth/UsernamePicker.tsx` — modal for picking/changing the public username. Used by the dashboard header (and the soft banner) and the settings Profile section. Live availability probe (debounced 350ms), inline status messages, Enter-to-submit. Validation derived during render (no setState-in-effect); availability fired from a debounced effect.
- `components/settings/Settings.tsx` — `/settings` UI. `SectionCard` + `Row` layout primitives, inline `PasswordForm` and `DeleteAccountModal` (typed-DELETE confirmation). Renders `UsernamePicker` for the username row.
- `app/record/page.tsx`, `app/dashboard/page.tsx`, `app/hand/[id]/page.tsx`, `app/settings/page.tsx`, `app/page.tsx` — routes (server components; client surfaces take server-fetched props). `/` redirects authed users to `/dashboard`. `app/hand/[id]/page.tsx` intercepts `id === SAMPLE_HAND_ID` (= `"sample"`) and serves the bundled fixture instead of hitting the DB.
- `app/auth/callback/route.ts` — exchanges the OAuth `code` for a session cookie; redirects to `/dashboard`. Callback URL must be in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (both localhost dev and the production domain).
- `lib/hands/db.ts` — server-side CRUD over the `hands` table. Mints 8-char ids on insert (with PK collision retry). Exports `listMyHands`, `getHand`, `getHandForViewing` (resolves owner + auth state + owner's username via a join to `profiles`), `countMyHands`, `insertHand`, `updateHandDetails`, `setHandPublic`, `deleteHand`, `deleteHands`.
- `lib/hands/actions.ts` — `'use server'` thin wrappers: `saveHandAction`, `updateHandDetailsAction`, `setHandPublicAction`, `deleteHandAction`, `deleteHandsAction`. The first two run input through `clampSavedHand` + `assertPayloadSize` before persisting.
- `lib/hands/limits.ts` — `HAND_LIMITS` constants, `clampSavedHand` (silent truncation for length-bounded fields, drops excess tags/annotations), `assertPayloadSize` (hard reject above 64KB serialized).
- `lib/profiles/db.ts` — server-side data layer for `profiles`. `getMyProfile`, `getProfileByUserId`, `isUsernameAvailable`, `setUsername` + the `USERNAME_REGEX` constant.
- `lib/profiles/actions.ts` — `'use server'` actions: `setUsernameAction` (validates regex + checks availability + upserts), `checkUsernameAvailableAction` (debounced probe for the picker modal), `changePasswordAction` (uses `supabase.auth.updateUser`), `deleteAccountAction` (calls `delete_my_account` RPC, signs out, redirects to `/`).
- `lib/sample-hand.ts` — `SAMPLE_HAND_ID = "sample"` and `getSampleHand(): SavedHand` returning the bundled fixture (6-handed 1/2 hero call vs missed flush draw with five annotations + hand-level notes). Used by both the dashboard's first-run sample row and the `/hand/sample` route interception.
- `supabase/migrations/` — versioned SQL. `0001_hands.sql` creates the table, indexes, RLS, and `updated_at` trigger; `0002_private_by_default.sql` adds `is_public` plus the owner-or-public SELECT policy; `0003_profiles.sql` creates the profiles table with public read / owner write RLS and the username regex CHECK; `0004_delete_my_account.sql` adds the `delete_my_account()` SECURITY DEFINER RPC scoped to `auth.uid() = id`. Apply via Supabase Dashboard → SQL Editor (no CLI installed).
- `DEPLOY.md` — production deployment walkthrough (GitHub → Vercel → Supabase URL config → OAuth provider redirects → smoke test). Self-contained; can be handed to any Claude chat.

### Persistence
- **Postgres-backed** via Supabase. `hands` table with column-mirrored metadata (name, stakes, date_display, hero_position, multiway, board, pot_type, tags, result, fav, notes, is_public) plus a `payload` jsonb column carrying the full RecorderState (`_full` shape: players, actions, board with nulls, blinds, heroPosition, straddle, muckedSeats, notes, venue, date, annotations, equityByStep). RLS: SELECT is `is_public OR auth.uid() = user_id` (anon + authenticated). INSERT/UPDATE/DELETE are owner-only via `auth.uid() = user_id`.
- **`profiles` table**: one row per auth user. `id` (PK + FK to `auth.users(id) on delete cascade`), `username` (unique, regex-checked 3-20 [a-z0-9_]), timestamps. RLS: public read (anon + authenticated) so usernames render on shared hand pages; owner-only write.
- **Account self-deletion**: `delete_my_account()` RPC (SECURITY DEFINER) lets users delete their own row in `auth.users`. Cascades clean up profiles + hands. Chosen over exposing a service-role key to the client.
- **Privacy**: hands default `is_public = false`. Owners flip via the Share button in the replayer header.
- **Setup defaults** (player count, blinds, straddle, default stack) live in localStorage under `smh:defaults` — per-browser preferences, not user data, intentionally client-side.

---

## v1.1 backlog (defer past first user testing)

Suggested next pickup (top = most leverage):

1. **Action-annotation editing in the replayer.** Recorder already has click-to-annotate on bet/check bubbles. Replayer surfaces annotations as anchored note balloons but has no edit affordance — owners can only edit by going back to the recorder. Implementation: mirror the hand-level Notes pencil pattern (lift `fullPayload` from page → patch via `updateHandDetailsAction({ _full: { ...fullPayload, annotations: { ...annotations, [idx]: text } } })`). Also unblocks the deferred `n` keyboard shortcut.
2. **Auth-page styling** — `/login` and `/signup` use the default `Card` component shell. Tap targets are sized correctly (h-11) but the visual treatment is generic. Bring them into the neutral charcoal + Inter system that the rest of the app uses.
3. **Bet-sizing presets aware of blinds** — at 1/2 stakes, opens are usually 5–10. A `2.5×` / `3×` / `pot + 1bb per limper` chip would cut entry time. The drawer's chip array is already trivially extensible (`chips: { id, label, amount }[]`).
4. **Edit gameplay actions on a saved hand.** Today only metadata (name / venue / date / notes / tags / fav) is editable. Re-recording is the workaround.
5. **Action-only stepping toggle in the replayer** — skip board-reveal steps, hop action-to-action.
6. **Replay speed control** — 1.1s/step is hardcoded.
7. **Wire the dashboard bulk action bar beyond Delete** — Tag / Share / Duplicate are stubs.
8. **Player-name autocomplete across hands** — record "Whale" once → suggest at the same venue.
9. **Pagination polish: reset to page 1 on filter/search/sort change.** Today the dashboard clamps to the last valid page if filtering shrinks the result set. Standard UX would reset to page 1. ~10-line fix; leaves a slightly weird "I was on page 5, filtered, now I'm on page 2" jump otherwise.
10. **Date sort is alphabetical-by-month-name (pre-existing bug).** The date column sort uses `localeCompare` on the display string ("Apr 24, 25"), which alphabetizes by month. Fix: sort by `_full?.date` (ISO) when present, fall back to `Date.parse(display)`.
11. **Game type column + double-board variants** (user roadmap item). Add `game_type` column for NLH / PLO4 / PLO5 / BIGO; later, double-board variants where each board awards half the pot. Multi-week. Defer until non-NLH variants are recordable.
12. **Sweep the remaining warm `oklch(... 60)` Tailwind arbitrary classes** in `Recorder.tsx` / `Replayer.tsx`. Mechanical change.
13. **Subscription / pricing.** User wants to monetize once value is validated. Stripe (US, lower fees but you handle tax) or Lemon Squeezy / Paddle (global, merchant-of-record, +~2%). Build pricing page → checkout → webhook → Supabase subscription state → RLS gates. ~1-2 day push after user testing validates willingness to pay. Out of scope for now.

## Long-term wishlist (poker-player ask)

These shape the product into a teaching tool, not just a recorder. Not committed; here so future agents know the direction.

- **Hand-history import.** Paste a PokerNow text dump or upload a Stars hand history → parsed into a saved hand. Probably the biggest velocity unlock for real users.
- **Equity at each street** (Equilab-style hot/cold % under the pot). Doesn't need to be a solver. We have the equity calc; just need to surface it more prominently.
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
- React 19's `react-hooks/refs` rule also forbids *writing* a ref during render, which rules out the pattern `const cacheRef = useRef(new Map()); useMemo(() => { cacheRef.current.set(k, ...) }, [k])`. The way around it is to compute the whole cache eagerly inside `useMemo` (return a `Map` directly) — see the equity precompute path in `Replayer.tsx`.
- Engine is cycle-indexed throughout. Don't conflate visual seat slots and cycle positions — every render-time conversion goes through `(heroPosition + visualI) % N` (cycle from visual) or `(cycleIdx - heroPosition + N) % N` (visual from cycle).
- Hero is always at visual slot 0 (bottom-center). Hero's *cycle* index is `state.heroPosition` and changes when the user picks a different position in setup (via a record swap in the reducer).
- The 7-card evaluator only runs once `state.board.filter(Boolean).length === 5`. The showdown panel surfaces a hint when the board is incomplete.
- **Never use native `<input type="checkbox">`.** Its rendered size inherits from the surrounding inline-layout context, so the same checkbox renders differently in `h-9` header rows vs `h-11` data rows. Use `components/ui/checkbox.tsx`.
- **Recorder popover state is lifted to the `Recorder` component** (`setupPopoverOpen`, `logOpen`). `MetaStrip` is a controlled component — it owns no popover state itself — because the parent needs `setupPopoverOpen` to dim the table behind the Stakes & seats popover. Outside-click handlers live inside `MetaStrip` next to each ref, but the boolean lives upstream.
- **Recorder/Replayer keyboard shortcuts skip when an input/textarea/contenteditable is focused.** Don't add new shortcuts without preserving that guard — the recorder's bet-amount input and the replayer's notes textarea both rely on it.
- **`BetBubble` is the single source for both bet and check bubbles.** Pass `amount` for chip+pill `$X` (default), `label="check"` (or any other text) to render a no-chip pill, `onClick` to make the bubble interactive (recorder annotation entry — replayer omits this so bubbles stay non-interactive there), and `hasAnnotation` to tint the pill emerald.
- **Annotation editing has two entry points in the recorder**: the action-log popover (existing) and **clicking the bet/check bubble on the felt** (new). Both dispatch `setAnnotation` to the reducer. The bubble click opens `AnnotationModal` (inline in `Recorder.tsx`); the editor pre-loads existing text if present.
- **The replayer note balloon** is anchored to the seat **nameplate** with a 56px dashed connector. Side selection follows the "opposite-side" rule: balloon sits on whichever side of the seat plate faces *into the table interior*. This avoids the original overflow bug where balloons extended past the table edge for left-side / right-side seats.
- **`/hand/sample` bypasses the DB.** `app/hand/[id]/page.tsx` intercepts `SAMPLE_HAND_ID` (= `"sample"`) and serves `lib/sample-hand.ts`'s fixture. Owners are always `false`; auth state is still checked so the back-link / signup CTA renders correctly. The dashboard's first-run sample row is the same fixture (re-uses `getSampleHand()`).
- **Input length caps are server-side only** in `saveHandAction` and `updateHandDetailsAction`. Client doesn't enforce. If you add a new free-text field, update `clampSavedHand` in `lib/hands/limits.ts` and bump the field's cap if appropriate. Strings are silently truncated; only the post-clamp payload size check throws (it'd only fire for clear constructed-payload abuse).
- **`?demo=N` on /dashboard** injects N synthetic rows via `generateSampleHands(N)`. Useful for previewing the dashboard with a populated library; rows are non-mutable (treated as samples) and not persisted.
- **Pagination is client-side** — server returns the full list; the dashboard slices to `PAGE_SIZE = 50`. Filter/sort/search still operate on the full set. If users start having thousands of hands, switch to server-side pagination or virtualization (`react-window` is the obvious drop-in).
- **The `delete_my_account` RPC** powers account self-delete. SECURITY DEFINER + scoped to `auth.uid() = id`. We chose this over exposing the service role key to the client. Cascades clean up profiles + hands.
- **Setup defaults localStorage key is `smh:defaults`**. Shape: `{ playerCount, sb, bb, straddleOn, straddleAmt, defaultStack }`. Read/write via `engine.readSetupDefaults` / `engine.writeSetupDefaults`.
- **OAuth + auth redirect URLs need to include both localhost and the production domain** in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Most "auth works locally but breaks in prod" failures trace here. See `DEPLOY.md` step 3 for the exact URLs to whitelist.
