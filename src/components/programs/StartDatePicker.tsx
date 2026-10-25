"use client";

import { addWeeks, startOfWeek } from "date-fns";
import { parseIsoDate, toIsoDate } from "@/domain/dates";
import type { IsoDate } from "@/domain/types";
import { useToday } from "@/data/hooks";
import { formatLongDate } from "@/lib/format";
import { button } from "@/components/ui/styles";

const mondayOf = (date: Date) =>
  toIsoDate(startOfWeek(date, { weekStartsOn: 1 }));

/** Picks a Monday: any date chosen in the native picker snaps to the Monday of its week. */
export function StartDatePicker({
  value,
  onChange,
}: {
  value: IsoDate;
  onChange: (monday: IsoDate) => void;
}) {
  const today = parseIsoDate(useToday());
  const quick = [
    { label: "This week", date: mondayOf(today) },
    { label: "Next week", date: mondayOf(addWeeks(today, 1)) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {quick.map(({ label, date }) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange(date)}
            aria-pressed={value === date}
            className={`${button.secondary} ${value === date ? "border-accent text-accent" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="text-muted flex flex-col gap-1 text-sm">
        Or pick any week
        <input
          type="date"
          value={value}
          onChange={(e) =>
            e.target.value && onChange(mondayOf(parseIsoDate(e.target.value)))
          }
          className="border-border bg-surface text-foreground h-12 rounded-xl border px-3 text-base"
        />
      </label>
      <p className="text-sm">
        Week 1 starts <strong>{formatLongDate(value)}</strong>
      </p>
    </div>
  );
}
