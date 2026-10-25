import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageRepository, STORAGE_KEY } from "../localStorageRepository";
import type { Draft, SessionRecord, SetLogRecord } from "../records";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

let storage: MemoryStorage;
let clock: Date;
let repo: LocalStorageRepository;

beforeEach(() => {
  storage = new MemoryStorage();
  clock = new Date("2026-10-19T10:00:00.000Z");
  repo = new LocalStorageRepository({ storage, now: () => clock });
});

const session = (overrides: Partial<Draft<SessionRecord>> = {}): Draft<SessionRecord> => ({
  id: "session-1",
  enrollmentId: "enrollment-1",
  date: "2026-10-19",
  week: 1,
  phaseId: "phase_1",
  dayKey: "upper_a",
  status: "in_progress",
  cardioDone: false,
  notes: null,
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

const setLog = (overrides: Partial<Draft<SetLogRecord>> = {}): Draft<SetLogRecord> => ({
  id: "set-1",
  sessionId: "session-1",
  performedOn: "2026-10-19",
  plannedExerciseId: "lat_pulldown",
  exerciseId: "lat_pulldown",
  setIndex: 0,
  weightKg: 50,
  reps: 10,
  ...overrides,
});

describe("LocalStorageRepository", () => {
  it("starts empty", async () => {
    expect(await repo.listPrograms()).toEqual([]);
    expect(await repo.getActiveEnrollment()).toBeNull();
  });

  it("stamps created/updated times and keeps createdAt on update", async () => {
    const created = await repo.saveSession(session());
    expect(created).toMatchObject({
      createdAt: "2026-10-19T10:00:00.000Z",
      updatedAt: "2026-10-19T10:00:00.000Z",
      deletedAt: null,
    });

    clock = new Date("2026-10-19T11:00:00.000Z");
    const updated = await repo.saveSession(session({ status: "completed" }));
    expect(updated).toMatchObject({
      status: "completed",
      createdAt: "2026-10-19T10:00:00.000Z",
      updatedAt: "2026-10-19T11:00:00.000Z",
    });
  });

  it("persists across instances on the same storage", async () => {
    await repo.saveSession(session());
    const again = new LocalStorageRepository({ storage });
    expect(await again.getSession("enrollment-1", "2026-10-19")).toMatchObject({ id: "session-1" });
  });

  it("upserts sessions by (enrollment, date), keeping the first id", async () => {
    await repo.saveSession(session());
    const saved = await repo.saveSession(session({ id: "another-id", status: "completed" }));
    expect(saved.id).toBe("session-1");
    expect(await repo.listSessions("enrollment-1")).toHaveLength(1);
  });

  it("upserts set logs by (session, planned exercise, set index)", async () => {
    await repo.saveSetLog(setLog());
    await repo.saveSetLog(setLog({ id: "dup", weightKg: 52.5 }));
    await repo.saveSetLog(setLog({ id: "set-2", setIndex: 1 }));
    const logs = await repo.listSetLogs("session-1");
    expect(logs.map((l) => [l.id, l.weightKg])).toEqual([
      ["set-1", 52.5],
      ["set-2", 50],
    ]);
  });

  it("soft-deletes set logs and revives them with the same id", async () => {
    await repo.saveSetLog(setLog());
    await repo.deleteSetLog("set-1");
    expect(await repo.listSetLogs("session-1")).toEqual([]);

    const revived = await repo.saveSetLog(setLog({ id: "new-id", reps: 8 }));
    expect(revived).toMatchObject({ id: "set-1", reps: 8, deletedAt: null });
  });

  it("finds earlier logs for given exercises", async () => {
    await repo.saveSetLog(setLog());
    await repo.saveSetLog(setLog({ id: "b", sessionId: "s2", performedOn: "2026-10-26" }));
    await repo.saveSetLog(setLog({ id: "c", exerciseId: "leg_press", plannedExerciseId: "leg_press" }));

    const logs = await repo.listSetLogsForExercises(["lat_pulldown"], "2026-10-26");
    expect(logs.map((l) => l.id)).toEqual(["set-1"]);
  });

  it("upserts swaps by slot and start date", async () => {
    const swap = {
      id: "w1",
      enrollmentId: "enrollment-1",
      phaseId: "phase_2",
      dayKey: "upper_a",
      plannedExerciseId: "machine_shoulder_press",
      replacementExerciseId: "seated_db_shoulder_press",
      fromDate: "2026-11-23",
    };
    await repo.saveSwap(swap);
    await repo.saveSwap({ ...swap, id: "w2", replacementExerciseId: "bb_overhead_press" });
    await repo.saveSwap({ ...swap, id: "w3", fromDate: "2026-11-30" });
    const swaps = await repo.listSwaps("enrollment-1");
    expect(swaps.map((s) => [s.id, s.replacementExerciseId, s.fromDate])).toEqual([
      ["w1", "bb_overhead_press", "2026-11-23"],
      ["w3", "seated_db_shoulder_press", "2026-11-30"],
    ]);
  });

  it("keeps only one active enrollment", async () => {
    const base = { programId: "p", startDate: "2026-10-19", isActive: true };
    await repo.saveEnrollment({ id: "e1", ...base });
    await repo.saveEnrollment({ id: "e2", ...base, startDate: "2026-10-26" });
    expect((await repo.getActiveEnrollment())?.id).toBe("e2");
  });

  it("notifies subscribers on every write", async () => {
    const listener = vi.fn();
    const unsubscribe = repo.subscribe(listener);
    await repo.saveSession(session());
    await repo.saveSetLog(setLog());
    unsubscribe();
    await repo.deleteSetLog("set-1");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("refuses to overwrite unreadable data", async () => {
    storage.setItem(STORAGE_KEY, "{not json");
    await expect(repo.listPrograms()).rejects.toThrow("corrupted");
    await expect(repo.saveSession(session())).rejects.toThrow("corrupted");
    expect(storage.getItem(STORAGE_KEY)).toBe("{not json");
  });
});
