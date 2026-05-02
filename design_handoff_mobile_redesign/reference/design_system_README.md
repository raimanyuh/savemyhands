# savemyhands — design system

A live-poker hand history database for grinders. Capture a hand from the casino on a visual table, get a sharable URL that plays back like an online history, and annotate any spot. The product feels like a serious analysis tool, not another gambling app.

## CONTENT FUNDAMENTALS

### Voice & tone
Direct, plainspoken, written by a player for players. Confident but never hype-y. Short sentences. We talk about *hands*, *spots*, *lines*, *the felt* — the language of the live cardroom — and we name positions by their poker abbreviations (BTN, CO, HJ, UTG, BB, SB).

We are explicitly **not**: gambling-promotional, addictive-pattern, neon-and-chrome-casino, or "AI coach" hyped. No "10x your win-rate." No cheering. No emoji. No exclamation marks.

### Naming conventions
- Product: **savemyhands** (one word, all lowercase, including in headings and links). The exception is the start of a sentence, where it stays lowercase intentionally — it's a wordmark.
- Hands are referred to by user-given titles ("Friday $1/$2 — Aces cracked"), never by IDs in UI.
- URLs use a 6-char base32-ish slug: `savemyhands.app/hand/k7q2nx`.
- Players in a hand: "Hero" for the user, otherwise free-text screen names ("Whale", "reg_3", "fish_in_seat_4"). Never auto-anonymize to "Player 1" except for folded seats not yet entered.

### Headline patterns
- Marketing H1 — short, declarative, one accent phrase in emerald: *"A database for the **live poker** grinder."*
- Section header — direct: *"Three steps from felt to share link."*, *"Built for the live game."*
- Empty state — short and useful: *"No hands yet. Start by recording one →"*

### Numbers & money
- Always tabular-nums in any monetary or stack-size context.
- US dollars by default: `$24`, `$1,240`. No leading `+` on raises in the log; use a verb instead (`Hero raises $24`).
- Pot size shows as `pot $48`, lowercased label.
- Stakes formatted as `$1/$2` (not `1/2 NLH`). Cap is `$1/$2/$5` if straddled. Game type only shown when not Hold'em.

### Microcopy rules
- Buttons are verbs in title case: *Save hand*, *Share link*, *Add note*, *Delete*.
- Destructive confirms name the object: *"Delete this hand?"*, body explains what's lost and warns it's permanent.
- Empty states should never be just an illustration — always include the next action.

## VISUAL FOUNDATIONS

### Concept
Charcoal control room with one warm green spotlight. The interface itself is dark, dense, tabular — but the **table** (when shown) is a real felt surface with depth, wood rails, and properly lit playing cards. Two materialities, one product:

1. **Chrome** — flat charcoal cards on a near-black ground; thin white-alpha borders; small, precise type. This is where users *work*.
2. **Felt** — a rich green radial-lit playing surface with shadowed cards, chip stacks, and dealer button. This is where the *hand* lives.

The seam between them — a felt-textured replay sitting inside a charcoal panel — is the signature visual of the product.

### Color
Foundation is a true neutral charcoal scale (achromatic OKLCH, C=0). One brand color: **emerald** — used sparingly for the active accent (hero highlight, dot indicator, share-link slug, primary stat). Destructive is a single warm red, only on delete/confirm flows.

The 4-color deck (clubs green, diamonds blue, spades black, hearts red) is non-negotiable — it's how live players read cards on screens. Don't drop to 2-color even on small thumbnails.

Felt and wood rail are scoped to the **table surface** only. Never use them as page backgrounds.

### Typography
**Inter** for everything UI (display through body). Tight tracking on display sizes (-0.035em at 56px), normal at body. Weights kept to 400 / 500 / 600 — no thin/light, no black.

**Geist Mono** for: tabular numbers in dense logs, the share-URL pill, step counters (`02 / 04`), keyboard shortcuts, and any place a value should *feel* like a value rather than a word.

The **eyebrow label** — 10px, 0.22em tracking, uppercase, emerald — is a system-wide rhythm element. Use it above section heads in marketing, above panels in the app.

### Layout
- 8-pt spacing grid; tighter inside dense panels (4-pt).
- Two-column dashboard: **hand list left (320px)**, **detail right (fills)**.
- The replay is always centered in its panel; controls and metadata orbit it.
- Marketing pages cap content at 1120px; hero can go full-bleed.

### Motion
Restrained: 150ms ease for hovers and form focus, 220ms for state transitions on the felt (a card flipping, chips being pushed). No bounce. No parallax. The replay scrubber is the **only** place we use a longer-held animation, and it's literally playing back the user's hand — so it's content, not chrome.

### Imagery
We don't have stock photos. We have:
- The product itself (replays, hand lists, annotations) screenshotted for marketing.
- The four playing-card suits as iconography.
- A single chip, a single dealer button, drawn as primitives.

If a marketing slot calls for a "photo" we use a felt-and-cards composition rendered in CSS, not a stock image of someone playing poker.

## ICONOGRAPHY

We don't carry a Lucide-style icon set. The system uses **three icon sources**, each scoped tightly:

1. **Card suits** (♠ ♣ ♦ ♥) — Unicode glyphs styled in the 4-color deck palette. These appear on every playing card and as system iconography for filters, suit selectors, and the brand mark.
2. **Action glyphs** — minimal text or 12px geometric primitives drawn inline: `→` (start recording), `+` (add note), `×` (close), `D` (dealer button), `✓` (selected). No external icon font.
3. **The brand mark itself** — a single SVG: a felt-green rounded square with a stylized hand of cards. Lives in `assets/icon.svg`. Used as the favicon, app icon, footer mark.

If you need an icon that isn't in those three buckets, prefer a labeled button instead. The system trades icon density for type density — that's intentional.

## COMPONENT PRINCIPLES

- **Surfaces** come in two flavors. **Flat cards** (`bg-elev-1`, 1px white/8% border, radius 14) for ordinary panels. **Glass cards** (gradient + blur + faint emerald glow + radius 18 + 2xl shadow) for the hero replay and other "this is the moment" surfaces. Don't mix.
- **Buttons** stay quiet. Marketing CTAs are `#fafaf9` on charcoal (light primary) at 48px tall. App buttons are 36px. Emerald fill is reserved for the single primary action in a flow (Save hand). Ghost and outline carry everything else.
- **Playing cards** have one geometry: 56×80 (full), 34×48 (hole-card stack), with consistent radius-5 corners and a soft drop shadow. Backs use the dark-red gradient with a faded `smh` wordmark.
- **Seat plates** are dark glass tiles that *float above* the felt — never flush. Position pill (BTN/BB/etc.) on top, name center, stack in emerald below. Folded seats drop to 45% opacity and grayscale.
- **Bet bubbles** are a chip + amount pill, tightly grouped, on the felt. The pill is near-black (`rgba(9,9,11,0.85)`) so it reads against any felt color. Annotated bets get an emerald-tinted variant.
- **The action log row** highlights the *current* step (emerald-tinted background + emerald border) and dims completed steps. Folded players go to muted gray.
- **The annotation balloon** is the one place we let a card breathe with a subtle emerald border + arrow tail pointing back at the action it's pinned to.

## STARTING POINT

Open `colors_and_type.css` for tokens and the import line for fonts. Every preview card under `preview/` pulls in `_base.css`, which in turn imports `colors_and_type.css` — that's the full foundation. Each preview is a real, working swatch of the system; copy from them rather than re-deriving values.
