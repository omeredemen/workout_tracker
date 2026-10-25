"use client";

import { useState } from "react";
import { movingAverage } from "@/domain/progress";
import type { BodyMetricRecord } from "@/data/records";
import { newId } from "@/data/ids";
import { useRepository } from "@/data/RepositoryProvider";
import { useToday } from "@/data/hooks";
import { formatShortDate, parseWeight } from "@/lib/format";
import { fromDisplay, toDisplay, useUnits } from "@/lib/units";
import { LineChart } from "@/components/charts/LineChart";
import { button, card } from "@/components/ui/styles";

export function BodyweightSection({
  metrics,
}: {
  metrics: BodyMetricRecord[];
}) {
  const repo = useRepository();
  const today = useToday();
  const units = useUnits();
  const [input, setInput] = useState("");
  const todays = metrics.find((m) => m.date === today);
  const weight = parseWeight(input);

  const readings = metrics
    .filter(
      (m): m is BodyMetricRecord & { weightKg: number } => m.weightKg !== null,
    )
    .map((m) => ({ x: m.date, y: toDisplay(m.weightKg, units) }));
  const average = movingAverage(
    readings.map((r) => ({ date: r.x, value: r.y })),
  ).map((a) => ({
    x: a.date,
    y: Math.round(a.value * 10) / 10,
  }));
  const latestAverage = average.at(-1);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (weight === null || weight === undefined) return;
    await repo.saveBodyMetric({
      id: todays?.id ?? newId(),
      date: today,
      weightKg: fromDisplay(weight, units),
      waistCm: todays?.waistCm ?? null,
      neckCm: todays?.neckCm ?? null,
    });
    setInput("");
  }

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Bodyweight</h2>
        {latestAverage && (
          <p className="text-muted text-sm">
            7-day average{" "}
            <strong className="text-foreground">
              {latestAverage.y} {units}
            </strong>
          </p>
        )}
      </div>

      <form onSubmit={save} className="flex gap-2">
        <input
          inputMode="decimal"
          autoComplete="off"
          aria-label={`Today's bodyweight in ${units}`}
          placeholder={
            todays?.weightKg != null
              ? `Today: ${toDisplay(todays.weightKg, units)} ${units}`
              : `Today's weight (${units})`
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`bg-background h-12 min-w-0 flex-1 rounded-xl border px-3 text-base ${weight === undefined ? "border-danger" : "border-border"}`}
        />
        <button
          type="submit"
          className={button.secondary}
          disabled={weight === null || weight === undefined}
        >
          {todays ? "Update" : "Save"}
        </button>
      </form>

      {readings.length > 0 ? (
        <LineChart
          title={`Bodyweight in ${units}, daily readings and 7-day average`}
          series={[
            { name: "7-day average", points: average, style: "line" },
            { name: "Daily", points: readings, style: "dots" },
          ]}
          formatY={(v) => `${Number(v.toFixed(1))}`}
        />
      ) : (
        <p className="text-muted text-sm">
          Weigh in each morning; the 7-day average smooths out daily swings.
        </p>
      )}
      {todays && (
        <p className="text-muted text-xs">
          Logged for {formatShortDate(today)}
        </p>
      )}
    </section>
  );
}
