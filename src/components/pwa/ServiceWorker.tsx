"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds (it would fight hot reload in dev). */
export function ServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
    navigator.serviceWorker
      .register(`/sw.js?v=${version}`, { scope: "/" })
      .catch((error: unknown) => {
        console.warn("Service worker registration failed", error);
      });
  }, []);
  return null;
}
