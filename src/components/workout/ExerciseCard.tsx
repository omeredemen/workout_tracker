"use client";

import type { ResolvedExercise } from "@/domain/types";
import type { SetLogRecord } from "@/data/records";
import { card } from "@/components/ui/styles";
import { SetRow } from "./SetRow";
import type { SaveSet } from "./WorkoutView";

const TECHNIQUE_LABEL: Record<string, string> = {
  straight: "Straight",
  rpt: "RPT",
  drop_set: "Drop set",
  rest_pause: "Rest-pause",
};

export function ExerciseCard({
  exercise,
  logs,
  onSave,
}: {
  exercise: ResolvedExercise;
  logs: SetLogRecord[];
  onSave: SaveSet;
}) {
  const mine = logs.filter(
    (l) => l.plannedExerciseId === exercise.plannedExerciseId,
  );
  const logAt = (i: number) => mine.find((l) => l.setIndex === i);

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <header>
        <h2 className="text-lg leading-tight font-semibold">
          {exercise.exercise.name}
        </h2>
        <p className="text-muted mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm">
          <span>
            {exercise.sets} × {exercise.targetReps.join("/")}
            {exercise.perSide && " per side"}
          </span>
          <span>· RIR {exercise.rir}</span>
          {exercise.technique !== "straight" && (
            <span className="bg-surface-2 text-foreground rounded-md px-1.5 font-medium">
              {TECHNIQUE_LABEL[exercise.technique]}
            </span>
          )}
          {exercise.lastSetTechnique && (
            <span className="bg-surface-2 text-foreground rounded-md px-1.5 font-medium">
              Last set: {TECHNIQUE_LABEL[exercise.lastSetTechnique]}
            </span>
          )}
        </p>
        {exercise.note && (
          <p className="text-muted mt-1 text-sm italic">{exercise.note}</p>
        )}
      </header>

      <div className="text-muted grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 text-xs">
        <span>Set</span>
        <span>Weight (kg)</span>
        <span>Reps</span>
        <span className="sr-only">Save</span>
      </div>
      {Array.from({ length: exercise.sets }, (_, i) => (
        <SetRow
          key={i}
          index={i}
          targetReps={exercise.targetReps[i]!}
          saved={logAt(i)}
          suggestedWeight={logAt(i - 1)?.weightKg ?? null}
          exerciseName={exercise.exercise.name}
          onSave={(weightKg, reps) => onSave(exercise, i, weightKg, reps)}
        />
      ))}
    </section>
  );
}
