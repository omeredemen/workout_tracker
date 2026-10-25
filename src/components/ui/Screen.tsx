import type { ReactNode } from "react";

/** Page frame: phone-width column, safe-area padding, room for the bottom nav. */
export function Screen({
  title,
  subtitle,
  action,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-48">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted mt-0.5 text-sm">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </main>
  );
}

export function Loading() {
  return (
    <main
      className="text-muted mx-auto w-full max-w-md px-4 pt-6"
      aria-busy="true"
    >
      Loading…
    </main>
  );
}

export function ErrorMessage({ error }: { error: Error }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <p
        className="border-danger text-danger rounded-2xl border p-4"
        role="alert"
      >
        Something went wrong: {error.message}
      </p>
    </main>
  );
}
