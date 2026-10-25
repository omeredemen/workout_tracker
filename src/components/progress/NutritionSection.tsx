"use client";

import { nutritionTargets } from "@/domain/nutrition";
import type { Program } from "@/domain/types";
import { useLocalSetting, writeLocalSetting } from "@/lib/localSetting";
import { card } from "@/components/ui/styles";

const MAINTENANCE_KEY = "workout-tracker:maintenance-kcal";

export function NutritionSection({
  program,
  bodyweightKg,
}: {
  program: Program;
  bodyweightKg: number | null;
}) {
  const stored = useLocalSetting(MAINTENANCE_KEY);
  const maintenance =
    stored && /^\d+$/.test(stored) ? Number(stored) : undefined;
  const nutrition = program.nutrition;
  if (!nutrition) return null;

  if (bodyweightKg === null) {
    return (
      <section className={card}>
        <h2 className="font-semibold">Daily targets</h2>
        <p className="text-muted mt-1 text-sm">
          Log your bodyweight to see protein, fat and carb targets.
        </p>
      </section>
    );
  }

  const targets = nutritionTargets(nutrition, bodyweightKg, maintenance);
  const range = (r: { min: number; max: number }) =>
    r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`;
  const tiles = [
    targets.calories && {
      label: "Calories",
      value: range(targets.calories),
      unit: "kcal",
    },
    targets.proteinG !== null && {
      label: "Protein",
      value: `${targets.proteinG}`,
      unit: "g",
    },
    targets.fatG !== null && {
      label: "Fat",
      value: `${targets.fatG}`,
      unit: "g",
    },
    targets.carbsG && {
      label: "Carbs",
      value: range(targets.carbsG),
      unit: "g",
    },
  ].filter(Boolean) as { label: string; value: string; unit: string }[];

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="font-semibold">Daily targets</h2>
      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={`bg-surface-2 rounded-xl px-3 py-2 ${t.label === "Calories" ? "col-span-2" : ""}`}
          >
            <dt className="text-muted text-xs">{t.label}</dt>
            <dd className="text-lg font-semibold">
              {t.value}{" "}
              <span className="text-muted text-sm font-normal">{t.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted">Maintenance calories</span>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 2600"
          value={stored ?? ""}
          onChange={(e) =>
            writeLocalSetting(
              MAINTENANCE_KEY,
              e.target.value.replace(/\D/g, "") || null,
            )
          }
          className="border-border bg-background h-11 w-28 rounded-xl border px-3 text-right text-base"
        />
      </label>
      {!maintenance && (
        <p className="text-muted text-xs">
          Enter your maintenance calories to get calorie and carb targets.
        </p>
      )}
      {nutrition.note && <p className="text-muted text-xs">{nutrition.note}</p>}
    </section>
  );
}
