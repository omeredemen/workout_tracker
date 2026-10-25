"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <p
      role="status"
      className="bg-surface-2 text-muted sticky top-0 z-30 px-4 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1 text-center text-xs font-medium"
    >
      Offline · everything you log is saved on this device
    </p>
  );
}
