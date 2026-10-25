import { describe, expect, it } from "vitest";
import { generateSchedule } from "../generateSchedule";
import { resolveWorkout } from "../resolveWorkout";
import { restAfterSet } from "../rest";
import { wolverine } from "./fixtures";

const { program, library } = wolverine();
const schedule = generateSchedule(program, "2026-10-19");
// Week 1 Upper A: 5 single exercises, then superset A (cable_curl + rope_pushdown), 3 sets each.
const workout = resolveWorkout(program, library, [], schedule[0]!)!;
const rest = (id: string, set: number) =>
  restAfterSet(workout, id, set, program.rules);

describe("restAfterSet", () => {
  it("rests between sets using the program's minimum set rest", () => {
    expect(rest("lat_pulldown", 0)).toEqual({ seconds: 120, kind: "set" });
    expect(rest("lat_pulldown", 1)).toEqual({ seconds: 120, kind: "set" });
  });

  it("uses the shorter between-exercise rest after an exercise's last set", () => {
    expect(rest("lat_pulldown", 2)).toEqual({ seconds: 60, kind: "exercise" });
  });

  it("doesn't rest after the first exercise of a superset", () => {
    expect(rest("cable_curl", 0)).toBeNull();
    expect(rest("cable_curl", 2)).toBeNull();
  });

  it("rests after the second exercise of a superset", () => {
    expect(rest("rope_pushdown", 0)).toEqual({ seconds: 120, kind: "set" });
  });

  it("doesn't rest after the workout's final set", () => {
    expect(rest("rope_pushdown", 2)).toBeNull();
  });

  it("falls back to defaults when the program has no rest rules", () => {
    expect(restAfterSet(workout, "lat_pulldown", 0, undefined)).toEqual({
      seconds: 120,
      kind: "set",
    });
    expect(restAfterSet(workout, "lat_pulldown", 2, undefined)).toEqual({
      seconds: 60,
      kind: "exercise",
    });
  });

  it("returns null for an unknown exercise", () => {
    expect(rest("moon_press", 0)).toBeNull();
  });
});
