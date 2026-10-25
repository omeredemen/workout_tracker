import type { ScheduledDay } from "@/domain/types";
import { newId } from "./ids";
import type { Draft, SessionRecord, SessionStatus } from "./records";
import type { Repository } from "./repository";

/** Updates the day's session, creating it first if needed. */
export async function updateSession(
  repo: Repository,
  enrollmentId: string,
  day: ScheduledDay,
  change: (session: Draft<SessionRecord>) => Partial<Draft<SessionRecord>>,
): Promise<SessionRecord> {
  const existing = await repo.getSession(enrollmentId, day.date);
  const base: Draft<SessionRecord> = existing ?? {
    id: newId(),
    enrollmentId,
    date: day.date,
    week: day.week,
    phaseId: day.phaseId,
    dayKey: day.dayKey,
    status: "planned",
    cardioDone: false,
    notes: null,
    startedAt: null,
    finishedAt: null,
  };
  return repo.saveSession({ ...base, ...change(base) });
}

/** Logging a set (re)starts the workout unless it's already finished. */
export function startedStatus(session: Draft<SessionRecord>): Partial<Draft<SessionRecord>> {
  const notStarted: SessionStatus[] = ["planned", "skipped"];
  return notStarted.includes(session.status)
    ? { status: "in_progress", startedAt: session.startedAt ?? new Date().toISOString() }
    : {};
}
