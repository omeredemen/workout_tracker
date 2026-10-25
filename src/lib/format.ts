import { format } from "date-fns";
import { parseIsoDate } from "@/domain/dates";
import type { IsoDate } from "@/domain/types";

/** "Mon 19 Oct" */
export function formatShortDate(date: IsoDate): string {
  return format(parseIsoDate(date), "EEE d MMM");
}

/** "Monday 19 October" */
export function formatLongDate(date: IsoDate): string {
  return format(parseIsoDate(date), "EEEE d MMMM");
}

export function formatWeight(kg: number | null): string {
  return kg === null ? "BW" : `${Number(kg.toFixed(2))} kg`;
}

/** Accepts "52,5" as well as "52.5" (comma keyboards). Returns undefined if invalid, null if empty. */
export function parseWeight(input: string): number | null | undefined {
  const trimmed = input.trim().replace(",", ".");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 1000) return undefined;
  return Math.round(value * 100) / 100;
}

/** Whole reps, 0–200. Returns undefined if invalid, null if empty. */
export function parseReps(input: string): number | null | undefined {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value <= 200 ? value : undefined;
}
