"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { signup } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordToggle } from "@/components/auth/PasswordToggle";

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

const submitStyle: CSSProperties = {
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
};

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, { error: null });
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthShell
      eyebrow="create account"
      title="Start a hand database."
      subtitle="Free during early access. No credit card."
    >
      <OAuthButtons label="Sign up with" />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "2px 0",
        }}
      >
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: SUBTLE,
          }}
        >
          or
        </span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
      </div>

      <form
        action={action}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="email" style={labelStyle}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = EMERALD)}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")
            }
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="password" style={labelStyle}>
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              minLength={8}
              style={{ ...inputStyle, paddingRight: 36, width: "100%" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = EMERALD)}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")
              }
            />
            <PasswordToggle
              shown={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          </div>
          <span style={{ fontSize: 11, color: SUBTLE }}>
            8 characters minimum.
          </span>
        </div>
        {state.error && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "oklch(0.704 0.191 22.216)",
            }}
          >
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          style={{
            ...submitStyle,
            opacity: pending ? 0.7 : 1,
            cursor: pending ? "default" : "pointer",
          }}
        >
          {pending ? "Creating account…" : "Create account"}
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
          }}
        >
          <span style={{ color: SUBTLE }}>Already have an account?</span>
          <Link
            href="/login"
            style={{
              color: MUTED,
              textDecoration: "none",
            }}
            onPointerEnter={(e) => (e.currentTarget.style.color = EMERALD_BRIGHT)}
            onPointerLeave={(e) => (e.currentTarget.style.color = MUTED)}
          >
            Sign in →
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
