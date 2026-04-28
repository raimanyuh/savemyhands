import Link from "next/link";

export function Shell({
  children,
  header,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {header}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

export function Header({
  title,
  back,
  backHref,
  onBack,
  right,
}: {
  title?: string;
  back?: string;
  backHref?: string;
  // If provided, called on click and can cancel navigation by returning false.
  onBack?: () => boolean | void;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
      <div className="flex items-center gap-3">
        {back && backHref && (
          <Link
            href={backHref}
            onClick={(e) => {
              if (!onBack) return;
              if (onBack() === false) e.preventDefault();
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {back}
          </Link>
        )}
        {title && (
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}
