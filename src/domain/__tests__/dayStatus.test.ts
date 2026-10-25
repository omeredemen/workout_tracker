import { describe, expect, it } from "vitest";
import { dayStatus } from "../dayStatus";

const today = "2026-10-21";
const workout = (date: string) => ({ date, dayKey: "upper_a" });

describe("dayStatus", () => {
  it("marks rest days as rest, whatever the date", () => {
    expect(dayStatus({ date: "2026-10-01", dayKey: null }, null, today)).toBe(
      "rest",
    );
  });

  it("uses the session status when there is one", () => {
    expect(
      dayStatus(workout("2026-10-19"), { status: "completed" }, today),
    ).toBe("completed");
    expect(dayStatus(workout("2026-10-19"), { status: "skipped" }, today)).toBe(
      "skipped",
    );
    expect(
      dayStatus(workout("2026-10-21"), { status: "in_progress" }, today),
    ).toBe("in_progress");
  });

  it("treats a planned session (cardio only) like no session", () => {
    expect(dayStatus(workout("2026-10-20"), { status: "planned" }, today)).toBe(
      "missed",
    );
    expect(dayStatus(workout("2026-10-22"), { status: "planned" }, today)).toBe(
      "planned",
    );
  });

  it("marks past workouts without a session as missed, and today/future as planned", () => {
    expect(dayStatus(workout("2026-10-20"), null, today)).toBe("missed");
    expect(dayStatus(workout("2026-10-21"), null, today)).toBe("planned");
    expect(dayStatus(workout("2026-10-22"), undefined, today)).toBe("planned");
  });
});
