import type { IsoDate } from "@/domain/types";
import type {
  Draft,
  EnrollmentRecord,
  ProgramRecord,
  SessionRecord,
  SetLogRecord,
  SwapRecord,
} from "./records";
import type { Repository } from "./repository";

export const STORAGE_KEY = "workout-tracker:v1";

type Tables = {
  programs: ProgramRecord[];
  enrollments: EnrollmentRecord[];
  swaps: SwapRecord[];
  sessions: SessionRecord[];
  setLogs: SetLogRecord[];
};

type Stored = { version: 1 } & Tables;

type Options = {
  storage?: Pick<Storage, "getItem" | "setItem">;
  now?: () => Date;
};

type AnyRow = Tables[keyof Tables][number];

/**
 * Keeps every table in one localStorage entry. The whole entry is read and
 * written on each call, which keeps tabs consistent and is plenty fast for
 * one person's training log.
 */
export class LocalStorageRepository implements Repository {
  private readonly storage: Pick<Storage, "getItem" | "setItem">;
  private readonly now: () => Date;
  private readonly listeners = new Set<() => void>();

  constructor({ storage, now }: Options = {}) {
    this.storage = storage ?? window.localStorage;
    this.now = now ?? (() => new Date());
  }

  async listPrograms() {
    return live(this.load().programs);
  }

  async getProgram(id: string) {
    return live(this.load().programs).find((p) => p.id === id) ?? null;
  }

  async saveProgram(program: Draft<ProgramRecord>) {
    return this.upsert("programs", program, (p) => p.id === program.id);
  }

  async getActiveEnrollment() {
    return live(this.load().enrollments).find((e) => e.isActive) ?? null;
  }

  async saveEnrollment(enrollment: Draft<EnrollmentRecord>) {
    return this.write((tables, stamp) => {
      if (enrollment.isActive) {
        for (const other of tables.enrollments) {
          if (other.id !== enrollment.id && other.isActive) {
            other.isActive = false;
            other.updatedAt = stamp;
          }
        }
      }
      return put(tables.enrollments, enrollment, (e) => e.id === enrollment.id, stamp);
    });
  }

  async listSwaps(enrollmentId: string) {
    return live(this.load().swaps).filter((s) => s.enrollmentId === enrollmentId);
  }

  async saveSwap(swap: Draft<SwapRecord>) {
    return this.upsert("swaps", swap, (s) => s.id === swap.id);
  }

  async listSessions(enrollmentId: string) {
    return live(this.load().sessions).filter((s) => s.enrollmentId === enrollmentId);
  }

  async getSession(enrollmentId: string, date: IsoDate) {
    return (
      live(this.load().sessions).find(
        (s) => s.enrollmentId === enrollmentId && s.date === date,
      ) ?? null
    );
  }

  async saveSession(session: Draft<SessionRecord>) {
    return this.upsert(
      "sessions",
      session,
      (s) => s.enrollmentId === session.enrollmentId && s.date === session.date,
    );
  }

  async listSetLogs(sessionId: string) {
    return live(this.load().setLogs).filter((l) => l.sessionId === sessionId);
  }

  async listSetLogsForExercises(exerciseIds: string[], beforeDate: IsoDate) {
    const ids = new Set(exerciseIds);
    return live(this.load().setLogs).filter(
      (l) => ids.has(l.exerciseId) && l.performedOn < beforeDate,
    );
  }

  async saveSetLog(log: Draft<SetLogRecord>) {
    return this.upsert(
      "setLogs",
      log,
      (l) =>
        l.sessionId === log.sessionId &&
        l.plannedExerciseId === log.plannedExerciseId &&
        l.setIndex === log.setIndex,
    );
  }

  async deleteSetLog(id: string) {
    this.write((tables, stamp) => {
      const log = tables.setLogs.find((l) => l.id === id && !l.deletedAt);
      if (log) {
        log.deletedAt = stamp;
        log.updatedAt = stamp;
      }
    });
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) listener();
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  }

  private upsert<K extends keyof Tables>(
    table: K,
    draft: Draft<Tables[K][number]>,
    sameRow: (row: Tables[K][number]) => boolean,
  ): Tables[K][number] {
    return this.write((tables, stamp) =>
      put(tables[table] as Tables[K][number][], draft, sameRow, stamp),
    );
  }

  private write<T>(change: (tables: Tables, stamp: string) => T): T {
    const tables = this.load();
    const result = change(tables, this.now().toISOString());
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...tables } satisfies Stored));
    for (const listener of this.listeners) listener();
    return result;
  }

  private load(): Tables {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return { programs: [], enrollments: [], swaps: [], sessions: [], setLogs: [] };
    }
    // Never silently replace unreadable data: it may be the only copy of the log.
    let stored: Stored;
    try {
      stored = JSON.parse(raw) as Stored;
    } catch {
      throw new Error(`Saved data in localStorage ("${STORAGE_KEY}") is corrupted`);
    }
    if (stored.version !== 1) {
      throw new Error(`Saved data has unknown version ${String(stored.version)}`);
    }
    const { programs, enrollments, swaps, sessions, setLogs } = stored;
    return { programs, enrollments, swaps, sessions, setLogs };
  }
}

function live<T extends AnyRow>(rows: T[]): T[] {
  return rows.filter((r) => r.deletedAt === null);
}

/**
 * Inserts or updates in place. A soft-deleted row matching the key is revived,
 * so its id stays stable.
 */
function put<T extends AnyRow>(
  rows: T[],
  draft: Draft<T>,
  sameRow: (row: T) => boolean,
  stamp: string,
): T {
  const existing = rows.find(sameRow);
  if (existing) {
    Object.assign(existing, draft, { id: existing.id, updatedAt: stamp, deletedAt: null });
    return { ...existing };
  }
  const row = { ...draft, createdAt: stamp, updatedAt: stamp, deletedAt: null } as T;
  rows.push(row);
  return { ...row };
}
