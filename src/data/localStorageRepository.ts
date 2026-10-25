import type { IsoDate } from "@/domain/types";
import type {
  BodyMetricRecord,
  Draft,
  EnrollmentRecord,
  ProgramRecord,
  SessionRecord,
  SetLogRecord,
  SwapRecord,
} from "./records";
import type { Repository } from "./repository";

export const STORAGE_KEY = "workout-tracker:v1";
export const SYNC_KEY = "workout-tracker:sync:v1";

export type Tables = {
  programs: ProgramRecord[];
  enrollments: EnrollmentRecord[];
  swaps: SwapRecord[];
  sessions: SessionRecord[];
  setLogs: SetLogRecord[];
  bodyMetrics: BodyMetricRecord[];
};
export type TableName = keyof Tables;
export type RowOf<K extends TableName> = Tables[K][number];

export const TABLE_NAMES: TableName[] = [
  "programs",
  "enrollments",
  "swaps",
  "sessions",
  "setLogs",
  "bodyMetrics",
];

type Stored = { version: 1 } & Tables;

/** Sync bookkeeping, kept apart from the data. */
export type SyncMeta = {
  /** The signed-in user this device's data belongs to; null until first sign-in. */
  ownerUserId: string | null;
  /** Ids of rows changed since they were last pushed: the offline write queue. */
  dirty: Partial<Record<TableName, string[]>>;
  /** Per table, the latest server_updated_at pulled. */
  cursors: Partial<Record<TableName, string>>;
  lastSyncedAt: string | null;
};

const EMPTY_META: SyncMeta = { ownerUserId: null, dirty: {}, cursors: {}, lastSyncedAt: null };

type Options = {
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  now?: () => Date;
};

type AnyRow = RowOf<TableName>;
type Touch = (table: TableName, id: string) => void;

/**
 * Keeps every table in one localStorage entry. The whole entry is read and
 * written on each call, which keeps tabs consistent and is plenty fast for
 * one person's training log.
 *
 * Once the device belongs to a signed-in user, every write also records the
 * row as dirty so the sync engine can push it, even after being offline.
 */
