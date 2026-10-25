import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageRepository } from "../../localStorageRepository";
import type { Draft, SessionRecord, SetLogRecord } from "../../records";
import { syncOnce } from "../engine";
import type { Remote } from "../remote";
import { naturalKeyOf, SYNC_TABLES, toLocal, toRemote, type RemoteRow } from "../tables";

class MemoryStorage {
  data = new Map<string, string>();
  getItem = (k: string) => this.data.get(k) ?? null;
  setItem = (k: string, v: string) => void this.data.set(k, v);
  removeItem = (k: string) => void this.data.delete(k);
}

/** Behaves like the Supabase tables: unique natural keys, one active enrollment, last write wins. */
class FakeRemote implements Remote {
  tables = new Map<string, Map<string, RemoteRow>>();
  offline = false;
  private clock = 0;

  private table(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }

  private check() {
    if (this.offline) throw new Error("Failed to fetch");
  }

  async pull(table: string, since: string | null, limit: number) {
    this.check();
    return [...this.table(table).values()]
      .filter((r) => !since || (r.server_updated_at as string) > since)
      .sort((a, b) => (a.server_updated_at as string).localeCompare(b.server_updated_at as string))
      .slice(0, limit);
  }

  async upsert(table: string, rows: RemoteRow[]) {
    this.check();
    const def = SYNC_TABLES.find((t) => t.remote === table)!;
    const store = this.table(table);
    for (const row of rows) {
      const existing = store.get(row.id as string);
      const key = naturalKeyOf(def, toLocal(def, row) as never);
      for (const other of store.values()) {
        if (other.id !== row.id && key && naturalKeyOf(def, toLocal(def, other) as never) === key) {
          throw new Error(`duplicate key value violates unique constraint on ${table}`);
        }
        if (table === "enrollments" && row.is_active && other.is_active && other.id !== row.id) {
          throw new Error("duplicate key value violates unique constraint enrollments_one_active");
        }
      }
      if (existing && Date.parse(row.updated_at as string) < Date.parse(existing.updated_at as string)) continue;
      // Real timestamps come back as "+00:00"; mimic that.
      const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, this.clock++)).toISOString().replace("Z", "+00:00");
      store.set(row.id as string, { ...row, server_updated_at: stamp });
    }
  }

  async selectWhereIn(table: string, column: string, values: string[]) {
    this.check();
    return [...this.table(table).values()].filter((r) => values.includes(r[column] as string));
  }
}

const USER = "user-1";
let remote: FakeRemote;
let clock: number;
const now = () => new Date(Date.UTC(2026, 9, 19, 10, 0, clock++));

function device() {
  return new LocalStorageRepository({ storage: new MemoryStorage(), now });
}

