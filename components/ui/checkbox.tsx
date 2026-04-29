"use client";

import { Check } from "lucide-react";

// Built on a <button>, not <input type="checkbox">, because native checkbox
// inputs inherit inline-layout metrics (line-height, baseline alignment)
// from their context — which can stretch them differently in a table
// header vs a data row even when width/height are explicit. A button
// renders at exactly the size we set, every time.
export function Checkbox({
  checked,
  onChange,
  ariaLabel,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`
        inline-flex size-3.5 shrink-0 items-center justify-center
        rounded-sm border cursor-pointer transition-colors
        ${
          checked
            ? "bg-[oklch(0.696_0.205_155)] border-[oklch(0.696_0.205_155)]"
            : "bg-transparent border-[oklch(1_0_0_/_0.18)] hover:border-[oklch(1_0_0_/_0.30)]"
        }
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-[oklch(0.696_0.205_155_/_0.4)]
        ${className}
      `}
    >
      {checked && (
        <Check
          size={10}
          strokeWidth={3}
          className="text-[oklch(0.145_0_0)]"
        />
      )}
    </button>
  );
}
