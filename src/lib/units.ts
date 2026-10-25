import { useSyncExternalStore } from "react";

/** Weights are always stored in kg; this only changes what's shown and typed. */
export type Units = "kg" | "lb";

const KEY = "workout-tracker:units";
const LB_PER_KG = 2.204_622_621_8;
const listeners = new Set<() => void>();

function read(): Units {
  try {
    return localStorage.getItem(KEY) === "lb" ? "lb" : "kg";
  } catch {
    return "kg";
  }
}

export function setUnits(units: Units) {
  try {
    localStorage.setItem(KEY, units);
  } catch {
    // Not persisted; still applied for this session.
  }
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useUnits(): Units {
  return useSyncExternalStore(subscribe, read, () => "kg");
}

/** kg → display units, rounded for display (kg to 0.01, lb to 0.1). */
export function toDisplay(kg: number, units: Units): number {
  return units === "kg" ? kg : Math.round(kg * LB_PER_KG * 10) / 10;
}

/** Display units → kg, rounded to 0.01. */
export function fromDisplay(value: number, units: Units): number {
  return units === "kg" ? value : Math.round((value / LB_PER_KG) * 100) / 100;
}
