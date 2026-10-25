import type { DayStatus } from "@/domain/dayStatus";

export const statusLabel: Record<DayStatus, string> = {
  completed: "Completed",
  in_progress: "In progress",
  missed: "Missed",
  skipped: "Skipped",
  planned: "Planned",
  rest: "Rest",
};

/** Calendar cell / day chip colors per status. */
export const statusCell: Record<DayStatus, string> = {
  completed: "bg-success text-background",
  in_progress: "bg-warning text-background",
  missed: "border border-danger text-danger",
  skipped: "bg-surface-2 text-muted line-through",
  planned: "bg-surface-2 text-foreground",
  rest: "text-muted",
};
