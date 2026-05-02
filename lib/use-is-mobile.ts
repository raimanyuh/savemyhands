"use client";

import { useSyncExternalStore } from "react";

// Three-tier breakpoint hook used to branch between sibling mobile and
// desktop components at the route level. Tablet (640–1024) reuses the
// existing desktop UI — only mobile gets a parallel implementation.
//
//   const { isMobile } = useIsMobile();
//   if (isMobile) return <MobileRecorder />;
//   return <Recorder />;
//
// Server renders always resolve to "desktop" so the SSR HTML matches the
// shipping desktop UI; the client swaps to mobile after hydration if the
// viewport is narrow. There's a one-frame flash for mobile users; CSS
// `display: none` swaps would avoid it but cost a duplicate render tree
// per route, which isn't worth it for surfaces this big.

const MOBILE_MAX = 639;
const TABLET_MAX = 1023;

export type Breakpoint = "mobile" | "tablet" | "desktop";

function getSnapshot(): Breakpoint {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w <= MOBILE_MAX) return "mobile";
  if (w <= TABLET_MAX) return "tablet";
  return "desktop";
}

function getServerSnapshot(): Breakpoint {
  return "desktop";
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

export function useIsMobile(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  bp: Breakpoint;
} {
  const bp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    isMobile: bp === "mobile",
    isTablet: bp === "tablet",
    isDesktop: bp === "desktop",
    bp,
  };
}
