import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { HeroPlayingCard, HeroTable } from "./HeroTable";
import { Faq } from "./Faq";

const EMERALD = "oklch(0.745 0.198 155)";
const MUTED = "oklch(0.715 0 0)";
const CARD = "oklch(0.18 0 0)";
const SUBCARD_BG = "oklch(0.145 0 0)";

const pageAtmosphere: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 0,
  background:
    "radial-gradient(ellipse 70% 45% at 50% -5%, oklch(0.42 0.12 155 / 0.14) 0%, transparent 65%)",
};

const pageGrain: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 1,
  opacity: 0.025,
  mixBlendMode: "overlay",
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
};

const wordmarkMark: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  background:
    "radial-gradient(ellipse at 50% 30%, #1f7a47 0%, #0e3d22 65%, #082818 100%)",
  boxShadow:
    "inset 0 0 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const btnBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 36,
  padding: "0 16px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  cursor: "pointer",
  border: "1px solid transparent",
  transition: "all 150ms ease",
  textDecoration: "none",
};

const btnPrimary: CSSProperties = {
  ...btnBase,
  background: "#fafaf9",
  color: "oklch(0.215 0 0)",
  borderColor: "#fafaf9",
};

const btnGhost: CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: "#fafaf9",
  borderColor: "rgba(255,255,255,0.12)",
};

const btnLg: CSSProperties = { height: 48, padding: "0 22px", fontSize: 14, borderRadius: 12 };

function Nav() {
  return (
    <nav
      className="smh-nav"
      style={{
        position: "relative",
        zIndex: 10,
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
        padding: "24px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "#fafaf9",
          textDecoration: "none",
        }}
      >
        <span style={wordmarkMark} />
        savemyhands
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <a
          href="#how"
          className="smh-nav-anchor"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: MUTED,
            padding: "8px 12px",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          How it works
        </a>
        <a
          href="#faq"
          className="smh-nav-anchor"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: MUTED,
            padding: "8px 12px",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          FAQ
        </a>
        <Link href="/login" style={btnGhost}>
          Sign in
        </Link>
        <Link href="/signup" style={btnPrimary}>
          Sign up
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section
      className="smh-hero"
      style={{
        position: "relative",
        zIndex: 5,
        maxWidth: 1440,
        margin: "0 auto",
        width: "100%",
        padding: "32px 32px 96px",
      }}
    >
      <div className="smh-hero-grid">
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: EMERALD,
              marginBottom: 24,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: EMERALD,
                boxShadow: `0 0 12px oklch(0.745 0.198 155 / 0.6)`,
              }}
            />
            free · early access
          </div>
          <h1
            style={{
              margin: "0 0 24px",
              fontSize: "clamp(40px, 5.6vw, 76px)",
              fontWeight: 600,
              letterSpacing: "-0.035em",
              lineHeight: 0.98,
              color: "#fafaf9",
              textWrap: "balance",
            }}
          >
            A database for the{" "}
            <span style={{ color: EMERALD }}>live poker</span> grinder.
          </h1>
          <p
            style={{
              margin: "0 0 36px",
              fontSize: "clamp(15px, 1.3vw, 18px)",
              lineHeight: 1.55,
              color: MUTED,
              maxWidth: 520,
              textWrap: "pretty",
            }}
          >
            Take your notes from the casino, enter the hand on a visual table,
            and share a URL that plays back like an online history. No notation,
            no spreadsheets, no friction.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href="/signup" style={{ ...btnPrimary, ...btnLg }}>
              Start recording
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginLeft: 2 }}
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <a href="#how" style={{ ...btnGhost, ...btnLg }}>
              Watch a sample hand
            </a>
          </div>
          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontSize: 12,
              color: MUTED,
              flexWrap: "wrap",
            }}
          >
            <HeroDot>No credit card</HeroDot>
            <HeroDot>Public hands viewable without an account</HeroDot>
          </div>
        </div>

        <div
          className="smh-hero-card"
          style={{
            position: "relative",
            padding: "32px 32px 28px",
            borderRadius: 24,
            background:
              "linear-gradient(180deg, oklch(0.215 0 0 / 0.55) 0%, oklch(0.18 0 0 / 0.35) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 14,
              left: 22,
              right: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              pointerEvents: "none",
            }}
          >
            <span>replay</span>
            <span
              style={{
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                letterSpacing: 0,
                textTransform: "none",
                color: "rgba(255,255,255,0.45)",
                fontWeight: 400,
              }}
            >
              savemyhands.app/hand/k7q2nx
            </span>
          </div>
          <div style={{ marginTop: 18 }}>
            <HeroTable />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroDot({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: EMERALD,
        }}
      />
      {children}
    </span>
  );
}

