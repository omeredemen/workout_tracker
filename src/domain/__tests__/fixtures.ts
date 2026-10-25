import rawLibrary from "@data/exercise-library.json";
import rawWolverine from "@data/wolverine.program.json";
import { parseLibrary, withProgramExercises } from "../library";
import { parseProgram } from "../parseProgram";

export const library = parseLibrary(rawLibrary);

/** A fresh, mutable copy of the Wolverine JSON for building broken variants. */
// Untyped on purpose: tests freely break its shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wolverineJson(): Record<string, any> {
  return structuredClone(rawWolverine);
}

export function wolverine() {
  const result = parseProgram(wolverineJson(), library);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return {
    program: result.program,
    library: withProgramExercises(library, result.program),
  };
}
