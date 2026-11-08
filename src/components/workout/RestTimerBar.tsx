"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { restTimer } from "@/lib/restTimer";

/** Floating rest countdown above the bottom nav, on every screen while a rest is running. */
export function RestTimerBar() {
  const raw = useSyncExternalStore(
    restTimer.subscribe,
    restTimer.snapshot,
    () => null,
  );
  const timer = restTimer.parse(raw);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!raw) return;
    const tick = () => {
      const t = restTimer.parse(restTimer.snapshot());
      const current = Date.now();
      setNow(current);
      if (!t) return;
      if (current >= t.endsAt) restTimer.notify();
      // Clear a finished timer after a while so it doesn't linger.
      if (current >= t.endsAt + 15_000) restTimer.stop();
    };
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [raw]);

  if (!timer) return null;
  const remainingSec = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  const done = remainingSec === 0;
  const progress = done
    ? 1
    : 1 - (timer.endsAt - now) / (timer.totalSec * 1000);

  return (
    <div
      role="timer"
      aria-label="Rest timer"
      aria-live={done ? "assertive" : "off"}
      className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md px-3 pb-2`}
    >
      <div
        className={`overflow-hidden rounded-2xl border shadow-lg ${
          done
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-surface"
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium ${done ? "" : "text-muted"}`}>
              {done ? "Rest over" : timer.label}
            </p>
            <p className="text-3xl font-bold tabular-nums">
              {done
                ? "Go!"
                : `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")}`}
            </p>
          </div>
          {!done && (
            <button
              type="button"
              onClick={() => restTimer.add(30)}
              className="border-border active:bg-surface-2 h-12 rounded-xl border px-4 font-semibold"
            >
              +30s
            </button>
          )}
          <button
            type="button"
            onClick={() => restTimer.stop()}
            className={`h-12 rounded-xl px-4 font-semibold ${done ? "bg-accent-foreground/15" : "border-border active:bg-surface-2 border"}`}
          >
            {done ? "Dismiss" : "Skip"}
          </button>
        </div>
        {!done && (
          <div className="bg-surface-2 h-1">
            <div
              className="bg-accent h-full transition-[width] duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
