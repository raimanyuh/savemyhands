"use client";

import { useSyncExternalStore } from "react";

// Returns true when the viewport is wide enough AND landscape enough to
// host the recorder's side-by-side layout (felt left, action panel +
// notes stacked on the right). Below the threshold, the recorder falls
// back to its stacked layout.
//
//   const useSide = useIsSideLayout();
//
// Threshold is tuned so:
//   - Typical laptops in landscape (1366x768, 1440x900, 1707x960 zoomed)
//     → side layout
//   - Portrait monitors / tablet portrait → stacked
//   - Mobile → handled separately by useIsMobile + RecorderShell
//
// Server renders always resolve to "stacked" so the SSR HTML is the
// safe fallback; clients flip to side after hydration if the viewport
// matches.

const QUERY = "(min-width: 1280px) and (min-aspect-ratio: 16/10)";

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(QUERY);
  // Same dual-subscription pattern as useIsMobile — Chrome DevTools'
  // device toolbar sometimes doesn't fire `change` on `matchMedia` when
  // it swaps emulated viewports, but `resize` always does.
  mq.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  return () => {
    mq.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
  };
}

export function useIsSideLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
