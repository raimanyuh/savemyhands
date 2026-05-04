import Link from "next/link";
import type { CSSProperties } from "react";
import { ContactPopover } from "@/components/Contact";
import { Faq } from "./Faq";
import { SampleReplayShell } from "./SampleReplayShell";
import { SignInCard } from "./SignInCard";

const EMERALD = "oklch(0.745 0.198 155)";
const MUTED = "oklch(0.715 0 0)";
const CARD = "oklch(0.18 0 0)";

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

const btnLg: CSSProperties = {
  height: 48,
  padding: "0 22px",
  fontSize: 14,
  borderRadius: 12,
};

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
          style={navLinkStyle}
        >
          How it works
        </a>
        <a
          href="#sample-hand"
          className="smh-nav-anchor"
          style={navLinkStyle}
        >
          Sample hand
        </a>
        <a
          href="#faq"
          className="smh-nav-anchor"
          style={navLinkStyle}
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

const navLinkStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: MUTED,
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
};

function Hero() {
  return (
    <section
      className="smh-hero"
      style={{
        position: "relative",
        zIndex: 5,
        maxWidth: 1120,
        margin: "0 auto",
        width: "100%",
        padding: "56px 32px 80px",
        textAlign: "center",
      }}
    >
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
          marginBottom: 22,
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
          margin: "0 auto",
          maxWidth: 900,
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
          margin: "26px auto 0",
          maxWidth: 580,
          fontSize: "clamp(15px, 1.3vw, 18px)",
          lineHeight: 1.55,
          color: MUTED,
          textWrap: "pretty",
        }}
      >
        Take your notes from the casino, enter the hand on a visual table, and
        share a URL that plays back like an online history. No notation, no
        spreadsheets, no friction.
      </p>
      <div
        style={{
          marginTop: 32,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
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
        <a href="#sample-hand" style={{ ...btnGhost, ...btnLg }}>
          Watch a sample hand
        </a>
      </div>

      <div
        id="sample-hand"
        style={{
          marginTop: 64,
          scrollMarginTop: 80,
        }}
      >
        <SampleReplayShell />
      </div>
    </section>
  );
}

function HowStep({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 280,
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        background: CARD,
        padding: 26,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          color: EMERALD,
        }}
      >
        {String(index).padStart(2, "0")} / 03
      </span>
      <h3
        style={{
          margin: "2px 0 0",
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "#fafaf9",
        }}
      >
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: MUTED }}>
        {body}
      </p>
    </div>
  );
}

function HowItWorks() {
  return (
    <section
      id="how"
      className="smh-section"
      style={{
        padding: "100px 32px",
        maxWidth: 1120,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 56,
          textAlign: "center",
          alignItems: "center",
        }}
      >
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
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        <HowStep
          index={1}
          title="Note it at the table"
          body="Jot the hand on your phone the way you already do — stakes, positions, action, board. No structured form, no app to learn between hands."
        />
        <HowStep
          index={2}
          title="Enter on a visual table"
          body="Drop seats into position, deal hole cards, click each action. The replay rebuilds itself as you go. Pin a note to any spot you want to revisit."
        />
        <HowStep
          index={3}
          title="Share a real URL"
          body="Every hand gets a public link that plays back like an online history. Send it to your study group, paste it in Discord, watch it back six months later."
        />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "28px 32px",
        maxWidth: 1120,
        margin: "0 auto",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        fontSize: 12,
        color: "oklch(0.556 0 0)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background:
              "radial-gradient(ellipse at 50% 30%, #1f7a47 0%, #0e3d22 65%, #082818 100%)",
            boxShadow:
              "inset 0 0 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "#fafaf9",
          }}
        >
          savemyhands
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <ContactPopover align="right" />
        <span>© savemyhands · built by a grinder, for grinders</span>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .smh-nav { padding: 18px 18px !important; flex-wrap: wrap !important; }
          .smh-nav-anchor { display: none !important; }
          .smh-hero { padding: 24px 18px 56px !important; }
          .smh-section { padding: 64px 18px !important; }
          .smh-faq { padding: 64px 18px 56px !important; }
          .smh-faq-answer { padding-right: 0 !important; }
          .smh-signin { padding: 40px 18px 80px !important; }
        }
      `}</style>
      <div style={pageAtmosphere} />
      <div style={pageGrain} />
      <div style={{ position: "relative", zIndex: 2, width: "100%" }}>
        <Nav />
        <main>
          <Hero />
          <HowItWorks />
          <Faq />
          <SignInCard />
          <Footer />
        </main>
      </div>
    </>
  );
}
