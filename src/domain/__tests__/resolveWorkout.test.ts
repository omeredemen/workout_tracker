import { describe, expect, it } from "vitest";
import { generateSchedule } from "../generateSchedule";
import { resolveWorkout } from "../resolveWorkout";
import type { ExerciseSwap, ResolvedWorkout, ScheduledDay } from "../types";
import { wolverine } from "./fixtures";

const { program, library } = wolverine();
const schedule = generateSchedule(program, "2026-10-19");

function day(week: number, dayKey: string): ScheduledDay {
  const found = schedule.find((d) => d.week === week && d.dayKey === dayKey);
  if (!found) throw new Error(`no ${dayKey} in week ${week}`);
  return found;
}

function ids(workout: ResolvedWorkout | null) {
  return workout!.blocks.map((b) =>
    b.kind === "single"
      ? b.exercise.exercise.id
      : b.exercises.map((e) => e.exercise.id),
  );
}

describe("resolveWorkout", () => {
  it("returns null on a rest day", () => {
    expect(resolveWorkout(program, library, [], schedule[2]!)).toBeNull();
  });

  it("groups a superset into one block where its first exercise appears", () => {
    const workout = resolveWorkout(program, library, [], day(1, "upper_a"));
    expect(workout).toMatchObject({
      phaseId: "phase_1",
      dayName: "Üst Vücut A",
    });
    expect(ids(workout)).toEqual([
      "lat_pulldown",
      "machine_shoulder_press",
      "incline_machine_chest_press",
      "machine_seated_row",
      "db_lateral_raise",
      ["cable_curl", "rope_pushdown"],
    ]);
    expect(workout!.blocks.at(-1)).toMatchObject({
      kind: "superset",
      letter: "A",
    });
  });

  it("gives RPT exercises a different target per set", () => {
    const workout = resolveWorkout(program, library, [], day(5, "upper_a"));
    const first = workout!.blocks[0]!;
    expect(first.kind === "single" && first.exercise).toMatchObject({
      plannedExerciseId: "machine_shoulder_press",
      technique: "rpt",
      sets: 3,
      targetReps: [6, 8, 10],
    });
  });

  it("carries rest-pause, per-side and notes through", () => {
    const upper = resolveWorkout(program, library, [], day(9, "upper_a"))!;
    const lateral = upper.blocks[4]!;
    expect(lateral.kind === "single" && lateral.exercise.lastSetTechnique).toBe(
      "rest_pause",
    );

    const lower = resolveWorkout(program, library, [], day(9, "lower_b"))!;
    const singles = lower.blocks.flatMap((b) =>
      b.kind === "single" ? [b.exercise] : [],
    );
    expect(singles.find((e) => e.plannedExerciseId === "lunge")?.perSide).toBe(
      true,
    );
    // The unpaired "SS" adductor from the source program stays a single exercise with its note.
    expect(
      singles.find((e) => e.plannedExerciseId === "adductor_machine")?.note,
    ).toMatch(/no partner/);
  });

  describe("a swap made mid-phase", () => {
    // Swap machine shoulder press → seated DB press on Upper A, from week 6 (phase 2 is weeks 5–8).
    const swap: ExerciseSwap = {
      phaseId: "phase_2",
      dayKey: "upper_a",
      plannedExerciseId: "machine_shoulder_press",
      replacementExerciseId: "seated_db_shoulder_press",
      fromDate: day(6, "upper_a").date,
    };
    const shoulderPress = (week: number, dayKey = "upper_a") => {
      const workout = resolveWorkout(
        program,
        library,
        [swap],
        day(week, dayKey),
      )!;
      for (const block of workout.blocks) {
        const exercises =
          block.kind === "single" ? [block.exercise] : block.exercises;
        const slot = exercises.find(
          (e) => e.plannedExerciseId === "machine_shoulder_press",
        );
        if (slot) return slot;
      }
      throw new Error("slot not found");
    };

    it("applies from its date to the end of the phase, keeping the plan's sets and reps", () => {
      for (const week of [6, 7, 8]) {
        expect(shoulderPress(week)).toMatchObject({
          exercise: { id: "seated_db_shoulder_press" },
          swapped: true,
          targetReps: [6, 8, 10],
        });
      }
    });

    it("does not change earlier weeks of the phase", () => {
      expect(shoulderPress(5)).toMatchObject({
        exercise: { id: "machine_shoulder_press" },
        swapped: false,
      });
    });

    it("does not leak into the next phase or other days", () => {
      expect(shoulderPress(9).exercise.id).toBe("machine_shoulder_press");
      expect(shoulderPress(6, "upper_b").exercise.id).toBe(
        "machine_shoulder_press",
      );
    });

    it("uses the latest swap when a slot was swapped again", () => {
      const later: ExerciseSwap = {
        ...swap,
        replacementExerciseId: "bb_overhead_press",
        fromDate: day(8, "upper_a").date,
      };
      const resolve = (week: number) =>
        resolveWorkout(program, library, [later, swap], day(week, "upper_a"))!
          .blocks[0]!;
      const id = (block: ReturnType<typeof resolve>) =>
        block.kind === "single" ? block.exercise.exercise.id : null;
      expect(id(resolve(7))).toBe("seated_db_shoulder_press");
      expect(id(resolve(8))).toBe("bb_overhead_press");
    });
  });
});
