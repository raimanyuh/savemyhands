"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const MUTED = "oklch(0.715 0 0)";
const SUBTLE = "oklch(0.556 0 0)";

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#fafaf9",
};

const inputStyle: CSSProperties = {
  height: 40,
  padding: "0 12px",
  background: "rgba(9,9,11,0.5)",
  color: "#fafaf9",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 150ms ease",
};

export function SignInCard() {
  const router = useRouter();
  // The card is a fast-path entry — any submit just routes to the real
  // /login flow. We don't want password text traveling through a GET, so
  // we cancel the native submit and navigate.
  const handoff = () => router.push("/login");

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
            marginBottom: 24,
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
            sign in
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
            Use the email you signed up with.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handoff();
          }}
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="signin-card-email" style={labelStyle}>
              Email
            </label>
            <input
              id="signin-card-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = EMERALD)}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor =
                  "rgba(255,255,255,0.10)")
              }
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="signin-card-password" style={labelStyle}>
              Password
            </label>
            <input
              id="signin-card-password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = EMERALD)}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor =
                  "rgba(255,255,255,0.10)")
              }
            />
          </div>
          <button
            type="submit"
            style={{
              width: "100%",
              height: 42,
              borderRadius: 10,
              background: EMERALD,
              color: "oklch(0.145 0 0)",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              transition: "filter 150ms ease",
            }}
          >
            Sign in
          </button>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
            }}
          >
            <span style={{ color: SUBTLE }}>New here?</span>
            <Link
              href="/signup"
              style={{
                color: MUTED,
                textDecoration: "none",
              }}
              onPointerEnter={(e) =>
                (e.currentTarget.style.color = EMERALD_BRIGHT)
              }
              onPointerLeave={(e) => (e.currentTarget.style.color = MUTED)}
            >
              Create account →
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
