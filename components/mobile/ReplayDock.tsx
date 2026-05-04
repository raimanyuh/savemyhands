"use client";

// Floating media-player dock for the mobile replayer. Pinned to the
// viewport bottom so the felt's hero plate always clears it (the felt
// also lifts seats by `bottomInset=96` on its end). Layout:
//
//   ┌ [STREET] action label ─ ⏮ ▶ ⏭ ─━━●━━─ 04/11 ┐
//
// The first row carries the street pill + a one-line action summary so
// the user can read what just happened without taking their thumb off
// the scrubber. The second row is the transport + scrubber + step
// counter.

import { ChevronLeft, ChevronRight, Pause, Play, Pencil } from "lucide-react";
import type { ReplayStep } from "@/components/poker/hand";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_BRIGHT = "oklch(0.745 0.198 155)";
const BG_DARK_GLASS = "rgba(15,15,18,0.92)";

export function ReplayDock({
  step,
  totalSteps,
  street,
  actionLabel,
  playing,
  annotatedSteps,
  onStepChange,
  onPlayPause,
  onAddNote,
}: {
  step: number;
  totalSteps: number;
  street: ReplayStep["street"];
  actionLabel: string;
  playing: boolean;
  // Indices of steps with non-empty annotations — render dots on the
  // scrubber track so the user can see them at a glance.
  annotatedSteps: number[];
  onStepChange: (next: number) => void;
  onPlayPause: () => void;
  // Owner-only "Add note" affordance — shown in the action summary row
  // when the current step is annotatable but doesn't yet have a note.
  // Undefined for non-owners, non-action steps, or steps that already
  // have an annotation (the AnnotationBalloon hosts the Edit pencil in
  // that case instead).
  onAddNote?: () => void;
}) {
  const atFirst = step === 0;
  const atLast = step === totalSteps - 1;
  const pct = totalSteps > 1 ? (step / (totalSteps - 1)) * 100 : 0;

  return (
    <div
      className="fixed flex flex-col"
      style={{
        left: 12,
        right: 12,
        bottom: "max(12px, env(safe-area-inset-bottom))",
        padding: "10px 12px",
        gap: 8,
        borderRadius: 14,
        background: BG_DARK_GLASS,
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow:
          "0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px oklch(0.696 0.205 155 / 0.15)",
        backdropFilter: "blur(12px)",
        zIndex: 40,
      }}
    >
      {/* Action summary row */}
      <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
        <StreetPill street={street} />
        <span
          style={{
            fontSize: 12,
            color: "oklch(0.85 0 0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {actionLabel}
        </span>
        {onAddNote && (
          <button
            type="button"
            onClick={onAddNote}
            aria-label="Add note to this action"
            className="inline-flex items-center"
            style={{
              gap: 4,
              padding: "3px 8px",
              borderRadius: 999,
              background: "oklch(0.196 0.030 155 / 0.85)",
              border: "1px solid oklch(0.696 0.205 155 / 0.40)",
              color: EMERALD_BRIGHT,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              flexShrink: 0,
            }}
          >
            <Pencil size={10} />
            Add note
          </button>
        )}
      </div>

      {/* Transport + scrubber row */}
      <div
        className="flex items-center"
        style={{ gap: 6, minHeight: 36 }}
      >
        <button
          type="button"
          onClick={() => onStepChange(Math.max(0, step - 1))}
          disabled={atFirst}
          aria-label="Previous step"
          style={{
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            background: "transparent",
            border: 0,
            color: atFirst ? "oklch(0.45 0 0)" : "oklch(0.92 0 0)",
            opacity: atFirst ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={onPlayPause}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            width: 40,
            height: 40,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: EMERALD,
            border: 0,
            color: "oklch(0.145 0 0)",
            boxShadow:
              "0 4px 12px oklch(0.696 0.205 155 / 0.4)",
          }}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          onClick={() => onStepChange(Math.min(totalSteps - 1, step + 1))}
          disabled={atLast}
          aria-label="Next step"
          style={{
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            background: "transparent",
            border: 0,
            color: atLast ? "oklch(0.45 0 0)" : "oklch(0.92 0 0)",
            opacity: atLast ? 0.4 : 1,
          }}
        >
          <ChevronRight size={20} />
        </button>

        {/* Scrubber — visible track + hidden range input on top so
            touch dragging works without writing custom touch handlers. */}
        <div
          className="relative flex items-center"
          style={{ flex: 1, height: 36, minWidth: 80 }}
        >
          {/* Track background */}
          <div
            className="absolute left-0 right-0 rounded-full"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: 4,
              background: "oklch(1 0 0 / 0.10)",
            }}
          />
          {/* Track fill */}
          <div
            className="absolute left-0 rounded-full"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: 4,
              width: `${pct}%`,
              background: EMERALD,
            }}
          />
          {/* Annotation dots */}
          {annotatedSteps.map((i) => {
            const dotPct =
              totalSteps > 1 ? (i / (totalSteps - 1)) * 100 : 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onStepChange(i)}
                aria-label={`Jump to annotated step ${i + 1}`}
                className="absolute"
                style={{
                  left: `${dotPct}%`,
                  top: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: EMERALD_BRIGHT,
                  border: 0,
                  padding: 0,
                  boxShadow:
                    "0 0 0 2px rgba(15,15,18,0.92), 0 0 6px oklch(0.745 0.198 155 / 0.6)",
                }}
              />
            );
          })}
          {/* Thumb */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${pct}%`,
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#fafafa",
              border: `2px solid ${EMERALD}`,
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
            }}
          />
          {/* Hidden range input over the track */}
          <input
            type="range"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={step}
            onChange={(e) => onStepChange(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0"
            style={{
              touchAction: "manipulation",
              cursor: "pointer",
            }}
            aria-label="Replay scrubber"
          />
        </div>

        {/* Step counter */}
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            color: "oklch(0.85 0 0)",
            fontVariantNumeric: "tabular-nums",
            minWidth: 44,
            textAlign: "right",
          }}
        >
          <span style={{ color: EMERALD_BRIGHT }}>
            {String(step + 1).padStart(2, "0")}
          </span>
          <span style={{ color: "oklch(0.55 0 0)" }}>
            /{String(totalSteps).padStart(2, "0")}
          </span>
        </span>
      </div>
    </div>
  );
}

function StreetPill({ street }: { street: ReplayStep["street"] }) {
  return (
    <span
      className="font-mono font-semibold inline-flex items-center"
      style={{
        height: 20,
        padding: "0 7px",
        borderRadius: 5,
        background: "oklch(0.30 0.10 155 / 0.40)",
        border: "1px solid oklch(0.696 0.205 155 / 0.40)",
        color: EMERALD_BRIGHT,
        fontSize: 9,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
    >
      {street}
    </span>
  );
}
