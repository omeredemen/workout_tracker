import { describe, expect, it } from "vitest";
import { bundledLibrary, bundledProgram } from "../bundled";

describe("bundled data", () => {
  it("parses the default program and library", () => {
    expect(bundledProgram.id).toBe("wolverine");
    expect(bundledLibrary.exercises.length).toBeGreaterThan(0);
  });
});
