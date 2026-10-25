"use client";

import { useState } from "react";
import type { SetLog } from "@/domain/types";
import type { SetLogRecord } from "@/data/records";
import { formatWeight, parseReps, parseWeight } from "@/lib/format";
import { fromDisplay, toDisplay, useUnits, type Units } from "@/lib/units";
import type { LastSetExtra, SetValues } from "./types";

const input =
  "h-12 w-full min-w-0 rounded-xl border bg-background px-3 text-center text-lg font-semibold tabular-nums placeholder:font-normal placeholder:text-muted/70";
const smallInput =
  "h-11 w-full min-w-0 rounded-lg border bg-background px-2 text-center text-base font-semibold tabular-nums placeholder:font-normal placeholder:text-muted/70";

/**
 * One set: weight and reps plus a save button, and on the final set any
 * rest-pause / drop-set inputs. Untouched fields show the saved value, or a
 * suggestion (muted) for weight. An empty reps field saves the target.
 */
export function SetRow({
  index,
  targetReps,
  saved,
  suggestedWeight,
  lastTime,
  extra,
  exerciseName,
  onSave,
}: {
  index: number;
  targetReps: number;
  saved: SetLogRecord | undefined;
  suggestedWeight: number | null;
  lastTime: SetLog | undefined;
  extra: LastSetExtra;
  exerciseName: string;
  onSave: (values: SetValues) => Promise<void>;
}) {
  // null = untouched: show the saved / suggested value instead.
  const [weightInput, setWeightInput] = useState<string | null>(null);
  const [repsInput, setRepsInput] = useState<string | null>(null);
  const [miniInputs, setMiniInputs] = useState<string[] | null>(null);
  const [dropWeightInput, setDropWeightInput] = useState<string | null>(null);
  const [dropRepsInput, setDropRepsInput] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const units = useUnits();
  // Inputs show and accept display units; values are stored in kg.
  const shown = (kg: number | null) =>
    toText(kg === null ? null : toDisplay(kg, units));
  const toKg = (display: number | null | undefined) =>
    display === null || display === undefined
      ? display
      : fromDisplay(display, units);

  const suggested = !saved && weightInput === null && suggestedWeight !== null;
  const weightText =
    weightInput ?? shown(saved ? saved.weightKg : suggestedWeight);
  const repsText = repsInput ?? toText(saved?.reps ?? null);
  const miniCount = extra?.kind === "rest_pause" ? extra.miniSets : 0;
  const miniTexts =
    miniInputs ??
    Array.from({ length: miniCount }, (_, i) =>
      toText(saved?.miniSetReps?.[i] ?? null),
    );
  const dropWeightText = dropWeightInput ?? shown(saved?.dropWeightKg ?? null);
  const dropRepsText = dropRepsInput ?? toText(saved?.dropReps ?? null);

  const weight = parseWeight(weightText);
  const parsedReps = parseReps(repsText);
  const reps = parsedReps === null ? targetReps : parsedReps;
  const minis = miniTexts.map(parseReps);
  const dropWeight = parseWeight(dropWeightText);
  const dropReps = parseReps(dropRepsText);

  const valid =
    weight !== undefined &&
    reps !== undefined &&
    !minis.includes(undefined) &&
    dropWeight !== undefined &&
    dropReps !== undefined;

  const values: SetValues | null = valid
    ? {
        weightKg: toKg(weight) as number | null,
        reps,
        miniSetReps: minis.filter(
          (m): m is number => m !== null && m !== undefined,
        ),
        dropWeightKg: toKg(dropWeight) as number | null,
        dropReps,
      }
    : null;

  const unchanged =
    saved !== undefined &&
    values !== null &&
    // Compared in display units, so lb ↔ kg rounding doesn't look like an edit.
    shown(saved.weightKg) === toText(weight ?? null) &&
    saved.reps === values.reps &&
    sameNumbers(saved.miniSetReps ?? [], values.miniSetReps) &&
    shown(saved.dropWeightKg ?? null) === toText(dropWeight ?? null) &&
    (saved.dropReps ?? null) === values.dropReps;

  async function save() {
    if (!values) return;
    setSaving(true);
    try {
      await onSave(values);
      setWeightInput(null);
      setRepsInput(null);
      setMiniInputs(null);
      setDropWeightInput(null);
      setDropRepsInput(null);
    } catch {
      // WorkoutView shows the error; keep what was typed.
    } finally {
      setSaving(false);
    }
  }

  const label = `${exerciseName} set ${index + 1}`;

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2">
        <span className="text-muted text-center text-sm font-semibold">
          {index + 1}
        </span>
        <input
          aria-label={`${label} weight in ${units}`}
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          placeholder={units}
          value={weightText}
          onChange={(e) => setWeightInput(e.target.value)}
          className={`${input} ${weight === undefined ? "border-danger" : "border-border"} ${suggested ? "text-muted font-normal" : ""}`}
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
      </div>

      {extra?.kind === "rest_pause" && (
        <div className="ml-10 flex items-center gap-2">
          <span className="text-muted w-16 shrink-0 text-xs leading-tight">
            Rest-pause reps
          </span>
          {miniTexts.map((text, i) => (
            <input
              key={i}
              aria-label={`${label} rest-pause mini-set ${i + 1} reps`}
              inputMode="numeric"
              autoComplete="off"
              placeholder={extra.repsHint}
              value={text}
              onChange={(e) => {
                const next = [...miniTexts];
                next[i] = e.target.value;
                setMiniInputs(next);
              }}
              className={`${smallInput} ${minis[i] === undefined ? "border-danger" : "border-border"}`}
            />
          ))}
          <span className="w-12 shrink-0" />
        </div>
      )}

      {extra?.kind === "drop_set" && (
        <div className="ml-10 flex items-center gap-2">
          <span className="text-muted w-16 shrink-0 text-xs leading-tight">
            Drop ({extra.dropHint})
          </span>
          <input
            aria-label={`${label} drop weight in ${units}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder={units}
            value={dropWeightText}
            onChange={(e) => setDropWeightInput(e.target.value)}
            className={`${smallInput} ${dropWeight === undefined ? "border-danger" : "border-border"}`}
          />
          <input
            aria-label={`${label} drop reps`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="reps"
            value={dropRepsText}
            onChange={(e) => setDropRepsInput(e.target.value)}
            className={`${smallInput} ${dropReps === undefined ? "border-danger" : "border-border"}`}
          />
          <span className="w-12 shrink-0" />
        </div>
      )}

      {lastTime && (
        <p
          className="text-muted ml-10 text-xs"
          aria-label={`${label} last time`}
        >
          Last time: {describeSet(lastTime, units)}
        </p>
      )}
    </form>
  );
}

export function describeSet(log: SetLog, units: Units = "kg"): string {
  let text = `${formatWeight(log.weightKg, units)} × ${log.reps}`;
  if (log.miniSetReps?.length) text += ` + ${log.miniSetReps.join(" + ")}`;
  if (log.dropReps != null)
    text += ` → ${formatWeight(log.dropWeightKg ?? null, units)} × ${log.dropReps}`;
  return text;
}

function toText(value: number | null): string {
  return value === null ? "" : String(value);
}

function sameNumbers(a: number[], b: number[]) {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}
