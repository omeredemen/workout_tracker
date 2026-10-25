import type { IsoDate } from "@/domain/types";
import type {
  Draft,
  EnrollmentRecord,
  ProgramRecord,
  SessionRecord,
  SetLogRecord,
  SwapRecord,
} from "./records";

/**
 * All persistence goes through this interface, so the UI doesn't care whether
 * data lives in localStorage or Supabase. Saves are upserts. Where a table has
 * a natural key (sessions, set logs), saving a row with the same key updates
 * the existing row and keeps its id.
 */
export interface Repository {
  listPrograms(): Promise<ProgramRecord[]>;
  getProgram(id: string): Promise<ProgramRecord | null>;
  saveProgram(program: Draft<ProgramRecord>): Promise<ProgramRecord>;

  getActiveEnrollment(): Promise<EnrollmentRecord | null>;
  /** Saving an active enrollment deactivates every other one. */
  saveEnrollment(enrollment: Draft<EnrollmentRecord>): Promise<EnrollmentRecord>;

  listSwaps(enrollmentId: string): Promise<SwapRecord[]>;
  /** Natural key: (enrollmentId, phaseId, dayKey, plannedExerciseId, fromDate). */
  saveSwap(swap: Draft<SwapRecord>): Promise<SwapRecord>;

  listSessions(enrollmentId: string): Promise<SessionRecord[]>;
  getSession(enrollmentId: string, date: IsoDate): Promise<SessionRecord | null>;
  /** Natural key: (enrollmentId, date). */
  saveSession(session: Draft<SessionRecord>): Promise<SessionRecord>;

  listSetLogs(sessionId: string): Promise<SetLogRecord[]>;
  /** Logs for these exercises performed before `beforeDate`, for "last time". */
  listSetLogsForExercises(exerciseIds: string[], beforeDate: IsoDate): Promise<SetLogRecord[]>;
  /** Natural key: (sessionId, plannedExerciseId, setIndex). */
  saveSetLog(log: Draft<SetLogRecord>): Promise<SetLogRecord>;
  deleteSetLog(id: string): Promise<void>;

  /** Called after any change, including changes from other tabs. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}
