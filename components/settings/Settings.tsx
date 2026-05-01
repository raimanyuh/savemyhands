"use client";

// /settings — account management.
//
// Sections:
//   * Profile — username (delegates to UsernamePicker for the change flow).
//   * Account — email (read-only), sign-in method (read-only), password set.
//   * Danger zone — account deletion behind a typed-confirmation modal.
//
// Styling tracks the dashboard's neutral charcoal palette. Sections are
// stacked cards rather than a single table so the page reads well at narrow
// widths (it's the cleanest mobile pattern this app has so far).

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Header, Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsernamePicker } from "@/components/auth/UsernamePicker";
import {
  changePasswordAction,
  deleteAccountAction,
} from "@/lib/profiles/actions";

const EMERALD = "oklch(0.696 0.205 155)";
const EMERALD_HOVER = "oklch(0.745 0.198 155)";
const DANGER = "oklch(0.55 0.22 25)";
const DANGER_HOVER = "oklch(0.62 0.22 25)";

// Friendly label for the user's primary sign-in method. Supabase exposes
// `app_metadata.provider` (single, the most-recent provider) and `.providers`
// (array, all linked); for display we show whichever is current and list
// extras inline if they exist.
function providerLabel(provider: string): string {
  switch (provider) {
    case "email":
      return "Email & password";
    case "google":
      return "Google";
    case "discord":
      return "Discord";
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1);
  }
}

export default function Settings({
  email,
  initialUsername,
  provider,
  providers,
}: {
  email: string;
  initialUsername: string | null;
  provider: string;
  providers: string[];
}) {
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <Shell
      header={
        <Header
          title="Settings"
          back="Dashboard"
          backHref="/dashboard"
        />
      }
    >
      <div className="flex-1 flex flex-col items-center px-6 py-10 gap-6 max-w-[640px] w-full mx-auto">
        <SectionCard title="Profile">
          <Row label="Username">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">
                {username ? (
                  <span className="font-medium">@{username}</span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUsernameOpen(true)}
              >
                {username ? "Change" : "Set username"}
              </Button>
            </div>
          </Row>
        </SectionCard>

        <SectionCard title="Account">
          <Row label="Email">
            <span className="text-sm">{email}</span>
          </Row>
          <Row label="Sign-in method">
            <span className="text-sm">
              {providerLabel(provider)}
              {providers.length > 1 && (
                <span className="text-muted-foreground">
                  {" "}
                  (also linked: {providers
                    .filter((p) => p !== provider)
                    .map(providerLabel)
                    .join(", ")})
                </span>
              )}
            </span>
          </Row>
          <Row label="Password">
            <PasswordForm />
          </Row>
        </SectionCard>

        <SectionCard
          title="Danger zone"
          accent={DANGER}
        >
          <Row label="Delete account">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">
                Permanently deletes your account and every hand you&apos;ve recorded. This cannot be undone.
              </span>
              <Button
                onClick={() => setDeleteOpen(true)}
                style={{ background: DANGER, color: "white", fontWeight: 600 }}
                className="h-11 sm:h-8 hover:opacity-90 sm:shrink-0"
              >
                Delete account
              </Button>
            </div>
          </Row>
        </SectionCard>
      </div>

      {usernameOpen && (
        <UsernamePicker
          initial={username}
          onSaved={(u) => setUsername(u)}
          onClose={() => setUsernameOpen(false)}
        />
      )}
      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} />}
    </Shell>
  );
}

function SectionCard({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="w-full rounded-xl border flex flex-col"
      style={{
        background: "oklch(0.205 0 0)",
        borderColor: accent ?? "rgba(255,255,255,0.08)",
      }}
    >
      <div className="px-5 py-3 border-b border-white/5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: accent ?? undefined }}
        >
          {title}
        </h2>
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 border-b border-white/5 last:border-b-0 flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function PasswordForm() {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "success" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const mismatch = pw2.length > 0 && pw1 !== pw2;
  const canSubmit =
    !pending && pw1.length >= 8 && pw2.length >= 8 && pw1 === pw2;

  const submit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await changePasswordAction(pw1);
      if (!res.ok) {
        setStatus({ kind: "error", message: res.error });
        return;
      }
      setStatus({ kind: "success" });
      setPw1("");
      setPw2("");
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <Input
          type="password"
          value={pw1}
          onChange={(e) => {
            setStatus({ kind: "idle" });
            setPw1(e.target.value);
          }}
          placeholder="New password"
          className="h-11 sm:h-9 text-sm flex-1"
          autoComplete="new-password"
        />
        <Input
          type="password"
          value={pw2}
          onChange={(e) => {
            setStatus({ kind: "idle" });
            setPw2(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) submit();
          }}
          placeholder="Confirm new password"
          className="h-11 sm:h-9 text-sm flex-1"
          autoComplete="new-password"
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={!canSubmit}
          style={{
            background: canSubmit ? EMERALD : undefined,
            color: canSubmit ? "oklch(0.145 0 0)" : undefined,
            fontWeight: 600,
          }}
          className={`h-11 sm:h-9 hover:!bg-[${EMERALD_HOVER}] disabled:opacity-50 sm:shrink-0`}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <div className="text-xs h-4">
        {status.kind === "success" && (
          <span style={{ color: EMERALD }}>Password updated.</span>
        )}
        {status.kind === "error" && (
          <span style={{ color: "oklch(0.65 0.20 22)" }}>{status.message}</span>
        )}
        {status.kind === "idle" && mismatch && (
          <span style={{ color: "oklch(0.65 0.20 22)" }}>
            Passwords don&apos;t match.
          </span>
        )}
        {status.kind === "idle" && !mismatch && pw1.length > 0 && pw1.length < 8 && (
          <span className="text-muted-foreground">
            At least 8 characters.
          </span>
        )}
      </div>
    </div>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = confirm.trim() === "DELETE" && !pending;

  const submit = () => {
    if (!canDelete) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteAccountAction();
        // The action redirects on success — we never reach this line.
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete account.");
      }
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-xl border flex flex-col"
        style={{
          background: "oklch(0.205 0 0)",
          borderColor: DANGER,
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold tracking-tight" style={{ color: DANGER }}>
            Delete account
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
          <p className="text-sm text-muted-foreground leading-relaxed">
            This will permanently delete your account, your username, and every hand you&apos;ve recorded. Shared hand URLs will 404. <span className="text-foreground font-medium">This cannot be undone.</span>
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Type DELETE to confirm
            </span>
            <Input
              autoFocus
              value={confirm}
              onChange={(e) => {
                setError(null);
                setConfirm(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canDelete) submit();
              }}
              placeholder="DELETE"
              className="h-11 sm:h-9 text-sm"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          {error && (
            <span className="text-xs" style={{ color: "oklch(0.65 0.20 22)" }}>
              {error}
            </span>
          )}
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-11 sm:h-7">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!canDelete}
            style={{
              background: canDelete ? DANGER : undefined,
              color: canDelete ? "white" : undefined,
              fontWeight: 600,
            }}
            className={`h-11 sm:h-7 hover:!bg-[${DANGER_HOVER}] disabled:opacity-50`}
          >
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
