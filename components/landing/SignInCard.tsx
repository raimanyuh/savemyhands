"use client";

// CTA card at the bottom of the landing page. Originally rendered a
// fully-styled email/password form whose submit just navigated to /login,
// which lost what the user had typed (a real UX trap). The form was
// removed; the card now hosts two clear buttons that route to the actual
// auth pages.

import Link from "next/link";
import type { CSSProperties } from "react";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const MUTED = "oklch(0.715 0 0)";

const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  height: 44,
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.005em",
  border: "1px solid transparent",
  textDecoration: "none",
  cursor: "pointer",
  transition: "background 150ms ease, border-color 150ms ease",
};

const primaryButton: CSSProperties = {
  ...buttonBase,
  background: EMERALD,
  color: "oklch(0.145 0 0)",
};

const ghostButton: CSSProperties = {
  ...buttonBase,
  background: "rgba(9,9,11,0.5)",
  color: "#fafaf9",
  borderColor: "rgba(255,255,255,0.10)",
  fontWeight: 500,
};

export function SignInCard() {
  return (
    <section
      className="smh-signin"
      style={{
        position: "relative",
        zIndex: 5,
        padding: "60px 32px 100px",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 380,
          borderRadius: 18,
          background:
            "linear-gradient(180deg, oklch(0.215 0 0 / 0.7) 0%, oklch(0.18 0 0 / 0.55) 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          padding: "32px 28px",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 70% 45% at 50% -10%, oklch(0.42 0.12 155 / 0.18) 0%, transparent 65%)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            marginBottom: 22,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: EMERALD_BRIGHT,
            }}
          >
            ready when you are
          </span>
          <h2
            style={{
              margin: "10px 0 6px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "#fafaf9",
            }}
          >
            Pick up where you left off.
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
            Sign in to your account or start a new one — it&apos;s free during
            early access.
          </p>
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Link href="/login" style={primaryButton}>
            Sign in
          </Link>
          <Link href="/signup" style={ghostButton}>
            Create account
          </Link>
        </div>
      </div>
    </section>
  );
}
