"use client";

// Shared hook for editing action annotations from the replayer.
// Used by both the desktop Replayer's anchored balloon and the mobile
// AnnotationBalloon. Each surface decides its own UI affordance (an
// inline textarea on desktop, a bottom sheet on mobile); this hook
// owns the override + persist logic.
//
// `_full.annotations` is keyed by ACTION index (the action's position
// in `_full.actions`), not by step index. ReplayStep carries an
// optional `actionIndex` for action steps so we can patch the right
// key.
//
// Lift-and-mirror pattern: callers pass a `livePayload` state + its
// setter rather than the raw fullPayload prop. After a successful
// save the hook updates the mirror so subsequent saves in the same
// session — including unrelated saves like hand-level notes — see
// the latest annotations. Without this, a later notes save would
// rebuild `_full` from the original prop and clobber annotation
// edits made earlier in the same session.

import { useCallback, useState } from "react";
import { updateHandDetailsAction } from "@/lib/hands/actions";
import type { ReplayStep, SavedHand } from "@/components/poker/hand";

export type AnnotationEdit = {
  // Returns the effective annotation for a step — local override if
  // present, original if not. Empty string overrides are treated as
  // "deleted" and return undefined.
  annotationOf: (step: ReplayStep) => string | undefined;
  // Returns whether ANY step at this index in the steps array has an
  // effective non-empty annotation, for the scrubber dot list.
  isStepAnnotated: (step: ReplayStep) => boolean;
  // Save (or clear) the annotation for the given action index. Pass an
  // empty string to delete. Optimistic — local override updates
  // immediately; server failure rolls back and surfaces an alert.
  saveAnnotation: (actionIndex: number, text: string) => Promise<void>;
};

export function useAnnotationEdit({
  handId,
  livePayload,
  setLivePayload,
}: {
  handId?: string;
  // The current best-known _full payload. Reads at save time include
  // any sibling-feature updates the parent has applied.
  livePayload?: SavedHand["_full"];
  // Called with the new payload after a successful save so the parent
  // mirror stays in lockstep with the database.
  setLivePayload?: (next: SavedHand["_full"]) => void;
}): AnnotationEdit {
  // Map of action index → override. `null` = explicitly deleted; a
  // string = replacement text. Absence = use original from the step.
  // Stored as a Record for shallow-equal comparison stability across
  // renders (Map identity churn is fine but Records play nicer with
  // setState in test environments).
  const [edits, setEdits] = useState<Record<number, string | null>>({});

  const annotationOf = useCallback(
    (step: ReplayStep) => {
      const idx = step.actionIndex;
      if (idx == null) return step.annotation;
      if (idx in edits) {
        const v = edits[idx];
        return v === null || v === "" ? undefined : v;
      }
      return step.annotation;
    },
    [edits],
  );

  const isStepAnnotated = useCallback(
    (step: ReplayStep) => {
      const note = annotationOf(step);
      return !!(note && note.trim());
    },
    [annotationOf],
  );

  const saveAnnotation = useCallback(
    async (actionIndex: number, text: string) => {
      const trimmed = text.trim();
      const newOverride = trimmed === "" ? null : trimmed;
      // Build the merged edits synchronously from the current `edits`
      // state. We can't write into a shared variable from inside a
      // setState updater and read it on the next line — React 18+
      // doesn't guarantee the updater runs before setEdits returns, so
      // the read can see the pre-update value (an empty object on the
      // first save), which then sends an unchanged payload to the
      // server. The prior-edits merge is still needed so saving B
      // after A doesn't clobber A — we get that by spreading `edits`,
      // which is in this callback's deps.
      const mergedEdits: Record<number, string | null> = {
        ...edits,
        [actionIndex]: newOverride,
      };
      setEdits(mergedEdits);
      // Without a handId or _full to merge into, we can't construct a
      // safe patch (sending just the new annotation would clobber the
      // rest of the saved hand state). Surface this so the user knows
      // their note didn't actually persist, and roll back the
      // optimistic local edit so the UI matches reality.
      if (!handId || !livePayload) {
        console.error(
          "[saveAnnotation] cannot persist — missing handId or livePayload",
          { handId: !!handId, livePayload: !!livePayload },
        );
        setEdits((m) => {
          const next = { ...m };
          delete next[actionIndex];
          return next;
        });
        window.alert(
          "Couldn't save the note — please refresh the page and try again.",
        );
        return;
      }
      try {
        const nextAnnotations: Record<number, string> = {
          ...(livePayload.annotations ?? {}),
        };
        // Apply every local override (including this one) so the
        // server's annotations match what the user sees locally.
        for (const [k, v] of Object.entries(mergedEdits)) {
          const key = Number(k);
          if (v === null || v === "") delete nextAnnotations[key];
          else nextAnnotations[key] = v;
        }
        const nextPayload: SavedHand["_full"] = {
          ...livePayload,
          annotations: nextAnnotations,
        };
        await updateHandDetailsAction(handId, { _full: nextPayload });
        // Lift the mirror so sibling saves (notes, etc.) build off
        // the latest annotations.
        setLivePayload?.(nextPayload);
      } catch (e) {
        console.error("Failed to save annotation", e);
        // Roll back this specific override; leave other in-session
        // edits intact since they're presumably still on the server.
        setEdits((m) => {
          const next = { ...m };
          delete next[actionIndex];
          return next;
        });
        const message =
          e instanceof Error && e.message
            ? `Couldn't save the note — ${e.message}`
            : "Couldn't save the note — try again.";
        window.alert(message);
      }
    },
    [edits, handId, livePayload, setLivePayload],
  );

  return { annotationOf, isStepAnnotated, saveAnnotation };
}
