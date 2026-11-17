import type { IsoDate } from "./types";

/**
 * MET for a hypertrophy session including its rests. The Compendium of Physical
 * Activities lists resistance training at 3.5 (moderate, 8–15 reps) to 6.0
 * (vigorous); 5.0 sits between them.
 */
export const STRENGTH_TRAINING_MET = 5;

/**
 * Estimated energy burned, in kcal: MET × bodyweight (kg) × hours.
 * A rough estimate (±30 % or so); null when either input is unknown.
 */
export function estimateWorkoutKcal(
  durationMs: number | null,
  bodyweightKg: number | null,
  met = STRENGTH_TRAINING_MET,
): number | null {
  if (durationMs === null || bodyweightKg === null || bodyweightKg <= 0)
    return null;
  return Math.round(met * bodyweightKg * (Math.max(0, durationMs) / 3_600_000));
}

/** The latest recorded bodyweight on or before `date`, else the earliest one after it. */
export function bodyweightOn(
  metrics: { date: IsoDate; weightKg: number | null }[],
  date: IsoDate,
): number | null {
  const weighed = metrics
    .filter(
      (m): m is { date: IsoDate; weightKg: number } => m.weightKg !== null,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const before = weighed.filter((m) => m.date <= date).at(-1);
  return (before ?? weighed[0])?.weightKg ?? null;
}
