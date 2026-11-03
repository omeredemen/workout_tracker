import type { z } from "zod";
import type { equipmentSchema } from "./program.schema";
import type {
  IsoDate,
  LibraryExercise,
  Program,
  ScheduledDay,
  SetLog,
} from "./types";

// Progressive overload by double progression: keep the weight while the reps
// climb past the target, then add weight and work back up. Thresholds follow
// the "2-for-2" coaching rule (beat the target in two workouts in a row before
// adding load) and the common stall rule (miss twice at a weight → drop ~10%).

type Equipment = z.output<typeof equipmentSchema>;

export type OverloadRules = {
  /** Reps above target that count as "beat the target". */
  extraReps: number;
  /** Consecutive workouts at the same weight that must beat the target. */
  sessionsToConfirm: number;
  /** Reps above target in one workout that mean the weight is clearly too light. */
  tooLightReps: number;
  /** Reps below target that count as a miss. */
  missReps: number;
  /** Load added, as a fraction of the weight (at least one plate/pin step). */
  increaseFraction: number;
  /** Load removed after repeated misses, as a fraction of the weight. */
  deloadFraction: number;
};

export const DEFAULT_OVERLOAD_RULES: OverloadRules = {
  extraReps: 1,
  sessionsToConfirm: 2,
  tooLightReps: 4,
  missReps: 2,
  increaseFraction: 0.025,
  deloadFraction: 0.1,
};

/** Smallest practical load jump per equipment, in kg. */
export const WEIGHT_STEP_KG: Record<Equipment, number> = {
  barbell: 2.5,
  smith: 2.5,
  ez_bar: 2.5,
  machine: 2.5,
  cable: 2.5,
  dumbbell: 2,
  bodyweight: 2.5,
};

export function weightStepKg(exercise: LibraryExercise): number {
  return WEIGHT_STEP_KG[exercise.equipment[0] ?? "machine"];
}

export type SetAdvice =
  /** No earlier set at this position to go on. */
  | { kind: "new" }
  | {
      kind: "increase";
      /** null for bodyweight: add load or reps another way. */
      weightKg: number | null;
      fromKg: number | null;
      reason: string;
    }
  | {
      kind: "repeat";
      weightKg: number | null;
      /** Reps to aim for at that weight. */
      goalReps: number;
      reason: string;
    }
  | { kind: "decrease"; weightKg: number; fromKg: number; reason: string };

/**
 * The target reps a past set was planned with, from the program and schedule;
 * undefined if the date or slot isn't in them (another enrollment, say).
 */
export function plannedTargetReps(
  program: Program,
  schedule: ScheduledDay[],
  log: Pick<SetLog, "performedOn" | "plannedExerciseId" | "setIndex">,
): number | undefined {
  const day = schedule.find((d) => d.date === log.performedOn);
  if (!day?.dayKey) return undefined;
  const phase = program.phases.find((p) => p.id === day.phaseId);
  const slot = phase?.days[day.dayKey]?.find(
    (s) => s.exerciseId === log.plannedExerciseId,
  );
  return slot?.reps[log.setIndex];
}

type Attempt = {
  date: IsoDate;
  weightKg: number | null;
  reps: number;
  target: number;
};

const sameWeight = (a: number | null, b: number | null) =>
  a === null || b === null ? a === b : Math.abs(a - b) < 0.05;

const round2 = (kg: number) => Math.round(kg * 100) / 100;

/**
 * What to do on one set of `exerciseId` on `date`, from earlier workouts of
 * the same exercise (actual exercise, so history follows swaps).
 *
 * - beat the target by `extraReps` in `sessionsToConfirm` workouts in a row at
 *   the same weight, or by `tooLightReps` once → increase
 * - fell `missReps` short in two workouts in a row at the same weight → decrease
 * - otherwise repeat the weight, aiming one rep past last time's result
 */
