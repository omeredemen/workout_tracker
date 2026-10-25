"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Bottom sheet built on <dialog>, which gives focus trapping and Escape for free. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A tap on the backdrop (the dialog element itself, outside the panel) closes it.
      onClick={(e) => e.target === ref.current && onClose()}
      className="border-border bg-surface text-foreground fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-md rounded-t-3xl border p-0 backdrop:bg-black/60"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="border-border flex items-center justify-between gap-3 border-b px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted active:bg-surface-2 h-11 rounded-xl px-3 font-medium"
          >
            Close
          </button>
        </header>
        <div className="overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </dialog>
  );
}
