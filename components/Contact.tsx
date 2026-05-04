"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, Copy, Mail } from "lucide-react";

export const CONTACT_EMAIL = "raimana.vinci@gmail.com";
export const CONTACT_DISCORD = "r4ym4n";

const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const MUTED = "oklch(0.715 0 0)";

// DiscordGlyph — matching the OAuth glyph at the same blue tint.
function DiscordGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="#5865F2"
    >
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.075.036c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.65 12.65 0 0 0-.617-1.25.077.077 0 0 0-.075-.036A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.197.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.335-.956 2.42-2.157 2.42zm7.974 0c-1.183 0-2.157-1.085-2.157-2.42 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.335-.946 2.42-2.157 2.42z" />
    </svg>
  );
}

// Compact button + popover. Use for footer / auth-page contexts.
export function ContactPopover({
  align = "right",
  buttonStyle,
  buttonLabel = "Contact",
}: {
  align?: "left" | "right";
  buttonStyle?: CSSProperties;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const baseBtn: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    height: 32,
    borderRadius: 8,
    background: "transparent",
    color: MUTED,
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "color 150ms ease, border-color 150ms ease",
  };

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ ...baseBtn, ...buttonStyle }}
        onPointerEnter={(e) => {
          e.currentTarget.style.color = "#fafaf9";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)";
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.color = (buttonStyle?.color as string) ?? MUTED;
          e.currentTarget.style.borderColor =
            (buttonStyle?.borderColor as string) ?? "rgba(255,255,255,0.10)";
        }}
      >
        {buttonLabel}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Contact"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            [align]: 0,
            zIndex: 50,
            minWidth: 280,
            padding: 8,
            borderRadius: 12,
            background:
              "linear-gradient(180deg, oklch(0.215 0 0) 0%, oklch(0.18 0 0) 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <ContactRow
            kind="email"
            label="Email"
            value={CONTACT_EMAIL}
            href={`mailto:${CONTACT_EMAIL}`}
          />
          <ContactRow
            kind="discord"
            label="Discord"
            value={CONTACT_DISCORD}
          />
        </div>
      )}
    </div>
  );
}

// Full inline panel — both options visible at once. Used in Settings.
export function ContactInline() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "4px 2px",
      }}
    >
      <ContactRow
        kind="email"
        label="Email"
        value={CONTACT_EMAIL}
        href={`mailto:${CONTACT_EMAIL}`}
      />
      <ContactRow
        kind="discord"
        label="Discord"
        value={CONTACT_DISCORD}
      />
    </div>
  );
}

function ContactRow({
  kind,
  label,
  value,
  href,
}: {
  kind: "email" | "discord";
  label: string;
  value: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt(`Copy ${label.toLowerCase()}:`, value);
    }
  };
  const labelStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: EMERALD_BRIGHT,
  };
  const valueStyle: CSSProperties = {
    fontSize: 14,
    color: "#fafaf9",
    fontFamily:
      "var(--font-geist-mono), ui-monospace, monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 8,
    background: "rgba(9,9,11,0.4)",
    border: "1px solid rgba(255,255,255,0.08)",
  };
  const copyBtn: CSSProperties = {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: copied ? EMERALD_BRIGHT : MUTED,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  return (
    <div style={rowStyle}>
      <span
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 6,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {kind === "email" ? (
          <Mail size={14} color={MUTED} />
        ) : (
          <DiscordGlyph size={14} />
        )}
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span style={labelStyle}>{label}</span>
        {href ? (
          <a
            href={href}
            style={{
              ...valueStyle,
              textDecoration: "none",
            }}
            onPointerEnter={(e) =>
              (e.currentTarget.style.color = EMERALD_BRIGHT)
            }
            onPointerLeave={(e) => (e.currentTarget.style.color = "#fafaf9")}
          >
            {value}
          </a>
        ) : (
          <span style={valueStyle}>{value}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        title={copied ? "Copied" : "Copy"}
        style={copyBtn}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
