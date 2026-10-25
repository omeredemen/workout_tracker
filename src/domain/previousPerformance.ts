import type { IsoDate, SetLog } from "./types";

export type PreviousPerformance = {
  date: IsoDate;
  sessionId: string;
  /** Sorted by setIndex. */
  sets: SetLog[];
};

/**
 * The most recent session before `beforeDate` in which this exercise was
 * performed. Matches the exercise actually done, so history follows swaps.
 */
export function previousPerformance(
  logs: SetLog[],
  exerciseId: string,
  beforeDate: IsoDate,
): PreviousPerformance | null {
  let latest: SetLog | undefined;
  for (const log of logs) {
    if (log.exerciseId !== exerciseId || log.performedOn >= beforeDate)
      continue;
    if (!latest || log.performedOn > latest.performedOn) latest = log;
  }
  if (!latest) return null;

  const { sessionId, performedOn } = latest;
  return {
    date: performedOn,
    sessionId,
    sets: logs
      .filter((l) => l.sessionId === sessionId && l.exerciseId === exerciseId)
      .sort((a, b) => a.setIndex - b.setIndex),
  };
}
