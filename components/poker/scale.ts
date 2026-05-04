// Felt-relative scaling helper. Components rendered INSIDE a `TableSurface`
// (or any element that sets `--smh-u` via a container query) read this
// variable to scale their pixel dimensions with the felt. Outside the
// felt, `var(--smh-u, 1)` falls back to 1 so the same component keeps
// its design size in dashboards, popovers, etc.
//
// Design baseline is 1280px-wide felt — every fixed pixel in seat plates,
// cards, bubbles, etc. is calibrated for that size. The scale factor is
// clamped on TableSurface to keep things legible at extreme widths.
export function scaled(px: number): string {
  return `calc(${px}px * var(--smh-u, 1))`;
}
