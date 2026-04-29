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

## Current State (as of 2026-04-28)

The app is end-to-end functional with cross-device share URLs. Hands persist per-user in Postgres, share URLs work for anon visitors when the owner toggles a hand public, and the dashboard reflects the signed-in user's own hands only (with bundled samples shown to first-run accounts). Landing page ships, recorder + replayer have been redesigned around a meta-strip / floating-dock pattern.

### What's working
- **Landing page** (`/`) — anon visitors get a real marketing page (hero with miniature 6-handed felt, How it works in 3 cards, Annotations feature card, FAQ accordion, footer). Signed-in visitors still redirect to `/dashboard`. Lives at `components/landing/`.
- **Auth** — Supabase login / signup / logout, plus OAuth via Google and Discord (buttons on `/login` and `/signup`, callback at `/auth/callback`). Still uses default-ish styling (one of the v1.1 polish items).
- **Recorder** (`/record`) — full state machine: setup → preflop → flop → turn → river → showdown. Top of page: editable hand name, then a single-line **meta strip** with `⚙ Stakes & seats` button (live summary of `$sb/$bb · N-max [· straddle $X]`, opens a popover with every setup control + Hero position picker + Save/Load default), street pill, pot, Geist-Mono action hint, `Log {N} ▾` button (opens the action-log popover), and a Start hand CTA visible only during setup. Below the table: trimmed 3-button action bar (Fold rose / Check-or-Call neutral / Bet-or-Raise emerald 200px wide) with `Undo` ghost on the right and a collapsible **sizing drawer** above it (½ pot / ⅔ pot / Pot / 1.25× / All-in chips, slider with min/max/manual input). Bet button: collapsed → opens drawer; open → commits. Keyboard shortcuts during play: `f` fold, `c` check/call, `r`/`b` open drawer + focus amount, `Enter` in input commits, `1`-`4` set sizing fractions, `a` all-in, `Cmd/Ctrl-Z` undo (works at any phase). All shortcuts skip when an input is focused. Heavy "Betting round complete" banner replaced with a thin 36px strip + the existing pulsing emerald outline on next-clickable board slots. Pot type auto-classified on save from preflop raise count (LP / SRP / 3BP / 4BP / 5BP).
- **Showdown** — per-villain Show / Muck. Auto-determined winner via 7-card evaluator. Side-pot decomposition handles multi-way all-ins (`engine.computeSidePots` + `hand-eval.awardPots` + `seatWinnings`); pot-by-pot breakdown rendered when there are 2+ pots. Pot displayed reflects uncalled-bet refunds. Save disabled until all villains decided. Header save disabled outside showdown so half-played hands can't be persisted.
- **Replayer** (`/hand/[id]`) — server-rendered, public-readable. **Floating media-player dock** fixed to the bottom of the viewport (action summary on the left, transport `⟲ ‹ ▶/⏸ ›`, inline scrubber with **emerald dots at every annotated step** for click-to-jump, step counter, `Log ▾` button). Removing the inline action label and reserved note row stops the layout from shifting when scrubbing across annotated steps. Anchored note balloon with a 1.5px dashed connector renders next to whichever seat the current step's annotation is about. **Log popover** opens above the dock, lists every step grouped by street with annotated dots and current-step highlight; click-to-jump on every row. Keyboard: existing `Space`/`←`/`→`/`Home`/`End` plus `[` (prev annotated), `]` (next annotated), `l` (toggle log), `Esc` (close popover). Hand-level Notes/Venue/Date panel below the table; **owners get a pencil to edit notes inline** (textarea + Save/Cancel; `⌘/Ctrl+Enter` saves, `Esc` cancels). 4-color deck, SMH wordmark on card backs, hero hole cards face-up, villain reveals at showdown if they showed.
- **Action / check bubbles** — players that put chips in the pot get a chip+pill `$amount` bubble between their seat and the felt center. Players that **check** get the same dark pill labeled `check` (no chip token) in the same spot. Both reset between streets and disappear when the seat folds. Lives in `components/poker/table-pieces.tsx` `BetBubble` (the `label` prop drives the check variant — passing it drops the chip token and overrides the dollar text).
- **Equity** — header toggle in the replayer reveals every villain who showed at showdown and overlays a per-seat equity badge at the current step's board. Equity is precomputed at save time (`_full.equityByStep`) so back/forth navigation is a pure lookup; older hands without it fall back to live runout enumeration. Skipped pre-flop (1.7M-runout enum is too slow for a synchronous toggle).
- **Sharing** — hands default private. Owners see a Lock/Globe toggle in the replayer header; toggling Public also auto-copies the URL to clipboard. Anon viewers can open a public hand directly; private hands and unknown ids return 404. Anon viewers see a "Save your own hands → Sign up" CTA in place of owner controls; the dashboard back-link is hidden for them.
- **Dashboard** (`/dashboard`) — server-fetches the signed-in user's hands. Sortable Name/Date/Venue/Stakes/Result columns, a Starred toggle that hides non-favorites, filter popovers (Positions / Stakes / Players / Multiway / Result / Tags / Pot type / Venue), search, inline rename, favorite star, four-color mini-cards, click-through to replayer. Per-row "⋯" menu with Edit details (modal: name/venue/date/notes) and Delete (with confirm). Bulk-select Delete in the action bar. Bundled `SAMPLE_HANDS` shown only when the user has zero saved hands; sample rows wear a "sample" chip next to the name and skip server actions on edit/delete.
- **Design tokens** — `app/globals.css` `.dark` block now uses **pure neutral charcoal** (chroma 0, hue 0) — same lightness scale as before but no warm tint. Inter as `--font-sans`. Emerald `oklch(0.696 0.205 155)` is the only saturated UI accent in the chrome. The wood-rail and emerald-felt gradients on the actual table surface are unchanged (still warm hex literals). Note: a handful of inline `text-[oklch(... 60)]` Tailwind arbitrary classes still live in `Recorder.tsx` and `Replayer.tsx` — they were intentionally left warm because the user scoped the neutralization to the dashboard surface only. Sweeping them later is a small, mechanical change.

