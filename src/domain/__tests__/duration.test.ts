import { describe, expect, it } from "vitest";
import {
  formatDuration,
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

  it("ignores workouts filled in on a later day", () => {
    const s = session({
      status: "completed",
      startedAt: at(9, 0, 10),
      finishedAt: at(9, 5, 10),
    });
    expect(workoutDurationMs(s, new Date(2026, 10, 10, 10, 0))).toBe(null);
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

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(247_000)).toBe("4:07");
    expect(formatDuration(52 * 60_000 + 10_000)).toBe("52:10");
    expect(formatDuration(3_909_999)).toBe("1:05:09");
  });
});
