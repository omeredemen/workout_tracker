import { describe, expect, it } from "vitest";
import { generateSchedule } from "../generateSchedule";
import { findExercise } from "../library";
import {
  adviseSet,
  plannedTargetReps,
  summarizeAdvice,
  weightStepKg,
} from "../overload";
import type { SetLog } from "../types";
import { library, wolverine } from "./fixtures";

const EX = "lat_pulldown";

/** One set 0 per workout, a week apart: [weightKg, reps][] oldest first. */
function history(...sets: [number | null, number][]): SetLog[] {
  return sets.map(([weightKg, reps], i) => ({
    sessionId: `s${i}`,
    performedOn: `2026-10-${String(1 + i * 7).padStart(2, "0")}`,
    exerciseId: EX,
    plannedExerciseId: EX,
    setIndex: 0,
    weightKg,
    reps,
  }));
}

const advise = (logs: SetLog[], targetReps = 10, extra = {}) =>
  adviseSet(logs, {
    exerciseId: EX,
    setIndex: 0,
    date: "2026-11-30",
    targetReps,
    stepKg: 2.5,
    ...extra,
  });

describe("adviseSet", () => {
  it("has nothing to say without history", () => {
    expect(advise([])).toEqual({ kind: "new" });
  });

  it("increases after beating the target twice at the same weight", () => {
    const a = advise(history([50, 11], [50, 11]));
    expect(a).toMatchObject({ kind: "increase", fromKg: 50, weightKg: 52.5 });
  });

  it("scales the jump with the weight (2.5%, at least one step)", () => {
    expect(advise(history([200, 11], [200, 12]))).toMatchObject({
      weightKg: 205,
    });
    expect(advise(history([20, 11], [20, 11]))).toMatchObject({
      weightKg: 22.5,
    });
  });

  it("needs the two workouts at the same weight, in a row", () => {
    expect(advise(history([47.5, 11], [50, 11])).kind).toBe("repeat");
    expect(advise(history([50, 11], [50, 10], [50, 11])).kind).toBe("repeat");
  });

  it("asks to repeat after beating the target once", () => {
    expect(advise(history([50, 10], [50, 12]))).toMatchObject({
      kind: "repeat",
      weightKg: 50,
      goalReps: 12,
    });
  });

  it("asks for one more rep after just hitting the target", () => {
    expect(advise(history([50, 10]))).toMatchObject({
      kind: "repeat",
      goalReps: 11,
    });
  });

  it("aims one rep higher, up to the target, after a short set", () => {
    expect(advise(history([50, 8]))).toMatchObject({
      kind: "repeat",
      weightKg: 50,
      goalReps: 9,
    });
  });

  it("increases at once when the weight is clearly too light", () => {
    expect(advise(history([30, 15])).kind).toBe("increase");
  });

  it("drops ~10% after missing badly twice at the same weight", () => {
    expect(advise(history([60, 8], [60, 7]))).toMatchObject({
      kind: "decrease",
      fromKg: 60,
      weightKg: 55, // 6 kg rounded to the 2.5 kg step
    });
    expect(advise(history([60, 10], [60, 7])).kind).toBe("repeat");
  });

  it("uses each past set's own target when known", () => {
    // 10 reps beat an 8-rep target twice.
    const a = advise(history([50, 10], [50, 10]), 10, { targetFor: () => 8 });
    expect(a.kind).toBe("increase");
  });

  it("goes heavier when the target drops (new phase)", () => {
    expect(advise(history([50, 10]), 6, { targetFor: () => 10 }).kind).toBe(
      "increase",
    );
  });

  it("asks for more load on bodyweight sets without inventing a weight", () => {
    expect(advise(history([null, 12], [null, 12]))).toMatchObject({
      kind: "increase",
      weightKg: null,
    });
  });

  it("ignores later workouts, other exercises and other set positions", () => {
    const logs = [
      ...history([50, 11], [50, 11]),
      { ...history([50, 3])[0]!, performedOn: "2026-12-01", sessionId: "x" },
      { ...history([10, 3])[0]!, exerciseId: "other", sessionId: "y" },
    ];
    expect(advise(logs).kind).toBe("increase");
    expect(
      adviseSet(logs, {
        exerciseId: EX,
        setIndex: 1,
        date: "2026-11-30",
        targetReps: 10,
        stepKg: 2.5,
      }).kind,
    ).toBe("new");
  });
});

describe("plannedTargetReps", () => {
  it("finds the target the set was planned with", () => {
    const { program } = wolverine();
    const schedule = generateSchedule(program, "2026-10-05");
    const day = schedule.find((d) => d.dayKey !== null)!;
    const slot = program.phases[0]!.days[day.dayKey!]![0]!;
    expect(
      plannedTargetReps(program, schedule, {
        performedOn: day.date,
        plannedExerciseId: slot.exerciseId,
        setIndex: 0,
      }),
    ).toBe(slot.reps[0]);
    expect(
      plannedTargetReps(program, schedule, {
        performedOn: "2020-01-01",
        plannedExerciseId: slot.exerciseId,
        setIndex: 0,
      }),
    ).toBeUndefined();
  });
});

describe("summarizeAdvice / weightStepKg", () => {
  it("reports the strongest advice", () => {
    expect(summarizeAdvice([{ kind: "new" }])).toBe("new");
    expect(
      summarizeAdvice([
        { kind: "repeat", weightKg: 50, goalReps: 10, reason: "" },
        { kind: "increase", weightKg: 52.5, fromKg: 50, reason: "" },
      ]),
    ).toBe("increase");
  });

  it("uses smaller jumps for dumbbells", () => {
    const db = library.exercises.find((e) => e.equipment[0] === "dumbbell")!;
    expect(weightStepKg(db)).toBe(2);
    expect(weightStepKg(findExercise(library, EX)!)).toBe(2.5);
  });
});
