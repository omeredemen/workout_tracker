import type { Program } from "./types";

type Range = { min: number; max: number };

export type NutritionTargets = {
  proteinG: number | null;
  fatG: number | null;
  /** Only when maintenance calories are known. */
  calories: Range | null;
  /** Remaining calories after protein and fat. Only when maintenance calories are known. */
  carbsG: Range | null;
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

export function nutritionTargets(
  nutrition: Program["nutrition"],
  bodyweightKg: number,
  maintenanceKcal?: number,
): NutritionTargets {
  const proteinG =
    nutrition?.proteinGPerKg !== undefined
      ? Math.round(nutrition.proteinGPerKg * bodyweightKg)
      : null;
  const fatG =
    nutrition?.fatGPerKg !== undefined
      ? Math.round(nutrition.fatGPerKg * bodyweightKg)
      : null;

  let calories: Range | null = null;
  if (maintenanceKcal !== undefined) {
    const deficit = nutrition?.calorieDeficitKcal;
    const surplus = nutrition?.calorieSurplusKcal;
    calories = deficit
      ? {
          min: maintenanceKcal - deficit.max,
          max: maintenanceKcal - deficit.min,
        }
      : surplus
        ? {
            min: maintenanceKcal + surplus.min,
            max: maintenanceKcal + surplus.max,
          }
        : { min: maintenanceKcal, max: maintenanceKcal };
  }

  let carbsG: Range | null = null;
  if (calories && nutrition?.carbs === "remaining_calories") {
    const fixedKcal =
      (proteinG ?? 0) * KCAL_PER_G.protein + (fatG ?? 0) * KCAL_PER_G.fat;
    const toCarbs = (kcal: number) =>
      Math.max(0, Math.round((kcal - fixedKcal) / KCAL_PER_G.carbs));
    carbsG = { min: toCarbs(calories.min), max: toCarbs(calories.max) };
  }

  return { proteinG, fatG, calories, carbsG };
}
