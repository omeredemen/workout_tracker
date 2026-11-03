import { describe, expect, it } from "vitest";
import { generateSchedule } from "../generateSchedule";
import {
  bestSetPerSession,
  setsBySession,
  estimatedOneRepMax,
  movingAverage,
  weeklyCompletion,
} from "../progress";
import type { SetLog } from "../types";
import { wolverine } from "./fixtures";

describe("movingAverage", () => {
  it("averages the trailing 7 calendar days, skipping missing days", () => {
    const result = movingAverage([
      { date: "2026-10-10", value: 90 },
      { date: "2026-10-01", value: 92 },
      { date: "2026-10-04", value: 91 },
      { date: "2026-10-07", value: 89 },
    ]);
    expect(result).toEqual([
      { date: "2026-10-01", value: 92 },
      { date: "2026-10-04", value: 91.5 },
      { date: "2026-10-07", value: 90.666_666_666_666_67 },
      { date: "2026-10-10", value: 90 }, // 04, 07, 10 (04 is 6 days back, in); 01 is out
    ]);
  });
});

describe("bestSetPerSession", () => {
  const set = (
    sessionId: string,
    performedOn: string,
    weightKg: number | null,
    reps: number,
    exerciseId = "lat_pulldown",
  ): SetLog => ({
    sessionId,
    performedOn,
    exerciseId,
    plannedExerciseId: exerciseId,
    setIndex: 0,
    weightKg,
    reps,
  });

  it("picks the highest estimated 1RM per session, oldest first", () => {
    const result = bestSetPerSession(
      [
        set("s2", "2026-10-26", 60, 6), // e1RM 72
        set("s2", "2026-10-26", 50, 10), // e1RM 66.7
        set("s1", "2026-10-19", 50, 10),
        set("s1", "2026-10-19", 55, 4), // e1RM 62.3
        set("s1", "2026-10-19", 99, 10, "leg_press"),
      ],
      "lat_pulldown",
    );
    expect(result.map((r) => [r.date, r.weightKg, r.reps])).toEqual([
      ["2026-10-19", 50, 10],
      ["2026-10-26", 60, 6],
    ]);
    expect(result[1]!.estimatedMaxKg).toBeCloseTo(72);
  });

  it("uses most reps for bodyweight sets", () => {
    const result = bestSetPerSession(
      [set("s1", "2026-10-19", null, 12), set("s1", "2026-10-19", null, 15)],
      "lat_pulldown",
    );
    expect(result).toEqual([
      { date: "2026-10-19", weightKg: null, reps: 15, estimatedMaxKg: null },
    ]);
  });

  it("estimates 1RM with Epley, and a single is itself", () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(100, 10)).toBeCloseTo(133.33);
  });
});

describe("weeklyCompletion", () => {
  it("counts planned, completed, skipped and cardio per program week", () => {
    const { program } = wolverine();
    const schedule = generateSchedule(program, "2026-10-19");
    const weeks = weeklyCompletion(schedule, [
      { date: "2026-10-19", status: "completed", cardioDone: true },
      { date: "2026-10-20", status: "in_progress", cardioDone: false },
      { date: "2026-10-21", status: "planned", cardioDone: true }, // rest day cardio
      { date: "2026-10-22", status: "skipped", cardioDone: false },
      { date: "2026-10-26", status: "completed", cardioDone: false },
    ]);
    expect(weeks).toHaveLength(12);
    expect(weeks[0]).toEqual({
      week: 1,
      phaseId: "phase_1",
      planned: 4,
      completed: 1,
      skipped: 1,
      cardioDays: 2,
    });
    expect(weeks[1]).toMatchObject({ week: 2, completed: 1 });
    expect(weeks[11]).toMatchObject({
      week: 12,
      phaseId: "phase_3",
      planned: 4,
      completed: 0,
    });
  });
});

describe("setsBySession", () => {
  const log = (
    sessionId: string,
    performedOn: string,
    setIndex: number,
    weightKg: number | null,
    reps: number,
    exerciseId = "lat_pulldown",
  ) => ({
    sessionId,
    performedOn,
    exerciseId,
    plannedExerciseId: exerciseId,
    setIndex,
    weightKg,
    reps,
  });

  it("groups sets per session, newest first, with volume and weight change", () => {
    const result = setsBySession(
      [
        log("b", "2026-10-08", 1, 52.5, 9),
        log("a", "2026-10-01", 0, 50, 10),
        log("b", "2026-10-08", 0, 52.5, 10),
        log("c", "2026-10-15", 0, 52.5, 11),
        log("x", "2026-10-15", 0, 99, 1, "other"),
      ],
      "lat_pulldown",
    );
    expect(result.map((r) => [r.date, r.change])).toEqual([
      ["2026-10-15", "same"],
      ["2026-10-08", "up"],
      ["2026-10-01", "first"],
    ]);
    expect(result[1]!.sets.map((s) => s.setIndex)).toEqual([0, 1]);
    expect(result[1]!.volumeKg).toBe(52.5 * 19);
  });
});
