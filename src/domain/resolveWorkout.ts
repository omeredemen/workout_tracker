import { findExercise } from "./library";
import type {
  ExerciseLibrary,
  ExerciseSwap,
  Program,
  ResolvedExercise,
  ResolvedWorkout,
  ScheduledDay,
  WorkoutBlock,
} from "./types";

/**
 * The exercises for one scheduled day, with swaps applied and supersets grouped.
 * Returns null on a rest day. `library` must include the program's own exercises
 * (see withProgramExercises).
 */
export function resolveWorkout(
  program: Program,
  library: ExerciseLibrary,
  swaps: ExerciseSwap[],
  day: ScheduledDay,
): ResolvedWorkout | null {
  if (day.dayKey === null) return null;
  const dayKey = day.dayKey;

  const phase = program.phases.find((p) => p.id === day.phaseId);
  const planned = phase?.days[dayKey];
  if (!phase || !planned) {
    throw new Error(`Phase "${day.phaseId}" has no workout for "${dayKey}"`);
  }

  const exercises = planned.map((slot): ResolvedExercise => {
    const swap = activeSwap(swaps, day, slot.exerciseId);
    const replacement =
      swap && findExercise(library, swap.replacementExerciseId);
    const exercise = replacement ?? findExercise(library, slot.exerciseId);
    if (!exercise) throw new Error(`Unknown exercise "${slot.exerciseId}"`);

    return {
      plannedExerciseId: slot.exerciseId,
      exercise,
      // Swapping back to the planned exercise is not a swap.
      swapped: exercise.id !== slot.exerciseId,
      sets: slot.sets,
      targetReps: slot.reps,
      rir: slot.rir,
      technique: slot.technique,
      lastSetTechnique: slot.lastSetTechnique,
      superset: slot.superset,
      perSide: slot.perSide,
      note: slot.note,
    };
  });

  return {
    date: day.date,
    week: day.week,
    phaseId: phase.id,
    phaseName: phase.name,
    dayKey,
    dayName: program.dayTemplates[dayKey]?.name ?? dayKey,
    blocks: groupSupersets(exercises),
  };
}

/** The latest swap of this slot in this phase that has started by `day.date`. */
function activeSwap(
  swaps: ExerciseSwap[],
  day: ScheduledDay,
  plannedExerciseId: string,
) {
  return swaps
    .filter(
      (s) =>
        s.phaseId === day.phaseId &&
        s.dayKey === day.dayKey &&
        s.plannedExerciseId === plannedExerciseId &&
        s.fromDate <= day.date,
    )
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate))
    .at(-1);
}

/** A superset becomes one block, placed where its first exercise appears. */
function groupSupersets(exercises: ResolvedExercise[]): WorkoutBlock[] {
  const blocks: WorkoutBlock[] = [];
  const supersets = new Map<
    string,
    Extract<WorkoutBlock, { kind: "superset" }>
  >();

  for (const exercise of exercises) {
    const letter = exercise.superset;
    if (!letter) {
      blocks.push({ kind: "single", exercise });
      continue;
    }
    const existing = supersets.get(letter);
    if (existing) {
      existing.exercises.push(exercise);
    } else {
      const block = {
        kind: "superset" as const,
        letter,
        exercises: [exercise],
      };
      supersets.set(letter, block);
      blocks.push(block);
    }
  }
  return blocks;
}
