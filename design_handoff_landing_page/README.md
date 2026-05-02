# Handoff: savemyhands landing page

## Overview

The marketing landing page for savemyhands — the page a poker grinder lands on when they hear about the product, want to see what it is, and decide whether to sign up. Single scrolling page, dark, with the hero replay card as the centerpiece.

The five sections, top to bottom:

1. **Nav bar** — wordmark, three text links (How it works, FAQ, Sample hand), Sign in button
2. **Hero** — eyebrow pill, big two-line headline with emerald accent, lede paragraph, two CTAs, then the **glass replay card** (this is the thing that sells the product)
3. **How it works** — three numbered steps in a 3-column grid
4. **FAQ** — four questions, first one open by default
5. **Sign in** — small centered glass card with email + password
6. **Footer** — wordmark + copyright line

## About the design files

**The HTML and CSS in `prototype/` is a design reference, not production code.** It's a single-file static page with hand-rolled CSS, intended to communicate intended look, layout, sizing, and interaction. There's no build step, no framework, no JS framework — just one HTML file with inline styles.

The task is to **rebuild this page in the savemyhands codebase** using its existing patterns (likely React + whatever styling system is already in place: Tailwind, CSS modules, styled-components, etc.). Don't lift the markup or the CSS verbatim — read the prototype, understand the intent, and rebuild it idiomatically in the host environment.

If the codebase already has a `<Button>`, `<Card>`, or layout primitives, use them. Only build new primitives when nothing existing fits.

## Fidelity

**High fidelity.** Every color, font size, spacing value, border radius, and shadow in the prototype is intentional. Recreate the page pixel-for-pixel using the host codebase's tokens (or the values listed below if no token system exists yet).

The replay card especially — the glass treatment, the felt gradient, the scrubber, the seat plates — has a lot of small details that compose into the "this looks like a real product" feel. Those details are the whole point of the section. Take the time.

## Scope boundaries

