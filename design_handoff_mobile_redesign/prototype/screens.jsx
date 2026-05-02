/* global React */
const { useState, useMemo } = React;

/* ─────────────────────────────────────────────────────
 * Mobile prototype components for savemyhands
 * Each screen is rendered inside an <IPhoneFrame> in index.html
 * ───────────────────────────────────────────────────── */

// ─── Reusable atoms ─────────────────────────────────
function Card({ rank, suit, size = "board", empty }) {
  if (empty) return <div className={`pcard s-${size} empty`}>+</div>;
  const suitClass = { "♠": "s-spade", "♣": "s-club", "♦": "s-diamond", "♥": "s-heart" }[suit];
  return (
    <div className={`pcard s-${size} ${suitClass}`}>
      <span style={{ fontSize: "1em" }}>{rank}</span>
      <span style={{ fontSize: "0.85em", marginTop: "1px" }}>{suit}</span>
    </div>
  );
}

function CardBack({ size = "hole" }) {
  return <div className={`pcard s-${size} back`} />;
}

function Bet({ amount, note }) {
  return (
    <span className="bet">
      <span className="chip" />
      <span className={`pill ${note ? "note" : ""}`}>${amount}</span>
    </span>
  );
}

function HoleCards({ cards, fan = false, hidden }) {
  if (hidden) {
    return (
      <div style={{ display: "flex", gap: "2px" }}>
        {cards.map((_, i) => <CardBack key={i} />)}
      </div>
    );
  }
  if (fan) {
    return (
      <div style={{ display: "flex", gap: "-4px", position: "relative" }}>
        {cards.map((c, i) => (
          <div key={i} style={{ marginLeft: i === 0 ? 0 : "-10px", transform: `rotate(${(i - (cards.length - 1) / 2) * 6}deg)`, transformOrigin: "bottom center" }}>
            <Card rank={c[0]} suit={c[1]} size="hole" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {cards.map((c, i) => <Card key={i} rank={c[0]} suit={c[1]} size="hole" />)}
    </div>
  );
}

// ─── Sample hand state ──────────────────────────────
const SAMPLE = {
  name: "Friday $1/$2 — Aces cracked",
  stakes: "$1/$2",
  street: "FLOP",
  pot: 48,
  step: 4,
  totalSteps: 11,
  hint: "Whale to act · facing $24",
  board: [["7", "♥"], ["2", "♠"], ["J", "♦"]],
  seats: [
    // 0 is hero (BTN), index goes counter-clockwise on desktop oval
    { pos: "BTN", name: "Hero", stack: 412, cards: [["A", "♥"], ["A", "♠"]], hero: true, folded: false, bet: null },
    { pos: "SB", name: "Whale", stack: 1240, cards: ["?", "?"], folded: false, acting: true, bet: 24 },
    { pos: "BB", name: "fish_4", stack: 210, cards: ["?", "?"], folded: false, bet: 24 },
    { pos: "UTG", name: "reg_3", stack: 305, folded: true },
    { pos: "HJ", name: "Mike", stack: 188, folded: true },
    { pos: "CO", name: "tight_5", stack: 540, folded: true },
  ],
};

// ─── Header ─────────────────────────────────────────
function Header({ title, sub, right }) {
  return (
    <div className="smh-header">
      <button className="iconbtn" aria-label="Back">‹</button>
      <div className="title">
        {title}
        {sub && <span className="sub">{sub}</span>}
      </div>
      <button className="iconbtn" aria-label="More">{right || "⋯"}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  TABLE VARIANT A — Vertical (PokerNow-style)
//  Hero bottom-center, opponents around an elongated portrait oval.
//  This is the recommended primary layout.
// ═══════════════════════════════════════════════════════
function TableVertical({ seats, board, pot, mode = "record", bottomInset = 0 }) {
  // Position seats around a portrait-oriented oval (CCW from hero)
  // Layout for up to 6 seats. Coordinates are %-based on the felt.
  // When `bottomInset` > 0 (replayer with dock), seats compress upward so the
  // hero plate clears the dock instead of being occluded by it.
  const heroBottom = bottomInset > 0 ? 78 : 92;
  const heroSideTop = bottomInset > 0 ? 66 : 78;
  const dealerBtnTop = bottomInset > 0 ? 70 : 82;
  const layouts = {
    6: [
      { left: 50, top: heroBottom },  // hero (BTN)
      { left: 12, top: heroSideTop }, // SB
      { left: 12, top: 38 },          // BB
      { left: 50, top: 10 },          // UTG
      { left: 88, top: 38 },          // HJ
      { left: 88, top: heroSideTop }, // CO
    ],
  };
  const positions = layouts[seats.length] || layouts[6];

  return (
    <div className="felt-bg" style={{ flex: 1, position: "relative", minHeight: 0 }}>
      {/* Pot badge in center */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -85px)", textAlign: "center", zIndex: 2 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.18em", textTransform: "uppercase" }}>pot</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>${pot}</div>
      </div>
      {/* Board cards */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", gap: 4, zIndex: 2 }}>
        {board.map((c, i) => <Card key={i} rank={c[0]} suit={c[1]} size="board" />)}
        {Array.from({ length: 5 - board.length }).map((_, i) => <Card key={`e${i}`} empty size="board" />)}
      </div>

      {/* Seats */}
      {seats.map((s, i) => {
        const p = positions[i];
        const heroAtBottom = s.hero;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: `${p.top}%`,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              zIndex: 3,
            }}
          >
            {/* Cards above the plate for everyone, including hero */}
            {s.cards && !s.folded && (
              <HoleCards cards={s.cards} hidden={s.cards[0] === "?"} />
            )}
            <div className={`plate ${s.folded ? "folded" : ""} ${s.acting ? "acting" : ""}`}>
              <span className="pos">{s.pos}</span>
              <span className="name">{s.name}</span>
              {!s.folded && <span className="stack">${s.stack}</span>}
            </div>
            {/* Bet bubble — hero shows below plate (board is above), others above */}
            {s.bet && (
              <div style={{ position: "absolute", top: heroAtBottom ? "100%" : -22, marginTop: heroAtBottom ? 4 : 0 }}>
                <Bet amount={s.bet} />
              </div>
            )}
          </div>
        );
      })}

      {/* Dealer button — placed near hero (BTN) */}
      <div style={{ position: "absolute", left: "62%", top: `${dealerBtnTop}%`, zIndex: 4 }}>
        <div className="dealer-btn">D</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  TABLE VARIANT B — Hero + List
//  Hero anchored at the bottom; opponents listed above as horizontal rows.
//  Best legibility, but less "felt" feeling.
// ═══════════════════════════════════════════════════════
function TableList({ seats, board, pot }) {
  const hero = seats.find(s => s.hero);
  const opponents = seats.filter(s => !s.hero);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--bg)" }}>
      {/* Opponents list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {opponents.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 10,
              background: s.folded ? "transparent" : "oklch(0.18 0 0)",
              border: `1px solid ${s.acting ? "oklch(0.696 0.205 155 / 0.5)" : "rgba(255,255,255,0.08)"}`,
              opacity: s.folded ? 0.45 : 1,
              boxShadow: s.acting ? "0 0 0 2px oklch(0.696 0.205 155 / 0.2)" : "none",
            }}
          >
            <div style={{ width: 38, textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.14em", color: "#d4d4d8", textTransform: "uppercase" }}>{s.pos}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-strong)" }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "var(--fg-subtle)", fontFamily: "var(--font-mono)" }}>
                {s.folded ? "folded" : `$${s.stack}`}
              </div>
            </div>
            {!s.folded && s.cards && <HoleCards cards={s.cards} hidden={s.cards[0] === "?"} />}
            {s.bet && <Bet amount={s.bet} />}
          </div>
        ))}
      </div>

      {/* Center "felt strip" — pot + board */}
      <div className="felt-bg" style={{ padding: "14px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(0,0,0,0.4)" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: "0.18em", textTransform: "uppercase" }}>pot</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums" }}>${pot}</div>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {board.map((c, i) => <Card key={i} rank={c[0]} suit={c[1]} size="board" />)}
          {Array.from({ length: 5 - board.length }).map((_, i) => <Card key={`e${i}`} empty size="board" />)}
        </div>
      </div>

      {/* Hero seat fixed bottom */}
      <div style={{ padding: "10px 12px", background: "oklch(0.18 0 0)", display: "flex", alignItems: "center", gap: 12 }}>
        <div className="plate" style={{ minWidth: 90 }}>
          <span className="pos">{hero.pos} · You</span>
          <span className="stack">${hero.stack}</span>
        </div>
        <div style={{ flex: 1 }} />
        <HoleCards cards={hero.cards} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  TABLE VARIANT C — Focus mode
//  Only hero, the active villain, and the pot are visible.
//  Tap the seat ring to expand all seats.
// ═══════════════════════════════════════════════════════
function TableFocus({ seats, board, pot }) {
  const hero = seats.find(s => s.hero);
  const villain = seats.find(s => s.acting) || seats.find(s => !s.hero && !s.folded);
  const otherActive = seats.filter(s => !s.hero && !s.folded && s !== villain).length;
  const folded = seats.filter(s => s.folded).length;

  return (
    <div className="felt-bg" style={{ flex: 1, position: "relative", minHeight: 0, display: "flex", flexDirection: "column", padding: "14px 12px" }}>
      {/* Top: villain card */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <div className={`plate acting`} style={{ minWidth: 120, padding: "8px 12px" }}>
          <span className="pos">{villain.pos} · acting</span>
          <span className="name">{villain.name}</span>
          <span className="stack">${villain.stack}</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 14 }}>
        <HoleCards cards={villain.cards} hidden />
        {villain.bet && <Bet amount={villain.bet} />}
      </div>

      {/* Pot + board centered */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.55)", letterSpacing: "0.18em", textTransform: "uppercase" }}>pot</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>${pot}</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {board.map((c, i) => <Card key={i} rank={c[0]} suit={c[1]} size="board" />)}
          {Array.from({ length: 5 - board.length }).map((_, i) => <Card key={`e${i}`} empty size="board" />)}
        </div>
        {/* Seat ring summary */}
        <button style={{
          marginTop: 10, padding: "6px 12px", borderRadius: 14,
          background: "rgba(9,9,11,0.6)", border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 500, cursor: "pointer",
          fontFamily: "var(--font-mono)",
        }}>
          {otherActive} more in · {folded} folded · tap to expand
        </button>
      </div>

      {/* Hero anchored bottom */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, alignItems: "center", marginTop: 10 }}>
        <div className="plate" style={{ minWidth: 100 }}>
          <span className="pos">{hero.pos} · You</span>
          <span className="stack">${hero.stack}</span>
        </div>
        <HoleCards cards={hero.cards} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  RECORDER SCREEN — meta strip, table, action bar, sizer
// ═══════════════════════════════════════════════════════
function RecorderScreen({ tableLayout, actionPattern, sizerOpen, setSizerOpen, pickerOpen, setPickerOpen }) {
  const Table = { vertical: TableVertical, list: TableList, focus: TableFocus }[tableLayout];

  return (
    <div className="smh-screen">
      <Header title={SAMPLE.name} sub="$1/$2 · 6-handed" right="⚙" />
      {/* Meta strip */}
      <div className="smh-meta">
        <span className="pill street">{SAMPLE.street}</span>
        <span className="pot">${SAMPLE.pot}</span>
        <span className="spacer" />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-subtle)" }}>{SAMPLE.hint}</span>
        <button className="pill" style={{ background: "transparent" }}>Log {SAMPLE.totalSteps}</button>
      </div>

      <Table seats={SAMPLE.seats} board={SAMPLE.board} pot={SAMPLE.pot} />

      {/* Sizing drawer (above action bar) */}
      {sizerOpen && actionPattern !== "modal" && (
        <BetSizer onClose={() => setSizerOpen(false)} pot={SAMPLE.pot} stack={412} />
      )}

      {/* Action bar — pattern variants */}
      {actionPattern === "fixed" && (
        <ActionBarFixed onRaiseClick={() => setSizerOpen(v => !v)} sizerOpen={sizerOpen} />
      )}
      {actionPattern === "sheet" && (
        <ActionBarSheet onRaiseClick={() => setSizerOpen(v => !v)} sizerOpen={sizerOpen} />
      )}
      {actionPattern === "modal" && (
        <ActionBarFixed onRaiseClick={() => setSizerOpen(true)} sizerOpen={false} />
      )}

      {/* Card picker overlay */}
      {pickerOpen && <CardPickerSheet onClose={() => setPickerOpen(false)} />}

      {/* Modal sizer */}
      {sizerOpen && actionPattern === "modal" && (
        <SizerModal onClose={() => setSizerOpen(false)} pot={SAMPLE.pot} stack={412} />
      )}
    </div>
  );
}

// ─── Action bars ────────────────────────────────────
function ActionBarFixed({ onRaiseClick, sizerOpen }) {
  return (
    <div className="actbar">
      <div className="undo-row">
        <span>Step {SAMPLE.step} / {SAMPLE.totalSteps}</span>
        <button>↶ Undo</button>
      </div>
      <div className="actbar-grid">
        <button className="actbtn fold">Fold</button>
        <button className="actbtn cc">Call<span className="amt">$24</span></button>
        <button className="actbtn br" onClick={onRaiseClick}>
          {sizerOpen ? "Raise to $72" : "Raise"}
          <span className="amt">{sizerOpen ? "tap to confirm" : "tap to size"}</span>
        </button>
      </div>
    </div>
  );
}

function ActionBarSheet({ onRaiseClick, sizerOpen }) {
  return (
    <div className="actbar" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, background: "oklch(0.205 0 0)" }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.18)", margin: "4px auto 8px" }} />
      <div className="undo-row">
        <span>Step {SAMPLE.step} / {SAMPLE.totalSteps} · drag up for sizer</span>
        <button>↶ Undo</button>
      </div>
      <div className="actbar-grid">
        <button className="actbtn fold">Fold</button>
        <button className="actbtn cc">Call<span className="amt">$24</span></button>
        <button className="actbtn br" onClick={onRaiseClick}>Raise<span className="amt">drag to size</span></button>
      </div>
    </div>
  );
}

// ─── Bet sizer (drawer) ─────────────────────────────
function BetSizer({ onClose, pot, stack }) {
  const [val, setVal] = useState(72);
  const presets = [
    { lbl: "½ pot", amt: Math.round(pot / 2) },
    { lbl: "⅔ pot", amt: Math.round(pot * 2 / 3) },
    { lbl: "Pot", amt: pot },
    { lbl: "1.25×", amt: Math.round(pot * 1.25) },
    { lbl: "All-in", amt: stack },
  ];
  return (
    <div className="sizer">
      <div className="amt-readout">
        <span className="val">${val}</span>
        <span className="pot">{(val / pot).toFixed(2)}× pot · stack ${stack}</span>
      </div>
      <input type="range" min="2" max={stack} value={val} onChange={e => setVal(+e.target.value)} />
      <div className="row" style={{ gap: 6 }}>
        {presets.map(p => (
          <button key={p.lbl} className={`preset ${p.amt === val ? "active" : ""}`} onClick={() => setVal(p.amt)}>
            {p.lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

function SizerModal({ onClose, pot, stack }) {
  return (
    <div className="sheet-overlay">
      <div className="sheet" style={{ height: "60%" }}>
        <div className="grabber" />
        <div className="sheet-head">
          <span className="t">Raise size</span>
          <button onClick={onClose}>Cancel</button>
        </div>
        <div style={{ flex: 1, padding: 16 }}>
          <BetSizer onClose={onClose} pot={pot} stack={stack} />
          <button className="actbtn br" style={{ width: "100%", marginTop: 14, height: 56 }}>Confirm raise to $72</button>
        </div>
      </div>
    </div>
  );
}

// ─── Card picker sheet (full-screen on mobile) ──────
function CardPickerSheet({ onClose }) {
  const [suit, setSuit] = useState(0);
  const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
  const suits = ["♠", "♥", "♦", "♣"];
  const colors = ["s-spade", "s-heart", "s-diamond", "s-club"];

  return (
    <div className="sheet-overlay">
      <div className="sheet" style={{ height: "auto", maxHeight: "85%" }}>
        <div className="grabber" />
        <div className="sheet-head">
          <span className="t">Pick a card · Hero hole 1 of 2</span>
          <button onClick={onClose}>Cancel</button>
        </div>
        <div className="picker-suits">
          {suits.map((s, i) => (
            <button key={s} className={i === suit ? "active" : ""} onClick={() => setSuit(i)}>
              <span className={colors[i]}>{s}</span>
            </button>
          ))}
        </div>
        <div className="picker-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
          {ranks.map(r => (
            <div key={r} className={`pcard s-grid ${colors[suit]}`} style={{ minHeight: 48, cursor: "pointer" }}>
              <span style={{ fontSize: 18 }}>{r}</span>
              <span style={{ fontSize: 14 }}>{suits[suit]}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
          <button className="actbtn cc" style={{ flex: 1, height: 44 }}>Mark as muck</button>
          <button className="actbtn br" style={{ flex: 1, height: 44 }}>Save · A♥</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  REPLAYER SCREEN — read-only, with dock variants
// ═══════════════════════════════════════════════════════
function ReplayerScreen({ tableLayout, dockPattern, anonViewer, showAnnotation }) {
  const Table = { vertical: TableVertical, list: TableList, focus: TableFocus }[tableLayout];

  // Reserve space at the bottom of the felt for the dock so it never occludes
  // the hero plate. Persistent + autohide use the same single-row dock height;
  // split has a top scrubber + bottom transport so it eats less at the bottom.
  const bottomInset =
    dockPattern === "split" ? 64 :
    dockPattern === "autohide" ? 84 :
    96; // persistent

  return (
    <div className="smh-screen">
      <Header title={SAMPLE.name} sub="savemyhands.app/hand/k7q2nx" right="↗" />
      {anonViewer && (
        <a className="anon-pill" href="#">Save your own hands →</a>
      )}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", paddingBottom: bottomInset }}>
        <Table seats={SAMPLE.seats} board={SAMPLE.board} pot={SAMPLE.pot} bottomInset={bottomInset} mode="replay" />

        {/* Dock variants */}
        {dockPattern === "persistent" && <ReplayDockPersistent />}
        {dockPattern === "autohide" && <ReplayDockPersistent autohide />}
        {dockPattern === "split" && <ReplayDockSplit />}

        {/* Annotation balloon (dock-attached) */}
        {showAnnotation && (
          <div style={{
            position: "absolute",
            left: 12, right: 12,
            bottom: dockPattern === "split" ? 84 : 96,
            zIndex: 6,
          }}>
            <div className="anno-balloon">
              <div className="head">
                <span className="dot">+</span>
                <span className="lbl">note · step 04</span>
              </div>
              He flat-called the c-bet too fast — probably a draw or middle pair. I'm barreling turn unless a heart comes.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReplayDockPersistent({ autohide }) {
  return (
    <div className="dock" style={{ bottom: 16, opacity: autohide ? 0.5 : 1 }}>
      <div className="dock-row">
        <div className="dock-icon">⏮</div>
        <div className="dock-icon play">▶</div>
        <div className="dock-icon">⏭</div>
        <div className="dock-track">
          <div className="dock-fill" style={{ width: "38%" }} />
          <div className="dock-thumb" style={{ left: "38%" }} />
          <div className="dock-anno-dot" style={{ left: "38%" }} />
          <div className="dock-anno-dot" style={{ left: "62%" }} />
        </div>
        <div className="dock-step"><span className="now">04</span>/{SAMPLE.totalSteps}</div>
      </div>
    </div>
  );
}

function ReplayDockSplit() {
  return (
    <>
      {/* Top: scrubber under header */}
      <div style={{
        position: "absolute", top: 48, left: 0, right: 0,
        background: "rgba(10,10,10,0.85)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "8px 12px",
        display: "flex", alignItems: "center", gap: 10,
        zIndex: 6,
      }}>
        <div className="dock-track" style={{ flex: 1 }}>
          <div className="dock-fill" style={{ width: "38%" }} />
          <div className="dock-thumb" style={{ left: "38%" }} />
          <div className="dock-anno-dot" style={{ left: "38%" }} />
          <div className="dock-anno-dot" style={{ left: "62%" }} />
        </div>
        <div className="dock-step"><span className="now">04</span>/{SAMPLE.totalSteps}</div>
      </div>
      {/* Bottom: transport only */}
      <div className="dock" style={{ bottom: 16 }}>
        <div className="dock-row" style={{ justifyContent: "center", gap: 14 }}>
          <div className="dock-icon">⏮</div>
          <div className="dock-icon play">▶</div>
          <div className="dock-icon">⏭</div>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
          <div className="dock-icon">≡</div>
          <div className="dock-icon">＋</div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  DASHBOARD SCREEN — card-per-hand list
// ═══════════════════════════════════════════════════════
function DashboardScreen() {
  const hands = [
    { name: "Friday $1/$2 — Aces cracked", date: "Oct 11", stake: "$1/$2", cards: [["A", "♥"], ["A", "♠"]], result: -412, star: true },
    { name: "PLO $2/$5 bomb pot", date: "Oct 09", stake: "$2/$5", cards: [["K", "♠"], ["K", "♣"], ["Q", "♦"], ["J", "♥"]], result: 880, star: true, plo: true },
    { name: "Limped pot, sets up", date: "Oct 08", stake: "$1/$3", cards: [["8", "♣"], ["8", "♦"]], result: 220, star: false },
    { name: "3-bet pot OOP", date: "Oct 06", stake: "$2/$5", cards: [["A", "♦"], ["K", "♦"]], result: -180, star: false },
    { name: "Friday cooler", date: "Oct 04", stake: "$1/$2", cards: [["Q", "♥"], ["Q", "♦"]], result: -610, star: false },
    { name: "River bluff, hero called", date: "Oct 02", stake: "$5/$10", cards: [["7", "♠"], ["6", "♠"]], result: 1240, star: true },
    { name: "Flopped flush, slow play", date: "Sep 29", stake: "$1/$2", cards: [["J", "♥"], ["9", "♥"]], result: 320, star: false },
  ];

  return (
    <div className="smh-screen">
      <Header title="Hands" sub="247 total" right="⋯" />
      <div className="dash-search">
        <input className="input" placeholder="Search hands…" />
        <button className="filter">Filter <span style={{ color: "var(--emerald-bright)", fontWeight: 700 }}>2</span></button>
      </div>
      <div className="dash-list">
        {hands.map((h, i) => (
          <div key={i} className="hand-card">
            <div className="holes">
              {h.cards.map((c, j) => <Card key={j} rank={c[0]} suit={c[1]} size="hole" />)}
            </div>
            <div className="body">
              <div className="name">{h.name}</div>
              <div className="meta">
                <span className="stake">{h.stake}</span>
                <span className="date">{h.date}</span>
                <span style={{ color: h.result > 0 ? "var(--emerald-bright)" : "oklch(0.704 0.191 22.216)", fontWeight: 600, marginLeft: "auto" }}>
                  {h.result > 0 ? "+" : ""}${Math.abs(h.result)}
                </span>
              </div>
            </div>
            <button className={`star ${h.star ? "on" : ""}`}>{h.star ? "★" : "☆"}</button>
          </div>
        ))}
      </div>
      <button className="fab">＋ Record</button>
    </div>
  );
}

// Expose globally
Object.assign(window, { RecorderScreen, ReplayerScreen, DashboardScreen, SAMPLE });
