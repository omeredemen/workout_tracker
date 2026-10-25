import type { ResolvedExercise } from "@/domain/types";

export type SetValues = {
  weightKg: number | null;
  reps: number;
  miniSetReps: number[];
  dropWeightKg: number | null;
  dropReps: number | null;
};

export type SaveSet = (
  exercise: ResolvedExercise,
  setIndex: number,
  values: SetValues,
) => Promise<void>;

/** Extra inputs on an exercise's final set. */
export type LastSetExtra =
  | { kind: "rest_pause"; miniSets: number; repsHint: string }
  | { kind: "drop_set"; dropHint: string }
  | null;
