Future wishlist:
Other game types (PLO, double board)
Username instead of email
Organize hands by folders
Able to share folders of hands with others, use case being coach/student.
Mobile site optimized.
Monetize it somehow.

State of savemyhands

  What's solid

  Auth — login / signup / logout via Supabase. Existing from before our work; haven't touched. Functional but unstyled vs the rest.

  Dashboard — list view with sortable Name/Date/Venue/Stakes/Result columns, working filter popovers (Positions / Stakes / Players /
  Result / Tags / Pot type / Venue), search box, inline rename, favorite star, four-color mini cards. Click-through to the replayer
  works.

  Recorder — the heart of the app, and it's pretty complete:
  - Full setup (player count, blinds, straddle, hero position, hero hole cards)
  - Auto-advance card pickers (flop, hero hole cards)
  - Action bar with fold/check/call/bet/raise + ½/¾/Pot/All-in fills
  - Live stack reduction, all-in detection, action log, undo
  - Hand info (editable name, venue, date, notes)
  - Required-action highlighting (hero cards in setup, board on deal CTAs)
  - Showdown with per-villain Show/Muck and auto-determined winner via 7-card evaluator
  - Side-by-side layout with notes panel so you don't scroll

  Replayer — animated step-by-step playback, transport controls, keyboard nav (←/→/Space/Home/End), bet bubbles, dealer button,
  mucked/folded states (now correctly time-gated), 4-color deck, notes/venue/date display.

  Engine correctness — preflop action loop traced through ~10 scenarios including the 8-handed straddle bug you caught. Hand evaluator is
   straight-flush-down-to-high-card with proper kickers and the wheel.

  What I'd block user testing on

  These are real gaps, not nice-to-haves:

  1. Share URLs don't actually share. This is the biggest one. The product brief is "share a hand by URL"; today the URL only resolves on
   the device that recorded it because everything's in localStorage. If you DM a friend savemyhands.app/hand/abc123, they get the sample
  hand. Needs Supabase tables (hands, hand_players, hand_actions, hand_streets per the brief) and a server route. Without this, the app
  is a personal journal, not a sharing tool.

  2. No delete. The bulk action bar's Tag/Share/Duplicate/Delete buttons are stubs. There's also no single-row delete. Once you save a
  hand you can rename/favorite/tag it but never get rid of it.

  3. No mobile layout. The recorder assumes ~1600px width. On a phone after a session — which is when a poker player would actually open
  this — the table will collapse and the controls will overflow. Probably the second-most-likely thing a tester would hit.

  4. Pot type is always "SRP". We hardcode it on save. The Pot type filter only ever shows SRP results, even on hands with 3-bets and
  4-bets. Should classify from the action log (count preflop raises).

  5. Uncalled bets aren't refunded. If hero shoves $400 on the river and villain folds, our pot calc still includes the $400. Real result
   undercounts hero's win by the unmatched amount. Easy to fix.

  6. Side-pot math is approximate. Multi-way all-ins of different stack sizes get a single pot split among winners — wrong when a short
  stack should only win the main pot they could match.

  7. / is still the Next.js placeholder. No landing page.

  What I'd hold for v1.1 (not blocking)

  - Edit a saved hand — currently saves are immutable, which is annoying when you fat-finger a stack size.
  - Player notes across hands — recording "Whale" once should autocomplete next time at Bay 101.
  - Bet-sizing presets — at 1/2, opens are usually 5–10. A "2.5x" / "3x" / "pot + 1bb per limper" chip would cut entry time in half.
  - Replay speed control — current 1.1s/step is fixed.
  - Auth-page styling — bring login/signup into the design system (warm sepia, Inter, etc.).

  My poker-player wishlist (opinions)

  Stuff I'd want if I were the user:

  1. Hand history import — paste a PokerNow text dump (or upload a Stars hand history) and have it parse into a saved hand. Live
  recording is great; pasting a hand my friend sent is the killer feature for sharing-driven flow.
  *2. Annotations per action — "I should have folded here" sticky-noted on a specific bet, visible in the replayer. This is what turns the
   app from a recorder into a teaching tool.
  *3. Equity at each street — Equilab-style hot/cold % under the pot. Doesn't need to be a GTO solver; just "Hero 62% / Villain 38% to
  win" is a huge value-add when reviewing hands.
  4. Hand strength label in the replayer — "Top Pair Top Kicker" / "Open-ended straight draw + flush draw" surfaced live as the board
  changes. Helps the viewer follow.
  5. Action-only stepping — current replay steps include board reveals as their own steps; toggle to skip those and just hop
  action-to-action.
  6. Session grouping — record multiple hands at the same venue/stakes/date as a session. Compute net result for the session. Filter the
  dashboard by session.
  7. Filter by hand criteria — "show me hands where I 3-bet from the BB and folded the flop". Right now filters cover metadata; the
  action-shape filters are where the real review value is.
  8. Range pre-fills — if I'm reviewing a 3-bet pot and want to estimate villain's range, a UI to pick a range (Pio-style grid: 22+,
  AJs+, KQs+, etc.) and have the equity calc use it.
  9. Stat dashboard once I have ≥50 hands — VPIP, PFR, AF, win rate by position. The dashboard could grow a "Stats" tab.
  10. A delete confirmation that's not a bulk action — really just want a row-level "..." menu with Delete / Duplicate / Edit.
  11. PLO mode someday — 4 hole cards. The recorder's CardRow supports autoAdvanceCount, so the data model is ~80% there.

  If I had to pick one from the wishlist for v1.1: annotations per action. It's what differentiates this from "another hand history app".

  If I had to pick one from the gaps to ship before users see it: real share URLs via Supabase. Without that, the app's name is a lie.

  Want me to sketch the Supabase schema + a migration so persistence is the next thing we tackle?