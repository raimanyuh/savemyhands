"use client";

// Annotation balloon for the mobile replayer. Floats absolute above
// the dock (bottom: 108 → 12 dock margin + ~96 dock height) when the
// current step has an annotation. Slides up + fades in on appear;
// fades out + unmounts on disappear so leaving the annotated step
// doesn't leave a stale balloon during scrub.
//
// Owners see an Edit affordance in the balloon header (when an
// onEdit callback is provided). Tapping fires the callback so the
// parent can open an edit sheet — too narrow to inline-edit here.

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import type { ReplayStep } from "@/components/poker/hand";

const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const ANIM_MS = 200;

export function AnnotationBalloon({
  step,
  street,
  annotation,
  onEdit,
}: {
  step: number;
  street: ReplayStep["street"];
  // null when the current step has no annotation. Truthy → balloon
  // appears.
  annotation: string | null;
  // Owner-only: opens an edit flow in the parent. Undefined for
  // anonymous viewers and non-owners.
  onEdit?: () => void;
}) {
  // Mount/unmount with delay so the fade-out animation plays.
  // setState-during-render + delayed unmount via setTimeout — same
  // pattern as <BottomSheet>, sidesteps `react-hooks/set-state-in-effect`.
  const [shouldRender, setShouldRender] = useState(!!annotation);
  if (annotation && !shouldRender) setShouldRender(true);

  // Pin the last non-null annotation so the fadeout shows it (the
  // upstream prop has already cleared by the time we want to fade).
  const [pinned, setPinned] = useState<string | null>(annotation);
  const [pinnedStep, setPinnedStep] = useState(step);
  if (annotation && annotation !== pinned) {
    setPinned(annotation);
    setPinnedStep(step);
  }

  useEffect(() => {
    if (annotation || !shouldRender) return;
    const t = window.setTimeout(() => setShouldRender(false), ANIM_MS);
    return () => window.clearTimeout(t);
  }, [annotation, shouldRender]);

  if (!shouldRender || !pinned) return null;

  const visible = !!annotation;

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: 12,
        right: 12,
        // Sit above the dock: dock bottom is `max(12px, safe-area)` and
        // ~84px tall (action row + transport row + paddings). 108 keeps
        // a tidy 12px gap.
        bottom: 108,
        zIndex: 35,
        opacity: visible ? 1 : 0,
        transform: `translateY(${visible ? 0 : 8}px)`,
        transition: `opacity ${ANIM_MS}ms ease-out, transform ${ANIM_MS}ms ease-out`,
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          padding: "10px 12px 12px",
          borderRadius: 12,
          background: "oklch(0.196 0.030 155)",
          borderTop: "1px solid oklch(0.696 0.205 155 / 0.40)",
          borderRight: "1px solid oklch(0.696 0.205 155 / 0.20)",
          borderBottom: "1px solid oklch(0.696 0.205 155 / 0.20)",
          borderLeft: "3px solid oklch(0.696 0.205 155)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.55)",
        }}
      >
        <div
          className="flex items-center font-mono"
          style={{
            gap: 6,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: EMERALD_BRIGHT,
            marginBottom: 4,
          }}
        >
          <span aria-hidden style={dotStyle} />
          <span>note · {street} · step {pinnedStep + 1}</span>
          <span style={{ flex: 1 }} />
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit note"
              className="inline-flex items-center"
              style={{
                gap: 4,
                background: "transparent",
                border: 0,
                color: EMERALD_BRIGHT,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <Pencil size={10} />
              Edit
            </button>
          )}
        </div>
        <p
          className="whitespace-pre-wrap"
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: "oklch(0.92 0.05 155)",
            margin: 0,
          }}
        >
          {pinned}
        </p>
      </div>
    </div>
  );
}

const dotStyle: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: EMERALD_BRIGHT,
  display: "inline-block",
  boxShadow: "0 0 6px oklch(0.745 0.198 155 / 0.6)",
};
