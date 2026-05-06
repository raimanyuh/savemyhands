"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.5 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.11z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.05-3.72 1.05-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.85 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.67-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.1 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function DiscordGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="#5865F2"
    >
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.075.036c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.65 12.65 0 0 0-.617-1.25.077.077 0 0 0-.075-.036A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.197.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.335-.956 2.42-2.157 2.42zm7.974 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.335-.946 2.42-2.157 2.42z" />
    </svg>
  );
}

const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  width: "100%",
  height: 42,
  padding: "0 14px",
  borderRadius: 10,
  background: "rgba(9,9,11,0.5)",
  color: "#fafaf9",
  border: "1px solid rgba(255,255,255,0.10)",
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  cursor: "pointer",
  transition: "background 150ms ease, border-color 150ms ease",
};

export function OAuthButtons({ label = "Continue with" }: { label?: string }) {
  const toast = useToast();
  const [pending, setPending] = useState<"google" | "discord" | null>(null);
  const [hovered, setHovered] = useState<"google" | "discord" | null>(null);

  const signIn = async (provider: "google" | "discord") => {
    setPending(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error("OAuth error", error);
      toast.error(`Couldn't start ${provider} sign-in. ${error.message}`);
      setPending(null);
    }
  };

  const styleFor = (provider: "google" | "discord"): CSSProperties => ({
    ...buttonBase,
    background:
      hovered === provider ? "rgba(255,255,255,0.06)" : buttonBase.background,
    borderColor:
      hovered === provider
        ? "rgba(255,255,255,0.18)"
        : "rgba(255,255,255,0.10)",
    opacity: pending !== null && pending !== provider ? 0.5 : 1,
    cursor: pending !== null ? "default" : "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => signIn("google")}
        onPointerEnter={() => setHovered("google")}
        onPointerLeave={() => setHovered(null)}
        style={styleFor("google")}
      >
        {pending === "google" ? (
          <Loader2 size={16} className="smh-spin" aria-label="Loading" />
        ) : (
          <GoogleGlyph />
        )}{" "}
        {label} Google
      </button>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => signIn("discord")}
        onPointerEnter={() => setHovered("discord")}
        onPointerLeave={() => setHovered(null)}
        style={styleFor("discord")}
      >
        {pending === "discord" ? (
          <Loader2 size={16} className="smh-spin" aria-label="Loading" />
        ) : (
          <DiscordGlyph />
        )}{" "}
        {label} Discord
      </button>
    </div>
  );
}
