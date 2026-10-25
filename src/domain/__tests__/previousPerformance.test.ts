import { describe, expect, it } from "vitest";
import { previousPerformance } from "../previousPerformance";
import type { SetLog } from "../types";

function set(
  sessionId: string,
  performedOn: string,
  exerciseId: string,
  setIndex: number,
  weightKg: number | null,
  reps: number,
): SetLog {
  return {
    sessionId,
    performedOn,
    exerciseId,
    plannedExerciseId: exerciseId,
    setIndex,
    weightKg,
    reps,
  };
}

const logs: SetLog[] = [
  set("s1", "2026-10-19", "lat_pulldown", 0, 50, 10),
  set("s1", "2026-10-19", "lat_pulldown", 1, 50, 9),
  set("s2", "2026-10-26", "lat_pulldown", 1, 52.5, 9), // out of order on purpose
  set("s2", "2026-10-26", "lat_pulldown", 0, 52.5, 10),
  set("s2", "2026-10-26", "machine_shoulder_press", 0, 30, 10),
  set("s3", "2026-11-02", "lat_pulldown", 0, 55, 8),
];

describe("previousPerformance", () => {
  it("returns the latest session before the date, sets in order", () => {
    expect(previousPerformance(logs, "lat_pulldown", "2026-11-02")).toEqual({
      date: "2026-10-26",
      sessionId: "s2",
      sets: [logs[3], logs[2]],
    });
  });

  it("ignores sessions on or after the date", () => {
    expect(
      previousPerformance(logs, "lat_pulldown", "2026-10-26")?.sessionId,
    ).toBe("s1");
    expect(previousPerformance(logs, "lat_pulldown", "2026-10-19")).toBeNull();
  });

  it("only includes the requested exercise", () => {
    const result = previousPerformance(
      logs,
      "machine_shoulder_press",
      "2026-12-01",
    );
    expect(result?.sets).toEqual([logs[4]]);
  });

  it("follows the exercise actually done, not the planned slot", () => {
    const swapped: SetLog = {
      ...set("s4", "2026-11-05", "seated_db_shoulder_press", 0, 14, 10),
      plannedExerciseId: "machine_shoulder_press",
    };
    const all = [...logs, swapped];
    expect(
      previousPerformance(all, "seated_db_shoulder_press", "2026-12-01")?.sets,
    ).toEqual([swapped]);
    expect(
      previousPerformance(all, "machine_shoulder_press", "2026-12-01")?.date,
    ).toBe("2026-10-26");
  });

  it("returns null for an exercise never done", () => {
    expect(previousPerformance(logs, "leg_press", "2026-12-01")).toBeNull();
  });
});
