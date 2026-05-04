import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ContactPopover } from "@/components/Contact";

const EMERALD = "oklch(0.745 0.198 155)";
const MUTED = "oklch(0.715 0 0)";

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

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <>
      <div style={pageAtmosphere} />
      <div style={pageGrain} />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "22px 24px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
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
        </header>

        <main
          style={{
            flex: 1,
            display: "grid",
            placeItems: "center",
            padding: "24px 18px 32px",
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
                  color: EMERALD,
                }}
              >
                {eyebrow}
              </span>
              <h1
                style={{
                  margin: "10px 0 6px",
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: "#fafaf9",
                }}
              >
                {title}
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: MUTED,
                }}
              >
                {subtitle}
              </p>
            </div>
            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {children}
            </div>
          </div>
        </main>

        <footer
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "0 18px 32px",
          }}
        >
          <ContactPopover align="right" buttonLabel="Contact us" />
        </footer>
      </div>
    </>
  );
}