export class LocalStorageRepository implements Repository {
  private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
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
    return this.write((tables, stamp, touch) => {
      if (enrollment.isActive) {
        for (const other of tables.enrollments) {
          if (other.id !== enrollment.id && other.isActive) {
            other.isActive = false;
            other.updatedAt = stamp;
            touch("enrollments", other.id);
          }
        }
      }
      return put("enrollments", tables, enrollment, (e) => e.id === enrollment.id, stamp, touch);
    });
  }

  async listSwaps(enrollmentId: string) {
    return live(this.load().swaps).filter((s) => s.enrollmentId === enrollmentId);
  }

  async saveSwap(swap: Draft<SwapRecord>) {
    return this.upsert(
      "swaps",
      swap,
      (s) =>
        s.enrollmentId === swap.enrollmentId &&
        s.phaseId === swap.phaseId &&
        s.dayKey === swap.dayKey &&
        s.plannedExerciseId === swap.plannedExerciseId &&
        s.fromDate === swap.fromDate,
    );
  }

  async listSessions(enrollmentId: string) {
    return live(this.load().sessions).filter((s) => s.enrollmentId === enrollmentId);
  }

  async getSession(enrollmentId: string, date: IsoDate) {
    return (
      live(this.load().sessions).find((s) => s.enrollmentId === enrollmentId && s.date === date) ??
      null
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

  async listAllSetLogs() {
    return live(this.load().setLogs);
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
    this.write((tables, stamp, touch) => {
      const log = tables.setLogs.find((l) => l.id === id && !l.deletedAt);
      if (log) {
        log.deletedAt = stamp;
        log.updatedAt = stamp;
        touch("setLogs", id);
      }
    });
  }

  async listBodyMetrics() {
    return live(this.load().bodyMetrics).sort((a, b) => a.date.localeCompare(b.date));
  }

  async saveBodyMetric(metric: Draft<BodyMetricRecord>) {
    return this.upsert("bodyMetrics", metric, (m) => m.date === metric.date);
  }

  async deleteBodyMetric(id: string) {
    this.write((tables, stamp, touch) => {
      const metric = tables.bodyMetrics.find((m) => m.id === id && !m.deletedAt);
      if (metric) {
        metric.deletedAt = stamp;
        metric.updatedAt = stamp;
        touch("bodyMetrics", id);
      }
    });
  }

  /** Everything, including soft-deleted rows, for export. */
  async exportAll(): Promise<Tables> {
    return this.load();
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

  // ---- Sync support (used by src/data/sync) ----

  getSyncMeta(): SyncMeta {
    const raw = this.storage.getItem(SYNC_KEY);
    if (!raw) return structuredClone(EMPTY_META);
    try {
      return { ...structuredClone(EMPTY_META), ...(JSON.parse(raw) as SyncMeta) };
    } catch {
      return structuredClone(EMPTY_META);
    }
  }

  private setSyncMeta(meta: SyncMeta) {
    this.storage.setItem(SYNC_KEY, JSON.stringify(meta));
  }

  hasData(): boolean {
    const tables = this.load();
    return TABLE_NAMES.some((t) => tables[t].length > 0);
  }

  /**
   * Hands the device's data to a user. The first time (no owner yet), every
   * existing row is queued for upload: the one-time import of local data.
   */
  claimFor(userId: string) {
    const meta = this.getSyncMeta();
    if (meta.ownerUserId === userId) return;
    if (meta.ownerUserId !== null) {
      throw new Error("This device's data belongs to another account; clear it first");
    }
    const tables = this.load();
    const dirty: SyncMeta["dirty"] = {};
    for (const t of TABLE_NAMES) dirty[t] = tables[t].map((r) => r.id);
    this.setSyncMeta({ ...EMPTY_META, ownerUserId: userId, dirty });
    this.emit();
  }

  /** Removes all data and sync state from this device. */
  clearAll() {
    this.storage.removeItem(STORAGE_KEY);
    this.storage.removeItem(SYNC_KEY);
    this.emit();
  }

  /** Rows queued for upload, including soft-deleted ones. */
  dirtyRows<K extends TableName>(table: K): RowOf<K>[] {
    const ids = new Set(this.getSyncMeta().dirty[table] ?? []);
    return (this.load()[table] as RowOf<K>[]).filter((r) => ids.has(r.id));
  }

  pendingCount(): number {
    const { dirty } = this.getSyncMeta();
    return TABLE_NAMES.reduce((n, t) => n + (dirty[t]?.length ?? 0), 0);
  }

  /** Dequeues pushed rows, unless they changed again while the push was in flight. */
  markClean<K extends TableName>(table: K, pushed: RowOf<K>[]) {
    const current = new Map(this.load()[table].map((r) => [r.id, r.updatedAt]));
    const done = new Set(pushed.filter((r) => current.get(r.id) === r.updatedAt).map((r) => r.id));
    const meta = this.getSyncMeta();
    meta.dirty[table] = (meta.dirty[table] ?? []).filter((id) => !done.has(id));
    this.setSyncMeta(meta);
  }

  /**
   * Merges rows pulled from the server. Last write wins: a queued local edit
   * newer than the server's version is kept (and pushed later).
   */
  applyRemote<K extends TableName>(table: K, incoming: RowOf<K>[], cursor: string | null) {
    const tables = this.load();
    const meta = this.getSyncMeta();
    const rows = tables[table] as RowOf<K>[];
    const dirty = new Set(meta.dirty[table] ?? []);
    let changed = false;

    for (const remote of incoming) {
      const index = rows.findIndex((r) => r.id === remote.id);
      const local = rows[index];
      if (local && dirty.has(local.id) && Date.parse(local.updatedAt) > Date.parse(remote.updatedAt)) {
        continue;
      }
      dirty.delete(remote.id);
      if (local && JSON.stringify(local) === JSON.stringify(remote)) continue;
      if (index >= 0) rows[index] = remote;
      else rows.push(remote);
      changed = true;
    }

    meta.dirty[table] = [...dirty];
    if (cursor) meta.cursors[table] = cursor;
    this.setSyncMeta(meta);
    if (changed) {
      this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...tables } satisfies Stored));
      this.emit();
    }
  }

  /**
   * Gives a row the id the server already uses for the same natural key (e.g.
   * a session for the same date created on another device), updating
   * references to it.
   */
  remapId(table: TableName, oldId: string, newId: string) {
    const tables = this.load();
    const meta = this.getSyncMeta();
    const row = tables[table].find((r) => r.id === oldId);
    if (!row) return;
    row.id = newId;
    const refs: [TableName, string][] =
      table === "programs"
        ? [["enrollments", "programId"]]
        : table === "enrollments"
          ? [["swaps", "enrollmentId"], ["sessions", "enrollmentId"]]
          : table === "sessions"
            ? [["setLogs", "sessionId"]]
            : [];
    for (const [child, column] of refs) {
      for (const r of tables[child] as unknown as Record<string, unknown>[]) {
        if (r[column] === oldId) {
          r[column] = newId;
          meta.dirty[child] = [...new Set([...(meta.dirty[child] ?? []), r.id as string])];
        }
      }
    }
    meta.dirty[table] = (meta.dirty[table] ?? []).map((id) => (id === oldId ? newId : id));
    this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...tables } satisfies Stored));
    this.setSyncMeta(meta);
    this.emit();
  }

  setLastSyncedAt(at: string) {
    const meta = this.getSyncMeta();
    meta.lastSyncedAt = at;
    this.setSyncMeta(meta);
  }

  // ---- internals ----

  private upsert<K extends TableName>(
    table: K,
    draft: Draft<RowOf<K>>,
    sameRow: (row: RowOf<K>) => boolean,
  ): RowOf<K> {
    return this.write((tables, stamp, touch) => put(table, tables, draft, sameRow, stamp, touch));
  }

  private write<T>(change: (tables: Tables, stamp: string, touch: Touch) => T): T {
    const tables = this.load();
    const meta = this.getSyncMeta();
    const tracking = meta.ownerUserId !== null;
    const touched: [TableName, string][] = [];
    const result = change(tables, this.now().toISOString(), (t, id) => touched.push([t, id]));

    this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...tables } satisfies Stored));
    if (tracking && touched.length) {
      for (const [t, id] of touched) meta.dirty[t] = [...new Set([...(meta.dirty[t] ?? []), id])];
      this.setSyncMeta(meta);
    }
    this.emit();
    return result;
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private load(): Tables {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return {
        programs: [],
        enrollments: [],
        swaps: [],
        sessions: [],
        setLogs: [],
        bodyMetrics: [],
      };
    }
    // Never silently replace unreadable data: it may be the only copy of the log.
    let stored: Partial<Stored>;
    try {
      stored = JSON.parse(raw) as Partial<Stored>;
    } catch {
      throw new Error(`Saved data in localStorage ("${STORAGE_KEY}") is corrupted`);
    }
    if (stored.version !== 1) {
      throw new Error(`Saved data has unknown version ${String(stored.version)}`);
    }
    return {
      programs: stored.programs ?? [],
      enrollments: stored.enrollments ?? [],
      swaps: stored.swaps ?? [],
      sessions: stored.sessions ?? [],
      setLogs: stored.setLogs ?? [],
      // Added in M4; older saves don't have it.
      bodyMetrics: stored.bodyMetrics ?? [],
    };
  }
}

function live<T extends AnyRow>(rows: T[]): T[] {
  return rows.filter((r) => r.deletedAt === null);
}

/**
 * Inserts or updates in place. A soft-deleted row matching the key is revived,
 * so its id stays stable.
 */
function put<K extends TableName>(
  table: K,
  tables: Tables,
  draft: Draft<RowOf<K>>,
  sameRow: (row: RowOf<K>) => boolean,
  stamp: string,
  touch: Touch,
): RowOf<K> {
  const rows = tables[table] as RowOf<K>[];
  const existing = rows.find(sameRow);
  if (existing) {
    Object.assign(existing, draft, { id: existing.id, updatedAt: stamp, deletedAt: null });
    touch(table, existing.id);
    return { ...existing };
  }
  const row = { ...draft, createdAt: stamp, updatedAt: stamp, deletedAt: null } as RowOf<K>;
  rows.push(row);
  touch(table, row.id);
  return { ...row };
}
