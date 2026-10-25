"use client";

import type { LibraryExercise, ResolvedExercise } from "@/domain/types";
import { formatShortDate } from "@/lib/format";
import { Sheet } from "@/components/ui/Sheet";

export function SwapSheet({
  exercise,
  planned,
  options,
  midPhase,
  phaseName,
  dayName,
  fromDate,
  onPick,
  onClose,
}: {
  exercise: ResolvedExercise | null;
  planned: LibraryExercise | undefined;
  /** Same-group alternatives to the planned exercise. */
  options: LibraryExercise[];
  midPhase: boolean;
  phaseName: string;
  dayName: string;
  fromDate: string;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const choices = planned ? [planned, ...options] : options;
  return (
    <Sheet open={exercise !== null} onClose={onClose} title="Swap exercise">
      {exercise && (
        <div className="flex flex-col gap-3">
          <p className="text-muted text-sm">
            Applies to {dayName} from {formatShortDate(fromDate)} to the end of{" "}
            {phaseName}. Sets and reps stay the same.
          </p>
          {midPhase && (
            <p
              className="border-warning text-warning rounded-xl border p-3 text-sm"
              role="alert"
            >
              You&apos;re in the middle of a phase. Swaps work best at the start
              of a phase, so progress stays comparable.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {choices.map((option) => {
              const current = option.id === exercise.exercise.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    disabled={current}
                    onClick={() => onPick(option.id)}
                    className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left ${
                      current
                        ? "border-accent"
                        : "border-border active:bg-surface-2"
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{option.name}</span>
                      <span className="text-muted block text-xs">
                        {option.id === planned?.id ? "Planned · " : ""}
                        {option.equipment.join(", ").replaceAll("_", " ")}
                      </span>
                    </span>
                    {current && (
                      <span className="text-accent text-sm font-semibold">
                        Current
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