const session = (id: string, overrides: Partial<Draft<SessionRecord>> = {}): Draft<SessionRecord> => ({
  id,
  enrollmentId: "e1",
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

const setLog = (id: string, sessionId: string, overrides: Partial<Draft<SetLogRecord>> = {}): Draft<SetLogRecord> => ({
  id,
  sessionId,
  performedOn: "2026-10-19",
  plannedExerciseId: "lat_pulldown",
  exerciseId: "lat_pulldown",
  setIndex: 0,
  weightKg: 50,
  reps: 10,
  ...overrides,
});

async function seedEnrollment(repo: LocalStorageRepository) {
  await repo.saveProgram({ id: "p1", slug: "w", name: "W", json: {} as never });
  await repo.saveEnrollment({ id: "e1", programId: "p1", startDate: "2026-10-19", isActive: true });
}

beforeEach(() => {
  remote = new FakeRemote();
  clock = 0;
});

describe("syncOnce", () => {
  it("uploads data logged before the first sign-in, then has nothing pending", async () => {
    const phone = device();
    await seedEnrollment(phone);
    await phone.saveSession(session("s1"));
    await phone.saveSetLog(setLog("l1", "s1", { miniSetReps: [4, 3] }));
    expect(phone.pendingCount()).toBe(0); // not tracking before an owner exists

    phone.claimFor(USER);
    expect(phone.pendingCount()).toBe(4);
    const result = await syncOnce(phone, remote, USER, now);
    expect(result.pushed).toBe(4);
    expect(phone.pendingCount()).toBe(0);
    expect(remote.tables.get("set_logs")!.get("l1")).toMatchObject({
      user_id: USER,
      session_id: "s1",
      weight_kg: 50,
      mini_set_reps: [4, 3],
      drop_reps: null,
    });
  });

  it("brings data logged on one device to another", async () => {
    const phone = device();
    const laptop = device();
    phone.claimFor(USER);
    laptop.claimFor(USER);
    await seedEnrollment(phone);
    await phone.saveSession(session("s1"));
    await phone.saveSetLog(setLog("l1", "s1", { weightKg: 52.5 }));
    await syncOnce(phone, remote, USER, now);

    await syncOnce(laptop, remote, USER, now);
    expect((await laptop.getActiveEnrollment())?.id).toBe("e1");
    expect(await laptop.listSetLogs("s1")).toEqual([
      expect.objectContaining({ id: "l1", weightKg: 52.5, miniSetReps: [] }),
    ]);
    expect(laptop.pendingCount()).toBe(0);
  });

  it("queues writes while offline and sends them when back online", async () => {
    const phone = device();
    phone.claimFor(USER);
    await seedEnrollment(phone);
    await phone.saveSession(session("s1"));
    await phone.saveSetLog(setLog("l1", "s1"));

    remote.offline = true;
    await expect(syncOnce(phone, remote, USER, now)).rejects.toThrow("Failed to fetch");
    expect(phone.pendingCount()).toBe(4);

    remote.offline = false;
    await syncOnce(phone, remote, USER, now);
    expect(phone.pendingCount()).toBe(0);
    expect(remote.tables.get("set_logs")!.has("l1")).toBe(true);
  });

  it("keeps the newest edit when two devices change the same set", async () => {
    const phone = device();
    const laptop = device();
    phone.claimFor(USER);
    laptop.claimFor(USER);
    await seedEnrollment(phone);
    await phone.saveSession(session("s1"));
    await phone.saveSetLog(setLog("l1", "s1"));
    await syncOnce(phone, remote, USER, now);
    await syncOnce(laptop, remote, USER, now);

    // Laptop edits first (older), phone edits later (newer); laptop syncs last.
    await laptop.saveSetLog(setLog("l1", "s1", { reps: 7 }));
    await phone.saveSetLog(setLog("l1", "s1", { reps: 12 }));
    await syncOnce(phone, remote, USER, now);
    await syncOnce(laptop, remote, USER, now);
    await syncOnce(phone, remote, USER, now);

    expect((await laptop.listSetLogs("s1"))[0]!.reps).toBe(12);
    expect((await phone.listSetLogs("s1"))[0]!.reps).toBe(12);
    expect(laptop.pendingCount()).toBe(0);
  });

  it("merges a workout started on two devices for the same day", async () => {
    const phone = device();
    const laptop = device();
    phone.claimFor(USER);
    laptop.claimFor(USER);
    await seedEnrollment(phone);
    await syncOnce(phone, remote, USER, now);
    await syncOnce(laptop, remote, USER, now);

    await phone.saveSession(session("phone-session"));
    await phone.saveSetLog(setLog("phone-set-1", "phone-session"));
    await laptop.saveSession(session("laptop-session"));
    await laptop.saveSetLog(setLog("laptop-set-2", "laptop-session", { setIndex: 1, reps: 9 }));
    await laptop.saveSetLog(setLog("laptop-set-1", "laptop-session", { reps: 11 })); // same slot as phone's

    await syncOnce(phone, remote, USER, now);
    await syncOnce(laptop, remote, USER, now);
    await syncOnce(phone, remote, USER, now);

    for (const repo of [phone, laptop]) {
      const sessions = await repo.listSessions("e1");
      expect(sessions.map((s) => s.id)).toEqual(["phone-session"]);
      const logs = (await repo.listSetLogs("phone-session")).sort((a, b) => a.setIndex - b.setIndex);
      expect(logs.map((l) => [l.id, l.setIndex, l.reps])).toEqual([
        ["phone-set-1", 0, 11], // laptop's later edit of the same set wins, under the server's id
        ["laptop-set-2", 1, 9],
      ]);
    }
  });

  it("switches the active enrollment without breaking the one-active rule", async () => {
    const phone = device();
    phone.claimFor(USER);
    await seedEnrollment(phone);
    await syncOnce(phone, remote, USER, now);
    await phone.saveEnrollment({ id: "e2", programId: "p1", startDate: "2026-10-26", isActive: true });

    await syncOnce(phone, remote, USER, now);
    const enrollments = [...remote.tables.get("enrollments")!.values()];
    expect(enrollments.filter((e) => e.is_active).map((e) => e.id)).toEqual(["e2"]);
  });

  it("syncs deletions", async () => {
    const phone = device();
    const laptop = device();
    phone.claimFor(USER);
    laptop.claimFor(USER);
    await seedEnrollment(phone);
    await phone.saveSession(session("s1"));
    await phone.saveSetLog(setLog("l1", "s1"));
    await syncOnce(phone, remote, USER, now);
    await syncOnce(laptop, remote, USER, now);

    await phone.deleteSetLog("l1");
    await syncOnce(phone, remote, USER, now);
    await syncOnce(laptop, remote, USER, now);
    expect(await laptop.listSetLogs("s1")).toEqual([]);
  });

  it("refuses to sync another account's data", async () => {
    const phone = device();
    phone.claimFor("someone-else");
    await expect(syncOnce(phone, remote, USER, now)).rejects.toThrow("different account");
    expect(() => phone.claimFor(USER)).toThrow("another account");
  });
});

describe("row mapping", () => {
  it("round-trips a set log, filling optional fields", () => {
    const def = SYNC_TABLES.find((t) => t.local === "setLogs")!;
    const row = {
      ...setLog("l1", "s1"),
      createdAt: "2026-10-19T10:00:00.000Z",
      updatedAt: "2026-10-19T10:00:00.000Z",
      deletedAt: null,
    };
    const remoteRow = toRemote(def, row, USER);
    expect(remoteRow).toMatchObject({ user_id: USER, set_index: 0, mini_set_reps: [], rir_actual: null });
    const back = toLocal(def, { ...remoteRow, weight_kg: "50.00", updated_at: "2026-10-19T10:00:00+00:00" });
    expect(back).toMatchObject({ weightKg: 50, updatedAt: "2026-10-19T10:00:00.000Z", miniSetReps: [] });
  });
});
