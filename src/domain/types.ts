import type { z } from "zod";
import type {
  exerciseLibrarySchema,
  lastSetTechniqueSchema,
  libraryExerciseSchema,
  phaseSchema,
  plannedExerciseSchema,
  programSchema,
  techniqueSchema,
  weekdays,
} from "./program.schema";

export type Program = z.output<typeof programSchema>;
export type Phase = z.output<typeof phaseSchema>;
export type PlannedExercise = z.output<typeof plannedExerciseSchema>;
export type Technique = z.output<typeof techniqueSchema>;
export type LastSetTechnique = z.output<typeof lastSetTechniqueSchema>;
export type ExerciseLibrary = z.output<typeof exerciseLibrarySchema>;
export type LibraryExercise = z.output<typeof libraryExerciseSchema>;
export type Weekday = (typeof weekdays)[number];

/** Calendar date as `yyyy-MM-dd`, interpreted in the user's local time zone. */
export type IsoDate = string;

export type ScheduledDay = {
  date: IsoDate;
  /** 1-based program week. */
  week: number;
  phaseId: string;
  /** Day template key, or null on a rest day. */
  dayKey: string | null;
};

/** A swap of one planned slot, from `fromDate` to the end of its phase. */
export type ExerciseSwap = {
  phaseId: string;
  dayKey: string;
  plannedExerciseId: string;
  replacementExerciseId: string;
  fromDate: IsoDate;
};

export type SetLog = {
  sessionId: string;
  performedOn: IsoDate;
  plannedExerciseId: string;
  /** The exercise actually performed (after any swap). */
  exerciseId: string;
  /** 0-based. */
  setIndex: number;
  /** null for bodyweight sets. */
  weightKg: number | null;
  reps: number;
  rirActual?: number | null;
  miniSetReps?: number[];
  dropWeightKg?: number | null;
  dropReps?: number | null;
};

export type ResolvedExercise = {
  /** The slot's exerciseId as written in the program; identifies the slot within a day. */
  plannedExerciseId: string;
  exercise: LibraryExercise;
  swapped: boolean;
  sets: number;
  /** One target per set. */
  targetReps: number[];
  rir: string;
  technique: Technique;
  lastSetTechnique?: LastSetTechnique;
  superset?: string;
  perSide: boolean;
  note?: string;
};

export type WorkoutBlock =
  | { kind: "single"; exercise: ResolvedExercise }
  | { kind: "superset"; letter: string; exercises: ResolvedExercise[] };

export type ResolvedWorkout = {
  date: IsoDate;
  week: number;
  phaseId: string;
  phaseName: string;
  dayKey: string;
  dayName: string;
  blocks: WorkoutBlock[];
};
