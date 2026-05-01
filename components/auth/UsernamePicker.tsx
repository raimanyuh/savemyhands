"use client";

// Modal for picking / changing the signed-in user's public username.
//
// First render is the entry point on the dashboard header — anyone without
// a username set sees a "Set username" button instead of their email; the
// modal validates against the same regex as the DB CHECK and pings the
// server for live availability after a short debounce.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  checkUsernameAvailableAction,
  setUsernameAction,
} from "@/lib/profiles/actions";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

// Synchronous validation derived from the input alone. The async availability
// probe is layered on top — see `availability` state below.
type ValidationResult =
  | { kind: "empty" }
  | { kind: "format"; message: string }
  | { kind: "current" } // matches the user's existing username — no probe needed
  | { kind: "valid"; normalized: string };

function validate(value: string, initial: string | null): ValidationResult {
  const v = value.trim().toLowerCase();
  if (v === "") return { kind: "empty" };
  if (!USERNAME_REGEX.test(v))
    return {
      kind: "format",
      message: "3-20 chars: lowercase letters, numbers, underscore.",
    };
  if (initial && v === initial) return { kind: "current" };
  return { kind: "valid", normalized: v };
}

type Availability =
  | { kind: "idle" }
  | { kind: "checking"; query: string }
  | { kind: "available"; query: string }
  | { kind: "taken"; query: string }
  | { kind: "error"; query: string; message: string };

export function UsernamePicker({
  initial,
  onSaved,
  onClose,
}: {
  initial: string | null;
  onSaved: (username: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [availability, setAvailability] = useState<Availability>({
    kind: "idle",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Bumps on every probe so an in-flight request whose result arrives after
  // the user kept typing gets ignored.
  const requestSeq = useRef(0);

  const validation = useMemo(() => validate(value, initial), [value, initial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced availability probe — only fires for inputs that pass synchronous
  // validation and aren't equal to the user's current username. 350ms feels
  // right; faster makes the spinner thrash.
  useEffect(() => {
    if (validation.kind !== "valid") return;
    const query = validation.normalized;
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailableAction(query);
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setAvailability({ kind: "error", query, message: res.error });
      } else if (res.available) {
        setAvailability({ kind: "available", query });
      } else {
        setAvailability({ kind: "taken", query });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [validation]);

  // What to show in the inline status line. Priority: server-side submit
  // error > sync format error > async availability result. The "checking"
  // state shows whenever there's a valid input but no matching availability
  // result yet (handles both the 350ms debounce and stale matches).
  let statusNode: React.ReactNode = null;
  if (submitError) {
    statusNode = (
      <span style={{ color: "oklch(0.65 0.20 22)" }}>{submitError}</span>
    );
  } else if (validation.kind === "format") {
    statusNode = (
      <span style={{ color: "oklch(0.65 0.20 22)" }}>{validation.message}</span>
    );
  } else if (validation.kind === "current") {
    statusNode = (
      <span className="text-muted-foreground">That&apos;s your current username.</span>
    );
  } else if (validation.kind === "valid") {
    if (
      availability.kind === "available" &&
      availability.query === validation.normalized
    ) {
      statusNode = (
        <span style={{ color: "oklch(0.696 0.205 155)" }}>Available</span>
      );
    } else if (
      availability.kind === "taken" &&
      availability.query === validation.normalized
    ) {
      statusNode = (
        <span style={{ color: "oklch(0.65 0.20 22)" }}>
          That username is taken.
        </span>
      );
    } else if (
      availability.kind === "error" &&
      availability.query === validation.normalized
    ) {
      statusNode = (
        <span style={{ color: "oklch(0.65 0.20 22)" }}>
          {availability.message}
        </span>
      );
    } else {
      statusNode = <span className="text-muted-foreground">Checking…</span>;
    }
  }

  const canSubmit =
    !submitting &&
    validation.kind === "valid" &&
    availability.kind === "available" &&
    availability.query === validation.normalized;

  const submit = async () => {
    if (!canSubmit || validation.kind !== "valid") return;
    setSubmitting(true);
    setSubmitError(null);
    const res = await setUsernameAction(validation.normalized);
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(res.error);
      return;
    }
    onSaved(res.profile.username);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-xl border border-white/10 flex flex-col"
        style={{
          background: "oklch(0.205 0 0)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold tracking-tight">
            {initial ? "Change username" : "Pick a username"}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Shown on shared hands in place of your email. 3-20 chars, lowercase
            letters, numbers, and underscores.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Username
            </span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                @
              </span>
              <Input
                autoFocus
                value={value}
                onChange={(e) => {
                  setSubmitError(null);
                  setValue(e.target.value.toLowerCase().replace(/\s+/g, ""));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) submit();
                }}
                placeholder="raimana"
                className="h-11 sm:h-9 text-sm pl-7"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </label>
          <div className="text-xs h-4">{statusNode}</div>
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-11 sm:h-7">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              background: canSubmit ? "oklch(0.696 0.205 155)" : undefined,
              color: canSubmit ? "oklch(0.145 0 0)" : undefined,
              fontWeight: 600,
            }}
            className="h-11 sm:h-7 hover:!bg-[oklch(0.745_0.198_155)] disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
