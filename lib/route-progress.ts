// Tiny event-bus helper that lets imperative `router.push()` /
// `router.replace()` / `router.back()` call sites trigger the top
// progress bar (mounted in `app/providers.tsx`).
//
// `<RouteProgress>` already detects internal-link clicks via a
// document-level listener, but programmatic navigations bypass that.
// Call `startRouteProgress()` immediately before any `router.push()` /
// equivalent so the bar appears for those too.
//
// Pattern:
//   import { startRouteProgress } from "@/lib/route-progress";
//   ...
//   startRouteProgress();
//   router.push("/dashboard");

const EVENT = "smh:route-progress-start";

export function startRouteProgress() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function onRouteProgressStart(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
