import type { ExerciseSwap, IsoDate, Program, SetLog } from "@/domain/types";

/** ISO 8601 timestamp. */
export type Timestamp = string;

type Row = {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Soft delete, so deletions can sync. */
  deletedAt: Timestamp | null;
};

export type ProgramRecord = Row & {
  slug: string;
  name: string;
  /** Validated program; never changed after import. */
  json: Program;
};

export type EnrollmentRecord = Row & {
  programId: string;
  /** Always a Monday. */
  startDate: IsoDate;
  isActive: boolean;
};

export type SwapRecord = Row & ExerciseSwap & { enrollmentId: string };

export type SessionStatus = "in_progress" | "completed" | "skipped";

export type SessionRecord = Row & {
  enrollmentId: string;
  date: IsoDate;
  week: number;
  phaseId: string;
  dayKey: string | null;
  status: SessionStatus;
  cardioDone: boolean;
  notes: string | null;
  startedAt: Timestamp | null;
  finishedAt: Timestamp | null;
};

export type SetLogRecord = Row & SetLog;

/** What callers pass to a save: the repository fills in the timestamps. */
export type Draft<T extends Row> = Omit<T, "createdAt" | "updatedAt" | "deletedAt">;
