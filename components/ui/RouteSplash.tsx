// Full-viewport interstitial shown via the route `loading.tsx` boundary
// while a new route's server component is rendering. Visual: a single
// face-down playing card centered on the page background, breathing
// gently with a subtle emerald shimmer sweeping diagonally across.
//
// The dark-red gradient + spaced "smh" wordmark mirrors the face-down
// villain-card style used by the recorder and replayer felts (see
// `components/poker/PlayingCard.tsx`'s `faceDown` branch), so loading
// state visually rhymes with the live tables. Animations live in
// `app/globals.css` under `smh-splash-*`.
//
// Server-component compatible — no hooks, no client boundary needed.
// Each `app/<route>/loading.tsx` simply renders `<RouteSplash />`.

const SPLASH_EMERALD = "oklch(0.745 0.198 155)";

export function RouteSplash() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
        animation: "smh-splash-fade-in 200ms ease-out both",
      }}
    >
      {/* Faint emerald glow under the card — matches the page-atmosphere
          radial used elsewhere (AuthShell), but pulses with the breathe
          rhythm so the card looks like it's sitting on a live felt. */}
      <div
        style={{
          position: "absolute",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${SPLASH_EMERALD} 0%, transparent 65%)`,
          opacity: 0.35,
          filter: "blur(40px)",
          animation: "smh-splash-glow 1.8s ease-in-out infinite",
        }}
      />

      {/* The card itself — breathing wrapper. */}
      <div
        style={{
          position: "relative",
          animation: "smh-splash-breathe 1.8s ease-in-out infinite",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 132,
            height: 188,
            borderRadius: 12,
            // Dark-red back, same gradient as PlayingCard's faceDown
            // darkRed branch — scaled up for hero presence.
            background: "linear-gradient(135deg, #6b1722 0%, #2a0608 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow:
              "0 24px 80px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Embossed wordmark — same letterform + tracking as the
              face-down villain card on the felt. */}
          <span
            style={{
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "0.28em",
              textTransform: "lowercase",
              color: "rgba(255,255,255,0.32)",
              fontFamily: "var(--font-sans)",
            }}
          >
            smh
          </span>

          {/* Diagonal shimmer band — sweeps across every 1.8s. The skew
              + emerald tint makes it read as a card catching light, not
              just a generic loading bar. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(100deg, transparent 35%, ${SPLASH_EMERALD} 50%, transparent 65%)`,
              opacity: 0.18,
              transform: "translateX(-120%) skewX(-12deg)",
              animation: "smh-splash-shimmer 1.8s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
