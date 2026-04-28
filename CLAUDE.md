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

The app is end-to-end functional with cross-device share URLs. Hands persist per-user in Postgres, share URLs work for anon visitors when the owner toggles a hand public, and the dashboard reflects the signed-in user's own hands only (with bundled samples shown to first-run accounts).

### What's working
- **Auth** — Supabase login / signup / logout, plus OAuth via Google and Discord (buttons on `/login` and `/signup`, callback at `/auth/callback`). Still uses default-ish styling (one of the v1.1 polish items). Signed-in visitors hitting `/` redirect to `/dashboard`; anon visitors get the placeholder until the landing page ships.
- **Recorder** (`/record`) — full state machine: setup → preflop → flop → turn → river → showdown. Editable hand name, hero position selector (hero always renders bottom-center, table rotates around them), inline-editable stacks/nicknames, auto-advancing card pickers (flop, hero hole cards), action bar with ½/¾/Pot/All-in fills, live stack reduction, all-in detection, action log, undo. Side-by-side layout: action stuff left, notes panel right. Required-action emerald glow on hero cards (setup) and board slots (deal CTAs). Pot type auto-classified on save from preflop raise count (LP / SRP / 3BP / 4BP / 5BP).
- **Showdown** — per-villain Show / Muck. Auto-determined winner via 7-card evaluator. Side-pot decomposition handles multi-way all-ins (`engine.computeSidePots` + `hand-eval.awardPots` + `seatWinnings`); pot-by-pot breakdown rendered when there are 2+ pots. Pot displayed reflects uncalled-bet refunds. Save disabled until all villains decided. Header save disabled outside showdown so half-played hands can't be persisted.
- **Replayer** (`/hand/[id]`) — server-rendered, public-readable. Animated step-by-step playback, transport controls, keyboard nav (←/→/Space/Home/End), bet bubbles, dealer button, fold/muck dimming (mucked status correctly time-gated to the showdown step), 4-color deck, SMH wordmark on card backs, hero hole cards face-up, villain reveals at showdown if they showed. First step is "Blinds posted" (no actions yet); first ←/→ plays the first action.
- **Equity** — header toggle in the replayer reveals every villain who showed at showdown and overlays a per-seat equity badge at the current step's board. Equity is precomputed at save time (`_full.equityByStep`) so back/forth navigation is a pure lookup; older hands without it fall back to live runout enumeration. Skipped pre-flop (1.7M-runout enum is too slow for a synchronous toggle).
- **Sharing** — hands default private. Owners see a Lock/Globe toggle in the replayer header; toggling Public also auto-copies the URL to clipboard. Anon viewers can open a public hand directly; private hands and unknown ids return 404. Anon viewers see a "Save your own hands → Sign up" CTA in place of owner controls; the dashboard back-link is hidden for them.
- **Dashboard** (`/dashboard`) — server-fetches the signed-in user's hands. Sortable Name/Date/Venue/Stakes/Result columns, a Starred toggle that hides non-favorites, filter popovers (Positions / Stakes / Players / Multiway / Result / Tags / Pot type / Venue), search, inline rename, favorite star, four-color mini-cards, click-through to replayer. Per-row "⋯" menu with Edit details (modal: name/venue/date/notes) and Delete (with confirm). Bulk-select Delete in the action bar. Bundled `SAMPLE_HANDS` shown only when the user has zero saved hands; sample rows wear a "sample" chip next to the name and skip server actions on edit/delete.
- **Design tokens** — warm sepia OKLCH neutrals at hue 60° in `app/globals.css`. Inter as `--font-sans`. Emerald `oklch(0.696 0.205 155)` is the only saturated UI accent; everything else is grayscale-on-felt.

