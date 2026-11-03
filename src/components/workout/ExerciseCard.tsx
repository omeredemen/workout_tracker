"use client";

import { summarizeAdvice, type SetAdvice } from "@/domain/overload";
import type { PreviousPerformance } from "@/domain/previousPerformance";
import type { Program, ResolvedExercise } from "@/domain/types";
import type { SetLogRecord } from "@/data/records";
import { formatShortDate } from "@/lib/format";
import { useUnits } from "@/lib/units";
import { card } from "@/components/ui/styles";
import { SetRow } from "./SetRow";
import type { LastSetExtra, SaveSet } from "./types";

/** Explanation keys: technique ids from the program, plus "rir". */
export type ExplainKey = string;

const badge =
  "inline-flex h-7 items-center rounded-lg bg-surface-2 px-2 text-xs font-semibold text-foreground active:opacity-70";

export function ExerciseCard({
  exercise,
  plannedName,
  program,
  logs,
  lastTime,
  advice,
  onSave,
  onSwap,
  onExplain,
}: {
  exercise: ResolvedExercise;
  /** Name of the planned exercise, shown when it was swapped out. */
  plannedName: string;
  program: Program;
  logs: SetLogRecord[];
  lastTime: PreviousPerformance | null;
  /** Progressive-overload advice, one per set. */
  advice: SetAdvice[];
  onSave: SaveSet;
  /** Absent when the exercise has no alternatives. */
  onSwap?: () => void;
  onExplain: (key: ExplainKey) => void;
}) {
  const mine = logs.filter(
    (l) => l.plannedExerciseId === exercise.plannedExerciseId,
  );
  const logAt = (i: number) => mine.find((l) => l.setIndex === i);
  const techniqueName = (key: string) =>
    program.techniques[key]?.name.replace(/\s*\(.*\)$/, "") ?? key;
  const extra = lastSetExtra(exercise, program);
  const units = useUnits();

  return (
    <section className={`${card} flex flex-col gap-3`}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-semibold">
            {exercise.exercise.name}
          </h2>
          {exercise.swapped && (
            <p className="text-muted text-xs">Swapped from {plannedName}</p>
          )}
          <p className="text-muted mt-1.5 text-sm">
            {exercise.sets} × {exercise.targetReps.join("/")}
            {exercise.perSide && " per side"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={badge}
              onClick={() => onExplain("rir")}
            >
              RIR {exercise.rir}
            </button>
            {exercise.technique !== "straight" && (
              <button
                type="button"
                className={badge}
                onClick={() => onExplain(exercise.technique)}
              >
                {techniqueName(exercise.technique)} ⓘ
              </button>
            )}
            {exercise.lastSetTechnique && (
              <button
                type="button"
                className={badge}
                onClick={() => onExplain(exercise.lastSetTechnique!)}
              >
                Last set: {techniqueName(exercise.lastSetTechnique)} ⓘ
              </button>
            )}
          </div>
        </div>
        {onSwap && (
          <button
            type="button"
            onClick={onSwap}
            className="border-border active:bg-surface-2 h-10 shrink-0 rounded-xl border px-3 text-sm font-medium"
            aria-label={`Swap ${exercise.exercise.name}`}
          >
            Swap
          </button>
        )}
      </header>

      {exercise.note && (
        <p className="text-muted text-sm italic">{exercise.note}</p>
      )}
      {lastTime && (
        <p className="text-muted text-xs">
          Last done {formatShortDate(lastTime.date)}
        </p>
      )}
      <OverloadSummary advice={advice} />

      <div className="text-muted grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 text-xs">
        <span>Set</span>
        <span>Weight ({units})</span>
        <span>Reps</span>
        <span className="sr-only">Save</span>
      </div>
      {Array.from({ length: exercise.sets }, (_, i) => {
        const previous = lastTime?.sets.find((s) => s.setIndex === i);
        const setAdvice = advice[i] ?? { kind: "new" as const };
        return (
          <SetRow
            // Remount when the exercise changes (after a swap) so typed values don't carry over.
            key={`${exercise.exercise.id}-${i}`}
            index={i}
            targetReps={exercise.targetReps[i]!}
            saved={logAt(i)}
            // The overload advice for this set (from the same set last time,
            // which handles RPT), else this session's previous set.
            suggestedWeight={
              setAdvice.kind === "new"
                ? (logAt(i - 1)?.weightKg ?? null)
                : setAdvice.weightKg
            }
            lastTime={previous}
            advice={setAdvice}
            extra={i === exercise.sets - 1 ? extra : null}
            exerciseName={exercise.exercise.name}
            onSave={(values) => onSave(exercise, i, values)}
          />
        );
      })}
    </section>
  );
}

const summaries = {
  increase: {
    icon: "↑",
    text: "Add weight today — you've earned it.",
    tone: "border-success text-success",
  },
  decrease: {
    icon: "↓",
    text: "Lighten the load and build back up.",
    tone: "border-danger text-danger",
  },
  repeat: {
    icon: "=",
    text: "Same weight — beat last time's reps.",
    tone: "border-border text-muted",
  },
} as const;

/** One line on what progressive overload asks of this exercise today. */
function OverloadSummary({ advice }: { advice: SetAdvice[] }) {
  const kind = summarizeAdvice(advice);
  if (kind === "new") return null;
  const { icon, text, tone } = summaries[kind];
  return (
    <p
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${tone}`}
    >
      <span aria-hidden className="text-base font-bold">
        {icon}
      </span>
      {text}
    </p>
  );
}

function lastSetExtra(
  exercise: ResolvedExercise,
  program: Program,
): LastSetExtra {
  const kind =
    exercise.lastSetTechnique ??
    (exercise.technique === "drop_set" ? "drop_set" : undefined);
  const technique = kind ? program.techniques[kind] : undefined;
  if (kind === "rest_pause") {
    const range = technique?.miniSetReps;
    return {
      kind,
      miniSets: technique?.miniSets ?? 3,
      repsHint: range ? `${range.min}–${range.max}` : "",
    };
  }
  if (kind === "drop_set") {
    const pct = technique?.dropPercent;
    return { kind, dropHint: pct ? `−${pct.min}–${pct.max}%` : "lighter" };
  }
  return null;
}
