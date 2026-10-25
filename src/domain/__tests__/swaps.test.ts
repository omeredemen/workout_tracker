import { describe, expect, it } from "vitest";
import { generateSchedule } from "../generateSchedule";
import { canSwap, getSwapOptions, isMidPhase } from "../swaps";
import { wolverine } from "./fixtures";

const { program, library } = wolverine();

describe("getSwapOptions", () => {
  it("returns only other exercises in the same swap group", () => {
    const options = getSwapOptions(library, "machine_shoulder_press");
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((e) => e.swapGroup === "shoulder_press")).toBe(true);
    expect(options.map((e) => e.id)).not.toContain("machine_shoulder_press");
    expect(options.map((e) => e.id)).toContain("seated_db_shoulder_press");
  });

  it("returns nothing for exercises without a swap group, or unknown ids", () => {
    expect(getSwapOptions(library, "lunge")).toEqual([]);
    expect(getSwapOptions(library, "moon_press")).toEqual([]);
  });
});

describe("canSwap", () => {
  it("allows same-group swaps only", () => {
    expect(
      canSwap(library, "machine_shoulder_press", "bb_overhead_press"),
    ).toBe(true);
    expect(canSwap(library, "machine_shoulder_press", "lat_pulldown")).toBe(
      false,
    );
    expect(
      canSwap(library, "machine_shoulder_press", "machine_shoulder_press"),
    ).toBe(false);
    expect(canSwap(library, "lunge", "leg_press")).toBe(false);
  });
});

describe("isMidPhase", () => {
  const schedule = generateSchedule(program, "2026-10-19");
  const week = (n: number) => schedule[(n - 1) * 7]!;

  it("is false in each phase's first week and true after it", () => {
    expect(
      [1, 2, 4, 5, 6, 9, 12].map((n) => isMidPhase(program, week(n))),
    ).toEqual([false, true, true, false, true, false, true]);
  });
});
