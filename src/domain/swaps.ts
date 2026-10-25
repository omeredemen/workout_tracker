import { findExercise } from "./library";
import type {
  ExerciseLibrary,
  LibraryExercise,
  Program,
  ScheduledDay,
} from "./types";

/** Other exercises in the same swap group. Empty when the exercise has no group. */
export function getSwapOptions(
  library: ExerciseLibrary,
  exerciseId: string,
): LibraryExercise[] {
  const group = findExercise(library, exerciseId)?.swapGroup;
  if (!group) return [];
  return library.exercises.filter(
    (e) => e.swapGroup === group && e.id !== exerciseId,
  );
}

export function canSwap(
  library: ExerciseLibrary,
  plannedExerciseId: string,
  replacementExerciseId: string,
): boolean {
  return getSwapOptions(library, plannedExerciseId).some(
    (e) => e.id === replacementExerciseId,
  );
}

/** Swaps are best made in a phase's first week; later than that warrants a warning. */
export function isMidPhase(
  program: Program,
  day: Pick<ScheduledDay, "week" | "phaseId">,
) {
  const phase = program.phases.find((p) => p.id === day.phaseId);
  return phase !== undefined && day.week > phase.weeks.from;
}
