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

/**
 * Logging a set (re)starts the workout unless it's already finished. Only a live set
 * (today's workout, or one started with "Start now") starts the clock; sets filled in
 * afterwards leave `startedAt` empty so they don't time the typing.
 */
export function startedStatus(live: boolean) {
  return (session: Draft<SessionRecord>): Partial<Draft<SessionRecord>> => {
    const notStarted: SessionStatus[] = ["planned", "skipped"];
    if (!notStarted.includes(session.status)) return {};
    return {
      status: "in_progress",
      startedAt: live ? (session.startedAt ?? new Date().toISOString()) : session.startedAt,
    };
  };
}

/** "Start now": the workout is being done right now, whatever day it's planned for. */
export function startNow(): Partial<Draft<SessionRecord>> {
  return {
    status: "in_progress",
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}
