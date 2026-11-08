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
 * Only counts a workout started on its own day: sets filled in on a later day would
 * otherwise show the time spent typing them in. A running workout only counts on that
 * day, so a forgotten "Finish" doesn't show a clock running for days.
 */
export function workoutDurationMs(
  session: TimedSession,
  now: Date,
): number | null {
  if (!session.startedAt) return null;
  const started = new Date(session.startedAt);
  if (Number.isNaN(started.getTime())) return null;
  if (toIsoDate(started) !== session.date) return null;

  let end: Date;
  if (session.status === "completed" && session.finishedAt) {
    end = new Date(session.finishedAt);
    if (Number.isNaN(end.getTime())) return null;
  } else if (session.status === "in_progress") {
    if (toIsoDate(now) !== session.date) return null;
    end = now;
  } else {
    return null;
  }
  return Math.max(0, end.getTime() - started.getTime());
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
