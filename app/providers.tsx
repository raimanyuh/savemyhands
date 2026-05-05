"use client";

import type { ReactNode } from "react";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast";

// Client-side providers shared across every route. Wraps the app body in
// the root layout. Add new app-wide providers here so the server-component
// layout file stays a thin shell.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfirmDialogProvider>
      <ToastProvider>{children}</ToastProvider>
    </ConfirmDialogProvider>
  );
}