export function adviseSet(
  logs: SetLog[],
  params: {
    exerciseId: string;
    setIndex: number;
    date: IsoDate;
    targetReps: number;
    stepKg: number;
    /** Target of a past set; falls back to today's target. */
    targetFor?: (log: SetLog) => number | undefined;
    rules?: OverloadRules;
  },
): SetAdvice {
  const { exerciseId, setIndex, date, targetReps, stepKg } = params;
  const rules = params.rules ?? DEFAULT_OVERLOAD_RULES;

  // Earlier workouts of this exercise, newest first.
  const bySession = new Map<string, SetLog[]>();
  for (const log of logs) {
    if (log.exerciseId !== exerciseId || log.performedOn >= date) continue;
    bySession.set(log.sessionId, [
      ...(bySession.get(log.sessionId) ?? []),
      log,
    ]);
  }
  const sessions = [...bySession.values()].sort((a, b) =>
    b[0]!.performedOn.localeCompare(a[0]!.performedOn),
  );

  // This set's attempts, newest first, stopping at a workout that skipped it.
  const attempts: Attempt[] = [];
  for (const sets of sessions) {
    const log = sets.find((s) => s.setIndex === setIndex);
    if (!log) break;
    attempts.push({
      date: log.performedOn,
      weightKg: log.weightKg,
      reps: log.reps,
      target: params.targetFor?.(log) ?? targetReps,
    });
  }
  const last = attempts[0];
  if (!last) return { kind: "new" };

  // Attempts at the most recent weight, newest first.
  const atWeight: Attempt[] = [];
  for (const a of attempts) {
    if (!sameWeight(a.weightKg, last.weightKg)) break;
    atWeight.push(a);
  }
  const beat = (a: Attempt) => a.reps >= a.target + rules.extraReps;
  const missed = (a: Attempt) => a.reps <= a.target - rules.missReps;
  const confirm = atWeight.slice(0, rules.sessionsToConfirm);
  const w = last.weightKg;

  const increase = (reason: string): SetAdvice => ({
    kind: "increase",
    fromKg: w,
    weightKg:
      w === null
        ? null
        : round2(
            w + Math.max(stepKg, roundTo(w * rules.increaseFraction, stepKg)),
          ),
    reason,
  });

  if (last.reps >= last.target + rules.tooLightReps) {
    return increase(
      `${last.reps} reps vs a target of ${last.target}: the weight is too light.`,
    );
  }
  if (confirm.length === rules.sessionsToConfirm && confirm.every(beat)) {
    return increase(
      `Beat ${last.target} reps in your last ${rules.sessionsToConfirm} workouts at this weight.`,
    );
  }
  // Fewer reps planned than last time (e.g. a new phase): go heavier.
  if (targetReps <= last.target - 2 && last.reps >= last.target) {
    return increase(
      `Target drops from ${last.target} to ${targetReps} reps: go heavier.`,
    );
  }

  const deload = confirm.length >= 2 && confirm.slice(0, 2).every(missed);
  if (deload && w !== null && w > 0) {
    const drop = Math.max(stepKg, roundTo(w * rules.deloadFraction, stepKg));
    return {
      kind: "decrease",
      fromKg: w,
      weightKg: Math.max(0, round2(w - drop)),
      reason: `Fell short of ${last.target} reps twice at this weight: drop it and build back up.`,
    };
  }

  if (beat(last)) {
    return {
      kind: "repeat",
      weightKg: w,
      goalReps: Math.max(targetReps + rules.extraReps, last.reps),
      reason: `Beat the target once. Do it again next workout to earn more weight.`,
    };
  }
  if (last.reps >= last.target) {
    return {
      kind: "repeat",
      weightKg: w,
      goalReps: Math.max(targetReps, last.reps) + rules.extraReps,
      reason: `Hit the target. Add a rep to work toward more weight.`,
    };
  }
  return {
    kind: "repeat",
    weightKg: w,
    goalReps: Math.min(targetReps, last.reps + 1),
    reason: `${last.reps} of ${last.target} reps last time. Keep the weight and add a rep.`,
  };
}

/** One line for a whole exercise: the strongest per-set advice. */
export function summarizeAdvice(sets: SetAdvice[]): SetAdvice["kind"] {
  const kinds = sets.map((s) => s.kind);
  if (kinds.includes("decrease")) return "decrease";
  if (kinds.includes("increase")) return "increase";
  if (kinds.includes("repeat")) return "repeat";
  return "new";
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}
