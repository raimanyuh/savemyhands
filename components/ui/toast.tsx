"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Drop-in replacement for `window.alert` with proper styling. Use it via
// the `useToast` hook; mount `<ToastProvider>` once at the root.
//
//   const toast = useToast();
//   toast.error("Couldn't save the hand — try again.");
//   toast.success("Saved.");
//
// Toasts stack at the bottom-right (top of the stack on desktop, lifts
// above the safe-area inset on iOS), slide in, auto-dismiss after a few
// seconds, and have a manual close affordance. Errors stay longer than
// success/info so users have time to read them.

export type ToastKind = "error" | "success" | "info";

type ToastEntry = {
  id: number;
  kind: ToastKind;
  message: string;
};

type ToastFn = {
  error: (message: string, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  // Escape hatch when the caller wants to control kind dynamically.
  show: (opts: { kind?: ToastKind; message: string; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastFn | null>(null);

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  error: 6000,
  success: 3000,
  info: 4000,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  // Monotonic id so React keys stay stable across rapid bursts where
  // Date.now() could collide. Ref so the counter persists across renders
  // without triggering re-renders itself.
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (opts: { kind?: ToastKind; message: string; durationMs?: number }) => {
      const kind = opts.kind ?? "info";
      const id = nextId.current++;
      setToasts((ts) => [...ts, { id, kind, message: opts.message }]);
      const dur = opts.durationMs ?? DEFAULT_DURATIONS[kind];
      window.setTimeout(() => dismiss(id), dur);
    },
    [dismiss],
  );

  // Build the imperative API. Memoized on `push` (which is itself
  // stable — its only dep is `dismiss`, which has no deps), so the
  // context value stays referentially equal across renders and consumers
  // don't re-render every state change. We attach `.error/.success/.info`
  // helpers to the function so call sites can write `toast.error(...)`
  // OR `toast({ message, kind })`.
  // Plain object with method properties so the compiler doesn't flag
  // mutation-on-a-function-value (the prior Object.assign / .error =
  // patterns both tripped React 19's strict ref/immutability rules).
  // Memoized on `push` (stable — its only dep is `dismiss`, no deps) so
  // the context value stays referentially equal across renders.
  const toastFn = useMemo<ToastFn>(
    () => ({
      error: (message, durationMs) =>
        push({ kind: "error", message, durationMs }),
      success: (message, durationMs) =>
        push({ kind: "success", message, durationMs }),
      info: (message, durationMs) =>
        push({ kind: "info", message, durationMs }),
      show: (opts) => push(opts),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={toastFn}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastEntry[];
  onDismiss: (id: number) => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      // Fixed bottom-right stack. `pointer-events-none` on the wrapper so
      // toasts don't block taps on the underlying UI; each toast card
      // re-enables pointer events for itself.
      className="fixed z-[500] bottom-4 right-4 flex flex-col gap-2 items-end pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} entry={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>,
    document.body,
  );
}

function ToastCard({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: () => void;
}) {
  const accent =
    entry.kind === "error"
      ? "oklch(0.65 0.20 22)"
      : entry.kind === "success"
        ? "oklch(0.696 0.205 155)"
        : "oklch(0.715 0 0)";
  return (
    <div
      role={entry.kind === "error" ? "alert" : "status"}
      aria-live={entry.kind === "error" ? "assertive" : "polite"}
      className="pointer-events-auto rounded-xl border border-white/10 shadow-2xl flex items-start gap-3 px-3.5 py-2.5 max-w-[360px] animate-[smh-toast-in_180ms_ease-out]"
      style={{
        background: "oklch(0.205 0 0)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div className="text-[13px] leading-snug text-zinc-100 flex-1 min-w-0">
        {entry.message}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 mt-0.5 text-zinc-500 hover:text-zinc-200 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
