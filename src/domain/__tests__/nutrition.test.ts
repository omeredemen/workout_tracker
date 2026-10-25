import { describe, expect, it } from "vitest";
import { nutritionTargets } from "../nutrition";
import { wolverine } from "./fixtures";

const { program } = wolverine();

describe("nutritionTargets", () => {
  it("computes protein and fat from bodyweight", () => {
    expect(nutritionTargets(program.nutrition, 90)).toEqual({
      proteinG: 180,
      fatG: 72,
      calories: null,
      carbsG: null,
    });
  });

  it("applies the deficit and gives carbs the remaining calories", () => {
    // 2800 − (400..600) = 2200..2400 kcal; protein 720 kcal + fat 648 kcal = 1368 kcal fixed.
    expect(nutritionTargets(program.nutrition, 90, 2800)).toEqual({
      proteinG: 180,
      fatG: 72,
      calories: { min: 2200, max: 2400 },
      carbsG: { min: 208, max: 258 },
    });
  });

  it("never returns negative carbs", () => {
    expect(nutritionTargets(program.nutrition, 120, 1500).carbsG).toEqual({
      min: 0,
      max: 0,
    });
  });

  it("handles a surplus and missing targets", () => {
    expect(
      nutritionTargets(
        { calorieSurplusKcal: { min: 200, max: 300 } },
        80,
        2500,
      ),
    ).toEqual({
      proteinG: null,
      fatG: null,
      calories: { min: 2700, max: 2800 },
      carbsG: null,
    });
    expect(nutritionTargets(undefined, 80)).toEqual({
      proteinG: null,
      fatG: null,
      calories: null,
      carbsG: null,
    });
  });
});
