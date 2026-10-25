"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { resolveWorkout } from "@/domain/resolveWorkout";
import type { ResolvedExercise } from "@/domain/types";
import {
  useActiveProgram,
  useRepoQuery,
  type ActiveProgram,
} from "@/data/hooks";
import { newId } from "@/data/ids";
import type { SessionRecord } from "@/data/records";
import type { Repository } from "@/data/repository";
import { useRepository } from "@/data/RepositoryProvider";
import { formatLongDate } from "@/lib/format";
import { ErrorMessage, Loading, Screen } from "@/components/ui/Screen";
import { button, card } from "@/components/ui/styles";
import { ExerciseCard } from "./ExerciseCard";

export function WorkoutView({ date }: { date: string }) {
  const active = useActiveProgram();
  if (active.status === "loading") return <Loading />;
  if (active.status === "error") return <ErrorMessage error={active.error} />;
  if (!active.data) {
    return (
      <Screen title="Workout">
        <Link href="/programs" className={button.primary}>
          Choose start date
        </Link>
      </Screen>
    );
  }
  return <ProgramWorkout active={active.data} date={date} />;
}

export type SaveSet = (
  exercise: ResolvedExercise,
  setIndex: number,
  weightKg: number | null,
  reps: number,
) => Promise<void>;

function ProgramWorkout({
  active,
  date,
}: {
  active: ActiveProgram;
  date: string;
}) {
  const repo = useRepository();
  const { program, library, schedule, enrollment } = active;
  const day = schedule.find((d) => d.date === date);

  const data = useRepoQuery(
    useCallback(
      async (r: Repository) => {
        const session = await r.getSession(enrollment.id, date);
        return {
          session,
          logs: session ? await r.listSetLogs(session.id) : [],
          swaps: await r.listSwaps(enrollment.id),
        };
      },
      [enrollment.id, date],
    ),
  );

  const swaps = data.data?.swaps;
  const workout = useMemo(
    () => (day && swaps ? resolveWorkout(program, library, swaps, day) : null),
    [program, library, swaps, day],
  );
  const [error, setError] = useState<Error | null>(null);

  if (!day) {
    return (
      <Screen title="Not in your program" subtitle={safeLongDate(date)}>
        <BackLink />
      </Screen>
    );
  }
  if (data.status === "loading") return <Loading />;
  if (data.status === "error") return <ErrorMessage error={data.error} />;
  if (!workout) {
    return (
      <Screen title="Rest day" subtitle={formatLongDate(date)}>
        <BackLink />
      </Screen>
    );
  }

  const { session, logs } = data.data;
  const phase = program.phases.find((p) => p.id === day.phaseId)!;
  const exercises = workout.blocks.flatMap((b) =>
    b.kind === "single" ? [b.exercise] : b.exercises,
  );
  const totalSets = exercises.reduce((n, e) => n + e.sets, 0);
  const logFor = (e: ResolvedExercise, setIndex: number) =>
    logs.find(
      (l) =>
        l.plannedExerciseId === e.plannedExerciseId && l.setIndex === setIndex,
    );
  const loggedSets = exercises.reduce(
    (n, e) =>
      n +
      Array.from({ length: e.sets }, (_, i) => logFor(e, i)).filter(Boolean)
        .length,
    0,
  );

  const ensureSession = async (): Promise<SessionRecord> =>
    session ??
    repo.saveSession({
      id: newId(),
      enrollmentId: enrollment.id,
      date,
      week: day.week,
      phaseId: day.phaseId,
      dayKey: day.dayKey,
      status: "in_progress",
      cardioDone: false,
      notes: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });

  const saveSet: SaveSet = async (exercise, setIndex, weightKg, reps) => {
    setError(null);
    try {
      const s = await ensureSession();
      await repo.saveSetLog({
        id: logFor(exercise, setIndex)?.id ?? newId(),
        sessionId: s.id,
        performedOn: date,
        plannedExerciseId: exercise.plannedExerciseId,
        exerciseId: exercise.exercise.id,
        setIndex,
        weightKg,
        reps,
      });
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  };

  async function finish() {
    if (!session) return;
    const missing = totalSets - loggedSets;
    if (
      missing > 0 &&
      !window.confirm(
        `${missing} of ${totalSets} sets aren't logged. Finish anyway?`,
      )
    )
      return;
    await repo.saveSession({
      ...session,
      status: "completed",
      finishedAt: new Date().toISOString(),
    });
  }

  async function reopen() {
    if (session)
      await repo.saveSession({
        ...session,
        status: "in_progress",
        finishedAt: null,
      });
  }

  return (
    <Screen
      title={workout.dayName}
      subtitle={`${formatLongDate(date)} · Week ${day.week} · ${phase.name}`}
      action={<BackLink />}
    >
      {error && (
        <p
          className="border-danger text-danger rounded-2xl border p-3 text-sm"
          role="alert"
        >
          Couldn&apos;t save: {error.message}
        </p>
      )}

      {workout.blocks.map((block) =>
        block.kind === "single" ? (
          <ExerciseCard
            key={block.exercise.plannedExerciseId}
            exercise={block.exercise}
            logs={logs}
            onSave={saveSet}
          />
        ) : (
          <section
            key={block.letter}
            className="border-border flex flex-col gap-2 rounded-2xl border-2 border-dashed p-2"
          >
            <p className="text-muted px-2 pt-1 text-xs font-semibold tracking-wide uppercase">
              Superset {block.letter} · back to back
            </p>
            {block.exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.plannedExerciseId}
                exercise={exercise}
                logs={logs}
                onSave={saveSet}
              />
            ))}
          </section>
        ),
      )}

      <section className={`${card} flex flex-col gap-3`}>
        <p className="text-muted text-sm">
          {loggedSets} of {totalSets} sets logged
        </p>
        {session?.status === "completed" ? (
          <>
            <p className="text-success font-semibold">Workout completed ✓</p>
            <button type="button" className={button.ghost} onClick={reopen}>
              Mark as not finished
            </button>
          </>
        ) : (
          <button
            type="button"
            className={button.primary}
            onClick={finish}
            disabled={!session || loggedSets === 0}
          >
            Finish workout
          </button>
        )}
      </section>
    </Screen>
  );
}

function BackLink() {
  return (
    <Link href="/calendar" className={button.secondary}>
      Calendar
    </Link>
  );
}

function safeLongDate(date: string) {
  try {
    return formatLongDate(date);
  } catch {
    return date;
  }
}
