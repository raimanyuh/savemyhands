"use client";

import { Suspense, type ReactNode } from "react";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast";
import { RouteProgress } from "@/components/ui/RouteProgress";

// Client-side providers shared across every route. Wraps the app body in
// the root layout. Add new app-wide providers here so the server-component
// layout file stays a thin shell.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfirmDialogProvider>
      <ToastProvider>
        {/* Suspense around RouteProgress is required because it calls
            useSearchParams — without a boundary, that would opt the
            entire client tree into CSR-only rendering. */}
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {children}
      </ToastProvider>
    </ConfirmDialogProvider>
  );
}
