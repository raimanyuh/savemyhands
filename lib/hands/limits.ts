// Server-side input limits for the `hands` table.
//
// These caps protect the database from a hostile authenticated user who
// might try to bloat their rows (or many rows) with arbitrarily large
// strings. They run in every server action that writes to `hands` so the
// client UI can't bypass them by skipping client-side validation.
//
// Caps are deliberately generous — a real poker note has dozens, maybe a
// few hundred characters; 4000 covers anything legitimate. We *truncate*
// silently for length-based caps because rejecting on every keystroke is
// hostile UX, and dropping a few characters off a paste is preferable to
// throwing a hand-save away. The whole-payload size check is a hard reject
// since hitting it implies clear abuse.

import type { SavedHand } from "@/components/poker/hand";

export const HAND_LIMITS = {
  // Top-level row fields.
  name: 100,
  notes: 4000,
  venue: 60,
  tag: 24,
  tagCount: 8,
  // Inside the `_full` payload.
  playerName: 32,
  annotation: 500,
  annotationCount: 200,
  // Hard cap on the serialized JSON size (bytes ≈ chars for ASCII). 64KB
  // is roomy for the most action-heavy 9-handed hand a real user could
  // record; anything over that is constructed payload abuse.
  payloadBytes: 64 * 1024,
} as const;

function clip(s: string | null | undefined, max: number): string | undefined {
  if (s == null) return undefined;
  const t = String(s);
  return t.length > max ? t.slice(0, max) : t;
}

// Truncate every free-text field inside the `_full` payload. Players' names,
// hand-level notes, venue, and per-action annotations are all user-typed
// and therefore subject to caps. Bounded fields (stacks, action enums,
// counts) are passed through unchanged.
function clampFull(
  full: NonNullable<SavedHand["_full"]>,
): NonNullable<SavedHand["_full"]> {
  const players = (full.players ?? []).map((p) => ({
    ...p,
    name: (clip(p.name, HAND_LIMITS.playerName) ?? "").trim(),
  }));
  const annotations: Record<number, string> = {};
  if (full.annotations) {
    // Sort by key for deterministic truncation, then keep the first N. In
    // practice a hand has well under 200 actions; this just guards against
    // a constructed payload with thousands of fake-keyed entries.
    const sorted = Object.entries(full.annotations)
      .map(([k, v]) => [Number(k), v] as const)
      .sort((a, b) => a[0] - b[0])
      .slice(0, HAND_LIMITS.annotationCount);
    for (const [k, v] of sorted) {
      const clipped = clip(v, HAND_LIMITS.annotation);
      if (clipped) annotations[k] = clipped;
    }
  }
  return {
    ...full,
    players,
    annotations,
    notes: clip(full.notes, HAND_LIMITS.notes),
    venue: clip(full.venue, HAND_LIMITS.venue),
  };
}

// Clamp every length-bounded user-input field on a SavedHand. Works on a
// full insert payload (Omit<SavedHand, "id">) or a partial patch — fields
// that aren't present pass through untouched.
export function clampSavedHand<T extends Partial<SavedHand>>(input: T): T {
  const out = { ...input };
  if (out.name != null) {
    const clipped = clip(out.name, HAND_LIMITS.name) ?? "";
    out.name = (clipped.trim() || "Untitled hand") as T["name"];
  }
  if (out.loc != null) {
    const clipped = (clip(out.loc, HAND_LIMITS.venue) ?? "").trim();
    out.loc = (clipped || "—") as T["loc"];
  }
  if (out.notes != null) {
    out.notes = clip(out.notes, HAND_LIMITS.notes) as T["notes"];
  }
  if (out.tags != null) {
    out.tags = out.tags
      .slice(0, HAND_LIMITS.tagCount)
      .map((t) => (clip(t, HAND_LIMITS.tag) ?? "").trim())
      .filter((t): t is string => t.length > 0) as T["tags"];
  }
  if (out._full != null) {
    out._full = clampFull(out._full) as T["_full"];
  }
  return out;
}

// Hard cap on serialized payload size. Run after clamping so we're checking
// the post-truncation footprint, not the attacker-supplied one. Throws when
// the size still exceeds the cap (the only way that happens after clamping
// is a constructed array of, say, 100 players or a payload with many
// thousands of action entries — abuse, not a legitimate use).
export function assertPayloadSize<T>(
  input: T,
  max = HAND_LIMITS.payloadBytes,
): void {
  // String length is a fine proxy for byte count for our caps — accented
  // characters add at most 1 byte each in UTF-8, and the cap is generous
  // enough that the discrepancy doesn't matter.
  const size = JSON.stringify(input).length;
  if (size > max) {
    throw new Error(
      `Hand payload is too large (${size.toLocaleString()} bytes, max ${max.toLocaleString()}).`,
    );
  }
}
