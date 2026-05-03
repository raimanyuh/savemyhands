"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// Generic content-height bottom sheet for mobile surfaces. Used by the
// card picker, filter sheet, setup sheet, and anything else that on
// desktop would be a popover or drawer.
//
//   const [open, setOpen] = useState(false);
//   <BottomSheet open={open} onOpenChange={setOpen} title="Pick a card">
//     ...
//   </BottomSheet>
//
// Behavior matches the design handoff:
// - Slide up 280ms cubic-bezier(0.32, 0.72, 0, 1)
// - Backdrop fades to rgba(0,0,0,0.55); tap to dismiss
// - Drag the grabber down 60+pt to dismiss
// - Esc closes
// - Sheet hugs content height; caps at maxHeightVh (default 85)
// - Respects iOS safe-area-inset-bottom

const ANIM_MS = 280;
const DRAG_DISMISS_PX = 60;

export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Title row (44pt) with a Cancel button on the right. Omit to skip
  // the header — the grabber alone is the dismiss affordance.
  title?: ReactNode;
  // Optional fixed footer below the scrollable content area. Typically
  // a primary button row.
  footer?: ReactNode;
  // Cap on sheet height. Content below this size makes the sheet hug
  // its content; content above is scrolled inside the sheet.
  maxHeightVh?: number;
  // Override the default "Cancel" label in the header.
  cancelLabel?: string;
  children: ReactNode;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  footer,
  maxHeightVh = 85,
  cancelLabel = "Cancel",
  children,
}: BottomSheetProps) {
  // Render-while-animating: we keep the sheet mounted briefly after
  // `open` flips false so the slide-down animation can play. The mount
  // happens synchronously via setState-during-render (React's blessed
  // pattern for deriving state from props); the unmount is scheduled
  // by a timeout in the effect callback once the animation completes.
  const [shouldRender, setShouldRender] = useState(open);
  if (open && !shouldRender) setShouldRender(true);
  useEffect(() => {
    if (open || !shouldRender) return;
    const t = window.setTimeout(() => setShouldRender(false), ANIM_MS);
    return () => window.clearTimeout(t);
  }, [open, shouldRender]);

  // Drag-to-dismiss. dragOffset is the cumulative finger displacement
  // since touchstart; only positive (downward) values translate the
  // sheet. dragging is the boolean "are we mid-touch" so we can skip
  // the spring animation while the finger is down.
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === "undefined") return null;
  if (!shouldRender) return null;

  const close = () => onOpenChange(false);

  // Drag handlers via Pointer Events so both touch (real mobile) and
  // mouse (DevTools, hybrid devices) drive the dismiss gesture. Pointer
  // capture lets the move/up events follow the pointer outside the
  // grabber's bounds.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    setDragging(true);
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* setPointerCapture can throw on some older browsers — ignore */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current == null) return;
    const dy = e.clientY - dragStartY.current;
    setDragOffset(Math.max(0, dy));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragOffset > DRAG_DISMISS_PX) {
      onOpenChange(false);
    }
    setDragOffset(0);
    setDragging(false);
    dragStartY.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  // While closing, translate fully off-screen. While dragging, follow
  // the finger 1:1. While open and idle, sit at translateY(0).
  const translateY = !open
    ? "100%"
    : dragging
      ? `${dragOffset}px`
      : "0";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[400] flex items-end"
      style={{
        background: "rgba(0,0,0,0.55)",
        opacity: open ? 1 : 0,
        transition: `opacity 240ms cubic-bezier(0.32, 0.72, 0, 1)`,
      }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full flex flex-col"
        style={{
          background: "var(--popover)",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTop: "1px solid rgba(255,255,255,0.10)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
          maxHeight: `${maxHeightVh}vh`,
          transform: `translateY(${translateY})`,
          transition: dragging
            ? "none"
            : `transform ${ANIM_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <div
          role="button"
          aria-label="Drag to dismiss"
          tabIndex={-1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex justify-center pt-2 pb-1 cursor-grab"
          style={{ touchAction: "none" }}
        >
          <span
            className="block h-1 w-9 rounded-full"
            style={{ background: "rgba(255,255,255,0.18)" }}
          />
        </div>
        {title && (
          <div
            className="flex items-center justify-between px-4 pt-1 pb-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="text-[14px] font-semibold tracking-tight">
              {title}
            </div>
            <button
              type="button"
              onClick={close}
              className="text-[13px] text-muted-foreground px-2 py-1 -mr-2"
            >
              {cancelLabel}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div
            className="px-4 py-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
