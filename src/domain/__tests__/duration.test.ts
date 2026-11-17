import { describe, expect, it } from "vitest";
import {
  formatDuration,
  isRunning,
  workoutDurationMs,
  type TimedSession,
} from "../duration";

// Local-time timestamps, so the tests don't depend on the machine's time zone.
const at = (hh: number, mm: number, day = 9) =>
  new Date(2026, 10, day, hh, mm).toISOString();
const session = (s: Partial<TimedSession>): TimedSession => ({
  date: "2026-11-09",
  status: "in_progress",
  startedAt: at(18, 0),
  finishedAt: null,
  ...s,
});

describe("workoutDurationMs", () => {
  it("measures a finished workout from start to finish", () => {
    const s = session({ status: "completed", finishedAt: at(19, 5) });
    expect(workoutDurationMs(s, new Date(2026, 10, 12))).toBe(65 * 60_000);
  });

  it("counts a running workout up to now", () => {
    expect(workoutDurationMs(session({}), new Date(2026, 10, 9, 18, 30))).toBe(
      30 * 60_000,
    );
  });

  it("stops counting a running workout once its day is over", () => {
    expect(workoutDurationMs(session({}), new Date(2026, 10, 10, 8, 0))).toBe(
      null,
    );
  });

  it("times a skipped workout done on a later day", () => {
    const s = session({
      status: "completed",
      startedAt: at(9, 0, 11),
      finishedAt: at(9, 50, 11),
    });
    expect(workoutDurationMs(s, new Date(2026, 10, 11, 10, 0))).toBe(
      50 * 60_000,
    );
    const running = session({ startedAt: at(9, 0, 11) });
    expect(workoutDurationMs(running, new Date(2026, 10, 11, 9, 20))).toBe(
      20 * 60_000,
    );
  });

  it("ignores a finish on a later day than the start (forgotten Finish)", () => {
    const s = session({ status: "completed", finishedAt: at(8, 0, 10) });
    expect(workoutDurationMs(s, new Date(2026, 10, 12))).toBe(null);
  });

  it("is null when not started, skipped, or planned", () => {
    const now = new Date(2026, 10, 9, 19, 0);
    expect(workoutDurationMs(session({ startedAt: null }), now)).toBe(null);
    expect(workoutDurationMs(session({ status: "skipped" }), now)).toBe(null);
    expect(workoutDurationMs(session({ status: "planned" }), now)).toBe(null);
  });

  it("never goes negative", () => {
    expect(workoutDurationMs(session({}), new Date(2026, 10, 9, 17, 0))).toBe(
      0,
    );
  });
});

describe("isRunning", () => {
  it("is true only for a workout in progress that started today", () => {
    const now = new Date(2026, 10, 9, 18, 30);
    expect(isRunning(session({}), now)).toBe(true);
    expect(isRunning(session({}), new Date(2026, 10, 10, 9, 0))).toBe(false);
    expect(isRunning(session({ startedAt: null }), now)).toBe(false);
    expect(
      isRunning(session({ status: "completed", finishedAt: at(19, 0) }), now),
    ).toBe(false);
    expect(isRunning(null, now)).toBe(false);
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(247_000)).toBe("4:07");
    expect(formatDuration(52 * 60_000 + 10_000)).toBe("52:10");
    expect(formatDuration(3_909_999)).toBe("1:05:09");
  });
});
