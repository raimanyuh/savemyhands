"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

// Drop-in replacement for `window.confirm` with proper styling. Use it via
// the `useConfirm` hook; mount `<ConfirmDialogProvider>` once at the root.
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Delete this hand?", destructive: true }))) return;
//   doDelete();
export type ConfirmOptions = {
  title: string;
  // Body copy. Plain string or any node — pass JSX when you want emphasis
  // (e.g. a hand name in bold) or a list of items.
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // Styles the confirm button red and shifts focus to Cancel by default,
  // matching the conventions for irreversible actions.
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error(
      "useConfirm must be used inside <ConfirmDialogProvider>",
    );
  }
  return ctx;
}

type PendingState = {
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    setPending((p) => {
      if (p) p.resolve(ok);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmDialogView
          opts={pending.opts}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialogView({
  opts,
  onConfirm,
  onCancel,
}: {
  opts: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        // Only treat Enter as confirm when the focus is on a button or the
        // dialog itself — avoid hijacking Enter inside any future inputs.
        const tag = (document.activeElement?.tagName ?? "").toLowerCase();
        if (tag === "button" || tag === "body") {
          e.preventDefault();
          onConfirm();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onConfirm, onCancel]);

  if (typeof document === "undefined") return null;

  const confirmLabel = opts.confirmLabel ?? "Confirm";
  const cancelLabel = opts.cancelLabel ?? "Cancel";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-xl border border-white/10 flex flex-col"
        style={{
          background: "oklch(0.205 0 0)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div className="px-5 pt-4 pb-3">
          <h3
            id="confirm-dialog-title"
            className="text-[15px] font-semibold tracking-tight"
          >
            {opts.title}
          </h3>
          {opts.message !== undefined && opts.message !== null && (
            <div className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {opts.message}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            autoFocus={opts.destructive}
          >
            {cancelLabel}
          </Button>
          {opts.destructive ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onConfirm}
              autoFocus
              style={{
                background: "oklch(0.696 0.205 155)",
                color: "oklch(0.145 0 0)",
                fontWeight: 600,
              }}
              className="hover:!bg-[oklch(0.745_0.198_155)]"
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
