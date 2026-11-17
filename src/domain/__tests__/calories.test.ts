import { describe, expect, it } from "vitest";
import { bodyweightOn, estimateWorkoutKcal } from "../calories";

describe("estimateWorkoutKcal", () => {
  it("is MET × kg × hours", () => {
    expect(estimateWorkoutKcal(60 * 60_000, 80)).toBe(400);
    expect(estimateWorkoutKcal(45 * 60_000, 80)).toBe(300);
    expect(estimateWorkoutKcal(30 * 60_000, 70, 6)).toBe(210);
  });

  it("is null without a duration or bodyweight", () => {
    expect(estimateWorkoutKcal(null, 80)).toBe(null);
    expect(estimateWorkoutKcal(60_000, null)).toBe(null);
    expect(estimateWorkoutKcal(60_000, 0)).toBe(null);
  });
});

describe("bodyweightOn", () => {
  const metrics = [
    { date: "2026-11-10", weightKg: 81 },
    { date: "2026-11-01", weightKg: 82 },
    { date: "2026-11-05", weightKg: null },
  ];

  it("uses the latest weight on or before the date", () => {
    expect(bodyweightOn(metrics, "2026-11-09")).toBe(82);
    expect(bodyweightOn(metrics, "2026-11-10")).toBe(81);
    expect(bodyweightOn(metrics, "2026-12-01")).toBe(81);
  });

  it("falls back to the earliest weight after the date, else null", () => {
    expect(bodyweightOn(metrics, "2026-10-01")).toBe(82);
    expect(bodyweightOn([], "2026-10-01")).toBe(null);
  });
});
