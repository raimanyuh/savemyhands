"use client";

// Top-of-viewport progress bar that animates while a client-side
// navigation is pending. Subtle inline feedback for every internal link
// click — no layout impact, fixed at the top edge above all page chrome.
//
// Pattern: a global capture-phase click listener detects internal-link
// clicks and starts the bar climbing toward 88%. A pathname / search
// effect fires when the new route lands, snapping the bar to 100% and
// fading it out. A `startedRef` guards the completion path so external
// pathname changes (router.push from code, browser back) don't trigger
// a stray flash.
//
// Mounted once in `app/providers.tsx` so it covers every route. The bar
// pairs with the per-route `loading.tsx` splash (`RouteSplash`): on a
// click you see the bar appear, then the splash takes over while the
// server renders, then both clear when the new page paints.

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { onRouteProgressStart } from "@/lib/route-progress";

const EMERALD = "oklch(0.745 0.198 155)";
const BAR_HEIGHT = 2;

function isModifiedClick(e: MouseEvent) {
  return (
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey ||
    e.button !== 0 ||
    e.defaultPrevented
  );
}

function isInternalNavigation(a: HTMLAnchorElement): boolean {
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const href = a.getAttribute("href");
  if (!href) return false;
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }
  try {
    const url = new URL(a.href, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    // Same path & query — no real navigation, skip.
    if (
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [progress, setProgress] = useState(0);
  const startedRef = useRef(false);
  const climbRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared start logic — invoked by both the link-click listener (for
  // `<Link>` / `<a>` navigations) and by `startRouteProgress()` events
  // (for programmatic `router.push()` calls).
  const start = useCallback(() => {
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
    if (climbRef.current) {
      clearInterval(climbRef.current);
      climbRef.current = null;
    }
    startedRef.current = true;
    setProgress(8);
    // Asymptotic climb toward 88% so the bar always feels alive but
    // never reaches the end before the route actually lands.
    climbRef.current = setInterval(() => {
      setProgress((p) => {
        if (p <= 0 || p >= 88) return p;
        return p + (88 - p) * 0.08;
      });
    }, 200);
  }, []);

  // Click listener — start the bar on internal-link clicks.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isModifiedClick(e)) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest("a");
      if (!a) return;
      if (!isInternalNavigation(a)) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  // Event listener — start the bar on programmatic navigations.
  useEffect(() => onRouteProgressStart(start), [start]);

  // Pathname / search effect — finish the bar when the route lands.
  useEffect(() => {
    if (!startedRef.current) return;
    startedRef.current = false;
    if (climbRef.current) {
      clearInterval(climbRef.current);
      climbRef.current = null;
    }
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setProgress(0);
      hideRef.current = null;
    }, 240);
    return () => {
      if (hideRef.current) {
        clearTimeout(hideRef.current);
        hideRef.current = null;
      }
    };
  }, [pathname, search]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (climbRef.current) clearInterval(climbRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, []);

  const visible = progress > 0;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: BAR_HEIGHT,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        // Faster fade-in so the bar appears immediately on click; longer
        // fade-out so the completion at 100% is visible to the eye.
        transition: visible
          ? "opacity 80ms ease-out"
          : "opacity 240ms ease-in",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: EMERALD,
          boxShadow: `0 0 8px ${EMERALD}, 0 0 4px ${EMERALD}`,
          transition: "width 200ms ease-out",
          animation: visible ? "smh-progress-pulse 1.6s ease-in-out infinite" : "none",
        }}
      />
    </div>
  );
}
