"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { bodyweightOn } from "@/domain/calories";
import { isRunning } from "@/domain/duration";
import { findExercise } from "@/domain/library";
import { adviseSet, plannedTargetReps, weightStepKg } from "@/domain/overload";
import { previousPerformance } from "@/domain/previousPerformance";
import { restAfterSet } from "@/domain/rest";
import { resolveWorkout } from "@/domain/resolveWorkout";
import { getSwapOptions, isMidPhase } from "@/domain/swaps";
import type { ResolvedExercise } from "@/domain/types";
import {
  useActiveProgram,
  useRepoQuery,
  useToday,
  type ActiveProgram,
} from "@/data/hooks";
import { newId } from "@/data/ids";
import type { Repository } from "@/data/repository";
import { useRepository } from "@/data/RepositoryProvider";
import { startNow, startedStatus, updateSession } from "@/data/sessions";
import { formatLongDate } from "@/lib/format";
import { restTimer } from "@/lib/restTimer";
import { fromDisplay, useUnits } from "@/lib/units";
import { CardioToggle } from "@/components/today/CardioToggle";
import { ErrorMessage, Loading, Screen } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { button, card } from "@/components/ui/styles";
import { ExerciseCard, type ExplainKey } from "./ExerciseCard";
import { SwapSheet } from "./SwapSheet";
import { WorkoutClock } from "./WorkoutDuration";
import type { SaveSet } from "./types";

const RIR_EXPLANATION = {
  name: "Reps in reserve (RIR)",
  description:
    "How many more reps you could still do when you stop the set. RIR 0 means you couldn't do another rep; RIR 1-2 means stop one or two reps before that.",
};

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