### Code map (key files)
- `components/poker/engine.ts` — `RecorderState`, reducer, `deriveStreet`, `formatAction`. Chip math: `committedBySeat` (raw, for live recorder display) / `committedBySeatFinal` (with per-street uncalled-bet refund), `totalPot` / `totalPotFinal`, `computeSidePots` (main + side pot decomposition with eligible seats; consecutive same-eligibility layers merge so dead-blind contributions roll into the main pot instead of fragmenting into ghost side pots). All commit math is stack-aware: a "call" or "raise" is capped at `stack[seat] − previous-streets-commit`, and a short-stack all-in for less than the current bet doesn't lower `lastBet` for downstream callers. The `CommitState` structural type lets these helpers also accept a `SavedHand._full` payload. State is cycle-indexed (BTN=0, SB=1, BB=2, …); `state.heroPosition` is hero's cycle index.
- `components/poker/hand.ts` — `SavedHand` (the row + payload shape that round-trips through Postgres), `ReplayHand` (replayer input), `recordedToHand` (uses refund-adjusted pot + per-pot eval to label the showdown step; passes `_full.equityByStep` through to the replayer), `computeStreetBets`, `committedThroughStep`, `hasFolded`, `derivePotType`, `potTypeOf`.
- `components/poker/hand-eval.ts` — best-5-of-7 evaluator with proper kickers + the wheel. `awardPots` resolves winners per side pot (returning `PotAward[][]` so future hi-lo / multi-board games can append additional awards per pot). `seatWinnings(awards, seat)` sums a player's allocations across pots.
- `components/poker/equity.ts` — `computeEquity(contestants, board)` enumerates every runout for a given partial board (flop/turn/river only — pre-flop is skipped because 5-card runouts are too slow for a synchronous toggle). `precomputeEquityByStep(hand)` walks every step in a `ReplayHand` and produces the `_full.equityByStep` map saved alongside the hand. The replayer prefers that precomputed map; runout enumeration is the fallback for older hands that predate the field.
- `components/poker/lib.ts` — `seatXY`, `chipXY`, `POSITION_NAMES`, `preflopOrder`, `postflopOrder`. Seats live on an ellipse with `RING_A=43, RING_B=40`. The visual rotation is `cycleIdx = (heroPosition + visualI) % N`.
- `components/poker/table-pieces.tsx` — `BetBubble` (with `isHero` flag for the hero-only nudge), `DealerButtonChip`, `NameDisplay`, `StackDisplay`, `TableSurface`.
- `components/poker/PlayingCard.tsx` — 4-color deck primitive (♠ black, ♣ green, ♦ blue, ♥ red).
- `components/poker/CardPicker.tsx` — `CardSlot` (single slot) and `CardRow` (multi-slot, `autoAdvanceCount` controls flop / hole-card chaining; `highlight` enables emerald glow).
- `components/poker/Recorder.tsx`, `components/poker/Replayer.tsx`, `components/poker/Dashboard.tsx` — the three product surfaces.
- `components/Shell.tsx` — page shell + header.
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

Priority order, top is most blocking:

1. **Landing page.** `/` is still the Next.js placeholder for unauthenticated visitors (signed-in users redirect straight to `/dashboard`). User intends to design with Claude design.
2. **Mobile-passable layout.** Recorder assumes ~1600px width. Phones — which is *when* a poker player actually wants to record a hand — get a broken layout. At least add a "best viewed on desktop" notice if a real responsive pass isn't shipping.

## v1.1 backlog (defer past first user test)

- Edit gameplay actions on a saved hand (only metadata is editable today; gameplay re-edit was tried and removed because the user is OK with re-recording for now).
- Auth-page styling (bring login/signup into the warm-sepia / Inter system).
- Player-name autocomplete across hands (record "Whale" once → suggest at the same venue).
- Bet-sizing presets aware of blinds (2.5x / 3x / pot+1bb-per-limper chips).
- Replay speed control (current 1.1s/step is fixed).
- Action-only stepping toggle in the replayer (skip board reveals).
- Wire the bulk action bar buttons beyond Delete (Tag / Share / Duplicate are still stubs).

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
