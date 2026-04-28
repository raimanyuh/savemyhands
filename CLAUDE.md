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

## Current State (as of 2026-04-27)

The app is end-to-end functional for a single user on a single device. Every priority above is implemented except real cross-device share URLs (#3 is half-done — URLs exist but only resolve from the recorder's own browser).

### What's working
- **Auth** — Supabase login / signup / logout. Untouched by recent design work; still uses default-ish styling (one of the v1.1 polish items).
- **Recorder** (`/record`) — full state machine: setup → preflop → flop → turn → river → showdown. Editable hand name, hero position selector (hero always renders bottom-center, table rotates around them), inline-editable stacks/nicknames, auto-advancing card pickers (flop, hero hole cards), action bar with ½/¾/Pot/All-in fills, live stack reduction, all-in detection, action log, undo. Side-by-side layout: action stuff left, notes panel right. Required-action emerald glow on hero cards (setup) and board slots (deal CTAs).
- **Showdown** — per-villain Show / Muck. Auto-determined winner via 7-card evaluator with split-pot handling. Save disabled until all villains decided. Header save disabled outside showdown so half-played hands can't be persisted.
- **Replayer** (`/hand/[id]`) — animated step-by-step playback, transport controls, keyboard nav (←/→/Space/Home/End), bet bubbles, dealer button, fold/muck dimming (mucked status correctly time-gated to the showdown step), 4-color deck, SMH wordmark on card backs, hero hole cards face-up, villain reveals at showdown if they showed.
- **Dashboard** (`/dashboard`) — sortable Name/Date/Venue/Stakes/Result columns, working filter popovers (Positions / Stakes / Players / Result / Tags / Pot type / Venue), search, inline rename, favorite star, four-color mini-cards, click-through to replayer.
- **Design tokens** — warm sepia OKLCH neutrals at hue 60° in `app/globals.css`. Inter as `--font-sans`. Emerald `oklch(0.696 0.205 155)` is the only saturated UI accent; everything else is grayscale-on-felt.

### Code map (key files)
- `components/poker/engine.ts` — `RecorderState`, reducer, `deriveStreet`, `committedBySeat`, `totalPot`, `formatAction`. State is cycle-indexed (BTN=0, SB=1, BB=2, …); `state.heroPosition` is hero's cycle index.
- `components/poker/hand.ts` — `SavedHand` (localStorage shape), `ReplayHand` (replayer input), `recordedToHand`, `computeStreetBets`, `committedThroughStep`, `hasFolded`.
- `components/poker/hand-eval.ts` — best-5-of-7 evaluator with proper kickers + the wheel.
- `components/poker/lib.ts` — `seatXY`, `chipXY`, `POSITION_NAMES`, `preflopOrder`, `postflopOrder`. Seats live on an ellipse with `RING_A=43, RING_B=40`. The visual rotation is `cycleIdx = (heroPosition + visualI) % N`.
- `components/poker/table-pieces.tsx` — `BetBubble` (with `isHero` flag for the hero-only nudge), `DealerButtonChip`, `NameDisplay`, `StackDisplay`, `TableSurface`.
- `components/poker/PlayingCard.tsx` — 4-color deck primitive (♠ black, ♣ green, ♦ blue, ♥ red).
- `components/poker/CardPicker.tsx` — `CardSlot` (single slot) and `CardRow` (multi-slot, `autoAdvanceCount` controls flop / hole-card chaining; `highlight` enables emerald glow).
- `components/poker/Recorder.tsx`, `components/poker/Replayer.tsx`, `components/poker/Dashboard.tsx` — the three product surfaces.
- `components/Shell.tsx` — page shell + header.
- `app/record/page.tsx`, `app/dashboard/page.tsx`, `app/hand/[id]/page.tsx` — routes.

### Persistence
- Currently localStorage only. Key: `smh:hands`. Saved hands carry a `_full` payload with the action log, board, blinds, hero position, mucked seats, notes, venue, date.
- **No Supabase tables yet.** The schema in this brief (`hands` / `hand_players` / `hand_actions` / `hand_streets`) is unimplemented.

---

## Blocking user testing (must-fix before real users)

Priority order, top is most blocking:

1. **Real share URLs.** This is the biggest gap. The whole "share a hand by URL" pitch is broken because hands live in localStorage. If user A sends user B a link, B sees the sample hand. Fix: implement the Supabase schema in this brief and make `/hand/[id]` fetch server-side (with a fallback to localStorage so old client-only saves still resolve for the original recorder). The `_full` payload model in `hand.ts` is already the right shape — it just needs to round-trip through Postgres.
2. **Delete a hand.** No row-level delete; bulk action bar buttons in the dashboard (Tag / Share / Duplicate / Delete) are stubs. At minimum need single-row delete with confirmation.
3. **Mobile-passable layout.** Recorder assumes ~1600px width. Phones — which is *when* a poker player actually wants to record a hand — get a broken layout. At least add a "best viewed on desktop" notice if a real responsive pass isn't shipping.
4. **Pot type auto-classification.** Recorder hardcodes `type: "SRP"` on save. Should derive from the action log (count preflop raises: 1 = SRP, 2 = 3BP, 3+ = 4BP). The Pot type filter is useless until this is fixed.
5. **Uncalled-bet refunds.** `totalPot` includes the full last bet even if villain folded. Hero who shoves $400 into a folded river is currently shown winning $X less than they actually did. Fix: in `totalPot` / `committedBySeat`, if the last aggressor's bet exceeds the largest committed amount among others-who-didn't-fold, refund the difference.
6. **Side-pot math for multi-way all-ins.** Single pot split among winners is wrong when a short stack should only win the main pot they could match. Build correct main/side pots based on per-seat committed amounts.
7. **Landing page.** `/` is still the Next.js placeholder.

## v1.1 backlog (defer past first user test)

- Edit a saved hand (saves are immutable today).
- Auth-page styling (bring login/signup into the warm-sepia / Inter system).
- Player-name autocomplete across hands (record "Whale" once → suggest at the same venue).
- Bet-sizing presets aware of blinds (2.5x / 3x / pot+1bb-per-limper chips).
- Replay speed control (current 1.1s/step is fixed).
- Action-only stepping toggle in the replayer (skip board reveals).
- Single-row "..." menu on dashboard rows (Edit / Duplicate / Delete).
- Wire the bulk action bar buttons.

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
- Engine is cycle-indexed throughout. Don't conflate visual seat slots and cycle positions — every render-time conversion goes through `(heroPosition + visualI) % N` (cycle from visual) or `(cycleIdx - heroPosition + N) % N` (visual from cycle).
- Hero is always at visual slot 0 (bottom-center). Hero's *cycle* index is `state.heroPosition` and changes when the user picks a different position in setup (via a record swap in the reducer).
- The 7-card evaluator only runs once `state.board.filter(Boolean).length === 5`. The showdown panel surfaces a hint when the board is incomplete.