function ProgramWorkout({
  active,
  date,
}: {
  active: ActiveProgram;
  date: string;
}) {
  const repo = useRepository();
  const today = useToday();
  const { program, library, schedule, enrollment } = active;
  const day = schedule.find((d) => d.date === date);
  const [error, setError] = useState<Error | null>(null);
  const [explaining, setExplaining] = useState<ExplainKey | null>(null);
  const [swapping, setSwapping] = useState<ResolvedExercise | null>(null);
  const units = useUnits();

  const data = useRepoQuery(
    useCallback(
      async (r: Repository) => {
        const session = await r.getSession(enrollment.id, date);
        return {
          session,
          logs: session ? await r.listSetLogs(session.id) : [],
          swaps: await r.listSwaps(enrollment.id),
          metrics: await r.listBodyMetrics(),
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
  const exercises = useMemo(
    () =>
      workout?.blocks.flatMap((b) =>
        b.kind === "single" ? [b.exercise] : b.exercises,
      ) ?? [],
    [workout],
  );

  // History for "last time": every earlier log of the exercises actually being done.
  const exerciseIds = [...new Set(exercises.map((e) => e.exercise.id))]
    .sort()
    .join(",");
  const history = useRepoQuery(
    useCallback(
      (r: Repository) =>
        r.listSetLogsForExercises(
          exerciseIds ? exerciseIds.split(",") : [],
          date,
        ),
      [exerciseIds, date],
    ),
  );

  if (!day) {
    return (
      <Screen title="Not in your program" subtitle={safeLongDate(date)}>
        <BackLink />
      </Screen>
    );
  }
  if (data.status === "loading" || history.status === "loading")
    return <Loading />;
  if (data.status === "error") return <ErrorMessage error={data.error} />;
  if (history.status === "error") return <ErrorMessage error={history.error} />;

  const { session, logs, metrics } = data.data;
  const phase = program.phases.find((p) => p.id === day.phaseId)!;

  if (!workout) {
    return (
      <Screen
        title="Rest day"
        subtitle={formatLongDate(date)}
        action={<BackLink />}
      >
        <CardioToggle
          program={program}
          enrollmentId={enrollment.id}
          day={day}
          session={session}
        />
      </Screen>
    );
  }

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

  const saveSet: SaveSet = async (exercise, setIndex, values) => {
    setError(null);
    const isNew = !logFor(exercise, setIndex);
    // Live: today's workout, or another day's workout started with "Start now".
    const live = date === today || isRunning(session, new Date());
    try {
      const s = await updateSession(
        repo,
        enrollment.id,
        day,
        startedStatus(live),
      );
      await repo.saveSetLog({
        id: logFor(exercise, setIndex)?.id ?? newId(),
        sessionId: s.id,
        performedOn: date,
        plannedExerciseId: exercise.plannedExerciseId,
        exerciseId: exercise.exercise.id,
        setIndex,
        ...values,
      });
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
    // Rest only when logging live, not when filling in or correcting sets afterwards.
    if (isNew && live) {
      const rest = restAfterSet(
        workout,
        exercise.plannedExerciseId,
        setIndex,
        program.rules,
      );
      if (rest)
        restTimer.start(
          rest.seconds,
          rest.kind === "set" ? "Rest" : "Rest · next exercise",
        );
    }
  };

  async function finish() {
    const missing = totalSets - loggedSets;
    if (
      missing > 0 &&
      !window.confirm(
        `${missing} of ${totalSets} sets aren't logged. Finish anyway?`,
      )
    )
      return;
    restTimer.stop();
    await updateSession(repo, enrollment.id, day!, () => ({
      status: "completed",
      finishedAt: new Date().toISOString(),
    }));
  }

  async function setStatus(status: "in_progress" | "planned" | "skipped") {
    await updateSession(repo, enrollment.id, day!, () => ({
      status,
      finishedAt: null,
    }));
  }

  async function swapTo(exerciseId: string) {
    if (!swapping) return;
    await repo.saveSwap({
      id: newId(),
      enrollmentId: enrollment.id,
      phaseId: day!.phaseId,
      dayKey: day!.dayKey!,
      plannedExerciseId: swapping.plannedExerciseId,
      replacementExerciseId: exerciseId,
      fromDate: date,
    });
    setSwapping(null);
  }

  const card_ = (exercise: ResolvedExercise) => {
    const options = getSwapOptions(library, exercise.plannedExerciseId);
    return (
      <ExerciseCard
        key={exercise.plannedExerciseId}
        exercise={exercise}
        plannedName={
          findExercise(library, exercise.plannedExerciseId)?.name ??
          exercise.plannedExerciseId
        }
        program={program}
        logs={logs}
        lastTime={previousPerformance(history.data, exercise.exercise.id, date)}
        advice={Array.from({ length: exercise.sets }, (_, setIndex) =>
          adviseSet(history.data, {
            exerciseId: exercise.exercise.id,
            setIndex,
            date,
            targetReps: exercise.targetReps[setIndex]!,
            // Plate steps: 2.5 kg / 2 kg dumbbells, or 5 lb.
            stepKg:
              units === "lb"
                ? fromDisplay(5, "lb")
                : weightStepKg(exercise.exercise),
            targetFor: (log) => plannedTargetReps(program, schedule, log),
          }),
        )}
        onSave={saveSet}
        onSwap={options.length ? () => setSwapping(exercise) : undefined}
        onExplain={setExplaining}
      />
    );
  };

  const explanation =
    explaining === "rir"
      ? RIR_EXPLANATION
      : explaining
        ? program.techniques[explaining]
        : undefined;
  const status = session?.status ?? "planned";

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
      <WorkoutClock
        session={session}
        isToday={date === today}
        bodyweightKg={bodyweightOn(metrics, date)}
        onStart={() =>
          void updateSession(repo, enrollment.id, day, startNow).catch(
            (e: unknown) =>
              setError(e instanceof Error ? e : new Error(String(e))),
          )
        }
      />
      {status === "skipped" && (
        <p className="border-border text-muted rounded-2xl border p-3 text-sm">
          You skipped this workout. Logging a set un-skips it.
        </p>
      )}

      {workout.blocks.map((block) =>
        block.kind === "single" ? (
          card_(block.exercise)
        ) : (
          <section
            key={block.letter}
            className="border-border flex flex-col gap-2 rounded-2xl border-2 border-dashed p-2"
          >
            <div className="flex items-center justify-between gap-2 px-2 pt-1">
              <p className="text-muted text-xs font-semibold tracking-wide uppercase">
                Superset {block.letter} · back to back, then rest
              </p>
              {program.techniques.superset && (
                <button
                  type="button"
                  onClick={() => setExplaining("superset")}
                  className="text-muted active:bg-surface-2 h-8 rounded-lg px-2 text-xs font-semibold"
                >
                  What&apos;s this? ⓘ
                </button>
              )}
            </div>
            {block.exercises.map(card_)}
          </section>
        ),
      )}

      <CardioToggle
        program={program}
        enrollmentId={enrollment.id}
        day={day}
        session={session}
      />

      <section className={`${card} flex flex-col gap-3`}>
        <p className="text-muted text-sm">
          {loggedSets} of {totalSets} sets logged
        </p>
        {status === "completed" ? (
          <>
            <p className="text-success font-semibold">Workout completed ✓</p>
            <button
              type="button"
              className={button.ghost}
              onClick={() => setStatus("in_progress")}
            >
              Mark as not finished
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={button.primary}
              onClick={finish}
              disabled={loggedSets === 0}
            >
              Finish workout
            </button>
            {loggedSets === 0 &&
              (status === "skipped" ? (
                <button
                  type="button"
                  className={button.ghost}
                  onClick={() => setStatus("planned")}
                >
                  Undo skip
                </button>
              ) : (
                <button
                  type="button"
                  className={button.ghost}
                  onClick={() =>
                    window.confirm("Skip this workout?") && setStatus("skipped")
                  }
                >
                  Skip this workout
                </button>
              ))}
          </>
        )}
      </section>

      <Sheet
        open={explanation !== undefined}
        onClose={() => setExplaining(null)}
        title={explanation?.name}
      >
        <p className="leading-relaxed">{explanation?.description}</p>
      </Sheet>

      <SwapSheet
        exercise={swapping}
        planned={
          swapping
            ? findExercise(library, swapping.plannedExerciseId)
            : undefined
        }
        options={
          swapping ? getSwapOptions(library, swapping.plannedExerciseId) : []
        }
        midPhase={isMidPhase(program, day)}
        phaseName={phase.name}
        dayName={workout.dayName}
        fromDate={date}
        onPick={swapTo}
        onClose={() => setSwapping(null)}
      />
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
