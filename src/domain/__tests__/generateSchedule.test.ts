import { describe, expect, it } from "vitest";
import { generateSchedule } from "../generateSchedule";
import { wolverine } from "./fixtures";

const { program } = wolverine();
// 2026-10-19 is a Monday; the week also contains the end of EU summer time (2026-10-25).
const START = "2026-10-19";

describe("generateSchedule", () => {
  const schedule = generateSchedule(program, START);

  it("covers 12 weeks: 84 days, 48 workouts and 36 rest days", () => {
    expect(schedule).toHaveLength(84);
    expect(schedule.filter((d) => d.dayKey !== null)).toHaveLength(48);
    expect(schedule.filter((d) => d.dayKey === null)).toHaveLength(36);
  });

  it("starts on the Monday given and follows the weekly schedule", () => {
    expect(schedule.slice(0, 7).map((d) => [d.date, d.dayKey])).toEqual([
      ["2026-10-19", "upper_a"],
      ["2026-10-20", "lower_a"],
      ["2026-10-21", null],
      ["2026-10-22", "upper_b"],
      ["2026-10-23", "lower_b"],
      ["2026-10-24", null],
      ["2026-10-25", null],
    ]);
  });

  it("gives consecutive, unique dates across a daylight-saving change", () => {
    expect(schedule[7]!.date).toBe("2026-10-26");
    expect(new Set(schedule.map((d) => d.date)).size).toBe(84);
    expect(schedule.at(-1)!.date).toBe("2027-01-10");
  });

  it("numbers weeks from 1 and switches phase at weeks 4→5 and 8→9", () => {
    const at = (i: number) => [schedule[i]!.week, schedule[i]!.phaseId];
    expect(at(0)).toEqual([1, "phase_1"]);
    expect(at(27)).toEqual([4, "phase_1"]); // Sunday of week 4
    expect(at(28)).toEqual([5, "phase_2"]); // Monday of week 5
    expect(at(55)).toEqual([8, "phase_2"]);
    expect(at(56)).toEqual([9, "phase_3"]);
    expect(at(83)).toEqual([12, "phase_3"]);
  });

  it("rejects a start date that isn't a Monday", () => {
    expect(() => generateSchedule(program, "2026-10-20")).toThrow(
      "not a Monday",
    );
  });

  it("rejects malformed dates", () => {
    expect(() => generateSchedule(program, "2026-02-30")).toThrow(
      "not a valid date",
    );
    expect(() => generateSchedule(program, "19/10/2026")).toThrow(
      "not a valid date",
    );
  });
});
