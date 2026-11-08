"use client";

import { useEffect, useState } from "react";
import {
  formatDuration,
  workoutDurationMs,
  type TimedSession,
} from "@/domain/duration";

/** Current time, re-rendered every second while `running`. */
function useNow(running: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(new Date());
    tick();
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);
  return now;
}

/** Elapsed workout time ("52:10"), live while in progress; null when unknown. */
export function useWorkoutDuration(
  session: TimedSession | null | undefined,
): string | null {
  const now = useNow(session?.status === "in_progress");
  if (!session) return null;
  const ms = workoutDurationMs(session, now);
  return ms === null ? null : formatDuration(ms);
}

/** Sticky workout clock at the top of the workout page. */
export function WorkoutClock({
  session,
  canStart,
  onStart,
}: {
  session: TimedSession | null | undefined;
  /** Show a start button (today's workout, not started yet). */
  canStart: boolean;
  onStart: () => void;
}) {
  const duration = useWorkoutDuration(session);
  const completed = session?.status === "completed";

  if (duration === null) {
    if (!canStart) return null;
    return (
      <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-2xl border px-4 py-2">
        <p className="text-muted text-sm">
          The timer starts with your first set.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="border-border active:bg-surface-2 h-11 shrink-0 rounded-xl border px-4 font-semibold"
        >
          Start now
        </button>
      </div>
    );
  }

  return (
    <div
      role="timer"
      aria-label={completed ? "Workout duration" : "Time in workout"}
      className="border-border bg-surface sticky top-[env(safe-area-inset-top)] z-10 flex items-baseline justify-between gap-3 rounded-2xl border px-4 py-2 shadow-sm"
    >
      <span className="text-muted text-sm font-medium">
        {completed ? "Workout took" : "Workout time"}
      </span>
      <span className="text-2xl font-bold tabular-nums">{duration}</span>
    </div>
  );
}

/** Inline "· 52:10" for summaries; renders nothing when unknown. */
export function WorkoutDurationText({
  session,
  prefix = "",
}: {
  session: TimedSession | null | undefined;
  prefix?: string;
}) {
  const duration = useWorkoutDuration(session);
  return duration === null ? null : (
    <span className="tabular-nums">
      {prefix}
      {duration}
    </span>
  );
}