### Code map (key files)
- `components/poker/engine.ts` — `RecorderState`, reducer, `deriveStreet`, `formatAction`. Chip math: `committedBySeat` (raw, for live recorder display) / `committedBySeatFinal` (with per-street uncalled-bet refund), `totalPot` / `totalPotFinal`, `computeSidePots` (main + side pot decomposition with eligible seats; consecutive same-eligibility layers merge so dead-blind contributions roll into the main pot instead of fragmenting into ghost side pots). All commit math is stack-aware: a "call" or "raise" is capped at `stack[seat] − previous-streets-commit`, and a short-stack all-in for less than the current bet doesn't lower `lastBet` for downstream callers. The `CommitState` structural type lets these helpers also accept a `SavedHand._full` payload. State is cycle-indexed (BTN=0, SB=1, BB=2, …); `state.heroPosition` is hero's cycle index.
- `components/poker/hand.ts` — `SavedHand` (the row + payload shape that round-trips through Postgres), `ReplayHand` (replayer input), `recordedToHand` (uses refund-adjusted pot + per-pot eval to label the showdown step; passes `_full.equityByStep` through to the replayer), `computeStreetBets`, `committedThroughStep`, `hasFolded`, `derivePotType`, `potTypeOf`.
- `components/poker/hand-eval.ts` — best-5-of-7 evaluator with proper kickers + the wheel. `awardPots` resolves winners per side pot (returning `PotAward[][]` so future hi-lo / multi-board games can append additional awards per pot). `seatWinnings(awards, seat)` sums a player's allocations across pots.
- `components/poker/equity.ts` — `computeEquity(contestants, board)` enumerates every runout for a given partial board (flop/turn/river only — pre-flop is skipped because 5-card runouts are too slow for a synchronous toggle). `precomputeEquityByStep(hand)` walks every step in a `ReplayHand` and produces the `_full.equityByStep` map saved alongside the hand. The replayer prefers that precomputed map; runout enumeration is the fallback for older hands that predate the field.
- `components/poker/lib.ts` — `seatXY`, `chipXY`, `POSITION_NAMES`, `preflopOrder`, `postflopOrder`. Seats live on an ellipse with `RING_A=43, RING_B=40`. The visual rotation is `cycleIdx = (heroPosition + visualI) % N`.
- `components/poker/table-pieces.tsx` — `BetBubble` (with `isHero` flag for the hero-only nudge; pass an optional `label` to render arbitrary text instead of `$amount` and drop the chip token — that's how check bubbles ride the same component), `DealerButtonChip`, `NameDisplay`, `StackDisplay`, `TableSurface`.
- `components/poker/PlayingCard.tsx` — 4-color deck primitive (♠ black, ♣ green, ♦ blue, ♥ red).
- `components/poker/CardPicker.tsx` — `CardSlot` (single slot) and `CardRow` (multi-slot, `autoAdvanceCount` controls flop / hole-card chaining; `highlight` enables emerald glow).
- `components/poker/Recorder.tsx` — V4b layout. Inline components: `MetaStrip` (the strip above the table; owns no popover state itself, takes both `popoverOpen`/`setPopoverOpen` for Stakes & seats and `logOpen`/`setLogOpen` for the action-log popover from the parent so the table can dim while the stakes popover is open), `SetupPopover` (Players / Blinds / Straddle / Stack + Apply to all / Hero position [setup-only] / Save & Load default footer), `ActionBar` (3 buttons + sizing drawer; the drawer chip set is `[half, twothird, pot, overpot=1.25, allin]` and the Bet button opens the drawer if collapsed, commits if open), `Kbd` (small keyboard hint badge), `ActionLog` (accepts `inPopover` to drop its outer chrome when rendered inside the meta-strip log popover).
- `components/poker/Replayer.tsx` — V3 layout. Inline `ReplayerInner` owns transport state plus the floating dock + log popover + anchored note balloon; the outer `Replayer` keys on `hand.id` so switching hands remounts the inner component. Receives `fullPayload` (the underlying `SavedHand._full`) so the owner notes-edit patch can update both the top-level `notes` column and `_full.notes` (the read prefers `_full.notes`, so both must move together).
- `components/poker/Dashboard.tsx` — dashboard surface; pure neutral charcoal palette throughout (no warm `oklch(... 60)` literals).
- `components/Shell.tsx` — page shell + header.
- `components/landing/HeroTable.tsx` — presentational 6-handed felt for the landing hero (wood rail, emerald felt, dealer button, hero hole cards, bet bubble, pot+board, seat plates with folded states). Exports `HeroTable` and `HeroPlayingCard` (the latter reused inside the How-it-works visualizations).
- `components/landing/Faq.tsx` — `"use client"` accordion; the only landing-page client component (everything else is server-rendered).
- `components/landing/LandingPage.tsx` — main composition: `Nav`, `Hero`, `HowItWorks`, `AnnotationsSection`, `Footer` + page atmosphere/grain overlays. CTAs route to `/signup` and `#how`.
- `components/ui/checkbox.tsx` — `<button role="checkbox">` with an overlaid `Check` glyph. We don't use native `<input type="checkbox">` because its sizing inherits from inline-layout context (line-height, baseline) and renders differently in a header vs a data row even with explicit `width`/`height`. The button form pins to exactly the size we set.
- `components/auth/OAuthButtons.tsx` — Google + Discord buttons that call `supabase.auth.signInWithOAuth` and redirect through `/auth/callback`. Inline brand SVGs (Lucide doesn't ship those marks).
- `app/record/page.tsx`, `app/dashboard/page.tsx`, `app/hand/[id]/page.tsx`, `app/page.tsx` — routes (all server components; the recorder/dashboard/replayer surfaces are client children that take server-fetched props). `/` redirects authed users to `/dashboard`.
- `app/auth/callback/route.ts` — exchanges the OAuth `code` for a session cookie via `supabase.auth.exchangeCodeForSession`, then redirects to `/dashboard`. The callback URL must be whitelisted in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (both `http://localhost:3000/auth/callback` for dev and the production domain).
- `lib/hands/db.ts` — server-side CRUD over the `hands` table. Mints 8-char ids on insert (with PK collision retry). Exports `listMyHands`, `getHand`, `getHandForViewing` (resolves owner + auth state), `countMyHands`, `insertHand`, `updateHandDetails`, `setHandPublic`, `deleteHand`, `deleteHands`.
- `lib/hands/actions.ts` — `'use server'` thin wrappers over the db module: `saveHandAction`, `updateHandDetailsAction`, `setHandPublicAction`, `deleteHandAction`, `deleteHandsAction`. All revalidate `/dashboard` (and `/hand/<id>` where relevant).
- `supabase/migrations/` — versioned SQL. `0001_hands.sql` creates the table, indexes, RLS, and `updated_at` trigger; `0002_private_by_default.sql` adds `is_public` plus the owner-or-public SELECT policy. Apply via Supabase Dashboard → SQL Editor (no CLI installed).

### Persistence
- **Postgres-backed** via Supabase. Single `hands` table with column-mirrored metadata (name, stakes, date_display, hero_position, multiway, board, pot_type, tags, result, fav, notes, is_public) plus a `payload` jsonb column carrying the full RecorderState (`_full` shape: players, actions, board with nulls, blinds, heroPosition, straddle, muckedSeats, notes, venue, date, annotations, equityByStep).
- **RLS**: SELECT is `is_public OR auth.uid() = user_id` (anon + authenticated). INSERT/UPDATE/DELETE are owner-only via `auth.uid() = user_id`.
- **Privacy**: hands default `is_public = false`. Owners flip via the Share button in the replayer header.
- **Setup defaults** (player count, blinds, straddle, default stack) still live in localStorage under `smh:defaults` — these are per-browser preferences, not user data, so they intentionally stay client-side.

---

## Blocking user testing (must-fix before real users)

1. **Mobile-passable layout.** Recorder assumes ~1600px width. The redesign tightened things up vertically (action log moved to a popover, action bar is one row + drawer) but the meta strip + dock + popovers are still desktop-shaped. Phones — which is *when* a poker player actually wants to record a hand — get a broken layout. At least add a "best viewed on desktop" notice if a real responsive pass isn't shipping.

## v1.1 backlog (defer past first user test)

Suggested next pickup (top = most leverage):

1. **Action-annotation editing in the replayer.** Annotations are written in `/record` and surfaced in `/hand` as anchored note balloons, but the balloon has no edit affordance — owners can only edit annotations by re-recording. The handoff sketched a `Edit ✎` ghost link inside the balloon; implementing it means a new server action that patches `_full.annotations[index]` (plus optimistic local state, mirroring the hand-level Notes pencil flow already in `Replayer.tsx`). Also unblocks the deferred `n` keyboard shortcut.
2. **Mobile recorder layout** — see "Blocking" above. Even a "best viewed on desktop" notice would beat the current broken render.
3. **Auth-page styling** — `/login` and `/signup` are still the default-ish look. Bring them into the neutral charcoal + Inter system that the rest of the app uses.
4. **Bet-sizing presets aware of blinds** — at 1/2 stakes, opens are usually 5–10. A `2.5×` / `3×` / `pot + 1bb per limper` chip would cut entry time. The drawer's chip array is already trivially extensible (`chips: { id, label, amount }[]`).
5. **Edit gameplay actions on a saved hand.** Today only metadata (name / venue / date / notes / tags / fav) is editable. Re-recording is the workaround — fine for typos, painful for sharing-after-the-fact.
6. **Action-only stepping toggle in the replayer** — skip board-reveal steps, hop action-to-action.
7. **Replay speed control** — 1.1s/step is hardcoded.
8. **Wire the dashboard bulk action bar beyond Delete** — Tag / Share / Duplicate are stubs.
9. **Player-name autocomplete across hands** — record "Whale" once → suggest at the same venue.
10. **Sweep the remaining warm `oklch(... 60)` Tailwind arbitrary classes** in `Recorder.tsx` / `Replayer.tsx` if you want full neutral parity. Mechanical change; left intentionally during the dashboard-only neutralization sweep.

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
- **Setup defaults localStorage key is `smh:defaults`** (preserved across the V4b redesign — the handoff's `smh:recorderDefaults` was renamed back to keep existing user defaults working). Shape: `{ playerCount, sb, bb, straddleOn, straddleAmt, defaultStack }`. Read/write via `engine.readSetupDefaults` / `engine.writeSetupDefaults`.
