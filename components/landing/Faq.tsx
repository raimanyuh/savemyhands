"use client";

import { useState } from "react";

type Item = { q: string; a: string };

const FAQ_ITEMS: Item[] = [
  {
    q: "Is it free?",
    a: "Yes, free while we're in early access. A paid tier may come later for power features (deeper stats, larger hand databases) but the core recorder, replayer, and share links will stay free.",
  },
  {
    q: "Do viewers need an account to watch a hand?",
    a: "No. Public hand URLs work for anyone — no signup, no login, no app. Viewers just open the link and watch the replay.",
  },
  {
    q: "Are my hands private by default?",
    a: "Yes. Every hand you save is private until you toggle it public. Only you can see private hands; public hands are visible to anyone with the URL.",
  },
  {
    q: "How long does it take to enter a hand?",
    a: "About as long as it takes to tell the story. The recorder uses a visual table — set up players, pick cards, click actions. No typing notation, no spreadsheets.",
  },
  {
    q: "Does it work on my phone?",
    a: "The recorder is desktop-first today (it assumes a wide screen). The replayer works fine on mobile. Mobile recording is on the roadmap.",
  },
  {
    q: "Can I import hands from PokerNow or PokerStars?",
    a: "Not yet. Hand-history import is on the wishlist — for now, savemyhands is for live (in-person) hands you record yourself.",
  },
];

function FaqRow({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#fafaf9",
          textAlign: "left",
          font: "inherit",
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}>{q}</span>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "transform 200ms ease",
            transform: open ? "rotate(45deg)" : "rotate(0)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      <div
        style={{
          maxHeight: open ? 240 : 0,
          overflow: "hidden",
          transition: "max-height 250ms ease, opacity 200ms ease",
          opacity: open ? 1 : 0,
        }}
      >
        <p
          style={{
            margin: 0,
            paddingBottom: 24,
            paddingRight: 56,
            fontSize: 15,
            lineHeight: 1.6,
            color: "oklch(0.715 0 0)",
            textWrap: "pretty",
            maxWidth: 720,
          }}
        >
          {a}
        </p>
      </div>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section
      id="faq"
      style={{
        padding: "120px 32px 80px",
        maxWidth: 1080,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "oklch(0.745 0.198 155)",
          }}
        >
          faq
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
          Questions, answered.
        </h2>
      </div>
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {FAQ_ITEMS.map((it, i) => (
          <FaqRow
            key={i}
            q={it.q}
            a={it.a}
            open={open === i}
            onToggle={() => setOpen(open === i ? -1 : i)}
          />
        ))}
      </div>
    </section>
  );
}
