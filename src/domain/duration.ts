import { toIsoDate } from "./dates";
import type { IsoDate } from "./types";

export interface TimedSession {
  date: IsoDate;
  status: "planned" | "in_progress" | "completed" | "skipped";
  /** ISO timestamps. */
  startedAt: string | null;
  finishedAt: string | null;
}

/**
 * How long the workout took (or has taken so far), in ms; null when it can't be told.
 *
 * The clock is the real time between start and finish, wherever the workout sits on
 * the calendar, so a skipped day done later is timed too. Sets filled in afterwards
 * never set `startedAt` (see `startedStatus`), so they show no duration. A start and
 * finish on different days (a forgotten "Finish") counts as unknown, and a running
 * clock stops at the end of the day it started.
 */
export function workoutDurationMs(
  session: TimedSession,
  now: Date,
): number | null {
  if (!session.startedAt) return null;
  const started = new Date(session.startedAt);
  if (Number.isNaN(started.getTime())) return null;

  let end: Date;
  if (session.status === "completed" && session.finishedAt) {
    end = new Date(session.finishedAt);
    if (Number.isNaN(end.getTime())) return null;
  } else if (session.status === "in_progress") {
    end = now;
  } else {
    return null;
  }
  if (toIsoDate(end) !== toIsoDate(started)) return null;
  return Math.max(0, end.getTime() - started.getTime());
}

/** True while the workout is being done right now (started today and not finished). */
export function isRunning(session: TimedSession | null | undefined, now: Date) {
  return (
    session?.status === "in_progress" &&
    workoutDurationMs(session, now) !== null
  );
}

/** "4:07", "52:10", "1:05:09". */
export function formatDuration(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
