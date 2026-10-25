"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { findExercise } from "@/domain/library";
import { bestSetPerSession, weeklyCompletion } from "@/domain/progress";
import {
  useActiveProgram,
  useRepoQuery,
  useToday,
  type ActiveProgram,
} from "@/data/hooks";
import type { Repository } from "@/data/repository";
import { formatWeight } from "@/lib/format";
import { toDisplay, useUnits } from "@/lib/units";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { LineChart } from "@/components/charts/LineChart";
import { ErrorMessage, Loading, Screen } from "@/components/ui/Screen";
import { button, card } from "@/components/ui/styles";
import { BodyweightSection } from "./BodyweightSection";
import { NutritionSection } from "./NutritionSection";

const loadAll = async (repo: Repository) => {
  const enrollment = await repo.getActiveEnrollment();
  return {
    metrics: await repo.listBodyMetrics(),
    logs: await repo.listAllSetLogs(),
    sessions: enrollment ? await repo.listSessions(enrollment.id) : [],
  };
};

export function ProgressView() {
  const active = useActiveProgram();
  const data = useRepoQuery(loadAll);
  if (active.status === "loading" || data.status === "loading")
    return <Loading />;
  if (active.status === "error") return <ErrorMessage error={active.error} />;
  if (data.status === "error") return <ErrorMessage error={data.error} />;

  const { metrics, logs, sessions } = data.data;
  const latestWeight =
    [...metrics].reverse().find((m) => m.weightKg !== null)?.weightKg ?? null;

  return (
    <Screen title="Progress">
      <BodyweightSection metrics={metrics} />
      {active.data ? (
        <>
          <NutritionSection
            program={active.data.program}
            bodyweightKg={latestWeight}
          />
          <WeeklySection active={active.data} sessions={sessions} />
          <ExerciseSection active={active.data} logs={logs} />
        </>
      ) : (
        <section className={`${card} flex flex-col gap-3`}>
          <p className="text-muted">
            Start a program to track workouts and nutrition targets.
          </p>
          <Link href="/programs" className={button.secondary}>
            Choose a program
          </Link>
        </section>
      )}
    </Screen>
  );
}

function WeeklySection({
  active,
  sessions,
}: {
  active: ActiveProgram;
  sessions: Parameters<typeof weeklyCompletion>[1];
}) {
  const today = useToday();
  const current =
    active.schedule.find((d) => d.date === today)?.week ??
    (today < active.schedule[0]!.date ? 0 : active.program.durationWeeks);
  const weeks = weeklyCompletion(active.schedule, sessions).filter(
    (w) => w.week <= Math.max(current, 1),
  );
  const planned = Math.max(...weeks.map((w) => w.planned));
  const done = weeks.reduce((n, w) => n + w.completed, 0);
  const total = weeks.reduce((n, w) => n + w.planned, 0);

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Workouts per week</h2>
        <p className="text-muted text-sm">
          <strong className="text-foreground">{done}</strong> of {total} done
        </p>
      </div>
      <ColumnChart
        title="Completed workouts per program week"
        reference={{ value: planned, label: `Planned ${planned}` }}
        columns={weeks.map((w) => ({
          label: `W${w.week}`,
          value: w.completed,
          detail: `${w.completed} of ${w.planned} workouts${w.skipped ? `, ${w.skipped} skipped` : ""} · cardio ${w.cardioDays} day${w.cardioDays === 1 ? "" : "s"}`,
        }))}
      />
    </section>
  );
}

function ExerciseSection({
  active,
  logs,
}: {
  active: ActiveProgram;
  logs: Parameters<typeof bestSetPerSession>[0];
}) {
  const units = useUnits();
  const counts = new Map<string, number>();
  for (const log of logs)
    counts.set(log.exerciseId, (counts.get(log.exerciseId) ?? 0) + 1);
  const options = [...counts.keys()]
    .map((id) => ({ id, name: findExercise(active.library, id)?.name ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const [chosen, setChosen] = useState<string | null>(null);
  const exerciseId = chosen && counts.has(chosen) ? chosen : options[0]?.id;
  const pick = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setChosen(e.target.value),
    [],
  );

  if (!exerciseId) {
    return (
      <section className={card}>
        <h2 className="font-semibold">Exercise progress</h2>
        <p className="text-muted mt-1 text-sm">
          Log some sets to see each exercise&apos;s progress.
        </p>
      </section>
    );
  }

  const best = bestSetPerSession(logs, exerciseId);
  const weighted = best.some((b) => b.estimatedMaxKg !== null);
  const latest = best.at(-1)!;

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="font-semibold">Exercise progress</h2>
      <select
        value={exerciseId}
        onChange={pick}
        aria-label="Exercise"
        className="border-border bg-background h-12 rounded-xl border px-3 text-base"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <p className="text-muted text-sm">
        Best set last time:{" "}
        <strong className="text-foreground">
          {formatWeight(latest.weightKg, units)} × {latest.reps}
        </strong>
      </p>
      <LineChart
        title={
          weighted
            ? `Estimated one-rep max in ${units}, best set per workout`
            : "Most reps per workout"
        }
        series={[
          {
            name: weighted ? "Estimated 1RM" : "Reps",
            style: "line",
            points: best.map((b) => ({
              x: b.date,
              y:
                weighted && b.estimatedMaxKg !== null
                  ? Math.round(toDisplay(b.estimatedMaxKg, units) * 10) / 10
                  : b.reps,
            })),
          },
        ]}
        formatY={(v) => (weighted ? `${Number(v.toFixed(1))}` : `${v}`)}
      />
      <p className="text-muted text-xs">
        {weighted
          ? "Estimated 1-rep max (Epley) of each workout's best set, so heavier-but-fewer and lighter-but-more reps compare fairly."
          : "Most reps in a set, per workout."}
      </p>
    </section>
  );
}
