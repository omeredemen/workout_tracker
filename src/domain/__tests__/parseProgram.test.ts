import { describe, expect, it } from "vitest";
import { parseProgram, type ProgramError } from "../parseProgram";
import { library, wolverineJson } from "./fixtures";

function errorsFor(json: unknown): ProgramError[] {
  const result = parseProgram(json, library);
  if (result.ok) throw new Error("expected the program to be rejected");
  return result.errors;
}

describe("parseProgram", () => {
  it("accepts the Wolverine program with no errors", () => {
    const result = parseProgram(wolverineJson(), library);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it("fills schema defaults", () => {
    const result = parseProgram(wolverineJson(), library);
    if (!result.ok) throw new Error();
    expect(result.program.phases[0]!.days.upper_a![0]!.perSide).toBe(false);
  });

  it("reports schema errors with readable paths", () => {
    const json = wolverineJson();
    json.phases[0].days.upper_a[0].sets = "3";
    json.phases[1].days.lower_a[2].rir = "two";
    json.weeklySchedule.funday = "upper_a";

    expect(errorsFor(json)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "phases[0].days.upper_a[0].sets" }),
        {
          path: "phases[1].days.lower_a[2].rir",
          message: 'Must be a number or a range like "1-2"',
        },
        expect.objectContaining({
          path: "weeklySchedule",
          message: expect.stringContaining("funday"),
        }),
      ]),
    );
  });

  it("rejects input that isn't a program at all", () => {
    expect(errorsFor("not json")).toEqual([
      expect.objectContaining({ path: "" }),
    ]);
  });

  it("collects every cross-check error in one pass", () => {
    const json = wolverineJson();
    const upperA = json.phases[0].days.upper_a;
    upperA[0].exerciseId = "moon_press"; // unknown exercise
    upperA[1].reps = [10, 10]; // 3 sets, 2 targets
    upperA[2].exerciseId = "machine_seated_row"; // same as [3]
    upperA[4].lastSetTechnique = "drop_set";
    delete json.techniques.drop_set; // …so drop_set is no longer explained
    upperA[5].superset = "B"; // supersets A and B now have one exercise each
    delete json.phases[2].days.lower_b; // used by the weekly schedule
    json.phases[1].weeks = { from: 6, to: 9 }; // gap at week 5, overlap at week 9

    const messages = errorsFor(json).map((e) => `${e.path}: ${e.message}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        'phases[0].days.upper_a[0].exerciseId: "moon_press" is not in the exercise library or the program\'s exercises',
        'phases[0].days.upper_a[1].reps: "machine_shoulder_press" has 3 sets but 2 rep targets; give one target per set',
        'phases[0].days.upper_a[3].exerciseId: "machine_seated_row" appears more than once on this day',
        'phases[0].days.upper_a: Superset "A" has only one exercise; a superset needs at least two',
        'phases[0].days.upper_a: Superset "B" has only one exercise; a superset needs at least two',
        'phases[0].days.upper_a[4]: "db_lateral_raise" uses technique "drop_set", which is not explained in techniques',
        'phases[2].days: Phase "phase_3" has no workout for "lower_b", which the weekly schedule uses',
        "phases: No phase covers week 5",
        'phases: Phases "phase_2" and "phase_3" overlap in week 9',
      ]),
    );
    expect(messages).toHaveLength(9);
  });

  it("checks phase week ranges against the program length", () => {
    const json = wolverineJson();
    json.phases[2].weeks = { from: 9, to: 14 };
    json.phases[1].weeks = { from: 8, to: 5 };

    expect(errorsFor(json).map((e) => e.message)).toEqual(
      expect.arrayContaining([
        "Ends at week 14, but the program is only 12 weeks long",
        "Starts at week 8 but ends at week 5",
        "No phase covers weeks 5–8",
      ]),
    );
  });

  it("rejects schedule days that point at missing templates", () => {
    const json = wolverineJson();
    json.weeklySchedule.sat = "full_body";
    expect(errorsFor(json)).toContainEqual({
      path: "weeklySchedule.sat",
      message: '"full_body" is not one of the dayTemplates',
    });
  });

  it("accepts extra exercises defined by the program, and rejects clashes", () => {
    const json = wolverineJson();
    json.exercises = [
      {
        id: "sled_push",
        name: "Sled Push",
        swapGroup: null,
        equipment: ["machine"],
      },
    ];
    json.phases[0].days.lower_a[0].exerciseId = "sled_push";
    expect(parseProgram(json, library).ok).toBe(true);

    json.exercises.push({
      id: "leg_press",
      name: "Leg Press",
      swapGroup: null,
      equipment: ["machine"],
    });
    expect(errorsFor(json)).toContainEqual({
      path: "exercises[1].id",
      message: '"leg_press" already exists in the exercise library',
    });
  });

  it("requires an explanation for supersets when they are used", () => {
    const json = wolverineJson();
    delete json.techniques.superset;
    expect(errorsFor(json)[0]).toEqual({
      path: "phases[0].days.upper_a",
      message: 'Uses supersets, but "superset" is not explained in techniques',
    });
  });
});
