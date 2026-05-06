"use client";

// Eye / eye-off icon button positioned absolutely inside the right edge
// of a password input. Consumer wraps `<input> + <PasswordToggle>` in a
// `position: relative` container and pads the input's right side to
// reserve space for the icon. Used on /login, /signup, and the Settings
// password-change form so visibility-toggle behavior is consistent.

import { Eye, EyeOff } from "lucide-react";
import type { CSSProperties } from "react";

export function PasswordToggle({
  shown,
  onToggle,
  style,
}: {
  shown: boolean;
  onToggle: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      tabIndex={-1}
      style={{
        position: "absolute",
        right: 8,
        top: "50%",
        transform: "translateY(-50%)",
        background: "transparent",
        border: "none",
        color: "rgba(255,255,255,0.5)",
        cursor: "pointer",
        padding: 4,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        transition: "color 150ms ease, background 150ms ease",
        ...style,
      }}
      onPointerEnter={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.85)";
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.5)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {shown ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}
