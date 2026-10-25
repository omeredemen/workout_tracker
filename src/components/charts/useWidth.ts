"use client";

import { useEffect, useRef, useState } from "react";

/** Tracks an element's width so SVG charts draw at real pixel size (crisp 1px/2px strokes). */
export function useWidth<T extends HTMLElement>(fallback = 340) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
