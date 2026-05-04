"use client";

import { useState } from "react";

type Item = { q: string; a: string };

const FAQ_ITEMS: Item[] = [
  {
    q: "Is it free?",
    a: "Yes — free for now. We'll figure out a paid tier eventually, but the core recorder, replayer, and share links aren't going behind a paywall.",
  },
  {
    q: "What kind of games do you support?",
    a: "No-limit hold'em, PLO4, and PLO5. You can flag a hand as a bomb pot or run it twice (double board). All of those compose — a PLO5 bomb-pot double-board hand records and replays correctly.",
  },
  {
    q: "Are my hands public?",
    a: "Only if you want them to be. Hands save private by default. Flip the lock icon on a hand to make it public, then anyone with the URL can watch it back — no signup needed for viewers.",
  },
  {
    q: "Does this work for online sites?",
    a: "No. Online rooms already give you a hand-history file. savemyhands is built for the live game — where there's no log, no replayer, and the only record is whatever you remember on the drive home.",
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
          className="smh-faq-answer"
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
      className="smh-faq"
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
          The quick version.
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
