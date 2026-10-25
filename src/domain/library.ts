import { exerciseLibrarySchema } from "./program.schema";
import type { ExerciseLibrary, LibraryExercise, Program } from "./types";

/** Parses the bundled library. Throws, since a broken bundled file is a bug, not user input. */
export function parseLibrary(json: unknown): ExerciseLibrary {
  return exerciseLibrarySchema.parse(json);
}

/** The library plus any extra exercises the program defines. */
export function withProgramExercises(
  library: ExerciseLibrary,
  program: Pick<Program, "exercises">,
): ExerciseLibrary {
  if (!program.exercises?.length) return library;
  return {
    ...library,
    exercises: [...library.exercises, ...program.exercises],
  };
}

export function findExercise(
  library: ExerciseLibrary,
  exerciseId: string,
): LibraryExercise | undefined {
  return library.exercises.find((e) => e.id === exerciseId);
}
