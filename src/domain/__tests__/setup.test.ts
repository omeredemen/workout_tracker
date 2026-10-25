import library from "@data/exercise-library.json";
import wolverine from "@data/wolverine.program.json";
import { describe, expect, it } from "vitest";

// Sample test for M0: proves Vitest, path aliases and JSON imports work.
// Real domain tests arrive with parseProgram in M1.
describe("bundled data", () => {
  it("loads the Wolverine program", () => {
    expect(wolverine.id).toBe("wolverine");
    expect(wolverine.durationWeeks).toBe(12);
  });

  it("loads the exercise library", () => {
    expect(library.exercises.length).toBeGreaterThan(0);
  });
});
