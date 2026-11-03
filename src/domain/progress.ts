import { addDays } from "date-fns";
import { parseIsoDate, toIsoDate } from "./dates";
import type { IsoDate, ScheduledDay, SetLog } from "./types";

/** Epley estimate of a one-rep max. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

/**
 * For each entry, the mean of all entries in the `days`-day window ending on
 * its date (inclusive). Missing days are simply absent from the window.
 */
export function movingAverage(
  entries: { date: IsoDate; value: number }[],
  days = 7,
): { date: IsoDate; value: number }[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map(({ date }) => {
    const from = toIsoDate(addDays(parseIsoDate(date), -(days - 1)));
    const window = sorted.filter((e) => e.date >= from && e.date <= date);
    return {
      date,
      value: window.reduce((sum, e) => sum + e.value, 0) / window.length,
    };
  });
}

export type BestSet = {
  date: IsoDate;
  weightKg: number | null;
  reps: number;
  estimatedMaxKg: number | null;
};

/**
 * The best set of each session in which this exercise was done, oldest first.
 * Best = highest estimated 1RM; for bodyweight sets (no weight), most reps.
 */
export function bestSetPerSession(
  logs: SetLog[],
  exerciseId: string,
): BestSet[] {
  const bySession = new Map<string, SetLog[]>();
  for (const log of logs) {
    if (log.exerciseId !== exerciseId) continue;
    bySession.set(log.sessionId, [
      ...(bySession.get(log.sessionId) ?? []),
      log,
    ]);
  }
  const best: BestSet[] = [];
  for (const sets of bySession.values()) {
    const score = (s: SetLog) =>
      s.weightKg === null
        ? -1e6 + s.reps
        : estimatedOneRepMax(s.weightKg, s.reps);
    const top = sets.reduce((a, b) => (score(b) > score(a) ? b : a));
    best.push({
      date: top.performedOn,
      weightKg: top.weightKg,
      reps: top.reps,
      estimatedMaxKg:
        top.weightKg === null
          ? null
          : estimatedOneRepMax(top.weightKg, top.reps),
    });
  }
  return best.sort((a, b) => a.date.localeCompare(b.date));
}

export type WeekSummary = {
  week: number;
  phaseId: string;
  planned: number;
  completed: number;
  skipped: number;
  cardioDays: number;
};

/** Planned vs completed workouts (and cardio days) for each program week. */
export function weeklyCompletion(
  schedule: ScheduledDay[],
  sessions: { date: IsoDate; status: string; cardioDone: boolean }[],
): WeekSummary[] {
  const byDate = new Map(sessions.map((s) => [s.date, s]));
  const weeks = new Map<number, WeekSummary>();
  for (const day of schedule) {
    const summary = weeks.get(day.week) ?? {
      week: day.week,
      phaseId: day.phaseId,
      planned: 0,
      completed: 0,
      skipped: 0,
      cardioDays: 0,
    };
    const session = byDate.get(day.date);
    if (day.dayKey !== null) {
      summary.planned++;
      if (session?.status === "completed") summary.completed++;
      if (session?.status === "skipped") summary.skipped++;
    }
    if (session?.cardioDone) summary.cardioDays++;
    weeks.set(day.week, summary);
  }
  return [...weeks.values()];
}

export type SessionSets = {
  date: IsoDate;
  /** Sorted by setIndex. */
  sets: SetLog[];
  /** Sum of weight × reps (main sets only; 0 for bodyweight). */
  volumeKg: number;
  /** Heaviest set's weight compared with the previous session's. */
  change: "up" | "down" | "same" | "first";
};

/** Every session of this exercise with all its sets, newest first. */
export function setsBySession(
  logs: SetLog[],
  exerciseId: string,
): SessionSets[] {
  const bySession = new Map<string, SetLog[]>();
  for (const log of logs) {
    if (log.exerciseId !== exerciseId) continue;
    bySession.set(log.sessionId, [
      ...(bySession.get(log.sessionId) ?? []),
      log,
    ]);
  }
  const oldestFirst = [...bySession.values()]
    .map((sets) => sets.sort((a, b) => a.setIndex - b.setIndex))
    .sort((a, b) => a[0]!.performedOn.localeCompare(b[0]!.performedOn));

  const top = (sets: SetLog[]) => Math.max(...sets.map((s) => s.weightKg ?? 0));
  return oldestFirst
    .map((sets, i): SessionSets => {
      const before = oldestFirst[i - 1];
      const diff = before ? top(sets) - top(before) : 0;
      return {
        date: sets[0]!.performedOn,
        sets,
        volumeKg: sets.reduce((n, s) => n + (s.weightKg ?? 0) * s.reps, 0),
        change: !before
          ? "first"
          : diff > 0.05
            ? "up"
            : diff < -0.05
              ? "down"
              : "same",
      };
    })
    .reverse();
}
