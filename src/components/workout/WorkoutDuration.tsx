"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { estimateWorkoutKcal } from "@/domain/calories";
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

/** Elapsed workout time in ms, live while in progress; null when unknown. */
function useWorkoutMs(session: TimedSession | null | undefined): number | null {
  const now = useNow(session?.status === "in_progress");
  return session ? workoutDurationMs(session, now) : null;
}

/** Elapsed workout time ("52:10"), live while in progress; null when unknown. */
export function useWorkoutDuration(
  session: TimedSession | null | undefined,
): string | null {
  const ms = useWorkoutMs(session);
  return ms === null ? null : formatDuration(ms);
}

/** Sticky workout clock at the top of the workout page, with a calorie estimate. */
export function WorkoutClock({
  session,
  isToday,
  bodyweightKg,
  onStart,
}: {
  session: TimedSession | null | undefined;
  /** The workout is planned for today (its first set starts the clock by itself). */
  isToday: boolean;
  bodyweightKg: number | null;
  onStart: () => void;
}) {
  const ms = useWorkoutMs(session);
  const completed = session?.status === "completed";

  if (ms === null) {
    if (completed) return null;
    return (
      <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-2xl border px-4 py-2">
        <p className="text-muted text-sm">
          {isToday
            ? "The timer starts with your first set."
            : "Doing this workout now? Start the timer."}
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

  const kcal = estimateWorkoutKcal(ms, bodyweightKg);
  return (
    <div
      role="timer"
      aria-label={completed ? "Workout duration" : "Time in workout"}
      className="border-border bg-surface sticky top-[env(safe-area-inset-top)] z-10 flex items-center justify-between gap-3 rounded-2xl border px-4 py-2 shadow-sm"
    >
      <div className="min-w-0">
        <p className="text-muted text-sm font-medium">
          {completed ? "Workout took" : "Workout time"}
        </p>
        {kcal !== null ? (
          <p
            className="text-muted text-xs tabular-nums"
            aria-label={`About ${kcal} kilocalories burned`}
          >
            ≈ {kcal} kcal burned
          </p>
        ) : (
          completed && (
            <Link href="/progress" className="text-muted text-xs underline">
              Log your bodyweight to estimate calories
            </Link>
          )
        )}
      </div>
      <span className="text-2xl font-bold tabular-nums">
        {formatDuration(ms)}
      </span>
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