function HowStep({
  index,
  eyebrow,
  title,
  body,
  children,
}: {
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 280,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        background: CARD,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.18)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          {String(index).padStart(2, "0")}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: EMERALD,
          }}
        >
          {eyebrow}
        </span>
      </div>
      <div
        style={{
          height: 140,
          borderRadius: 12,
          background: SUBCARD_BG,
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "#fafaf9",
          }}
        >
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: MUTED }}>{body}</p>
      </div>
    </div>
  );
}

function FeltWedge() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at 50% 130%, #1f7a47 0%, #0e3d22 40%, transparent 70%)",
        opacity: 0.55,
      }}
    />
  );
}

function StepRecordViz() {
  return (
    <>
      <FeltWedge />
      <div style={{ display: "flex", gap: 6, position: "relative", zIndex: 1 }}>
        <HeroPlayingCard rank="A" suit="♠" size={0.95} />
        <HeroPlayingCard rank="K" suit="♠" size={0.95} />
        <div style={{ width: 8 }} />
        <div
          style={{
            width: 42,
            height: 60,
            borderRadius: 5,
            background: "rgba(0,0,0,0.3)",
            border: "1.5px dashed rgba(255,255,255,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.4)",
            fontSize: 18,
          }}
        >
          +
        </div>
      </div>
    </>
  );
}

function StepSaveViz() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        share url
      </span>
      <div
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          background: "rgba(9,9,11,0.65)",
          border: "1px solid rgba(255,255,255,0.12)",
          fontSize: 13,
          color: "#fafaf9",
          letterSpacing: 0,
          boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        }}
      >
        savemyhands.app/hand/<span style={{ color: EMERALD }}>k7q2nx</span>
      </div>
    </div>
  );
}

function StepReplayViz() {
  return (
    <>
      <FeltWedge />
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10 }}>
        <button
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(9,9,11,0.7)",
            color: "#fafaf9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 24, height: 3, borderRadius: 2, background: EMERALD }} />
          <span style={{ width: 24, height: 3, borderRadius: 2, background: EMERALD }} />
          <span style={{ width: 24, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
          <span style={{ width: 24, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: 11,
            color: MUTED,
          }}
        >
          02 / 04
        </span>
      </div>
    </>
  );
}

function HowItWorks() {
  return (
    <section
      id="how"
      className="smh-section"
      style={{ padding: "120px 32px", maxWidth: 1280, margin: "0 auto", width: "100%" }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 56, maxWidth: 640 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: EMERALD,
          }}
        >
          how it works
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(28px, 3.5vw, 44px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: "#fafaf9",
          }}
        >
          Three steps from felt to share link.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            lineHeight: 1.55,
            color: MUTED,
            textWrap: "pretty",
          }}
        >
          Jot the hand down at the table. Enter it into savemyhands when you get
          home. Send the link. No app downloads, no accounts for viewers.
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        <HowStep
          index={1}
          eyebrow="input"
          title="Enter the hand on a visual table"
          body="Open your notes from the casino, set up the players, positions, stacks and hole cards, then click through every action street by street. No notation to learn."
        >
          <StepRecordViz />
        </HowStep>
        <HowStep
          index={2}
          eyebrow="save"
          title="Get a unique URL for every hand"
          body="Hands save privately by default. Flip the lock to public and the share link copies to your clipboard."
        >
          <StepSaveViz />
        </HowStep>
        <HowStep
          index={3}
          eyebrow="replay"
          title="Watch it play back like it's online"
          body="Animated street-by-street replay with bet sizing, pot, dealer button, and equity at each step. Anyone with the link can watch — no signup."
        >
          <StepReplayViz />
        </HowStep>
      </div>
    </section>
  );
}

