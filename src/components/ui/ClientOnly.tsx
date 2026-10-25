"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const noopSubscribe = () => () => {};

/**
 * Renders children only in the browser after hydration. App data lives in
 * localStorage, so there is nothing meaningful to render on the server, and
 * prerendering must not read the clock or storage. Use it inside each page
 * (not the root layout) so Next.js can still render and validate the segment.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return hydrated ? children : fallback;
}