**In scope:**
- The single landing page at `/` (or wherever marketing routes live)
- All five sections above
- Responsive behavior down to ~360px wide
- The hero replay card as a static visual (no live animation required for v1 — the scrubber doesn't need to scrub)

**Out of scope:**
- The actual product UI (`/record`, `/hand/:id`, `/dashboard`) — covered in separate handoffs
- Auth backend / form submission — the sign-in card is presentational; wire it up to whatever auth flow already exists
- Email capture, blog, pricing page, anything not on this single page
- Replay card animation — if you want to do it, sure, but v1 is a static snapshot of step 04/11

## Suggested file layout

I don't know the exact structure of the savemyhands repo, so these are **best-guess targets** — adjust to whatever convention the codebase uses.

```
apps/web/src/
  routes/
    index.tsx                       ← THIS PAGE (or marketing/+page.tsx, etc.)
  components/
    marketing/                      ← NEW — landing-page-only components
      Nav.tsx
      Hero.tsx
      ReplayCard.tsx                ← the glass replay card
      Felt.tsx                      ← shared felt/oval/seats — also used by /record desktop
      HowItWorks.tsx
      FaqAccordion.tsx
      LoginCard.tsx
      MarketingFooter.tsx
  styles/
    marketing.css                   ← if needed; prefer Tailwind/CSS-modules tokens if those exist
```

If the codebase already has a `<Felt>` or `<Table>` component for the actual recorder, **reuse it inside ReplayCard**. The hero replay card should look identical to the real product table; that's the whole point. The prototype rolls its own felt because it's standalone.

## Sections

### 1. Nav bar

**Layout (1120px max-width, 32px horizontal padding, 22px vertical padding):**

- Two-column flex, space-between
- Left: brand cluster — 28×28 mark + "savemyhands" wordmark
- Right: nav links cluster — 3 text links, 22px gap, then a "Sign in" ghost button

**Components:**

- **Mark** — 28×28, 8px radius, radial gradient `radial-gradient(ellipse at 50% 30%, #1f7a47 0%, #0e3d22 65%, #082818 100%)` with inset shadow `inset 0 0 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`. This evokes a felt poker table compressed into a tile.
- **Wordmark** — "savemyhands" (one word, lowercase), 17px, weight 600, letter-spacing -0.015em, color `--fg-strong`. Always lowercase, including in headings.
- **Nav links** — 13px, color `--fg-muted`, hover → `--fg`. No underlines.
- **Sign in (ghost button)** — 36px tall, 16px horizontal padding, 10px radius, transparent bg, 1px border `rgba(255,255,255,0.12)`, white text. Hover: `rgba(255,255,255,0.05)` background.

### 2. Hero

**Layout:**

- Centered, 80px top padding, 100px bottom padding
- Vertical stack: eyebrow → h1 → lede → CTAs → replay card
- All text-aligned center; replay card has 56px top margin

**Components:**

- **Eyebrow pill** — inline-flex with 6px emerald dot. Text "free · early access" in 11px, weight 600, letter-spacing 0.22em, uppercase, color `--emerald-bright`. Dot is 6px circle with `box-shadow: 0 0 12px oklch(0.745 0.198 155 / 0.6)` (soft emerald glow).
- **Headline** — `clamp(40px, 5.6vw, 76px)`, weight 600, letter-spacing -0.035em, line-height 0.98, color `--fg-strong`, `text-wrap: balance`. Two lines, with "live poker" on line 2 wrapped in a span colored `--emerald-bright`. Exact copy:
  > A database for the<br/>**live poker** grinder.
- **Lede** — 18px, line-height 1.55, color `--fg-muted`, max-width 580px, 26px top margin, `text-wrap: pretty`. Copy:
  > Take your notes from the casino, enter the hand on a visual table, and share a URL that plays back like an online history. No notation, no spreadsheets, no friction.
- **CTAs** — flex row, 12px gap, 32px top margin
  - Primary: 48px tall, 22px horizontal padding, 12px radius, bg `#fafaf9`, text `oklch(0.215 0 0)` (near-black). Copy: "Start recording →". Hover: bg `white`.
  - Ghost: same dimensions, transparent bg, white text, 1px border `rgba(255,255,255,0.12)`. Copy: "Watch a sample hand".

### 2a. Hero replay card (the centerpiece)

This is the most important visual on the page. It's a glass-treatment card containing a head bar (title + URL pill), a felt section (the actual table), and a foot bar (transport scrubber).

**Container:**

- Max-width 880px, centered, 56px top margin
- 18px border-radius
- 1px border `rgba(255,255,255,0.06)`
- Background: `linear-gradient(180deg, oklch(0.215 0 0 / 0.55) 0%, oklch(0.18 0 0 / 0.35) 100%)`
- `backdrop-filter: blur(8px)`
- Drop shadow: `0 30px 80px rgba(0,0,0,0.5)`
- `overflow: hidden` (so child gradients respect the radius)
- A `::before` pseudo-element with a soft emerald glow at the top: `radial-gradient(ellipse 70% 45% at 50% -5%, oklch(0.42 0.12 155 / 0.18) 0%, transparent 65%)`

**Head row** (14px 18px padding, bottom border `rgba(255,255,255,0.06)`):

- Left: title — "Friday $1/$2 — Aces cracked", 13px, weight 600, color `--fg`
- Right: URL pill — `display: inline-flex`, 7px 12px padding, 8px radius, bg `rgba(9,9,11,0.65)`, 1px border `--border-strong`, mono font, 12px, color `--fg-strong`. Inside: "savemyhands.app/hand/" + a span colored `--emerald-bright` with the slug "k7q2nx".

**Felt** (the table itself):

- Aspect-ratio 16:9
- Background: `radial-gradient(ellipse at 50% 30%, #1f7a47 0%, #0e3d22 65%, #082818 100%)`
- Inset shadow: `inset 0 0 100px rgba(0,0,0,0.55), inset 0 2px 6px rgba(0,0,0,0.45)`
- Position: relative; contains an absolutely-positioned grid that places the table-oval in its center

**Table oval:**

- 75% width, 65% height of the felt
- 50% border-radius (true ellipse)
- Background: `radial-gradient(ellipse at 50% 35%, oklch(0.5 0.13 155) 0%, oklch(0.32 0.10 155) 60%, oklch(0.18 0.07 155) 100%)`
- Wood-rim shadow: `box-shadow: 0 0 0 12px #2c1505, 0 0 0 14px #190a02, 0 28px 80px rgba(0,0,0,0.7), inset 0 0 60px rgba(0,0,0,0.55)`. The two solid `0 0 0` shadows simulate the leather/wood rim of a poker table — keep them.

**Inside the oval — pot label:**

- Absolute position: `top: 28%, left: 50%, translate(-50%, 0)`
- Text: "pot $48"
- Mono, 11px, color `rgba(255,255,255,0.85)`, letter-spacing 0.04em
- Background: `rgba(9,9,11,0.55)`, padding 4px 10px, 6px radius, 1px border `rgba(255,255,255,0.08)`

**Inside the oval — board cards:**

- Absolute centered, flex row with 6px gap
- 3 cards: 7♥ (red), 2♠ (black), J♦ (blue-ish — `oklch(0.5 0.18 250)`, deliberately slightly different from hearts to differentiate suits)
- Each card: 44×62, 4px radius, bg `#fafafa`, drop shadow `0 4px 10px rgba(0,0,0,0.5)`, weight 700, 17px

**Inside the oval — seats** (4 seats positioned by % around the oval):

| Seat | Position | Contents |
|---|---|---|
| Hero (BTN) | `left: 50%, top: 88%` | Plate above, hole cards (A♥ A♠) below. NOTE: prototype has cards below the plate for the hero — when porting, keep this for the marketing card |
| Whale (SB) | `left: 8%, top: 50%` | Face-down hole cards above, plate below. Plate shows "SB · Whale · $1,240" |
| reg_3 (UTG, folded) | `left: 50%, top: 12%` | Plate only, faded. "UTG · reg_3 · $305" |
| fish_4 (CO) | `left: 92%, top: 50%` | Face-down hole cards above, plate below. "CO · fish_4 · $210" |

**Plate** (the seat label):
- min-width 80px, padding 6px 10px, 10px radius
- Background `rgba(9,9,11,0.85)`, 1px border `rgba(255,255,255,0.1)`
- Drop shadow `0 8px 20px rgba(0,0,0,0.55)` + inset highlight `inset 0 1px 0 rgba(255,255,255,0.04)`
- `backdrop-filter: blur(6px)`
- Vertical flex with 2px gap, items centered
- Three lines:
  - Position abbrev — 8px, weight 600, `#d4d4d8`, letter-spacing 0.14em, uppercase
  - Name (optional, omitted for hero where pos already says "BTN · Hero") — 11px, weight 500, `#f4f4f5`
  - Stack — 11px, weight 600, `--emerald-bright`, tabular-nums
- Folded state: `opacity: 0.4, filter: grayscale(0.7)`

**Hole cards** (face-up):
- 26×36, 3px radius, white bg, drop shadow, weight 700, 11px
- Suit color same as board cards

**Hole cards** (face-down):
- Same dimensions, background `linear-gradient(135deg, #6b1722 0%, #2a0608 100%)`, 1px border `rgba(255,255,255,0.1)`. The deep-red gradient evokes a real card back.

**Bet bubbles** — 3 of them on the table at this moment, each at ~50% on the line between the seat and the pot:
- `left: 50%, top: 73%` (hero's bet)
- `left: 18%, top: 50%` (Whale's bet)
- `left: 82%, top: 50%` (fish_4's bet)
- Each: chip icon + amount pill, side by side, 4px gap, transformed to `translate(-50%, -50%)` so the position values mark the center
- **Chip:** 16px circle, gradient `linear-gradient(180deg, #fafaf9 0%, #d6d3d1 100%)`, 1.5px dashed border `#57534e`, inset white ring `inset 0 0 0 1.5px #ffffff`. Drop shadow.
- **Amount pill:** padding 0 6px, 18px tall, inline-flex, 5px radius, 10px font, weight 600, white. bg `rgba(9,9,11,0.85)`, border `rgba(255,255,255,0.12)`. tabular-nums. Copy: "$24" on each.

**Dealer button:**
- `left: 62%, top: 78%` — placed near hero (BTN)
- 18×18 circle, gradient `radial-gradient(circle at 32% 28%, #ffffff 0%, #f1f0ee 60%, #c2bfbb 100%)`, "D" inside (weight 900, 10px, near-black), drop shadow, 1px border `rgba(0,0,0,0.2)`
- The off-center radial gradient gives it a subtle ivory-disc 3D feel — keep it.

**Foot row** (transport bar, 14px 18px padding, top border `rgba(255,255,255,0.06)`, bg `rgba(9,9,11,0.35)`):

- Flex row, 14px gap, items centered
- Left: play icon — 28×28, 8px radius, emerald bg, near-black "▶" character (font-size 11, weight 900). The bg color is `--emerald`, not `--emerald-bright`.
- Middle: scrubber track — `flex: 1`, 4px tall, 2px radius, bg `rgba(255,255,255,0.08)`. Inside: a fill at 38% width (emerald-bright), and a 12×12 white thumb at the same position with drop shadow.
- Right: step counter — mono, 12px, color `--fg-muted`, tabular-nums. Format: `<emerald-bright "04"> / 11`.

### 3. How it works

**Layout:**
- 100px vertical padding
- Centered section head: eyebrow + h2
- 3-column grid below, 18px gap

**Section head:**
- Eyebrow: "how it works", 10px, weight 600, letter-spacing 0.22em, uppercase, color `--emerald-bright`
- h2: "Three steps from felt to share link.", `clamp(28px, 3.5vw, 44px)`, weight 600, letter-spacing -0.02em, line-height 1.1, color `--fg-strong`. 12px top margin from eyebrow. 56px bottom margin before grid.

**Step card:**
- 14px radius, 1px border `rgba(255,255,255,0.08)`, bg `oklch(0.18 0 0)`, 26px padding
- Top: step number, mono, 12px, color `--emerald-bright`, format `01 / 03`
- h3: 18px, weight 600, color `--fg-strong`, letter-spacing -0.01em. 12px above, 8px below.
- Body: 14px, line-height 1.6, color `--fg-muted`

Three steps with this exact copy:

1. **Note it at the table** — "Jot the hand on your phone the way you already do — stakes, positions, action, board. No structured form, no app to learn between hands."
2. **Enter on a visual table** — "Drop seats into position, deal hole cards, click each action. The replay rebuilds itself as you go. Pin a note to any spot you want to revisit."
3. **Share a real URL** — "Every hand gets a public link that plays back like an online history. Send it to your study group, paste it in Discord, watch it back six months later."

### 4. FAQ

**Layout:**
- 80px top padding, 100px bottom padding
- Centered section head: eyebrow "faq" + h2 "The quick version."
- Vertical stack of FAQ rows, 12px gap, max-width 720px, centered

**FAQ row (collapsed):**
- 14px radius, 1px border `rgba(255,255,255,0.08)`, bg `oklch(0.18 0 0)`, 18px 22px padding
- Question row: flex space-between, 15px font, weight 600, color `--fg-strong`, cursor pointer
- Right glyph: mono "+", color `--fg-subtle`, 16px

**FAQ row (open):**
- Same as collapsed, plus glyph changes to "−" colored `--emerald-bright`
- Answer paragraph below: 14px, line-height 1.6, color `--fg-muted`, 12px top margin

Four questions:

1. **Is this for online play?** (open by default)
   > No. Online sites already give you a hand history file. savemyhands is for the live game — where there's no log, no replayer, and the only record is whatever you remember on the drive home.
2. **Are shared hands public?** (collapsed; copy TBD by maintainer)
3. **Does it work with mixed games?** (collapsed; copy TBD)
4. **What does it cost?** (collapsed; copy TBD)

The last three need real copy from the maintainer before launch. The prototype shows them collapsed without answers as a placeholder. **Don't ship them empty** — either fill in the answers or remove the rows.

### 5. Sign-in card

**Layout:**
- 60px top padding, 100px bottom padding
- Single centered card, max-width 380px

**Card container:**
- 18px radius
- Background: `linear-gradient(180deg, oklch(0.215 0 0 / 0.7) 0%, oklch(0.18 0 0 / 0.55) 100%)`
- 1px border `rgba(255,255,255,0.08)`
- Drop shadow `0 30px 80px rgba(0,0,0,0.5)`
- `backdrop-filter: blur(8px)`
- 32px 28px padding
- `overflow: hidden`
- `::before` pseudo with soft emerald glow at top: `radial-gradient(ellipse 70% 45% at 50% -10%, oklch(0.42 0.12 155 / 0.18) 0%, transparent 65%)`

**Card head:**
- Centered, 24px bottom margin
- Eyebrow "sign in" — 10px, weight 600, letter-spacing 0.22em, uppercase, color `--emerald-bright`
- h2 "Pick up where you left off." — 24px, weight 600, letter-spacing -0.02em, color `--fg-strong`. 10px top, 6px bottom margin.
- Sub "Use the email you signed up with." — 13px, color `--fg-muted`

**Form:**
- Vertical flex, 14px gap

**Field:**
- Label above input, 6px gap
- Label: 13px, weight 500, color `--fg`
- Input: 40px tall, 12px horizontal padding, bg `rgba(9,9,11,0.5)`, color `--fg`, 1px border `--border-strong`, 10px radius, 14px font, no outline
- Focused: border-color `--emerald`

**Submit button:**
- Full-width, 42px tall, 10px radius, bg `--emerald`, text `oklch(0.145 0 0)`, weight 600
- Copy: "Sign in"

**Foot row** below button:
- Flex space-between, 12px font, color `--fg-subtle`
- Left link: "Forgot password?" → `/forgot`
- Right link: "Create account →" → `/signup`
- Hover: links become `--emerald-bright`

### 6. Footer

**Layout:**
- 1px top border `rgba(255,255,255,0.06)`, 28px vertical padding
- Flex row, space-between, 1120px max-width, 32px horizontal padding
- 12px font, color `--fg-subtle`

**Contents:**
- Left: brand cluster (smaller mark — 22×22, 6px radius — and wordmark in 14px, weight 600, color `--fg-strong`)
- Right: "© savemyhands · built by a grinder, for grinders"

## Page atmosphere

Two fixed-position pseudo-elements on the page wrapper provide the ambient feel:

- **Soft emerald glow at top** — `position: fixed; inset: 0; pointer-events: none; z-index: 0;` with `background: radial-gradient(ellipse 70% 45% at 50% -5%, oklch(0.42 0.12 155 / 0.14) 0%, transparent 65%);`
- **Subtle noise overlay** — same positioning, opacity 0.025, mix-blend-mode overlay, with an inline SVG turbulence texture as a tiled background. Adds film grain at a barely-perceptible level. Don't skip this — it's why the page feels like a product and not a Tailwind template.

The actual page content sits in a `position: relative; z-index: 1` container above both layers.

## Interactions & behavior

- **Nav links** — smooth scroll to `#how-it-works`, `#faq`, `#sample-hand`. Add IDs to those sections.
- **CTAs** — "Start recording →" navigates to `/record` (or `/signup` if not authenticated). "Watch a sample hand" opens a real shared hand — pick whichever sample link maintains itself.
- **FAQ accordion** — click question to toggle; only one open at a time, OR allow multiple (designer's choice; prototype shows just the first open). Glyph toggles between `+` and `−`. Smooth height transition (200–280ms ease-out).
- **Sign-in form** — wire up to the existing auth flow. Don't reinvent.
- **Replay card** — static in v1. If you want to go further later, it could autoplay through the 11 steps of the hand on a loop, but that's not required.
- **Hover states** — every link/button has one. The prototype is precise; preserve.

## State management

This page is mostly stateless. The only local state:

- FAQ accordion — `useState<number | null>(0)` for which row is open (0 = first row open by default).
- Sign-in form — controlled inputs + submit handler that calls existing auth.

No global state, no data fetching. The replay card is hard-coded values matching the demo hand "Friday $1/$2 — Aces cracked".

## Design tokens

These are pulled from `reference/colors_and_type.css`. If the codebase already has a token system, map onto it; if not, paste these into a `tokens.css`.

### Colors

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.10 0 0)` | Page bg |
| `--bg-elev-2` | `oklch(0.16 0 0)` | (not used here, but in the system) |
| `--bg-elev-3` | `oklch(0.18 0 0)` | Step cards, FAQ rows |
| `--fg` | `oklch(0.92 0 0)` | Body text |
| `--fg-strong` | `oklch(0.98 0 0)` | Headings |
| `--fg-muted` | `oklch(0.70 0 0)` | Secondary text |
| `--fg-subtle` | `oklch(0.55 0 0)` | Tertiary text, footer |
| `--emerald` | `oklch(0.696 0.205 155)` | Primary CTA bg, scrubber play button |
| `--emerald-bright` | `oklch(0.745 0.198 155)` | Eyebrows, accents, scrubber fill, hover |
| `--border` | `rgba(255,255,255,0.06)` | Section borders |
| `--border-strong` | `rgba(255,255,255,0.10)` | Emphasized borders |

### Typography

| Token | Value |
|---|---|
| `--font-sans` | `Inter, -apple-system, system-ui, sans-serif` |
| `--font-mono` | `"Geist Mono", ui-monospace, "SF Mono", monospace` |

The prototype loads Inter and Geist Mono from Google Fonts (`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap')`). Match this in the host codebase, ideally with a self-hosted version using the existing font-loading strategy.

### Sizes used

- 76 / clamp / 40 — h1
- 44 / clamp / 28 — section h2
- 24 — login card h2
- 18 — lede, step h3, replay card body
- 17 — wordmark in nav
- 15 — FAQ question
- 14 — step body, login button, login form input
- 13 — nav link, login label, login sub, replay head title
- 12 — footer, scrubber step, URL pill, login row foot
- 11 — eyebrows, plate, pot label, hole cards, replay head meta, step number
- 10 — section eyebrow, login eyebrow, bet pill, dealer "D"
- 8 — plate position abbrev

### Radii

- 4 — board card
- 5 — bet pill
- 6 — pot label, footer mark
- 8 — URL pill, scrubber play
- 10 — buttons (default), login form input, plate, login submit
- 12 — large button, scrubber, login submit
- 14 — step card, FAQ row
- 18 — replay card, login card
- 50% — dealer disc, eyebrow dot, oval

### Shadows

- Step card: 1px border, no shadow
- Login card: `0 30px 80px rgba(0,0,0,0.5)` + glow pseudo
- Replay card: `0 30px 80px rgba(0,0,0,0.5)` + glow pseudo
- Felt inset: `inset 0 0 100px rgba(0,0,0,0.55), inset 0 2px 6px rgba(0,0,0,0.45)`
- Oval rim: `0 0 0 12px #2c1505, 0 0 0 14px #190a02, 0 28px 80px rgba(0,0,0,0.7), inset 0 0 60px rgba(0,0,0,0.55)`
- Plate: `0 8px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)`
- Card (board/hole): `0 4px 10px rgba(0,0,0,0.5)`
- Bet chip: `0 3px 6px rgba(0,0,0,0.55), inset 0 0 0 1.5px #ffffff`
- Eyebrow dot: `0 0 12px oklch(0.745 0.198 155 / 0.6)`

## Responsive behavior

The prototype uses a 1120px max-width container with 32px horizontal padding. Behavior at smaller widths:

- **Below 720px:** Stack the 3-column "How it works" grid into 1 column. Keep step cards same size.
- **Below 600px:** Hero h1 starts shrinking via `clamp()`. Lede stays 18px (don't shrink — readability matters more than fit).
- **Below 540px:** Replay card becomes the visually dominant element by far. The seat positions are %-based on the felt so they reflow with the felt. The pot label and bet bubbles may overlap each other a bit at the smallest sizes; if so, hide the bet bubbles below 480px (they're decorative on the marketing page, not data).
- **Below 480px:** Drop the nav links (How it works, FAQ, Sample hand) into a hamburger menu. The Sign in button can stay visible.

The page is **portrait mobile primary for marketing** — most landing-page traffic is mobile. Test at 360px, 390px, 414px before declaring done.

## Test cases

1. **Page loads at 1440px** with the replay card at full 880px width, all 4 seats visible around the oval, dealer button near hero, 3 bet bubbles, scrubber at 38%.
2. **Page loads at 390px (iPhone)** with the replay card scaled, board cards still readable, plates not overlapping.
3. **FAQ row 1 is open by default**; clicking row 2 opens it (+ closes row 1, if single-open behavior is chosen).
4. **All hover states fire** — primary button bg lightens to white, ghost button shows subtle bg, FAQ row glyph color is brighter on hover.
5. **Sign-in form has accessible labels** (label + input with `htmlFor`/`id`) and tab order works left-to-right, top-to-bottom.
6. **Page atmosphere** (emerald glow + noise) renders behind content but doesn't catch pointer events.
7. **Reduced motion** — if a user has `prefers-reduced-motion`, skip the FAQ height transition. (The prototype doesn't handle this; please add when implementing.)

## Assets

Only one image asset:

- **`prototype/icon.svg`** — the savemyhands favicon / brand mark in SVG. Use as the favicon (`<link rel="icon">`) and for the OG/Twitter card if those are added later.

The hero brand mark (28×28 in nav) is **not** the SVG icon — it's a CSS-only radial-gradient tile that evokes a felt. The prototype uses CSS for both because the geometric simplicity makes it cheaper to render and ensures it stays sharp at any DPI. Keep it as CSS in production.

If the codebase already has a logo/brand SVG component, use that instead of the CSS tile in nav — but verify it visually matches the felt-tile aesthetic. If it's a workmark-only logo, reproduce the felt tile.

## Files in this bundle

```
design_handoff_landing_page/
├── README.md                            ← this file
├── prototype/
│   ├── index.html                       ← entry point, open in browser
│   ├── _base.css                        ← shared base styles (resets, typography, eyebrow)
│   └── icon.svg                         ← favicon / brand mark
└── reference/
    ├── colors_and_type.css              ← full design system token sheet
    └── design_system_README.md          ← brand voice, copy guidelines, type system
```

To preview the prototype locally:
```bash
cd design_handoff_landing_page/prototype
python3 -m http.server 8000
# Open http://localhost:8000
```

The prototype references `../../colors_and_type.css` and `../../preview/_base.css` via the design system project structure. The `_base.css` in this bundle inlines what's needed; if you preview from the bundled folder, the path `../../colors_and_type.css` won't resolve — fix the path to `../reference/colors_and_type.css` in `_base.css` line 6 if you want to preview locally, or just open `prototype/index.html` directly with the missing fonts (it falls back to system sans).

## Open questions for the maintainer

1. **FAQ rows 2–4 need real copy.** The prototype shows the questions but the answers are TBD. Either supply copy or remove those rows.
2. **CTA destinations.** "Start recording →" — does it go to `/record` (auth required) or `/signup`? "Watch a sample hand" — which hand do you want to feature? It should be a real, well-annotated, fun hand.
3. **Sample-hand link in nav.** Same question — which hand?
4. **Sign in card vs. sign-in page.** The card on the landing page is a marketing element. Should it actually log users in inline, or is it a "preview" that links to a dedicated `/signin` route? The prototype renders it as a real form; recommend inline login if your auth backend supports it (one less click to retention).
5. **Email-capture in v2?** The page currently doesn't capture leads. If marketing wants a "Notify me when X is ready" pill, this is the place. Out of scope for v1.
6. **Animation budget.** Replay card is static in v1. If you want it animated (autoplay through the hand's 11 steps on a 12-second loop), call it out — that's a meaningful additional task, not a 30-minute polish.