function AnnotationsSection() {
  return (
    <section
      className="smh-annotations"
      style={{
        padding: "40px 32px 120px",
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        className="smh-annotations-grid"
        style={{
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.08)",
          background:
            "linear-gradient(180deg, oklch(0.21 0 0 / 0.6) 0%, oklch(0.17 0 0 / 0.4) 100%)",
          padding: "clamp(32px, 5vw, 72px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)",
          gap: "clamp(32px, 5vw, 72px)",
          alignItems: "center",
        }}
      >
        <div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: EMERALD,
            }}
          >
            annotations
          </span>
          <h2
            style={{
              margin: "12px 0 20px",
              fontSize: "clamp(28px, 3.5vw, 44px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: "#fafaf9",
              textWrap: "balance",
            }}
          >
            Stick a note on the moment that mattered.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.6,
              color: MUTED,
              textWrap: "pretty",
              maxWidth: 480,
            }}
          >
            Pin a thought to any action in the hand &mdash; &quot;shouldn&apos;t have c-bet here&quot;,
            &quot;villain showed weak preflop&quot;, &quot;pot odds were 4:1&quot;. Notes appear inline in
            the replay, so when you share the hand the conversation comes with it.
          </p>
          <ul
            style={{
              margin: "28px 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {[
              "Per-action sticky notes, not just a single comment box.",
              "Visible to viewers when the hand is public.",
              "Use them to study sessions, mark leaks, or settle a debate.",
            ].map((t, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 14,
                  color: "oklch(0.85 0 0)",
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: `1px solid oklch(0.745 0.198 155 / 0.5)`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 2,
                  }}
                >
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={EMERALD}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ position: "relative" }}>
          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              background: SUBCARD_BG,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11,
                color: MUTED,
              }}
            >
              <span style={{ fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                flop · step 04
              </span>
              <span style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}>
                04 / 11
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              <HeroPlayingCard rank="A" suit="♣" size={0.95} />
              <HeroPlayingCard rank="7" suit="♦" size={0.95} />
              <HeroPlayingCard rank="2" suit="♣" size={0.95} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              {[
                { who: "Hero", act: "bets", amount: "$24", muted: false, highlight: false },
                { who: "Whale", act: "calls", amount: "$24", muted: false, highlight: true },
                { who: "reg_3", act: "folds", amount: null, muted: true, highlight: false },
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: row.highlight ? "oklch(0.745 0.198 155 / 0.08)" : "transparent",
                    border: row.highlight
                      ? "1px solid oklch(0.745 0.198 155 / 0.25)"
                      : "1px solid transparent",
                    color: row.muted ? "oklch(0.55 0 0)" : "#fafaf9",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 500 }}>{row.who}</span>{" "}
                    <span style={{ color: MUTED }}>{row.act}</span>
                  </span>
                  {row.amount && <span style={{ fontWeight: 600 }}>{row.amount}</span>}
                </div>
              ))}
            </div>
            <div
              style={{
                position: "relative",
                marginLeft: 24,
                padding: "14px 16px",
                borderRadius: 12,
                background: "oklch(0.22 0 0)",
                border: `1px solid oklch(0.745 0.198 155 / 0.3)`,
                boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -7,
                  top: 18,
                  width: 12,
                  height: 12,
                  background: "oklch(0.22 0 0)",
                  borderLeft: `1px solid oklch(0.745 0.198 155 / 0.3)`,
                  borderBottom: `1px solid oklch(0.745 0.198 155 / 0.3)`,
                  transform: "rotate(45deg)",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: EMERALD,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#0e3d22" strokeWidth="4">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: EMERALD,
                  }}
                >
                  note
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "#e7e5e4" }}>
                He flat-called the c-bet too fast &mdash; probably a draw or middle pair. I&apos;m
                barreling turn unless a heart comes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        padding: "40px 32px",
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background:
              "radial-gradient(ellipse at 50% 30%, #1f7a47 0%, #0e3d22 65%, #082818 100%)",
            boxShadow: "inset 0 0 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", color: "#fafaf9" }}>
          savemyhands
        </span>
      </div>
      <span style={{ fontSize: 12, color: MUTED }}>
        A database for the live poker grinder.
      </span>
    </footer>
  );
}

export function LandingPage() {
  return (
    <>
      <style>{`
        .smh-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.25fr);
          gap: 64px;
          align-items: center;
        }
        @media (max-width: 960px) {
          .smh-hero-grid { grid-template-columns: 1fr; gap: 48px; }
        }
        @media (max-width: 880px) {
          .smh-annotations-grid { grid-template-columns: 1fr !important; }
        }
        /* Responsive landing tweaks: tighten padding on phones, hide nav
           anchors that compete with the auth buttons, and hide the hero
           replay-table card (which doesn't render legibly under ~480px wide
           because seat plates start overlapping). */
        @media (max-width: 640px) {
          .smh-nav { padding: 18px 18px !important; flex-wrap: wrap !important; }
          .smh-nav-anchor { display: none !important; }
          .smh-hero { padding: 16px 18px 56px !important; }
          .smh-hero-card { display: none !important; }
          .smh-section { padding: 64px 18px !important; }
          .smh-annotations { padding: 24px 18px 80px !important; }
          .smh-faq { padding: 64px 18px 56px !important; }
          .smh-faq-answer { padding-right: 0 !important; }
        }
      `}</style>
      <div style={pageAtmosphere} />
      <div style={pageGrain} />
      <div style={{ position: "relative", zIndex: 2, width: "100%" }}>
        <Nav />
        <main>
          <Hero />
          <HowItWorks />
          <AnnotationsSection />
          <Faq />
          <Footer />
        </main>
      </div>
    </>
  );
}
