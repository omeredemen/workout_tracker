import type { Program, ResolvedWorkout } from "./types";

export type RestKind = "set" | "exercise";

const DEFAULT_SET_REST_SEC = 120;
const DEFAULT_EXERCISE_REST_SEC = 60;

/**
 * How long to rest after saving a set, or null when the next thing should
 * start straight away (mid-superset, or the workout is over).
 *
 * Supersets: the members' sets are done back to back, so the rest comes after
 * the last member's set. A superset round counts as a "set".
 */
export function restAfterSet(
  workout: ResolvedWorkout,
  plannedExerciseId: string,
  setIndex: number,
  rules: Program["rules"],
): { seconds: number; kind: RestKind } | null {
  const blockIndex = workout.blocks.findIndex((b) =>
    (b.kind === "single" ? [b.exercise] : b.exercises).some(
      (e) => e.plannedExerciseId === plannedExerciseId,
    ),
  );
  const block = workout.blocks[blockIndex];
  if (!block) return null;

  const members = block.kind === "single" ? [block.exercise] : block.exercises;
  const memberIndex = members.findIndex(
    (e) => e.plannedExerciseId === plannedExerciseId,
  );
  // Mid-superset: go straight to the partner, unless the partner has no set at this index.
  const nextMemberWithSet = members
    .slice(memberIndex + 1)
    .find((e) => e.sets > setIndex);
  if (nextMemberWithSet) return null;

  const blockSets = Math.max(...members.map((e) => e.sets));
  const lastRound = setIndex >= blockSets - 1;
  if (!lastRound) {
    return {
      seconds: rules?.restBetweenSetsSec?.min ?? DEFAULT_SET_REST_SEC,
      kind: "set",
    };
  }
  if (blockIndex === workout.blocks.length - 1) return null;
  return {
    seconds: rules?.restBetweenExercisesSec ?? DEFAULT_EXERCISE_REST_SEC,
    kind: "exercise",
  };
}
