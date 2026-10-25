import rawLibrary from "@data/exercise-library.json";
import rawWolverine from "@data/wolverine.program.json";
import { parseLibrary } from "@/domain/library";
import { parseProgram } from "@/domain/parseProgram";

/** The exercise library and default program that ship with the app. */
export const bundledLibrary = parseLibrary(rawLibrary);

const parsed = parseProgram(rawWolverine, bundledLibrary);
if (!parsed.ok) {
  throw new Error(`Bundled program is invalid: ${JSON.stringify(parsed.errors)}`);
}
export const bundledProgram = parsed.program;
