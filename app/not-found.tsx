import Link from "next/link";
import type { CSSProperties } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SAMPLE_HAND_ID } from "@/lib/sample-hand";

// Global 404 boundary. Rendered for any unmatched URL and for any
// `notFound()` call without a closer not-found.tsx — most often when a
// share link points at a deleted hand or a private hand viewed by a
// non-owner. Reuses `AuthShell` for atmosphere + footer ContactPopover so
// the page feels intentionally branded instead of the stark Next.js
// default. The "Back to home" CTA hits `/`, which already redirects
// signed-in users to /dashboard — so a single CTA covers both auth states.

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";

const ctaPrimary: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  height: 42,
  borderRadius: 10,
  background: EMERALD,
  color: "oklch(0.145 0 0)",
  fontWeight: 600,
  fontSize: 14,
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  transition: "filter 150ms ease",
};

const ctaGhost: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  height: 42,
  padding: "0 14px",
  borderRadius: 10,
  background: "rgba(9,9,11,0.5)",
  color: "#fafaf9",
  border: "1px solid rgba(255,255,255,0.10)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
  transition: "background 150ms ease, border-color 150ms ease",
};

export default function NotFound() {
  return (
    <AuthShell
      eyebrow="404"
      title="That hand isn't here."
      subtitle="The link may be stale, or the hand was deleted or set private."
    >
      <Link href="/" style={ctaPrimary}>
        Back to home
      </Link>
      <Link
        href={`/hand/${SAMPLE_HAND_ID}`}
        style={ctaGhost}
        prefetch={false}
      >
        Watch a sample hand
      </Link>
      <p
        style={{
          margin: "6px 0 0",
          textAlign: "center",
          fontSize: 12,
          color: "oklch(0.556 0 0)",
        }}
      >
        If you got here from a share link, the owner may have deleted it.{" "}
        <span style={{ color: EMERALD_BRIGHT }}>Use the contact button below</span>{" "}
        to let us know.
      </p>
    </AuthShell>
  );
}
