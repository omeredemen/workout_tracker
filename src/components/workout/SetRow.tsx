"use client";

import { useState } from "react";
import type { SetLogRecord } from "@/data/records";
import { parseReps, parseWeight } from "@/lib/format";

const input =
  "h-12 w-full min-w-0 rounded-xl border bg-background px-3 text-center text-lg font-semibold tabular-nums placeholder:font-normal placeholder:text-muted/70";

/**
 * One set: weight and reps inputs plus a save button. Untouched fields show
 * the saved value, or for weight the previous set's weight. An empty reps
 * field saves the target.
 */
export function SetRow({
  index,
  targetReps,
  saved,
  suggestedWeight,
  exerciseName,
  onSave,
}: {
  index: number;
  targetReps: number;
  saved: SetLogRecord | undefined;
  suggestedWeight: number | null;
  exerciseName: string;
  onSave: (weightKg: number | null, reps: number) => Promise<void>;
}) {
  // null = untouched: show the saved / suggested value instead.
  const [weightInput, setWeightInput] = useState<string | null>(null);
  const [repsInput, setRepsInput] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const weightText =
    weightInput ?? toText(saved ? saved.weightKg : suggestedWeight);
  const repsText = repsInput ?? toText(saved?.reps ?? null);

  const weight = parseWeight(weightText);
  const parsedReps = parseReps(repsText);
  const reps = parsedReps === null ? targetReps : parsedReps;
  const valid = weight !== undefined && reps !== undefined;
  const unchanged =
    saved !== undefined && saved.weightKg === weight && saved.reps === reps;

  async function save() {
    if (!valid || weight === undefined || reps === undefined) return;
    setSaving(true);
    try {
      await onSave(weight, reps);
      setWeightInput(null);
      setRepsInput(null);
    } catch {
      // WorkoutView shows the error; keep what was typed.
    } finally {
      setSaving(false);
    }
  }

  const label = `${exerciseName} set ${index + 1}`;

  return (
    <form
      className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <span className="text-muted text-center text-sm font-semibold">
        {index + 1}
      </span>
      <input
        aria-label={`${label} weight in kg`}
        inputMode="decimal"
        enterKeyHint="next"
        autoComplete="off"
        placeholder="kg"
        value={weightText}
        onChange={(e) => setWeightInput(e.target.value)}
        className={`${input} ${weight === undefined ? "border-danger" : "border-border"}`}
      />
      <input
        aria-label={`${label} reps`}
        inputMode="numeric"
        enterKeyHint="done"
        autoComplete="off"
        placeholder={String(targetReps)}
        value={repsText}
        onChange={(e) => setRepsInput(e.target.value)}
        className={`${input} ${parsedReps === undefined ? "border-danger" : "border-border"}`}
      />
      <button
        type="submit"
        disabled={!valid || saving || unchanged}
        aria-label={unchanged ? `${label} saved` : `Save ${label}`}
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold ${
          unchanged
            ? "bg-success text-background"
            : "border-accent text-accent active:bg-accent active:text-accent-foreground disabled:border-border disabled:text-muted border-2"
        }`}
      >
        ✓
      </button>
    </form>
  );
}

function toText(value: number | null): string {
  return value === null ? "" : String(value);
}
