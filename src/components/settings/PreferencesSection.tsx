"use client";

import { setUnits, useUnits, type Units } from "@/lib/units";
import { card } from "@/components/ui/styles";

export function PreferencesSection() {
  const units = useUnits();
  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="font-semibold">Weight units</h2>
      <div
        role="radiogroup"
        aria-label="Weight units"
        className="grid grid-cols-2 gap-2"
      >
        {(["kg", "lb"] as Units[]).map((u) => (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={units === u}
            onClick={() => setUnits(u)}
            className={`h-12 rounded-xl border font-semibold ${units === u ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}
          >
            {u}
          </button>
        ))}
      </div>
      <p className="text-muted text-xs">
        Weights are stored in kg; this only changes how they&apos;re shown and
        typed on this device.
      </p>
    </section>
  );
}
